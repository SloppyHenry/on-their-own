"""Optionaler Zugangsschutz für das Heimnetz: ein gemeinsames Token, einmal eingegeben, danach als Cookie.

Ohne `SIM_ACCESS_TOKEN` tut dieses Modul nichts. Mit Token verlangt es für `/api/*` und `/ws` entweder das Cookie
oder `Authorization: Bearer <token>`; frei bleiben nur `/api/health` (Healthcheck des Containers), `/api/auth/*` und die
statischen Dateien (sie enthalten keine Daten). Das Cookie trägt nicht das Token selbst, sondern dessen SHA-256.
"""

import asyncio
import hashlib
import hmac
import time

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from starlette.types import ASGIApp, Receive, Scope, Send

COOKIE = "sim_access"
COOKIE_MAX_AGE_S = 30 * 24 * 3600
OPEN_PATHS = ("/api/health", "/api/auth/")
MAX_FAILS, WINDOW_S, FAIL_DELAY_S = 10, 60.0, 0.5

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    token: str


class AuthStatus(BaseModel):
    required: bool
    authenticated: bool


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _cookie_ok(cookies: dict[str, str], expected: str) -> bool:
    return hmac.compare_digest(cookies.get(COOKIE, ""), expected)


def _bearer_ok(header: str, token: str) -> bool:
    scheme, _, value = header.partition(" ")
    return scheme.lower() == "bearer" and hmac.compare_digest(value.strip().encode(), token.encode())


def _cookies(scope: Scope) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in scope.get("headers", []):
        if k == b"cookie":
            for part in v.decode("latin-1").split(";"):
                name, _, val = part.strip().partition("=")
                out[name] = val
    return out


def _header(scope: Scope, name: bytes) -> str:
    return next((v.decode("latin-1") for k, v in scope.get("headers", []) if k == name), "")


class AccessMiddleware:
    """Reiner ASGI-Filter, damit er für HTTP und WebSocket gleich gilt."""

    def __init__(self, app: ASGIApp, token: str):
        self.app, self.token, self.expected = app, token, digest(token)

    def allowed(self, scope: Scope) -> bool:
        return _cookie_ok(_cookies(scope), self.expected) or _bearer_ok(_header(scope, b"authorization"), self.token)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        path = scope["path"]
        guarded = path == "/ws" or (path.startswith("/api/") and not path.startswith(OPEN_PATHS))
        if not guarded or self.allowed(scope):
            return await self.app(scope, receive, send)
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 4401})
            return
        body = b'{"detail":"Anmeldung erforderlich."}'
        await send({"type": "http.response.start", "status": 401, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


def _token(request: Request) -> str | None:
    secret = request.app.state.settings.access_token
    return secret.get_secret_value() if secret is not None and secret.get_secret_value() else None


@router.get("/status", response_model=AuthStatus)
async def status(request: Request) -> AuthStatus:
    token = _token(request)
    if token is None:
        return AuthStatus(required=False, authenticated=True)
    ok = _cookie_ok(request.cookies, digest(token))
    return AuthStatus(required=True, authenticated=ok)


@router.post("/login", response_model=AuthStatus)
async def login(body: LoginRequest, request: Request, response: Response) -> AuthStatus:
    token = _token(request)
    if token is None:
        return AuthStatus(required=False, authenticated=True)
    fails: list[float] = request.app.state.auth_fails
    now = time.monotonic()
    fails[:] = [t for t in fails if now - t < WINDOW_S]
    if len(fails) >= MAX_FAILS:
        response.status_code = 429
        return AuthStatus(required=True, authenticated=False)
    if not hmac.compare_digest(body.token.encode(), token.encode()):
        fails.append(now)
        await asyncio.sleep(FAIL_DELAY_S)
        response.status_code = 401
        return AuthStatus(required=True, authenticated=False)
    response.set_cookie(COOKIE, digest(token), max_age=COOKIE_MAX_AGE_S, httponly=True, samesite="strict", path="/")
    return AuthStatus(required=True, authenticated=True)


@router.post("/logout", response_model=AuthStatus)
async def logout(request: Request, response: Response) -> AuthStatus:
    response.delete_cookie(COOKIE, path="/")
    return AuthStatus(required=_token(request) is not None, authenticated=False)
