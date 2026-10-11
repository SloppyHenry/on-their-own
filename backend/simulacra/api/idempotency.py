"""Idempotenz verändernder Anfragen: Header `Idempotency-Key`; derselbe Schlüssel führt nie zu einer zweiten Ausführung."""

import asyncio
import hashlib
import json
import time
from typing import Awaitable, Callable

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..simulation.builder import Simulation

TTL_S = 24 * 3600


class Idempotency:
    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}

    async def run(self, sim: Simulation, request: Request, payload: BaseModel | None,
                  handler: Callable[[], Awaitable[BaseModel]]) -> JSONResponse:
        key = request.headers.get("Idempotency-Key", "")
        if not 8 <= len(key) <= 128 or not key.isprintable():
            raise HTTPException(400, "Header 'Idempotency-Key' fehlt oder ist ungültig (8 bis 128 Zeichen, z. B. eine UUID).")
        body = json.dumps(payload.model_dump() if payload else {}, sort_keys=True)
        digest = hashlib.sha256(f"{request.method} {request.url.path} {body}".encode()).hexdigest()
        lock = self._locks.setdefault(key, asyncio.Lock())
        try:
            async with lock:                                   # gleichzeitige Wiederholung wartet auf das erste Ergebnis
                stored = await sim.engine.db.run(lambda: self._lookup(sim, key))
                if stored is not None:
                    if stored["request_hash"] != digest:
                        raise HTTPException(409, "Dieser Idempotency-Key wurde schon für eine andere Anfrage verwendet.")
                    return JSONResponse(json.loads(stored["response"]), status_code=stored["status"], headers={"Idempotent-Replay": "true"})
                result = (await handler()).model_dump()
                await sim.engine.db.run(lambda: self._store(sim, key, digest, 200, result))
                return JSONResponse(result)
        finally:
            if not lock.locked():
                self._locks.pop(key, None)

    @staticmethod
    def _lookup(sim: Simulation, key: str):
        conn = sim.engine.state.conn
        conn.execute("DELETE FROM idempotency WHERE created_at < ?", (time.time() - TTL_S,))
        return conn.execute("SELECT * FROM idempotency WHERE key=?", (key,)).fetchone()

    @staticmethod
    def _store(sim: Simulation, key: str, digest: str, status: int, result: dict) -> None:
        sim.engine.state.conn.execute("INSERT OR REPLACE INTO idempotency(key, request_hash, status, response, created_at) VALUES(?,?,?,?,?)",
                                      (key, digest, status, json.dumps(result), time.time()))
