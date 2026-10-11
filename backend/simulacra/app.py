"""Einstiegspunkt für uvicorn (`simulacra.app:app`); die Anwendung selbst liegt in `simulacra/api/`."""

import httpx  # noqa: F401  (Tests ersetzen httpx.AsyncClient für die Health-Prüfung)

from .api.app import app, create_app, probe_llm  # noqa: F401
