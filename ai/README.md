# Sahay ML Intelligence

FastAPI service for optional Sahay ML features.

## Features

- Request intelligence: TF-IDF + Logistic Regression predicts canonical category and urgency.
- Duplicate detection: TF-IDF + cosine similarity against nearby open candidates.
- Volunteer ranking: hard-filtered eligible candidates are ranked with `ML_MODEL` when a real trained `volunteer_ranker_<version>.joblib` exists, otherwise with deterministic `BOOTSTRAP_RANKING`.
- Smart request search: TF-IDF semantic baseline ranks active request candidates without external paid APIs.

## Run

```bash
cd ai
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

Health: `GET http://localhost:8001/health`

## Training

```bash
python -m app.training.dataset_builder
python -m app.training.train_request_models
python -m app.training.train_volunteer_ranker
```

Bootstrap request data is generated under `ai/data/bootstrap_training_data.csv` when real request rows are not available. Do not treat bootstrap metrics as production accuracy.

Volunteer ranker training reads `ai/data/volunteer_ranker_training_data.csv`, requires `ML_RANKER_MIN_TRAINING_ROWS`, and prints `INSUFFICIENT_REAL_TRAINING_DATA` instead of synthesizing labels.

## Security

The AI service is intended for internal backend calls only. It does not need JWTs, emails, phone numbers, exact addresses, message text, raw coordinates, or secrets.
