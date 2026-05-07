from typing import Any, Dict

import joblib

from app.core.config import MODEL_PATH, VECTORIZER_PATH


try:
    vectorizer = joblib.load(VECTORIZER_PATH)
    model = joblib.load(MODEL_PATH)
    ML_AVAILABLE = True
    print("✓ Models loaded successfully")
except FileNotFoundError:
    print("⚠ Model files not found. Run training/train.py first.")
    ML_AVAILABLE = False


def predict_with_ml(text: str) -> Dict[str, Any]:
    """
    ML-based prediction using the trained model.
    Returns: {fake_probability, confidence, explanation}
    """
    if not ML_AVAILABLE:
        return {
            "fake_probability": 0.5,
            "confidence": 0.0,
            "explanation": "ML model unavailable"
        }

    try:
        # Vectorize input
        X = vectorizer.transform([text])

        # Get probabilities for both classes
        # Class 0 = Real, Class 1 = Fake
        probabilities = model.predict_proba(X)[0]

        fake_probability = float(probabilities[1])

        # Confidence = how far from 0.5 (uncertain)
        # Maximum confidence is 1.0 (completely certain), minimum is 0.0 (completely uncertain)
        confidence = abs(fake_probability - 0.5) * 2

        return {
            "fake_probability": round(fake_probability, 3),
            "confidence": round(confidence, 3),
            "explanation": f"ML model predicts {int(fake_probability * 100)}% likelihood of misinformation"
        }
    except Exception as e:
        print(f"ML prediction error: {e}")
        return {
            "fake_probability": 0.5,
            "confidence": 0.0,
            "explanation": f"ML error: {str(e)}"
        }
