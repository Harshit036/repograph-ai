from fastapi import APIRouter, Query

from app.services.flow_tracing_service import trace_execution_flow

router = APIRouter()


@router.get("/trace-flow")
def trace_flow(
    keyword: str = Query(...),
    direction: str = Query("callees"),   # "callees" | "callers"
    max_depth: int = Query(4, ge=1, le=6),
):
    return trace_execution_flow(keyword, direction=direction, max_depth=max_depth)
