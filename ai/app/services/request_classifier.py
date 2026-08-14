import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

from app.config import (
    CATEGORIES,
    DATA_DIR,
    ML_CATEGORY_CONFIDENCE_THRESHOLD,
    ML_URGENCY_CONFIDENCE_THRESHOLD,
    MODEL_DIR,
    MODEL_VERSION,
    URGENCIES,
)


BOOTSTRAP_ROWS = [
    ("Urgently need O negative blood donor at hospital", "Patient at district hospital needs O negative blood before surgery", "BLOOD_DONATION", "HIGH"),
    ("B positive blood donor required", "Need two units of B positive blood at AIIMS blood bank tonight", "BLOOD_DONATION", "HIGH"),
    ("A positive blood needed for operation", "Family is searching for A positive donor for scheduled operation tomorrow", "BLOOD_DONATION", "MEDIUM"),
    ("Platelet donor needed near city hospital", "Dengue patient needs platelet donation from eligible donor today", "BLOOD_DONATION", "HIGH"),
    ("AB negative blood donor request", "Rare blood group donor needed at hospital blood bank", "BLOOD_DONATION", "HIGH"),
    ("Blood donor for morning transfusion", "Doctor asked family to arrange blood donor by morning", "BLOOD_DONATION", "MEDIUM"),
    ("O positive donor needed", "Need O positive blood donor for patient admitted in ward", "BLOOD_DONATION", "MEDIUM"),
    ("Can someone donate blood tomorrow", "Hospital has asked for a matching blood donor for transfusion", "BLOOD_DONATION", "LOW"),
    ("Need a doctor for my mother who has high fever", "Mother has fever and weakness and needs doctor or nurse guidance", "MEDICAL", "HIGH"),
    ("Need medicine delivery for elderly parent", "Diabetes and blood pressure tablets must be picked up from pharmacy", "MEDICAL", "MEDIUM"),
    ("Nurse needed for wound dressing", "Elderly patient needs dressing change and basic medical care at home", "MEDICAL", "MEDIUM"),
    ("Need help arranging clinic appointment", "Child has cough and fever and needs nearby clinic consultation", "MEDICAL", "MEDIUM"),
    ("Medical support for asthma patient", "Inhaler is finished and breathing problem is getting worse", "MEDICAL", "HIGH"),
    ("Need wheelchair after surgery", "Patient discharged from hospital needs wheelchair for a few days", "MEDICAL", "LOW"),
    ("Doctor consultation needed today", "Senior citizen has dizziness and needs medical advice quickly", "MEDICAL", "HIGH"),
    ("Need thermometer and basic medicines", "Family needs paracetamol and ORS for sick child", "MEDICAL", "LOW"),
    ("Need food packets for 10 people", "Ten workers need cooked food packets tonight", "FOOD", "MEDIUM"),
    ("Meals needed for stranded family", "Family stuck near bus stand needs dinner and drinking water", "FOOD", "HIGH"),
    ("Groceries for senior citizen", "Need rice dal milk and vegetables delivered this week", "FOOD", "LOW"),
    ("Lunch distribution volunteers needed", "Community kitchen needs help packing and giving lunch packets", "FOOD", "MEDIUM"),
    ("Baby food and milk required", "Mother needs milk powder and biscuits for children", "FOOD", "MEDIUM"),
    ("Ration kit needed urgently", "Flood affected family has no dry ration left", "FOOD", "HIGH"),
    ("Need drinking water cans", "Apartment block has no water and needs drinking water cans", "FOOD", "MEDIUM"),
    ("Tea and snacks for night volunteers", "Relief volunteers need simple food during night duty", "FOOD", "LOW"),
    ("Need a ride to the railway station", "Need transport to railway station with luggage this evening", "TRANSPORT", "LOW"),
    ("Ambulance or car to hospital needed", "Patient must be taken to hospital quickly and cab is not available", "TRANSPORT", "HIGH"),
    ("Need vehicle to move relief supplies", "Rice bags and blankets need pickup from donor location", "TRANSPORT", "MEDIUM"),
    ("Bike pickup for medicines", "Need someone to collect medicines from pharmacy and bring them home", "TRANSPORT", "MEDIUM"),
    ("Ride home from clinic", "Senior citizen needs safe ride back after appointment", "TRANSPORT", "LOW"),
    ("Transport for wheelchair patient", "Need car with space to take patient for checkup", "TRANSPORT", "MEDIUM"),
    ("Need tempo for shifting donated items", "Boxes of clothes must be moved to community hall", "TRANSPORT", "LOW"),
    ("Urgent vehicle for accident patient", "Need immediate transport to emergency ward", "TRANSPORT", "HIGH"),
    ("Person unconscious after accident immediate help required", "Road accident victim is unconscious and needs immediate help", "EMERGENCY", "HIGH"),
    ("Building fire evacuation help", "Smoke in apartment corridor and elderly residents need evacuation", "EMERGENCY", "HIGH"),
    ("Child missing near market", "Need nearby people to help search immediately", "EMERGENCY", "HIGH"),
    ("Flood water entering homes", "Families are trapped and need urgent rescue coordination", "EMERGENCY", "HIGH"),
    ("Gas leak smell in building", "Residents need quick safety help and evacuation support", "EMERGENCY", "HIGH"),
    ("Electric wire fallen on road", "Live wire is blocking lane and people may get hurt", "EMERGENCY", "HIGH"),
    ("Elderly person locked inside", "Senior citizen is not responding and door is locked", "EMERGENCY", "HIGH"),
    ("Night safety check after power cut", "Need volunteers to check old residents during outage", "EMERGENCY", "MEDIUM"),
    ("Need help moving some boxes", "Need two neighbours to lift boxes to the first floor", "GENERAL", "LOW"),
    ("Need help filling online form", "Senior citizen needs support submitting a government form", "GENERAL", "LOW"),
    ("Need volunteers to organize contact list", "Community needs help calling residents and updating a sheet", "GENERAL", "MEDIUM"),
    ("Help needed cleaning community hall", "After event cleanup needs a few volunteers tomorrow", "GENERAL", "LOW"),
    ("Need someone to stand in queue", "Need help collecting a document from local office", "GENERAL", "LOW"),
    ("Need translation help", "Family needs Hindi English translation for hospital desk", "GENERAL", "MEDIUM"),
    ("Need help setting up relief desk", "Volunteers needed to arrange tables chairs and registers", "GENERAL", "MEDIUM"),
    ("Need help finding lost bag", "Please ask nearby residents to check gate and parking area", "GENERAL", "LOW"),
    ("Need O negative blood urgently", "Patient needs O negative blood donor immediately", "BLOOD_DONATION", "HIGH"),
    ("Mother has fever and needs doctor", "Mother has fever and needs a doctor nearby", "MEDICAL", "MEDIUM"),
    ("Need meals for stranded family", "Family is stranded and needs meals tonight", "FOOD", "MEDIUM"),
    ("Need vehicle to reach hospital", "Need vehicle to reach hospital for patient", "TRANSPORT", "HIGH"),
    ("Person unconscious after road crash", "Person unconscious after road crash and needs immediate help", "EMERGENCY", "HIGH"),
    ("Need someone to help carry furniture", "Need help carrying furniture to another room", "GENERAL", "LOW"),
]

CRITICAL_SIGNALS = {
    "unconscious": "contains critical signal: unconscious",
    "severe bleeding": "contains critical signal: severe bleeding",
    "accident": "contains critical signal: accident",
    "road crash": "contains critical signal: road crash",
    "can't breathe": "contains critical signal: can't breathe",
    "cant breathe": "contains critical signal: can't breathe",
    "life threatening": "contains critical signal: life threatening",
}


def _bootstrap_path() -> Path:
    return DATA_DIR / "bootstrap_training_data.csv"


def ensure_bootstrap_data() -> Path:
    path = _bootstrap_path()
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["title", "description", "category", "urgency"])
        for title, description, category, urgency in BOOTSTRAP_ROWS:
            writer.writerow([title, description, category, urgency])
    return path


class RequestClassifier:
    def __init__(self) -> None:
        self.category_model = None
        self.urgency_model = None
        self.metadata = {}
        self.load_or_train()

    def load_or_train(self) -> None:
        category_path = MODEL_DIR / f"category_classifier_{MODEL_VERSION}.joblib"
        urgency_path = MODEL_DIR / f"urgency_classifier_{MODEL_VERSION}.joblib"
        metadata_path = MODEL_DIR / "model_metadata.json"
        if category_path.exists() and urgency_path.exists():
            self.category_model = joblib.load(category_path)
            self.urgency_model = joblib.load(urgency_path)
            if metadata_path.exists():
                self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            return
        self.train_from_csv(ensure_bootstrap_data(), bootstrap=True)

    def train_from_csv(self, csv_path: Path, bootstrap: bool) -> dict:
        rows = []
        with csv_path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row.get("category") in CATEGORIES and row.get("urgency") in URGENCIES:
                    rows.append(row)
        texts = [(row["title"] + " " + row["description"]).strip() for row in rows]
        categories = [row["category"] for row in rows]
        urgencies = [row["urgency"] for row in rows]
        test_size = 0.33 if len(rows) >= 12 else 0.25
        train_x, test_x, train_c, test_c, train_u, test_u = train_test_split(
            texts, categories, urgencies, test_size=test_size, random_state=42, stratify=categories
        )
        features = FeatureUnion([
            ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 3), min_df=1, max_features=4000, sublinear_tf=True)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, max_features=2500, sublinear_tf=True)),
        ])
        category_model = Pipeline([
            ("features", features),
            ("clf", LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")),
        ])
        urgency_model = Pipeline([
            ("features", FeatureUnion([
                ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 3), min_df=1, max_features=4000, sublinear_tf=True)),
                ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, max_features=2500, sublinear_tf=True)),
            ])),
            ("clf", LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")),
        ])
        category_model.fit(train_x, train_c)
        urgency_model.fit(train_x, train_u)
        category_pred = category_model.predict(test_x)
        urgency_pred = urgency_model.predict(test_x)
        metrics = {
            "category": {
                "accuracy": round(float(accuracy_score(test_c, category_pred)), 4),
                "macroF1": round(float(f1_score(test_c, category_pred, average="macro", zero_division=0)), 4),
                "perClassF1": {
                    label: round(float(score), 4)
                    for label, score in zip(CATEGORIES, f1_score(test_c, category_pred, labels=CATEGORIES, average=None, zero_division=0))
                },
                "confusionMatrixLabels": CATEGORIES,
                "confusionMatrix": confusion_matrix(test_c, category_pred, labels=CATEGORIES).tolist(),
            },
            "urgency": {
                "accuracy": round(float(accuracy_score(test_u, urgency_pred)), 4),
                "macroF1": round(float(f1_score(test_u, urgency_pred, average="macro", zero_division=0)), 4),
                "perClassF1": {
                    label: round(float(score), 4)
                    for label, score in zip(URGENCIES, f1_score(test_u, urgency_pred, labels=URGENCIES, average=None, zero_division=0))
                },
                "confusionMatrixLabels": URGENCIES,
                "confusionMatrix": confusion_matrix(test_u, urgency_pred, labels=URGENCIES).tolist(),
            },
        }
        self.category_model = category_model
        self.urgency_model = urgency_model
        joblib.dump(category_model, MODEL_DIR / f"category_classifier_{MODEL_VERSION}.joblib")
        joblib.dump(urgency_model, MODEL_DIR / f"urgency_classifier_{MODEL_VERSION}.joblib")
        self.metadata = {
            "modelName": "TF-IDF + LogisticRegression request intelligence",
            "modelVersion": MODEL_VERSION,
            "trainedAt": datetime.now(timezone.utc).isoformat(),
            "realTrainingRows": 0 if bootstrap else len(rows),
            "bootstrapRows": len(rows) if bootstrap else 0,
            "featureConfig": {
                "textFields": ["title", "description"],
                "wordNgrams": [1, 3],
                "charNgrams": [3, 5],
                "classWeight": "balanced",
                "randomState": 42,
            },
            "metrics": metrics,
            "bootstrapDataUsed": bootstrap,
        }
        (MODEL_DIR / "model_metadata.json").write_text(json.dumps(self.metadata, indent=2), encoding="utf-8")
        return self.metadata

    def predict(self, title: str, description: str) -> dict:
        text = f"{title or ''} {description or ''}".strip()[:4200]
        category_probs = self.category_model.predict_proba([text])[0]
        urgency_probs = self.urgency_model.predict_proba([text])[0]
        category_index = int(category_probs.argmax())
        urgency_index = int(urgency_probs.argmax())
        predicted_urgency = str(self.urgency_model.classes_[urgency_index])
        urgency_source = "MODEL"
        safety_reason = None
        lowered = text.lower()
        for signal, reason in CRITICAL_SIGNALS.items():
            if signal in lowered:
                predicted_urgency = "HIGH"
                urgency_source = "SAFETY_OVERRIDE"
                safety_reason = reason
                break
        category_confidence = round(float(category_probs[category_index]), 4)
        urgency_confidence = round(float(urgency_probs[urgency_index]), 4)
        category_available = category_confidence >= ML_CATEGORY_CONFIDENCE_THRESHOLD
        urgency_available = urgency_confidence >= ML_URGENCY_CONFIDENCE_THRESHOLD or urgency_source == "SAFETY_OVERRIDE"
        return {
            "predictedCategory": self.category_model.classes_[category_index],
            "categoryConfidence": category_confidence,
            "predictedUrgency": predicted_urgency,
            "urgencyConfidence": urgency_confidence,
            "suggestionAvailable": bool(category_available or urgency_available),
            "categorySuggestionAvailable": bool(category_available),
            "urgencySuggestionAvailable": bool(urgency_available),
            "urgencySource": urgency_source,
            "safetyReason": safety_reason,
            "modelVersion": MODEL_VERSION,
            "bootstrapDataUsed": bool(self.metadata.get("bootstrapDataUsed", True)),
        }
