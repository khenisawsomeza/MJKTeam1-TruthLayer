import os
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Enable CORS for local testing if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PostData(BaseModel):
    text: str

# Load ML model
try:
    vectorizer = joblib.load('vectorizer.pkl')
    model = joblib.load('model.pkl')
    ML_AVAILABLE = True
except FileNotFoundError:
    print("Model files not found. Run train.py first.")
    ML_AVAILABLE = False

def calculate_rule_score(text: str):
    score = 100
    reasons = []
    
    # Rule 1: Sensational words
    sensational_words = ['shocking', 'breaking', '!!!', 'miracle', 'weird trick', 'secret']
    lower_text = text.lower()
    for word in sensational_words:
        if word in lower_text:
            score -= 20
            reasons.append(f"Sensational phrase detected: '{word}' (-20)")
            break
            
    # Rule 2: Excess punctuation
    if text.count('!') > 3:
        score -= 10
        reasons.append("Excessive exclamation points (-10)")
        
    # Rule 3: ALL CAPS words
    words = text.split()
    all_caps_words = [w for w in words if w.isupper() and len(w) > 3]
    if len(all_caps_words) > 1:
        score -= 10
        reasons.append(f"Contains multiple ALL CAPS words (-10)")
        
    return score, reasons

@app.post("/analyze")
def analyze_post(post: PostData):
    text = post.text
    if not text:
        return {"score": 100, "label": "Low Risk", "reasons": ["No text provided"]}

    # Rule-Based Scoring
    rule_score, reasons = calculate_rule_score(text)
    
    # ML Scoring
    ml_penalty = 0
    if ML_AVAILABLE:
        # Vectorize input
        X = vectorizer.transform([text])
        # Predict probability of class 1 (Fake)
        fake_probability = model.predict_proba(X)[0][1]
        
        if fake_probability > 0.3: # Threshold for considering it
            ml_penalty = int(fake_probability * 50)
            reasons.append(f"Model detected misinformation pattern ({int(fake_probability * 100)}% confidence)")
    else:
        reasons.append("ML Model offline. Using only rule-based system.")

    # Final Score Calculation
    final_score = rule_score - ml_penalty
    final_score = max(0, min(100, final_score)) # Clamp between 0-100

    # Determine Label
    if final_score >= 80:
        label = "Low Risk"
    elif final_score >= 50:
        label = "Medium Risk"
    else:
        label = "High Risk"

    return {
        "score": final_score,
        "label": label,
        "reasons": reasons
    }
