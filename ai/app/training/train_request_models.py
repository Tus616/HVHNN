from pathlib import Path

from app.services.request_classifier import RequestClassifier, ensure_bootstrap_data


if __name__ == "__main__":
    classifier = RequestClassifier()
    metadata = classifier.train_from_csv(Path(ensure_bootstrap_data()), bootstrap=True)
    print("bootstrap rows:", metadata["bootstrapRows"])
    print("real training rows:", metadata["realTrainingRows"])
    print("category accuracy:", metadata["metrics"]["category"]["accuracy"])
    print("category macro F1:", metadata["metrics"]["category"]["macroF1"])
    print("urgency accuracy:", metadata["metrics"]["urgency"]["accuracy"])
    print("urgency macro F1:", metadata["metrics"]["urgency"]["macroF1"])
    print("BOOTSTRAP DATA USED")
