import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.architecture_service import generate_architecture_summary, stream_architecture_summary

router = APIRouter()


@router.get("/architecture-summary")
def architecture_summary():
    return generate_architecture_summary()


@router.get("/architecture-summary/stream")
def architecture_summary_stream():
    def event_gen():
        for token in stream_architecture_summary():
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
