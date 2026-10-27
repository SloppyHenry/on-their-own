"""ULID: 26 Zeichen (Crockford-Base32), nach Zeit sortierbar und weltweit eindeutig."""

import os
import time

_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def new_ulid(now_ms: int | None = None) -> str:
    ms = int(time.time() * 1000) if now_ms is None else now_ms
    value = (ms << 80) | int.from_bytes(os.urandom(10), "big")
    return "".join(_ALPHABET[(value >> (5 * i)) & 31] for i in range(25, -1, -1))


def new_event_id() -> str:
    return "evt_" + new_ulid()
