from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/docs/oauth2-redirect"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        from app.core.config import get_settings
        expected = get_settings().api_key

        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != expected:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Pass it as X-API-Key header."},
            )

        # Per-request LLM config from headers
        provider = request.headers.get("X-LLM-Provider")
        if provider:
            from app.core.llm_context import LLMConfig, set_llm_config
            set_llm_config(LLMConfig(
                provider=provider,
                model=request.headers.get("X-LLM-Model") or "",
                api_key=request.headers.get("X-LLM-Key"),
            ))

        # Per-request user identity — sent by the frontend after GitHub OAuth login.
        # Falls back to "dev-user" (set as default in user_context) for local dev.
        user_id = request.headers.get("X-User-Id")
        if user_id:
            from app.core.user_context import set_user_id
            set_user_id(user_id)

        return await call_next(request)
