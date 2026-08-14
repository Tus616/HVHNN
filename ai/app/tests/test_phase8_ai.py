from app.schemas import DuplicateDetectIn, VolunteerCandidate, VolunteerRankIn
from app.services.duplicate_detector import DuplicateDetector
from app.services.request_classifier import RequestClassifier
from app.services.volunteer_ranker import VolunteerRanker


def test_request_classifier_returns_canonical_labels():
    result = RequestClassifier().predict("Need medicine delivery", "Elderly patient needs tablets from nearby pharmacy today")
    assert result["predictedCategory"] in {"BLOOD_DONATION", "MEDICAL", "FOOD", "TRANSPORT", "EMERGENCY", "GENERAL"}
    assert result["predictedUrgency"] in {"LOW", "MEDIUM", "HIGH"}


def test_duplicate_detector_finds_similar_text():
    result = DuplicateDetector().detect(DuplicateDetectIn(
        title="Need food packets",
        description="Families need cooked meals after flooding",
        category="FOOD",
        candidates=[{"id": "r1", "title": "Food packets needed", "description": "Flood affected families need meals", "category": "FOOD", "status": "OPEN"}],
    ))
    assert result["similarityScore"] > 0


def test_volunteer_ranker_orders_candidates():
    result = VolunteerRanker().rank(VolunteerRankIn(candidates=[
        VolunteerCandidate(userId="slow", distanceKm=20, categoryMatch=False, available=False),
        VolunteerCandidate(userId="near", distanceKm=1.2, categoryMatch=True, available=True, volunteerMode=True, completionRate=0.9, rating=4.8),
    ]))
    assert result["rankingMode"] == "BOOTSTRAP_RANKING"
    assert result["rankedVolunteers"][0]["userId"] == "near"
