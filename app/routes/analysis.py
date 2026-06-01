from typing import Optional
from fastapi import APIRouter, Query
from app.services.dead_code_service import analyze_dead_code
from app.services.test_coverage_service import analyze_test_coverage

router = APIRouter()


@router.get("/dead-code")
def dead_code(repo_id: Optional[str] = Query(None)):
    return analyze_dead_code(repo_id)


@router.get("/test-coverage")
def test_coverage(repo_id: Optional[str] = Query(None)):
    return analyze_test_coverage(repo_id)
