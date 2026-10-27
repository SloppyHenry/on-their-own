"""Gemeinsames für die Modell-Tests: aufgezeichnete Hugging-Face-Antworten als Mock-Transport. Kein Test braucht das echte Netz."""

import json
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest

from on_their_own.models import curated
from on_their_own.models.hardware import Hardware

FIX = Path(__file__).resolve().parent.parent / "fixtures"
HF = FIX / "models"


def load(name: str):
    return json.loads((HF / name).read_text())


class FakeHF:
    """Beantwortet /api/models (Trend, Herausgeber, Suche) und /api/models/<repo>/tree/main aus den Fixtures; zählt die Anfragen."""

    def __init__(self, offline: bool = False, status: int | None = None):
        self.offline, self.status, self.requests = offline, status, []
        self.transport = httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request.url)
        if self.offline:
            raise httpx.ConnectError("kein Netz", request=request)
        if self.status:
            return httpx.Response(self.status, json={"error": "fehler"})
        path, q = request.url.path, parse_qs(request.url.query.decode())
        if path == "/api/models":
            assert q.get("filter") == ["gguf"]
            if "author" in q:
                return httpx.Response(200, json=load("list_qwen.json") if q["author"] == ["Qwen"] else [])
            if "search" in q:
                return httpx.Response(200, json=load("list_search_gemma.json"))
            return httpx.Response(200, json=load("list_trending.json"))
        if path.startswith("/api/models/") and path.endswith("/tree/main"):
            repo = path[len("/api/models/"):-len("/tree/main")]
            f = HF / f"tree_{repo.replace('/', '_')}.json"
            return httpx.Response(200, json=json.loads(f.read_text())) if f.exists() else httpx.Response(404, json={"error": "nicht aufgezeichnet"})
        return httpx.Response(404)

    def trees(self) -> list[str]:
        return [u.path for u in self.requests if u.path.endswith("/tree/main")]


@pytest.fixture
def hf():
    return FakeHF()


def machine(kind: str = "metal", ram_gb: int = 16, vram_gb: int = 0, free_gb: float | None = None, name: str = "Apple M1") -> Hardware:
    ram = ram_gb * 1024
    if kind == "metal":
        return Hardware("metal", name, ram, ram, ram, 100_000, "macos", "arm64", gpu_count=1, gpu_names=[name])
    if kind == "nvidia":
        return Hardware("nvidia", name, vram_gb * 1024, int((free_gb if free_gb is not None else vram_gb) * 1024), ram, 100_000, "linux", "x64", cuda_version="12.4", gpu_count=1, gpu_names=[name])
    return Hardware("cpu", "Prozessor", 0, 0, ram, 100_000, "linux", "x64")


@pytest.fixture
def m1() -> Hardware:
    return machine()


@pytest.fixture
def cur() -> curated.Curated:
    return curated.load()
