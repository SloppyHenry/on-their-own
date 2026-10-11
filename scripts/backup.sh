#!/usr/bin/env bash
# Sicherung des ganzen Datenverzeichnisses (live.db + Spielstände) aus dem Volume, konsistent auch bei laufender Simulation.
# Aufruf auf maintux:  scripts/backup.sh [Zielverzeichnis]
# Ergebnis: <Ziel>/simulacra-JJJJMMTT-HHMMSS-NN.tar.gz (Standard ~/simulacra-backups, die letzten SIM_BACKUP_KEEP=14 bleiben)
set -euo pipefail
# shellcheck source=scripts/_compose.sh
source "$(dirname "$0")/_compose.sh"

DEST="${1:-${SIM_BACKUP_DIR:-$HOME/simulacra-backups}}"
KEEP="${SIM_BACKUP_KEEP:-14}"
mkdir -p "$DEST"
chmod 700 "$DEST"
stamp="$(date +%Y%m%d-%H%M%S)"
n=0                                              # zwei Backups in derselben Sekunde überschreiben sich nie
while [[ -e "$DEST/simulacra-$stamp-$(printf '%02d' "$n").tar.gz" ]]; do n=$((n + 1)); done
out="$DEST/simulacra-$stamp-$(printf '%02d' "$n").tar.gz"
tmp="$out.part"
trap 'rm -f "$tmp"' EXIT

if [[ -n "$(sim_running)" ]]; then
  sim_compose exec -T simulacra python -m simulacra.saves.cli backup - >"$tmp"
else
  sim_compose run --rm -T --no-deps simulacra python -m simulacra.saves.cli backup - >"$tmp"
fi
listing="$(tar -tzf "$tmp" 2>/dev/null)" || die "Das Backup ist kein lesbares Archiv, nichts gespeichert."
grep -qx 'manifest.json' <<<"$listing" || die "Im Backup fehlt manifest.json, nichts gespeichert."       # kein Pipe: grep -q + pipefail meldet sonst SIGPIPE als Fehler
mv "$tmp" "$out"

n=0
while IFS= read -r f; do                       # Dateinamen sortieren zeitlich; neueste zuerst, alles ab Nummer KEEP+1 löschen
  n=$((n + 1))
  if (( n > KEEP )); then rm -f -- "$f"; fi
done < <(printf "%s\n" "$DEST"/simulacra-*.tar.gz | sort -r)

echo "$out"
