from app.schemas import DuplicateDetectIn, RequestSearchCandidate, RequestSearchIn
from app.services.duplicate_detector import DuplicateDetector
from app.services.request_classifier import RequestClassifier
from app.services.request_search import RequestSearchService


def main() -> None:
    classifier = RequestClassifier()
    metadata = classifier.metadata
    print("Category:")
    print("accuracy:", metadata.get("metrics", {}).get("category", {}).get("accuracy"))
    print("macro F1:", metadata.get("metrics", {}).get("category", {}).get("macroF1"))
    print("per-class F1:", metadata.get("metrics", {}).get("category", {}).get("perClassF1"))
    print("Urgency:")
    print("accuracy:", metadata.get("metrics", {}).get("urgency", {}).get("accuracy"))
    print("macro F1:", metadata.get("metrics", {}).get("urgency", {}).get("macroF1"))
    search = RequestSearchService().search(RequestSearchIn(
        query="blood donor near me",
        candidates=[
            RequestSearchCandidate(requestId="blood", title="O negative blood donor needed", description="Hospital needs blood", category="BLOOD_DONATION", status="OPEN"),
            RequestSearchCandidate(requestId="general", title="Carry furniture", description="Need help moving a cupboard", category="GENERAL", status="OPEN"),
        ],
    ))
    duplicate = DuplicateDetector().detect(DuplicateDetectIn(
        title="Need O negative blood donor",
        description="Patient needs O negative blood urgently at city hospital",
        category="BLOOD_DONATION",
        candidates=[{"id": "r1", "title": "O negative blood donor needed", "description": "Urgent blood donor needed at city hospital", "category": "BLOOD_DONATION", "status": "OPEN", "distanceKm": 1.8}],
    ))
    print("Search sanity top result:", search["results"][0]["requestId"] if search["results"] else None)
    print("Duplicate detection manually-labelled sanity:", duplicate["duplicateLikely"], duplicate["overallScore"])


if __name__ == "__main__":
    main()
