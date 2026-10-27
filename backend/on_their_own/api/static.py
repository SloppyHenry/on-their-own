"""Liefert das gebaute Frontend aus (ein Container, kein Nginx). Unbekannte Pfade fallen auf `index.html` zurück,
`/api/*` und `/ws` bleiben der API vorbehalten."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

IMMUTABLE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"


def mount_frontend(app: FastAPI, root: Path) -> None:
    root = root.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"Frontend nicht gefunden: {index} (zuerst 'npm run build' in frontend/ ausführen)")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str) -> FileResponse:
        if path == "ws" or path.startswith(("api/", "ws/")) or path == "api":
            raise HTTPException(404, "Nicht gefunden.")
        target = (root / path).resolve()
        if path and target.is_file() and target.is_relative_to(root):
            return FileResponse(target, headers={"Cache-Control": IMMUTABLE if target.parent.name == "assets" else NO_CACHE})
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})
