from datetime import datetime, timezone

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import FeatureUnion

from app.config import ML_DUPLICATE_DISTANCE_KM, ML_DUPLICATE_OVERALL_THRESHOLD, ML_DUPLICATE_TEXT_THRESHOLD


class DuplicateDetector:
    def detect(self, payload) -> dict:
        threshold = payload.threshold or ML_DUPLICATE_OVERALL_THRESHOLD
        candidates = [
            candidate for candidate in payload.candidates
            if str(candidate.status or "OPEN").upper() == "OPEN"
            and (not payload.category or not candidate.category or payload.category == candidate.category)
        ]
        if not candidates:
            return {
                "duplicateLikely": False,
                "overallScore": 0.0,
                "textSimilarity": 0.0,
                "similarityScore": 0.0,
                "matchingRequestId": None,
                "matchingTitle": None,
                "distanceKm": None,
                "status": None,
                "threshold": threshold,
                "reason": None,
            }
        query = f"{payload.title} {payload.description}".strip()
        corpus = [query] + [f"{item.title} {item.description} {item.category or ''}".strip() for item in candidates]
        vectors = FeatureUnion([
            ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 3), min_df=1, sublinear_tf=True)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True)),
        ]).fit_transform(corpus)
        scores = cosine_similarity(vectors[0], vectors[1:]).flatten()
        ranked = []
        for index, candidate in enumerate(candidates):
            text_score = float(scores[index])
            category_score = 1.0 if payload.category and candidate.category and payload.category == candidate.category else 0.0
            distance_score = self._distance_score(candidate.distanceKm)
            recency_score = self._recency_score(candidate.createdAt)
            status_score = 1.0 if str(candidate.status or "OPEN").upper() == "OPEN" else 0.0
            overall = (text_score * 0.58) + (category_score * 0.16) + (distance_score * 0.14) + (status_score * 0.07) + (recency_score * 0.05)
            ranked.append((overall, text_score, candidate))
        overall, text_score, best = max(ranked, key=lambda item: item[0])
        duplicate_likely = overall >= threshold and text_score >= ML_DUPLICATE_TEXT_THRESHOLD
        reason = self._reason(best, overall, text_score)
        return {
            "duplicateLikely": duplicate_likely,
            "overallScore": round(float(overall), 4),
            "textSimilarity": round(float(text_score), 4),
            "similarityScore": round(float(text_score), 4),
            "matchingRequestId": best.id,
            "matchingTitle": best.title,
            "distanceKm": best.distanceKm,
            "status": best.status,
            "threshold": threshold,
            "reason": reason,
        }

    def _distance_score(self, distance_km: float | None) -> float:
        if distance_km is None:
            return 0.5
        if distance_km <= ML_DUPLICATE_DISTANCE_KM:
            return 1.0
        return max(0.0, 1.0 - ((distance_km - ML_DUPLICATE_DISTANCE_KM) / 20.0))

    def _recency_score(self, created_at: str | None) -> float:
        if not created_at:
            return 0.5
        try:
            normalized = created_at.replace("Z", "+00:00")
            created = datetime.fromisoformat(normalized)
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            minutes = max(0.0, (datetime.now(timezone.utc) - created.astimezone(timezone.utc)).total_seconds() / 60)
            return max(0.0, 1.0 - (minutes / (24 * 60)))
        except ValueError:
            return 0.5

    def _reason(self, candidate, overall: float, text_score: float) -> str:
        category = str(candidate.category or "request").lower().replace("_", " ")
        distance = f" {candidate.distanceKm:.1f} km away" if candidate.distanceKm is not None else ""
        return f"Highly similar {category} request{distance} with {text_score:.0%} text similarity."
