#!/usr/bin/env bash
# Beendet die von dev.sh gestarteten Prozesse samt Kindprozessen.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/data/run"

kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}

for name in frontend backend; do
  f="$RUN/$name.pid"
  [[ -f "$f" ]] || { echo "$name: keine PID-Datei"; continue; }
  pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill_tree "$pid"
    for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && { kill -9 "$pid" 2>/dev/null; echo "$name: erzwungen beendet"; } || echo "$name: beendet"
  else
    echo "$name: lief nicht mehr"
  fi
  rm -f "$f"
done
