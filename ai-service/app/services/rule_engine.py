import re
from typing import List


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

