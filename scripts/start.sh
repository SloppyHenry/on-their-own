#!/usr/bin/env bash
# Startet On Their Own im Vordergrund (Strg+C beendet alles): das Modell (llama.cpp, wenn install.sh eines eingerichtet hat)
# und das Backend mit der gebauten Oberfläche. Für den Betrieb ohne Bildschirm besser die Dienste von install.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${SIM_DATA_DIR:-$ROOT/data}"
mkdir -p "$DATA/logs"
[[ -x "$ROOT/backend/.venv/bin/python" ]] || { echo "backend/.venv fehlt – erst ./install.sh ausführen." >&2; exit 1; }
[[ -d "$ROOT/frontend/dist" ]] || { echo "frontend/dist fehlt – erst ./install.sh ausführen." >&2; exit 1; }

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
APP_PORT="${SIM_PORT:-8090}"
if port_busy "$APP_PORT"; then
  echo "Port $APP_PORT ist schon belegt (läuft On Their Own schon, oder ein anderes Programm?). Nichts wurde gestartet." >&2
  echo "Anderen Port wählen: SIM_PORT=$((APP_PORT + 1)) ./scripts/start.sh" >&2
  exit 1
fi

LLM_PID=""
cleanup() { [[ -n "$LLM_PID" ]] && kill "$LLM_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if [[ -f "$DATA/runtime/llm.cmd" ]]; then
  # shellcheck disable=SC1091
  source "$DATA/runtime/llm.cmd"
  LD_LIBRARY_PATH="$LLM_LIB:${LD_LIBRARY_PATH:-}" DYLD_LIBRARY_PATH="$LLM_LIB:${DYLD_LIBRARY_PATH:-}" bash -c "exec $LLM_CMD" >"$DATA/logs/llm.log" 2>&1 &
  LLM_PID=$!
  echo "Modell startet (PID $LLM_PID, Log: data/logs/llm.log)"
fi

cd "$ROOT/backend"
export SIM_DATA_DIR="$DATA" SIM_STATIC_DIR="$ROOT/frontend/dist"
echo "Oberfläche: http://127.0.0.1:$APP_PORT"
.venv/bin/python -m simulacra
