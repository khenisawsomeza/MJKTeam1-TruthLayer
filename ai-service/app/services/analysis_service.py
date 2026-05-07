from typing import Any, Dict

from app.services.external_ai_service import external_ai_score
from app.services.ml_service import ML_AVAILABLE, predict_with_ml
from app.services.rule_engine import calculate_rule_score
from app.utils.text import format_external_ai_reason


def analyze_post_data(text: str, source_score: float) -> Dict[str, Any]:
    """
    Main analysis workflow.
    Returns comprehensive scoring with confidence and breakdown.
    """
    text = text.strip()

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
    final_score = max(0, min(100, final_score))

    # Determine label based on score
    if final_score >= 70:
        label = "Likely Credible"
    elif final_score > 40:
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

