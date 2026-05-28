from fastapi import APIRouter
from app.services.onboarding_service import generate_onboarding_guide

router = APIRouter()


@router.get("/onboarding-guide")
def onboarding_guide():
    return generate_onboarding_guide()
