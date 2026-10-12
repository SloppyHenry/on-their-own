#!/usr/bin/env bash
# Rollt den aktuellen Stand auf maintux aus. Läuft auf dem Mac. Nur nach ausdrücklicher Freigabe benutzen.
#   scripts/deploy_maintux.sh [--dry-run] [--with-e2e] [--yes]
# --dry-run   zeigt nur, was passieren würde (kein ssh, kein rsync, keine Tests)
# --with-e2e  führt vorher auch die Browser-Tests aus (dauert ca. 2 Minuten)
# --yes       keine Rückfrage
# Umgebung: SIM_DEPLOY_HOST (maintux), SIM_DEPLOY_DIR (simulacra), SIM_KEY_SOURCE (Schlüsseldatei auf dem Ziel, Standard ~/llm/api-key),
#   SIM_SSH_OPTS (zusätzliche ssh-Optionen, z. B. "-i ~/.ssh/id_x -o IdentitiesOnly=yes"), SIM_DEPLOY_USER (Benutzer, falls nicht aus der ssh-Konfiguration)
# Anderes Ziel (z. B. SecondTux): Router-Adresse und Modellname stehen in deploy/.env auf dem Ziel, siehe docs/betrieb.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${SIM_DEPLOY_HOST:-maintux}"
HOST="${SIM_DEPLOY_USER:+$SIM_DEPLOY_USER@}$NAME"
SSH_OPTS="${SIM_SSH_OPTS:-}"          # absichtlich ohne Anführungszeichen expandiert (mehrere Optionen)
# shellcheck disable=SC2086,SC2029
ssh() { command ssh $SSH_OPTS "$@"; }
DIR="${SIM_DEPLOY_DIR:-simulacra}"
dry=0; e2e=0; yes=0
for a in "$@"; do
  case "$a" in
    --dry-run) dry=1 ;; --with-e2e) e2e=1 ;; --yes) yes=1 ;;
    *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
  esac
done
run() { if (( dry )); then echo "[dry-run] $*"; else "$@"; fi; }

echo "Ziel: $HOST:~/$DIR"
echo "1. Tests lokal (Backend, Typen, Vitest$( ((e2e)) && echo ', Playwright'))"
if (( ! dry )); then
  (cd "$ROOT/backend" && .venv/bin/python -m pytest -q) || { echo "Backend-Tests fehlgeschlagen, Abbruch." >&2; exit 1; }
  (cd "$ROOT/frontend" && npm run typecheck && npm test) || { echo "Frontend-Tests fehlgeschlagen, Abbruch." >&2; exit 1; }
  if (( e2e )); then (cd "$ROOT/frontend" && npx playwright test) || { echo "Browser-Tests fehlgeschlagen, Abbruch." >&2; exit 1; }; fi
fi

if (( ! dry && ! yes )); then
  read -r -p "Das baut und startet den Container auf $HOST neu. Fortfahren? (ja/nein) " answer
  [[ "$answer" == "ja" ]] || { echo "Abgebrochen."; exit 1; }
fi

echo "2. Quellcode übertragen"
run rsync -az --delete -e "ssh${SSH_OPTS:+ $SSH_OPTS}" --exclude-from="$ROOT/scripts/rsync-excludes.txt" "$ROOT/" "$HOST:$DIR/"
echo "3. Backup, Bauen, Starten und Prüfen auf $HOST (bei Fehler zurück auf die vorherige Version)"
run ssh "$HOST" "cd '$DIR' && SIM_KEY_SOURCE='${SIM_KEY_SOURCE:-}' bash scripts/_remote_up.sh"
echo "Fertig: http://$NAME:8090"
