#!/usr/bin/env bash
# On Their Own: Installation in einem Aufruf (Linux und macOS).
#
#   ./install.sh                 interaktiv, fragt vor jedem Schritt mit Wirkung nach
#   ./install.sh --yes           ohne Rückfragen (Standardantworten)
#   ./install.sh --dry-run       zeigt nur, was geschehen würde (liest das Netz, ändert nichts)
#   ./install.sh --no-model      kein Modell laden            --no-llm  auch keine Laufzeit (externer Server)
#   ./install.sh --headless      Server ohne Bildschirm: lauscht im Netz (ohne Zugangsschutz; mit --token mit Token)
#   ./install.sh --model qwen3-8b  ein bestimmtes Modell aus der kuratierten Liste
#   ./install.sh --update        Projekt und llama.cpp aktualisieren       --uninstall  Dienste entfernen (--purge: auch Daten)
#
# Grundsätze: kein sudo; alles liegt im Projektordner (data/) und im Benutzerordner; jeder Download wird geprüft (SHA-256),
# wo der Anbieter eine Prüfsumme liefert. Das Skript ist wiederholbar: was schon da ist, wird übersprungen.
# Läuft auch mit der alten bash 3.2 von macOS (keine assoziativen Arrays).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="${SIM_DATA_DIR:-$ROOT/data}"
RUNTIME="$DATA/runtime/llama.cpp"
MODELS_DIR="$DATA/models"
LOGS="$DATA/logs"
LOCAL_BIN="$HOME/.local/bin"
LLM_PORT="${OTO_LLM_PORT:-8081}"
APP_PORT="${OTO_PORT:-8090}"
MARK_BEGIN="# --- on-their-own install (verwaltet von install.sh) ---"
MARK_END="# --- ende on-their-own install ---"

YES=0; DRY=0; TOKEN=0; NO_MODEL=0; NO_LLM=0; HEADLESS=0; UPDATE=0; UNINSTALL=0; PURGE=0; MODEL_KEY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1;; --dry-run) DRY=1;; --no-model) NO_MODEL=1;; --no-llm) NO_LLM=1; NO_MODEL=1;;
    --headless) HEADLESS=1;; --token) TOKEN=1;; --update) UPDATE=1;; --uninstall) UNINSTALL=1;; --purge) PURGE=1;;
    --model) shift; MODEL_KEY="${1:-}";;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unbekannter Schalter: $1 (siehe --help)" >&2; exit 2;;
  esac
  shift
done

# ---------- Ausgabe und Hilfen ----------
if [ -t 1 ]; then C_P=$'\033[33m'; C_OK=$'\033[32m'; C_W=$'\033[31m'; C_D=$'\033[2m'; C_Q=$'\033[36m'; C_0=$'\033[0m'; else C_P=""; C_OK=""; C_W=""; C_D=""; C_Q=""; C_0=""; fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s[%s] %s%s\n' "$C_P" "$1" "$2" "$C_0"; }
ok()   { printf '  %s%s%s\n' "$C_OK" "$*" "$C_0"; }
warn() { printf '  %s%s%s\n' "$C_W" "$*" "$C_0"; }
plan() { printf '  %s→ würde %s%s\n' "$C_D" "$*" "$C_0"; }
die()  { printf '%sFehler: %s%s\n' "$C_W" "$*" "$C_0" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
# port_busy PORT: lauscht auf 127.0.0.1 schon jemand? (reines bash, ohne lsof/nc)
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# ask "Frage" j|n  → 0 = ja. Mit --yes, --dry-run oder ohne Terminal gilt die Standardantwort.
ask() {
  local q="$1" def="${2:-j}" a
  if [ "$YES" = 1 ] || [ "$DRY" = 1 ] || [ ! -t 0 ]; then
    printf '  %s? %s%s %s(Standard: %s)%s\n' "$C_Q" "$q" "$C_0" "$C_D" "$([ "$def" = j ] && echo ja || echo nein)" "$C_0"
    [ "$def" = j ]; return
  fi
  printf '  %s? %s%s [%s] ' "$C_Q" "$q" "$C_0" "$([ "$def" = j ] && echo J/n || echo j/N)"
  read -r a || a=""
  case "${a:-$def}" in j|J|y|Y|ja|Ja) return 0;; *) return 1;; esac
}

# Ausgabe in data/logs/install.log; bei Fehler die letzten Zeilen zeigen
quiet() {
  mkdir -p "$LOGS"
  if ! "$@" >>"$LOGS/install.log" 2>&1; then tail -n 15 "$LOGS/install.log" >&2; die "fehlgeschlagen: $* (vollständig: $LOGS/install.log)"; fi
}

# Befehl nur ausführen, wenn kein Trockenlauf ist
run() { if [ "$DRY" = 1 ]; then plan "ausführen: $*"; else "$@"; fi; }

sha256_of() { if have sha256sum; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

# Download mit Fortsetzen und Prüfsumme. fetch URL ZIEL [SHA256]
fetch() {
  local url="$1" dest="$2" sha="${3:-}" got
  mkdir -p "$(dirname "$dest")"
  curl -fL -sS --progress-bar --retry 3 --retry-delay 2 -C - -o "$dest.part" "$url" || { rm -f "$dest.part"; die "Download fehlgeschlagen: $url"; }
  if [ -n "$sha" ]; then
    got="$(sha256_of "$dest.part")"
    if [ "$got" != "$sha" ]; then rm -f "$dest.part"; die "Prüfsumme stimmt nicht ($url): erwartet $sha, erhalten $got"; fi
  fi
  mv "$dest.part" "$dest"
}

# Python für kleine JSON-Hilfen: das vorhandene python3, sonst über uv (nach Schritt 2)
py() {
  if have python3; then python3 "$@"
  elif have uv; then uv run --no-project --quiet --python 3.14 python "$@"
  else die "Python fehlt (und uv ist noch nicht installiert)."; fi
}

# ---------- Schritte (scripts/install/*.sh) ----------
LIB="$ROOT/scripts/install"
for f in machine runtime model services; do
  [ -f "$LIB/$f.sh" ] || { echo "Fehler: $LIB/$f.sh fehlt (Projektordner unvollständig)." >&2; exit 1; }
done
# shellcheck source=scripts/install/machine.sh
. "$LIB/machine.sh"
# shellcheck source=scripts/install/runtime.sh
. "$LIB/runtime.sh"
# shellcheck source=scripts/install/model.sh
. "$LIB/model.sh"
# shellcheck source=scripts/install/services.sh
. "$LIB/services.sh"

main() {
  printf '%sOn Their Own · Installation%s\n' "$C_P" "$C_0"
  detect_hw
  if [ "$UNINSTALL" = 1 ]; then uninstall; exit 0; fi
  LLAMA_BIN=""; LLAMA_LIB=""; MODEL_FILE=""; MODEL_ALIAS=""; SERVICE=0; NODE_OK=0
  check_machine
  install_prereqs
  setup_project
  install_runtime
  choose_model
  write_env
  write_llm_cmd
  install_services
  finish
}
main
