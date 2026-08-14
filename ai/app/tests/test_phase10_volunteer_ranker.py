import numpy as np

from app.schemas import VolunteerCandidate, VolunteerRankIn
from app.services.volunteer_ranker import VolunteerRanker


def test_ineligible_volunteer_never_enters_ranking():
    result = VolunteerRanker().rank(VolunteerRankIn(candidates=[
        VolunteerCandidate(userId="off", distanceKm=0.5, categoryMatch=True, available=False, volunteerMode=True),
        VolunteerCandidate(userId="wrong", distanceKm=0.5, categoryMatch=False, available=True, volunteerMode=True),
        VolunteerCandidate(userId="ok", distanceKm=2.0, categoryMatch=True, skillMatch=True, available=True, volunteerMode=True),
    ]))
    assert [item["userId"] for item in result["rankedVolunteers"]] == ["ok"]


def test_fallback_prefers_close_relevant_available_reliable_candidate():
    result = VolunteerRanker().rank(VolunteerRankIn(urgency="HIGH", candidates=[
        VolunteerCandidate(userId="weak", distanceKm=18, categoryMatch=True, available=True, volunteerMode=True, completionRate=0.1, acceptanceRate=0.1),
        VolunteerCandidate(userId="strong", distanceKm=1.7, categoryMatch=True, available=True, volunteerMode=True, completionRate=0.92, acceptanceRate=0.8, sameCity=True),
    ]))
    top = result["rankedVolunteers"][0]
    assert result["rankingMode"] == "BOOTSTRAP_RANKING"
    assert top["userId"] == "strong"
    assert 0 <= top["matchScore"] <= 100
    assert 2 <= len(top["reasons"]) <= 4


class FakeModel:
    def predict_proba(self, rows):
        return np.array([[0.2, row[0]] for row in rows])


def test_model_path_works_if_model_exists():
    ranker = VolunteerRanker()
    ranker.model = FakeModel()
    result = ranker.rank(VolunteerRankIn(candidates=[
        VolunteerCandidate(userId="far", distanceKm=20, categoryMatch=True, available=True, volunteerMode=True),
        VolunteerCandidate(userId="near", distanceKm=1, categoryMatch=True, available=True, volunteerMode=True),
    ]))
    assert result["rankingMode"] == "ML_MODEL"
    assert result["rankedVolunteers"][0]["userId"] == "near"
