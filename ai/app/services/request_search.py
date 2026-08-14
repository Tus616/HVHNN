from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import ML_MAX_CANDIDATES, MODEL_VERSION


class RequestSearchService:
    implementation = "TF-IDF semantic baseline"

    def search(self, payload) -> dict:
        query = str(payload.query or "").strip()
        candidates = [
            candidate for candidate in payload.candidates[:ML_MAX_CANDIDATES]
            if str(candidate.status or "OPEN").upper() == "OPEN"
        ]
        if not query or not candidates:
            return {"modelVersion": MODEL_VERSION, "implementation": self.implementation, "results": []}

        corpus = [query] + [
            f"{item.title} {item.description} {item.category or ''}".strip()
            for item in candidates
        ]
        vectors = TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 3),
            min_df=1,
            sublinear_tf=True,
        ).fit_transform(corpus)
        scores = cosine_similarity(vectors[0], vectors[1:]).flatten()
        ranked = sorted(
            (
                {
                    "requestId": candidate.requestId,
                    "score": round(float(scores[index]), 4),
                }
                for index, candidate in enumerate(candidates)
            ),
            key=lambda item: item["score"],
            reverse=True,
        )
        return {
            "modelVersion": MODEL_VERSION,
            "implementation": self.implementation,
            "results": [
                {**item, "rank": index + 1}
                for index, item in enumerate(ranked)
                if item["score"] > 0
            ],
        }
