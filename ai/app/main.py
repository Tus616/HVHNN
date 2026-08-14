from fastapi import FastAPI
from pydantic import BaseModel

from app.config import MODEL_VERSION, VOLUNTEER_RANKER_VERSION
from app.schemas import (
    DuplicateDetectIn,
    DuplicateDetectOut,
    HealthOut,
    RequestPredictionIn,
    RequestPredictionOut,
    RequestSearchIn,
    RequestSearchOut,
    VolunteerRankIn,
    VolunteerRankOut,
)
from app.services.duplicate_detector import DuplicateDetector
from app.services.request_classifier import RequestClassifier
from app.services.request_search import RequestSearchService
from app.services.volunteer_ranker import VolunteerRanker

app = FastAPI(title="Sahay ML Intelligence", version=MODEL_VERSION)
classifier = RequestClassifier()
duplicate_detector = DuplicateDetector()
request_search = RequestSearchService()
volunteer_ranker = VolunteerRanker()


@app.get("/health", response_model=HealthOut)
def health():
    return {
        "status": "ok",
        "modelVersion": MODEL_VERSION,
        "modelsLoaded": {
            "category": classifier.category_model is not None,
            "urgency": classifier.urgency_model is not None,
            "requestSearch": True,
            "volunteerRanker": volunteer_ranker.model is not None,
        },
        "metadata": {**classifier.metadata, "volunteerRanker": volunteer_ranker.metadata or {"modelVersion": VOLUNTEER_RANKER_VERSION, "rankingMode": "BOOTSTRAP_RANKING"}},
    }


@app.post("/predict/request", response_model=RequestPredictionOut)
def predict_request(payload: dict):
    title = payload.get("title", "")
    description = payload.get("description", "")
    if isinstance(title, BaseModel):
        title = title.model_dump()
    if isinstance(description, BaseModel):
        description = description.model_dump()
    return classifier.predict(str(title or ""), str(description or ""))


@app.post("/detect/duplicate", response_model=DuplicateDetectOut)
def detect_duplicate(payload: DuplicateDetectIn):
    return duplicate_detector.detect(payload)


@app.post("/search/requests", response_model=RequestSearchOut)
def search_requests(payload: RequestSearchIn):
    return request_search.search(payload)


@app.post("/rank/volunteers", response_model=VolunteerRankOut)
def rank_volunteers(payload: VolunteerRankIn):
    return volunteer_ranker.rank(payload)
