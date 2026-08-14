import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from app.config import DATA_DIR, ML_RANKER_MIN_TRAINING_ROWS, MODEL_DIR, VOLUNTEER_RANKER_VERSION
from app.services.volunteer_ranker import FEATURES


TRAINING_PATH = DATA_DIR / "volunteer_ranker_training_data.csv"


def read_rows(path: Path) -> tuple[list[list[float]], list[int]]:
    if not path.exists():
        return [], []
    rows = []
    labels = []
    with path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("successfulMatch") not in {"0", "1", 0, 1}:
                continue
            try:
                rows.append([float(row.get(feature, 0.0) or 0.0) for feature in FEATURES])
                labels.append(int(row["successfulMatch"]))
            except ValueError:
                continue
    return rows, labels


def evaluate(model, test_x, test_y) -> dict:
    predictions = model.predict(test_x)
    metrics = {
        "accuracy": round(float(accuracy_score(test_y, predictions)), 4),
        "precision": round(float(precision_score(test_y, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(test_y, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(test_y, predictions, zero_division=0)), 4),
    }
    if len(set(test_y)) > 1 and hasattr(model, "predict_proba"):
        metrics["rocAuc"] = round(float(roc_auc_score(test_y, model.predict_proba(test_x)[:, 1])), 4)
    top_k = min(5, len(test_y))
    if top_k > 0 and hasattr(model, "predict_proba"):
        ranked = sorted(zip(model.predict_proba(test_x)[:, 1], test_y), key=lambda item: item[0], reverse=True)[:top_k]
        metrics["successAtTopK"] = round(float(any(label == 1 for _, label in ranked)), 4)
        metrics["topK"] = top_k
    return metrics


def main() -> None:
    rows, labels = read_rows(TRAINING_PATH)
    positive_rows = sum(labels)
    negative_rows = len(labels) - positive_rows
    if len(rows) < ML_RANKER_MIN_TRAINING_ROWS or positive_rows == 0 or negative_rows == 0:
        print("INSUFFICIENT_REAL_TRAINING_DATA")
        print("trainingRows:", len(rows))
        print("positiveRows:", positive_rows)
        print("negativeRows:", negative_rows)
        print("rankingMode: BOOTSTRAP_RANKING")
        return

    train_x, test_x, train_y, test_y = train_test_split(
        rows,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )
    candidates = [
        ("HistGradientBoostingClassifier", HistGradientBoostingClassifier(random_state=42)),
        ("RandomForestClassifier", RandomForestClassifier(n_estimators=160, random_state=42, class_weight="balanced")),
    ]
    evaluated = []
    for name, model in candidates:
        model.fit(train_x, train_y)
        metrics = evaluate(model, test_x, test_y)
        selector = metrics.get("rocAuc", metrics["f1"])
        evaluated.append((selector, name, model, metrics))
    _, model_name, model, metrics = max(evaluated, key=lambda item: item[0])

    model_path = MODEL_DIR / f"volunteer_ranker_{VOLUNTEER_RANKER_VERSION}.joblib"
    joblib.dump(model, model_path)
    metadata = {
        "modelVersion": VOLUNTEER_RANKER_VERSION,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "trainingRows": len(rows),
        "positiveRows": positive_rows,
        "negativeRows": negative_rows,
        "features": FEATURES,
        "metrics": metrics,
        "rankingMode": "ML_MODEL",
        "modelType": model_name,
    }
    (MODEL_DIR / "volunteer_ranker_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
