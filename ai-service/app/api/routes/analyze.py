from typing import Any, Dict

from fastapi import APIRouter

from app.schemas.requests import PostData
from app.services.analysis_service import analyze_post_data


router = APIRouter()


@router.post("/analyze")
def analyze_post(post: PostData) -> Dict[str, Any]:
    """
    Main analysis endpoint.
    Returns comprehensive scoring with confidence and breakdown.
    """
    return analyze_post_data(post.text, post.source_score)

