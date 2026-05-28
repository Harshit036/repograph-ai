from fastapi import APIRouter
from app.services.architecture_service import generate_architecture_summary

router = APIRouter()


@router.get("/architecture-summary")
def architecture_summary():
    return generate_architecture_summary()
