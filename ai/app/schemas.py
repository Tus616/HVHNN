from typing import Any

from pydantic import BaseModel, Field, model_validator


class RequestPredictionIn(BaseModel):
    title: str = Field(default="", max_length=180)
    description: str = Field(default="", max_length=4000)


class RequestPredictionOut(BaseModel):
    predictedCategory: str
    categoryConfidence: float
    predictedUrgency: str
    urgencyConfidence: float
    suggestionAvailable: bool
    categorySuggestionAvailable: bool
    urgencySuggestionAvailable: bool
    urgencySource: str
    safetyReason: str | None = None
    modelVersion: str
    bootstrapDataUsed: bool


class DuplicateCandidate(BaseModel):
    id: str
    title: str = ""
    description: str = ""
    category: str | None = None
    status: str | None = None
    city: str | None = None
    district: str | None = None
    state: str | None = None
    distanceKm: float | None = None
    createdAt: str | None = None


class DuplicateDetectIn(BaseModel):
    title: str = Field(default="", max_length=180)
    description: str = Field(default="", max_length=4000)
    category: str | None = None
    city: str | None = None
    district: str | None = None
    state: str | None = None
    threshold: float | None = None
    candidates: list[DuplicateCandidate] = Field(default_factory=list)


class DuplicateDetectOut(BaseModel):
    duplicateLikely: bool
    overallScore: float
    textSimilarity: float
    similarityScore: float
    matchingRequestId: str | None = None
    matchingTitle: str | None = None
    distanceKm: float | None = None
    status: str | None = None
    threshold: float
    reason: str | None = None


class RequestSearchCandidate(BaseModel):
    requestId: str
    title: str = ""
    description: str = ""
    category: str | None = None
    status: str | None = None


class RequestSearchIn(BaseModel):
    query: str = Field(default="", max_length=400)
    candidates: list[RequestSearchCandidate] = Field(default_factory=list)


class RequestSearchResult(BaseModel):
    requestId: str
    score: float
    rank: int


class RequestSearchOut(BaseModel):
    modelVersion: str
    implementation: str
    results: list[RequestSearchResult]


class VolunteerCandidate(BaseModel):
    userId: str
    distanceKm: float | None = None
    categoryMatch: bool = False
    skillMatch: bool = True
    available: bool = False
    availabilityMatch: bool = False
    volunteerMode: bool = False
    completedHelps: int = 0
    acceptanceCount: int = 0
    completionRate: float = 0.0
    acceptanceRate: float = 0.0
    historicalSuccessForCategory: float = 0.0
    historicalSuccessForArea: float = 0.0
    rating: float = 0.0
    sameCity: bool = False
    sameDistrict: bool = False
    recentActivityDays: float | None = None


class VolunteerRankIn(BaseModel):
    request: dict[str, Any] | None = None
    requestId: str | None = None
    category: str | None = None
    urgency: str | None = None
    candidates: list[VolunteerCandidate] = Field(default_factory=list)
    eligibleCandidates: list[VolunteerCandidate] = Field(default_factory=list)

    @model_validator(mode="after")
    def normalize_payload(self):
        if not self.candidates and self.eligibleCandidates:
            self.candidates = self.eligibleCandidates
        if self.request:
            self.requestId = self.requestId or self.request.get("requestId") or self.request.get("id")
            self.category = self.category or self.request.get("category")
            self.urgency = self.urgency or self.request.get("urgency")
        return self


class RankedVolunteer(BaseModel):
    userId: str
    rank: int
    matchScore: int
    score: float
    reasons: list[str]


class VolunteerRankOut(BaseModel):
    rankingMode: str
    modelVersion: str
    rankedVolunteers: list[RankedVolunteer]


class HealthOut(BaseModel):
    status: str
    modelVersion: str
    modelsLoaded: dict[str, bool]
    metadata: dict[str, Any]
