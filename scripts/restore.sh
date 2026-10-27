#!/usr/bin/env bash
# Spielt ein Backup zurück. Der aktuelle Stand wird vorher gesichert (nach ~/on-their-own-backups und im Volume unter /data/backups).
# Aufruf auf maintux:  scripts/restore.sh <on-their-own-….tar.gz> [--yes]
set -euo pipefail
# shellcheck source=scripts/_compose.sh
source "$(dirname "$0")/_compose.sh"

file="${1:-}"; [[ -n "$file" && -f "$file" ]] || die "Aufruf: scripts/restore.sh <backup.tar.gz> [--yes]"
listing="$(tar -tzf "$file" 2>/dev/null)" || die "$file ist kein lesbares Archiv."
grep -qx 'manifest.json' <<<"$listing" || die "$file ist kein Backup von On Their Own."

if [[ "${2:-}" != "--yes" ]]; then
  echo "Der aktuelle Stand wird durch $file ersetzt (vorher wird er gesichert)."
  read -r -p "Zum Fortfahren das Wort wiederherstellen eingeben: " answer
  [[ "$answer" == "wiederherstellen" ]] || die "Abgebrochen."
fi

was_running="$(sim_running)"
if [[ -n "$was_running" || -n "$(sim_compose ps -a -q on-their-own)" ]]; then
  "$(dirname "$0")/backup.sh" >/dev/null || die "Sicherung des aktuellen Stands fehlgeschlagen, nichts geändert."
fi
[[ -z "$was_running" ]] || sim_compose stop on-their-own
restart() { [[ -z "$was_running" ]] || sim_compose start on-their-own; }
trap restart EXIT                               # auch bei Fehlern: die App läuft danach wieder, wenn sie vorher lief

sim_compose run --rm -T --no-deps on-their-own python -m on_their_own.saves.cli restore - <"$file"
echo "Fertig. Prüfen: http://localhost:${SIM_PUBLISH:-8090}/api/health"
