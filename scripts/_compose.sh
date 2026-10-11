#!/usr/bin/env bash
# Gemeinsame Hilfen für backup.sh, restore.sh und _remote_up.sh (nur einbinden, nicht ausführen).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export SIM_KEY_FILE="${SIM_KEY_FILE:-$HOME/simulacra-secrets/llm_api_key}"

sim_compose() {
  docker compose -f "$ROOT/deploy/compose.yaml" --project-directory "$ROOT/deploy" "$@"
}

sim_running() {   # gibt etwas aus, wenn der Container läuft
  sim_compose ps --status running -q simulacra
}

die() { echo "Fehler: $*" >&2; exit 1; }
