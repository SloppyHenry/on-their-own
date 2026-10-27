"""Attrappen für die Browser-Tests der Modellverwaltung (AP17c-4): ein Hugging Face mit kleinen Dateien, GitHub-Releases mit einem falschen `llama-server`
und eine feste Hardware. Die Bausteine kommen aus `backend/tests/models/fakes.py` (dieselben wie in den Backend-Tests); nichts geht ins Netz."""

import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "tests" / "models"))
from fakes import FakeHub, asset, tar_with_server  # noqa: E402

from on_their_own.models.hardware import Hardware  # noqa: E402

MODEL_BYTES = 1_500_000                    # klein, aber genug Stücke, um den Fortschritt zu sehen (mit Pause je Stück)
REPOS = {"Qwen/Qwen3-8B-GGUF": "Qwen3-8B-Q4_K_M.gguf", "Qwen/Qwen3-4B-GGUF": "Qwen3-4B-Q4_K_M.gguf", "Qwen/Qwen3-14B-GGUF": "Qwen3-14B-Q4_K_M.gguf", "unsloth/Gemma-Test-GGUF": "Gemma-Test-Q4_K_M.gguf"}


class E2EHub(FakeHub):
    """Wie `FakeHub`, dazu die Modellliste (`/api/models`) und Metadaten, damit der Katalog etwas zeigt."""

    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.host == "huggingface.co" and request.url.path == "/api/models":
            self.requests.append(request)
            if "author" in dict(request.url.params) or "search" in dict(request.url.params):
                return httpx.Response(200, json=[])
            return httpx.Response(200, json=[
                {"id": repo, "author": repo.split("/")[0], "tags": ["gguf", "license:apache-2.0"], "pipeline_tag": "text-generation", "downloads": 1000 - i, "likes": 10, "lastModified": "2026-10-01T00:00:00Z",
                 "gated": False, "gguf": {"total": 8_000_000_000, "architecture": "qwen3"}} for i, repo in enumerate(self.repos)])
        return super().handle(request)


def build(delay_s: float) -> E2EHub:
    hub = E2EHub()
    hub.delay_s = delay_s
    for repo, file in REPOS.items():
        hub.add(repo, file, os.urandom(MODEL_BYTES))
    data = tar_with_server()
    a = asset("llama-b100-bin-ubuntu-x64.tar.gz", data)
    hub.release_assets[a["name"]] = data
    hub.releases = [{"tag_name": "b100", "assets": [a]}]
    return hub


def install(app, delay_s: float = 0.12) -> E2EHub:
    """Hängt die Attrappen an die App; die Modellverwaltung entsteht erst beim ersten Zugriff und liest sie dann."""
    hub = build(delay_s)
    app.state.hf_transport = app.state.download_transport = hub.transport
    app.state.releases_url = "https://api.github.com/repos/ggml-org/llama.cpp/releases"
    app.state.hardware_probe = lambda data_dir: Hardware("cpu", "Prozessor (Test)", 0, 0, 16384, 200_000, "linux", "x64")
    return hub
