import csv
import os
from pathlib import Path

from pymongo import MongoClient


def main() -> None:
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/hvhn")
    db_name = os.getenv("MONGODB_DB_NAME", "hvhn")
    out_dir = Path(__file__).resolve().parents[2] / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    client = MongoClient(uri, serverSelectionTimeoutMS=2500)
    db = client[db_name]
    request_path = out_dir / "request_training_data.csv"
    with request_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["title", "description", "category", "urgency"])
        for request in db.help_requests.find({}, {"title": 1, "description": 1, "category": 1, "urgency": 1}):
            writer.writerow([
                request.get("title", ""),
                request.get("description", ""),
                request.get("category", ""),
                request.get("urgency", ""),
            ])
    event_path = out_dir / "volunteer_ranker_training_data.csv"
    with event_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        features = [
            "distanceScore", "categoryMatch", "skillMatch", "availabilityMatch", "volunteerMode",
            "sameCity", "sameDistrict", "completionRate", "acceptanceRate", "completedHelpsScore",
            "acceptedHelpsScore", "ratingScore", "recentActivityScore", "historicalSuccessForCategory",
            "historicalSuccessForArea", "urgencyScore", "successfulMatch",
        ]
        writer.writerow(features)
        for event in db.ml_matching_events.find({}, {"requestId": 1, "candidateUserId": 1, "accepted": 1, "completed": 1}):
            request = db.help_requests.find_one({"_id": event.get("requestId")}) or {}
            user = db.users.find_one({"_id": event.get("candidateUserId")}) or {}
            status_rows = list(db.request_volunteers.find({"volunteerId": event.get("candidateUserId")}, {"status": 1}))
            accepted = sum(1 for row in status_rows if str(row.get("status", "")).upper() in {"ACCEPTED", "COMPLETED"})
            completed = sum(1 for row in status_rows if str(row.get("status", "")).upper() == "COMPLETED")
            total = len(status_rows)
            distance = float(event.get("distanceKm") or 25.0)
            urgency = str(request.get("urgency") or "MEDIUM").upper()
            urgency_score = {"LOW": 0.76, "MEDIUM": 0.85, "HIGH": 0.95, "CRITICAL": 1.0}.get(urgency, 0.85)
            category = str(request.get("category") or "").upper()
            categories = {str(value).upper() for value in user.get("volunteerCategories", [])}
            writer.writerow([
                round(1.0 / (1.0 + max(distance, 0.0) / 5.0), 4),
                1.0 if category in categories else 0.0,
                1.0,
                1.0 if str(user.get("volunteerStatus", "")).upper() == "ONLINE" or user.get("isAlwaysAvailable") else 0.0,
                1.0 if user.get("isVolunteer") is True else 0.0,
                1.0 if request.get("city") and request.get("city") == user.get("city") else 0.0,
                1.0 if request.get("district") and request.get("district") == user.get("district") else 0.0,
                round(completed / accepted, 4) if accepted else 0.0,
                round(accepted / total, 4) if total else 0.0,
                min(completed, 20) / 20,
                min(accepted, 30) / 30,
                min(float(user.get("rating") or 0.0) / 5.0, 1.0),
                0.0,
                0.0,
                0.0,
                urgency_score,
                1 if event.get("completed") is True else 0,
            ])
    print(f"Wrote {request_path}")
    print(f"Wrote {event_path}")


if __name__ == "__main__":
    main()
