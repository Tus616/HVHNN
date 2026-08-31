import json

import joblib

from app.config import MODEL_DIR, VOLUNTEER_RANKER_VERSION


URGENCY_WEIGHT = {"LOW": 0.9, "MEDIUM": 1.0, "HIGH": 1.12, "CRITICAL": 1.18}
FEATURES = [
    "distanceScore",
    "categoryMatch",
    "skillMatch",
    "availabilityMatch",
    "volunteerMode",
    "sameCity",
    "sameDistrict",
    "completionRate",
    "acceptanceRate",
    "completedHelpsScore",
    "acceptedHelpsScore",
    "ratingScore",
    "recentActivityScore",
    "historicalSuccessForCategory",
    "historicalSuccessForArea",
    "urgencyScore",
]


class VolunteerRanker:
    def __init__(self) -> None:
        self.model = None
        self.metadata = {}
        self.load_model()

    def load_model(self) -> None:
        model_path = MODEL_DIR / f"volunteer_ranker_{VOLUNTEER_RANKER_VERSION}.joblib"
        metadata_path = MODEL_DIR / "volunteer_ranker_metadata.json"
        if model_path.exists():
            self.model = joblib.load(model_path)
            if metadata_path.exists():
                self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    def rank(self, payload) -> dict:
        eligible = [
            candidate for candidate in payload.candidates
            if candidate.volunteerMode and candidate.categoryMatch and candidate.skillMatch
            and (candidate.available or candidate.availabilityMatch)
        ]
        if not eligible:
            return {"rankingMode": "BOOTSTRAP_RANKING", "modelVersion": VOLUNTEER_RANKER_VERSION, "rankedVolunteers": []}
        if self.model is not None:
            try:
                return self._rank_with_model(payload, eligible)
            except Exception:
                pass
        return self._rank_fallback(payload, eligible)

    def _rank_with_model(self, payload, candidates) -> dict:
        rows = [self._features(candidate, payload.urgency) for candidate in candidates]
        probabilities = self.model.predict_proba(rows)[:, 1]
        ranked = []
        for candidate, probability in zip(candidates, probabilities):
            score = float(max(0.0, min(1.0, probability)))
            ranked.append({
                "userId": candidate.userId,
                "score": round(score, 4),
                "matchScore": int(round(score * 100)),
                "reasons": self._reasons(candidate),
            })
        ranked.sort(key=lambda item: item["score"], reverse=True)
        for index, item in enumerate(ranked, start=1):
            item["rank"] = index
        return {"rankingMode": "ML_MODEL", "modelVersion": VOLUNTEER_RANKER_VERSION, "rankedVolunteers": ranked}

    def _rank_fallback(self, payload, candidates) -> dict:
        ranked = []
        urgency_factor = URGENCY_WEIGHT.get(str(payload.urgency or "MEDIUM").upper(), 1.0)
        for candidate in candidates:
            features = self._feature_map(candidate, payload.urgency)
            score = (
                0.22 * features["categoryMatch"]
                + 0.08 * features["skillMatch"]
                + 0.18 * features["availabilityMatch"]
                + 0.18 * features["distanceScore"]
                + 0.10 * features["completionRate"]
                + 0.08 * features["acceptanceRate"]
                + 0.05 * features["recentActivityScore"]
                + 0.04 * features["sameCity"]
                + 0.03 * features["sameDistrict"]
                + 0.02 * features["historicalSuccessForCategory"]
                + 0.02 * features["ratingScore"]
            ) * urgency_factor
            normalized = min(score, 1.0)
            ranked.append({
                "userId": candidate.userId,
                "score": round(normalized, 4),
                "matchScore": int(round(normalized * 100)),
                "reasons": self._reasons(candidate),
            })
        ranked.sort(key=lambda item: item["score"], reverse=True)
        for index, item in enumerate(ranked, start=1):
            item["rank"] = index
        return {"rankingMode": "BOOTSTRAP_RANKING", "modelVersion": VOLUNTEER_RANKER_VERSION, "rankedVolunteers": ranked}

    def _features(self, candidate, urgency) -> list[float]:
        values = self._feature_map(candidate, urgency)
        return [values[name] for name in FEATURES]

    def _feature_map(self, candidate, urgency) -> dict[str, float]:
        distance = 25.0 if candidate.distanceKm is None else max(candidate.distanceKm, 0.0)
        recent_days = 30.0 if candidate.recentActivityDays is None else max(candidate.recentActivityDays, 0.0)
        return {
            "distanceScore": 1.0 / (1.0 + distance / 5.0),
            "categoryMatch": 1.0 if candidate.categoryMatch else 0.0,
            "skillMatch": 1.0 if candidate.skillMatch else 0.0,
            "availabilityMatch": 1.0 if (candidate.available or candidate.availabilityMatch) else 0.0,
            "volunteerMode": 1.0 if candidate.volunteerMode else 0.0,
            "sameCity": 1.0 if candidate.sameCity else 0.0,
            "sameDistrict": 1.0 if candidate.sameDistrict else 0.0,
            "completionRate": self._clamp(candidate.completionRate),
            "acceptanceRate": self._clamp(candidate.acceptanceRate),
            "completedHelpsScore": min(max(candidate.completedHelps, 0), 20) / 20,
            "acceptedHelpsScore": min(max(candidate.acceptanceCount, 0), 30) / 30,
            "ratingScore": self._clamp((candidate.rating or 0.0) / 5.0),
            "recentActivityScore": max(0.0, 1.0 - recent_days / 30.0),
            "historicalSuccessForCategory": self._clamp(candidate.historicalSuccessForCategory),
            "historicalSuccessForArea": self._clamp(candidate.historicalSuccessForArea),
            "urgencyScore": self._clamp(URGENCY_WEIGHT.get(str(urgency or "MEDIUM").upper(), 1.0) / 1.18),
        }

    def _reasons(self, candidate) -> list[str]:
        reasons = []
        if candidate.categoryMatch:
            reasons.append("Matches request category")
        if candidate.distanceKm is not None:
            reasons.append(f"{candidate.distanceKm:.1f} km away")
        if candidate.available or candidate.availabilityMatch:
            reasons.append("Available now")
        if candidate.completionRate >= 0.75:
            reasons.append(f"{round(candidate.completionRate * 100)}% completion reliability")
        elif candidate.completedHelps > 0:
            reasons.append("Has completed help history")
        if candidate.historicalSuccessForCategory >= 0.7:
            reasons.append("Strong history with similar requests")
        if len(reasons) < 2 and candidate.sameCity:
            reasons.append("Same city")
        if len(reasons) < 2:
            reasons.append("Eligible volunteer")
        return reasons[:4]

    def _clamp(self, value: float | None) -> float:
        return min(max(float(value or 0.0), 0.0), 1.0)
