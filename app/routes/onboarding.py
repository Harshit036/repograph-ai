import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.onboarding_service import generate_onboarding_guide, stream_onboarding_guide

router = APIRouter()


@router.get("/onboarding-guide")
def onboarding_guide():
    return generate_onboarding_guide()


@router.get("/onboarding-guide/stream")
def onboarding_guide_stream():
    def event_gen():
        for event in stream_onboarding_guide():
            yield f"data: {json.dumps(event)}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
