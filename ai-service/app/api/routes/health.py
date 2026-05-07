from fastapi import APIRouter

from app.services.ml_service import ML_AVAILABLE


router = APIRouter()


@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "ml_available": ML_AVAILABLE,
        "service": "TruthLayer AI Service"
    }

