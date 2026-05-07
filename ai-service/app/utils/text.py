import re


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

