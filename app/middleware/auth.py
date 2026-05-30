from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Paths that never require an API key
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/docs/oauth2-redirect"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        from app.core.config import get_settings
        expected = get_settings().api_key

        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != expected:
            # Must return a Response, not raise HTTPException, inside BaseHTTPMiddleware
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Pass it as X-API-Key header."},
            )
        return await call_next(request)
