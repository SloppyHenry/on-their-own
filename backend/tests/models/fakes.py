"""Attrappen für die Tests der Modellverwaltung (AP17c-3): ein `llama-server`, der wirklich auf einem Port lauscht, und ein Hugging-Face mit kleinen Dateien.
Kein Test braucht das Netz oder ein echtes Modell. Das Verhalten des falschen Servers steuert der Inhalt der „Modelldatei“ (`ok`, `bad`, `crash`, `slow`)."""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import re
import stat
import sys
import tarfile
from pathlib import Path

import httpx

FAKE_SERVER = r'''#!{python}
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

args = sys.argv[1:]
if "--version" in args:
    print("fake llama.cpp b1"); sys.exit(0)
get = lambda k, d=None: args[args.index(k) + 1] if k in args else d
port, alias, model = int(get("--port", "0")), get("--alias", "x"), get("-m", "")
mode = open(model, "rb").read(16).decode("utf8", "ignore").strip() if model else "ok"       # echte Modelldateien (Zufallsbytes) heißen „ok“
if mode == "crash":
    sys.stderr.write("fehler: Modell kaputt\n"); sys.exit(3)
t0 = time.time()
calls = [0]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj):
        body = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path == "/health":
            ready = time.time() - t0 > (1.0 if mode == "slow" else 0.0)
            return self._send(200 if ready else 503, {{"status": "ok" if ready else "loading model"}})
        if self.path == "/v1/models":
            return self._send(200, {{"data": [{{"id": alias}}]}})
        self._send(404, {{}})
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{{}}")
        calls[0] += 1
        enum = ((((body.get("response_format") or {{}}).get("json_schema") or {{}}).get("schema") or {{}}).get("properties") or {{}}).get("option_id", {{}}).get("enum", ["o1"])
        if mode == "bad" and calls[0] % 2 == 0:
            content = "Ich weiß nicht so recht"
        else:
            content = json.dumps({{"option_id": enum[0], "reason": "weil", "utterance": "", "importance": 3}})
        self._send(200, {{"choices": [{{"message": {{"content": content}}, "finish_reason": "stop"}}], "usage": {{"prompt_tokens": 50, "completion_tokens": 20}}, "timings": {{"predicted_per_second": 42.0}}}})

ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
'''


def make_fake_llama(path: Path) -> Path:
    """Legt eine ausführbare Datei `llama-server` an (ein Python-Skript)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(FAKE_SERVER.format(python=sys.executable))
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return path


def install_fake_runtime(data_dir: Path, tag: str = "b1", kind: str = "cpu") -> Path:
    """Wie nach „Laufzeit installieren“: `data/runtime/llama.cpp/<Version>-<Art>/llama-server` und der Verweis `current`."""
    rt = data_dir / "runtime" / "llama.cpp"
    binary = make_fake_llama(rt / f"{tag}-{kind}" / "llama-server")
    link = rt / "current"
    if link.is_symlink():
        link.unlink()
    link.symlink_to(f"{tag}-{kind}")
    return binary


def put_model(data_dir: Path, name: str, content: str = "ok") -> Path:
    """Eine „Modelldatei“ von außen im Modellordner (erscheint als `extern`)."""
    f = data_dir / "models" / f"{name}.gguf"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content)
    return f


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Blob:
    def __init__(self, data: bytes):
        self.data, self.sha = data, sha(data)


class Stream(httpx.AsyncByteStream):
    """Antwortkörper in Stücken, der nach `cut` Bytes die Verbindung verliert (None: vollständig)."""

    def __init__(self, data: bytes, cut: int | None = None, delay_s: float = 0.0):
        self.data, self.cut, self.delay_s = data, cut, delay_s

    async def __aiter__(self):
        step = 64 * 1024
        for i in range(0, len(self.data), step):
            if self.delay_s:
                await asyncio.sleep(self.delay_s)
            if self.cut is not None and i >= self.cut:
                raise httpx.ReadError("Verbindung verloren")
            yield self.data[i:i + step]

    async def aclose(self):
        pass


class FakeHub:
    """Hugging Face mit kleinen Dateien: Dateiliste, Modellseite, `resolve` (leitet auf ein CDN weiter, versteht `Range`) und GitHub-Releases."""

    def __init__(self):
        self.repos: dict[str, dict[str, Blob]] = {}
        self.gated: set[str] = set()
        self.cut_first: dict[str, int] = {}              # Datei -> nach so vielen Bytes bricht der erste Abruf ab
        self.ignore_range = False
        self.delay_s = 0.0                              # Pause je Stück: macht das Laden langsam genug, um es zu unterbrechen
        self.redirect_to = "cdn-lfs.huggingface.co"
        self.requests: list[httpx.Request] = []
        self.release_assets: dict[str, bytes] = {}
        self.releases: list[dict] = []
        self.transport = httpx.MockTransport(self.handle)

    def add(self, repo: str, file: str, data: bytes) -> Blob:
        self.repos.setdefault(repo, {})[file] = b = Blob(data)
        return b

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        host, path = request.url.host, request.url.path
        if host == "api.github.com":
            return httpx.Response(200, json=self.releases)
        if host in ("github.com", "objects.githubusercontent.com"):
            name = path.rsplit("/", 1)[-1]
            return httpx.Response(200, stream=Stream(self.release_assets[name])) if name in self.release_assets else httpx.Response(404)
        if host == "huggingface.co":
            m = re.match(r"^/api/models/([^/]+/[^/]+)/tree/main$", path)
            if m:
                repo = m.group(1)
                if repo in self.gated:
                    return httpx.Response(401, json={"error": "gated"})
                if repo not in self.repos:
                    return httpx.Response(404, json={"error": "nicht gefunden"})
                return httpx.Response(200, json=[{"type": "file", "path": f, "size": len(b.data), "lfs": {"oid": b.sha, "size": len(b.data)}} for f, b in self.repos[repo].items()])
            m = re.match(r"^/api/models/([^/]+/[^/]+)$", path)
            if m:
                return httpx.Response(200, json={"id": m.group(1), "tags": ["gguf", "license:apache-2.0"]}) if m.group(1) in self.repos else httpx.Response(404)
            m = re.match(r"^/([^/]+/[^/]+)/resolve/main/(.+)$", path)
            if m:
                return httpx.Response(302, headers={"location": f"https://{self.redirect_to}/blob/{m.group(1).replace('/', '_')}/{m.group(2)}"})
        if host == self.redirect_to or host.endswith(".hf.co"):
            m = re.match(r"^/blob/([^/]+)/(.+)$", path)
            if m:
                repo = next((r for r in self.repos if r.replace("/", "_") == m.group(1)), None)
                blob = self.repos.get(repo or "", {}).get(m.group(2))
                if blob is None:
                    return httpx.Response(404)
                data, status, headers = blob.data, 200, {}
                rng = request.headers.get("range")
                if rng and not self.ignore_range:
                    start = int(re.match(r"bytes=(\d+)-", rng).group(1))                       # type: ignore[union-attr]
                    if start >= len(data):
                        return httpx.Response(416)
                    data, status = data[start:], 206
                    headers["content-range"] = f"bytes {start}-{len(blob.data) - 1}/{len(blob.data)}"
                cut = self.cut_first.pop(m.group(2), None)
                return httpx.Response(status, headers=headers, stream=Stream(data, cut, self.delay_s))
        return httpx.Response(404, json={"error": f"nicht erwartet: {request.url}"})


def tar_with_server(tag_dir: str = "llama-b1") -> bytes:
    """Ein Release-Archiv mit einem laufenden falschen `llama-server`."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        data = FAKE_SERVER.format(python=sys.executable).encode()
        info = tarfile.TarInfo(f"{tag_dir}/llama-server")
        info.size, info.mode = len(data), 0o755
        tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def asset(name: str, data: bytes) -> dict:
    return {"name": name, "browser_download_url": f"https://github.com/ggml-org/llama.cpp/releases/download/x/{name}", "digest": "sha256:" + sha(data), "size": len(data)}


def env_with(**kv) -> dict[str, str]:
    return {**os.environ, **kv}


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
