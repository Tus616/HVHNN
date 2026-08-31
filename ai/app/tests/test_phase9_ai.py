from app.schemas import DuplicateDetectIn, RequestSearchCandidate, RequestSearchIn
from app.services.duplicate_detector import DuplicateDetector
from app.services.request_classifier import RequestClassifier
from app.services.request_search import RequestSearchService


def test_phase9_classifier_examples_are_canonical():
    classifier = RequestClassifier()
    examples = [
        ("Need O negative blood urgently", "Patient needs donor now", "BLOOD_DONATION", "HIGH"),
        ("Mother has fever and needs doctor", "Doctor nearby needed for fever", "MEDICAL", None),
        ("Need meals for stranded family", "Family needs food tonight", "FOOD", None),
        ("Need vehicle to reach hospital", "Need ride to hospital", "TRANSPORT", None),
        ("Person unconscious after road crash", "Life threatening accident", "EMERGENCY", "HIGH"),
        ("Need someone to help carry furniture", "Carry furniture upstairs", "GENERAL", None),
    ]
    for title, description, category, urgency in examples:
        result = classifier.predict(title, description)
        assert result["predictedCategory"] == category
        if urgency:
            assert result["predictedUrgency"] == urgency
        assert result["suggestionAvailable"] is True


def test_phase9_safety_guard_overrides_critical_urgency():
    result = RequestClassifier().predict("Need general help", "Person unconscious and can't breathe")
    assert result["predictedUrgency"] == "HIGH"
    assert result["urgencySource"] == "SAFETY_OVERRIDE"


def test_phase9_search_ranks_blood_above_unrelated():
    result = RequestSearchService().search(RequestSearchIn(
        query="blood donor near me",
        candidates=[
            RequestSearchCandidate(requestId="blood", title="O negative blood donor needed", description="Hospital needs blood", category="BLOOD_DONATION", status="OPEN"),
            RequestSearchCandidate(requestId="general", title="Carry furniture", description="Need help moving a cupboard", category="GENERAL", status="OPEN"),
        ],
    ))
    assert result["results"][0]["requestId"] == "blood"


def test_phase9_duplicate_detector_scores_near_similar_requests():
    result = DuplicateDetector().detect(DuplicateDetectIn(
        title="Need O negative blood donor",
        description="Patient needs O negative blood urgently at city hospital",
        category="BLOOD_DONATION",
        candidates=[
            {"id": "r1", "title": "O negative blood donor needed", "description": "Urgent blood donor needed at city hospital", "category": "BLOOD_DONATION", "status": "OPEN", "distanceKm": 1.8},
            {"id": "r2", "title": "Carry furniture", "description": "Need help moving a chair", "category": "GENERAL", "status": "OPEN", "distanceKm": 1.0},
        ],
    ))
    assert result["duplicateLikely"] is True
    assert result["matchingRequestId"] == "r1"


def test_phase9_duplicate_detector_rejects_unrelated_requests():
    result = DuplicateDetector().detect(DuplicateDetectIn(
        title="Need O negative blood donor",
        description="Patient needs O negative blood urgently",
        category="BLOOD_DONATION",
        candidates=[
            {"id": "r1", "title": "Carry furniture", "description": "Need help moving a chair", "category": "GENERAL", "status": "OPEN", "distanceKm": 1.0},
        ],
    ))
    assert result["duplicateLikely"] is False
