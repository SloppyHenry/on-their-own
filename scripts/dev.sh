#!/usr/bin/env bash
# Startet Backend (127.0.0.1:8090) und Vite-Dev-Server (5173) im Hintergrund.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/data/run"
LOGS="$ROOT/data/logs"
mkdir -p "$RUN" "$LOGS"

PORT="${SIM_PORT:-8090}"
HOST="${SIM_HOST:-127.0.0.1}"
export SIM_DATA_DIR="${SIM_DATA_DIR:-$ROOT/data}"

if [[ ! -x "$ROOT/backend/.venv/bin/python" ]]; then
  echo "backend/.venv fehlt – siehe README (uv venv + uv pip install)." >&2; exit 1
fi
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo "frontend/node_modules fehlt – 'npm ci' in frontend/ ausführen." >&2; exit 1
fi

for name in backend frontend; do
  if [[ -f "$RUN/$name.pid" ]] && kill -0 "$(cat "$RUN/$name.pid")" 2>/dev/null; then
    echo "$name läuft bereits (PID $(cat "$RUN/$name.pid")). Erst scripts/stop.sh ausführen." >&2; exit 1
  fi
done

cd "$ROOT/backend"
nohup .venv/bin/python -m uvicorn simulacra.app:app --host "$HOST" --port "$PORT" \
  >"$LOGS/backend.log" 2>&1 &
echo $! >"$RUN/backend.pid"

cd "$ROOT/frontend"
nohup npm run dev -- --host 127.0.0.1 --strictPort >"$LOGS/frontend.log" 2>&1 &
echo $! >"$RUN/frontend.pid"

echo "Backend:  http://$HOST:$PORT/api/health  (Log: data/logs/backend.log)"
echo "Frontend: http://127.0.0.1:5173          (Log: data/logs/frontend.log)"
echo "Beenden:  scripts/stop.sh"
