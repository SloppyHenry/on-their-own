"""§17 Nr. 14: funktioniert ohne externe Cloud-LLM-API.

Eine Netzsperre im Prozess lässt nur localhost und maintux durch; jeder andere Verbindungsversuch scheitert und wird gezählt.
Die Simulation nutzt den echten HTTP-Client (OpenAI-kompatibel) gegen einen lokalen Ersatz des Routers.
Mit `-m integration` läuft derselbe Nachweis gegen das echte Modell auf maintux.
"""

import json
import re
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from agents.conftest import with_goals

from simulacra.config import Settings
from simulacra.llm.providers import first_option_fn
from simulacra.simulation.builder import Simulation

from .conftest import ROOT

CLOUD = re.compile(r"api\.openai\.com|anthropic\.com|googleapis|generativelanguage|api\.mistral|cohere\.(ai|com)|together\.xyz|groq\.com|openrouter|huggingface\.co")


class NetLock:
    def __init__(self, monkeypatch, allowed_names=("localhost", "127.0.0.1", "::1", "maintux")):
        self.blocked: list[str] = []
        real_gai, real_connect = socket.getaddrinfo, socket.socket.connect
        self.allowed_ips = {"127.0.0.1", "::1"}
        for name in allowed_names:
            try:
                self.allowed_ips |= {ai[4][0] for ai in real_gai(name, None)}
            except OSError:
                pass

        def gai(host, *a, **k):
            name = host.decode() if isinstance(host, bytes) else host                    # httpx reicht Namen als Bytes weiter
            if name is not None and str(name) not in allowed_names and str(name) not in self.allowed_ips:
                self.blocked.append(str(name))
                raise socket.gaierror(f"Netzsperre: {host}")
            return real_gai(host, *a, **k)

        def connect(sock, addr):
            if isinstance(addr, tuple) and addr[0] not in self.allowed_ips:
                self.blocked.append(str(addr[0]))
                raise ConnectionRefusedError(f"Netzsperre: {addr[0]}")
            return real_connect(sock, addr)

        monkeypatch.setattr(socket, "getaddrinfo", gai)
        monkeypatch.setattr(socket.socket, "connect", connect)


class LocalRouter:
    """Antwortet wie der llama.cpp-Router (OpenAI-Format), aber lokal und deterministisch."""

    def __init__(self):
        fn = with_goals(first_option_fn)
        self.calls = 0
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, obj):
                body = json.dumps(obj).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                self._send({"data": [{"id": "qwen3.8-9b-uncensored"}]})

            def do_POST(self):
                req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                schema = ((req.get("response_format") or {}).get("json_schema") or {}).get("schema")
                outer.calls += 1
                self._send({"choices": [{"message": {"content": fn(req["messages"], schema, None)}, "finish_reason": "stop"}],
                            "usage": {"prompt_tokens": 100, "completion_tokens": 20}})

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}/v1"


async def test_k14_simulation_laeuft_hinter_einer_netzsperre_nur_mit_lokalem_modell(monkeypatch):
    router = LocalRouter()
    lock = NetLock(monkeypatch)
    with pytest.raises(httpx.ConnectError):
        httpx.get("https://api.openai.com/v1/models", timeout=3)                         # die Sperre wirkt wirklich
    lock.blocked.clear()
    sim = Simulation.create(Settings(llm_base_url=router.url, llm_api_key_file="/nonexistent", llm_backoff_s=0.0), ":memory:")
    sim.store.ensure_all()
    await sim.runner.step(60)
    st = sim.runner.stats
    assert router.calls > 5 and st.decisions > 5 and st.valid == st.decisions           # nur der lokale Router wurde gefragt, mit Erfolg
    assert lock.blocked == []                                                             # kein einziger Versuch nach außen
    sim.close()
    router.srv.shutdown()


def test_k14_kein_cloud_endpunkt_in_code_oder_konfiguration():
    roots = [ROOT / "backend" / "simulacra", ROOT / "frontend" / "src", ROOT / "deploy", ROOT / "scripts"]
    hits = [f"{p.relative_to(ROOT)}:{i}" for r in roots for p in r.rglob("*") if p.is_file() and p.suffix in {".py", ".ts", ".tsx", ".yaml", ".sh", ".example", ".json", ".html"}
            for i, line in enumerate(p.read_text(errors="ignore").splitlines(), 1) if CLOUD.search(line)]
    assert hits == []
    assert Settings.model_fields["llm_base_url"].default.startswith("http://maintux:")    # Standard: Router im Heimnetz


@pytest.mark.integration
async def test_k14_echtes_modell_auf_maintux_hinter_der_netzsperre(monkeypatch, tmp_path):
    lock = NetLock(monkeypatch)
    settings = Settings()
    sim = Simulation.create(settings, tmp_path / "live.db")
    sim.store.ensure_all()
    await sim.runner.step(15)
    assert sim.runner.stats.valid > 0 and lock.blocked == []
    sim.close()
