"""Einstiegspunkt für uvicorn (`on_their_own.app:app`); die Anwendung selbst liegt in `on_their_own/api/`."""

import httpx  # noqa: F401  (Tests ersetzen httpx.AsyncClient für die Health-Prüfung)

from .api.app import app, create_app, probe_llm  # noqa: F401
