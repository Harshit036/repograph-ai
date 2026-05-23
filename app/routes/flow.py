from fastapi import APIRouter

from app.services.flow_tracing_service import trace_execution_flow

router = APIRouter()


@router.get("/trace-flow")
def trace_flow(keyword: str):

    return trace_execution_flow(keyword)
