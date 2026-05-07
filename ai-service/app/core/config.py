from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "model.pkl"
VECTORIZER_PATH = MODEL_DIR / "vectorizer.pkl"

CORS_ORIGINS = ["*"]

