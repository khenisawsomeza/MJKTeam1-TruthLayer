import os
import re
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from external_ai import external_ai_score

app = FastAPI()

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PostData(BaseModel):
    text: str
    source_score: float = 50.0  # Default to 50 if not provided


# Load ML model
try:
    vectorizer = joblib.load('vectorizer.pkl')
    model = joblib.load('model.pkl')
    ML_AVAILABLE = True
    print("✓ Models loaded successfully")
except FileNotFoundError:
    print("⚠ Model files not found. Run train.py first.")
    ML_AVAILABLE = False


def calculate_rule_score(text: str) -> tuple[float, List[str]]:
    """
    Rule-based scoring system.
    Returns: (score 0-100, list of reasons)
    """
    score = 100
    reasons = []
    
    lower_text = text.lower()
    
    # Rule 1: Sensational words
    sensational_words = [
        'shocking', 'breaking', 'miracle', 'weird trick', 'secret',
        'exclusive', 'unbelievable', 'proof', 'warning', 'must watch',
        'dont want you to know', 'hate this', 'you wont believe'
    ]
    for word in sensational_words:
        # Use word boundaries \b to ensure exact word matches (avoids matching 'secret' in 'secretary')
        pattern = fr"\b{re.escape(word)}\b"
        if re.search(pattern, lower_text):
            score -= 15
            reasons.append(f"Sensational language: '{word}'")
            break
    
    # Rule 2: Excessive punctuation
    exclamation_count = text.count('!')
    if exclamation_count > 3:
        score -= 10
        reasons.append(f"Excessive punctuation ({exclamation_count} exclamation marks)")
    
    # Rule 3: Multiple ALL CAPS words
    words = text.split()
    all_caps_words = [w for w in words if w.isupper() and len(w) > 2]
    if len(all_caps_words) >= 15:
        score -= 12
        reasons.append(f"Multiple ALL CAPS words detected")
    
    # Rule 4: Question marks (urgent tone)
    question_count = text.count('?')
    if question_count >= 3:
        score -= 8
        reasons.append("Excessive questioning (urgent tone)")
    
    # Rule 5: Text length (very short posts may be low quality)
    if len(text) < 50:
        score -= 5
        reasons.append("Text too short for reliable analysis")
    
    # Clamp score
    score = max(0, min(100, score))
    return score, reasons


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
        
        fake_probability = float(probabilities[1])  # Probability of being fake (class 1)
        
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


def format_external_ai_reason(reasoning: str) -> str:
    """
    Normalize external AI reasoning so the label is rendered only once.
    """
    cleaned_reasoning = re.sub(
        r"^(External AI:\s*)+",
        "",
        reasoning or "",
        flags=re.IGNORECASE,
    ).strip()
    return f"External AI: {cleaned_reasoning}" if cleaned_reasoning else ""


@app.post("/analyze")
def analyze_post(post: PostData) -> Dict[str, Any]:
    """
    Main analysis endpoint.
    Returns comprehensive scoring with confidence and breakdown.
    """
    text = post.text.strip()
    
    if not text:
        return {
            "fake_probability": 0.5,
            "confidence": 0.0,
            "score": 50,
            "label": "Uncertain",
            "reasons": ["No text provided"],
            "explanation": "Empty text cannot be analyzed"
        }
    
    # Rule-based scoring
    rule_score, rule_reasons = calculate_rule_score(text)
    
    # ML-based scoring
    ml_result = predict_with_ml(text)
    fake_probability = ml_result["fake_probability"]
    ml_confidence = ml_result["confidence"]
    
    # External AI (HF + RAG)
    ext_ai_result = external_ai_score(text)
    ext_ai_prob = ext_ai_result["external_ai_score"]
    
    # Convert ML and External AI probability to score (0-100)
    # probability 1.0 = score 0 (high risk)
    # probability 0.0 = score 100 (low risk)
    ml_score = (1.0 - fake_probability) * 100
    ext_score = (1.0 - ext_ai_prob) * 100
    
    # Final score: weighted average
    # ML model -> 10%
    # Rule-based -> 10%
    # External AI (HF + RAG) -> 30%
    # Source checker -> 50%
    source_score = post.source_score

    # Calculate overall confidence
    # If ML is missing, we start with a base confidence of 0.3 if rules/source are active
    # If ML is present, we use its confidence as the base
    base_confidence = ml_confidence if ML_AVAILABLE else 0.3
    
    # Simple agreement check: do rule and ML (or source) agree?
    # We compare the rule score against the weighted average of other signals
    other_signals_avg = (ml_score * 0.2 + ext_score * 0.3 + source_score * 0.5)
    agreement = 1.0 - (abs(rule_score - other_signals_avg) / 100)
    
    # Combine base confidence with the agreement between systems
    overall_confidence = (base_confidence * 0.4) + (agreement * 0.6)
    
    # Final clamping to ensure valid range
    overall_confidence = max(0.1, min(1.0, overall_confidence))
    
    final_score = (ml_score * 0.1) + (rule_score * 0.1) + (ext_score * 0.3) + (source_score * 0.5)
    final_score = max(0, min(100, final_score))  # Clamp 0-100
    
    # Determine label based on score
    if final_score >= 70:
        label = "Likely Credible"
    elif final_score >= 40:
        label = "Needs Verification"
    else:
        label = "Low Credibility"
    
    # Combine all reasons
    all_reasons = rule_reasons + [ml_result["explanation"]]
    external_ai_reason = format_external_ai_reason(
        ext_ai_result.get("reasoning", "")
    )
    if external_ai_reason:
        all_reasons.append(external_ai_reason)
        
    return {
        "fake_probability": fake_probability,
        "external_ai_score": round(ext_score, 1),
        "source_score": round(source_score, 1),
        "confidence": round(overall_confidence, 3),
        "score": round(final_score, 1),
        "label": label,
        "reasons": all_reasons,
        "external_evidence": ext_ai_result["evidence_used"],
        "breakdown": {
            "rule_score": round(rule_score, 1),
            "ml_score": round(ml_score, 1),
            "external_ai_score": round(ext_score, 1),
            "source_score": round(source_score, 1)
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "ml_available": ML_AVAILABLE,
        "service": "TruthLayer AI Service"
    }
