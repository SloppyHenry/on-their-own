#!/usr/bin/env bash
# Erzeugt frontend/src/types/{schema.json,generated.ts} aus den Pydantic-Modellen.
#   scripts/gen_types.sh           schreibt die Dateien
#   scripts/gen_types.sh --check   schlägt fehl (Exit 1), wenn die eingecheckten Dateien veraltet sind
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"
TYPES="$ROOT/frontend/src/types"
OUT="$TYPES"
[[ "${1:-}" == "--check" ]] && OUT="$(mktemp -d)"
mkdir -p "$TYPES"

( cd "$ROOT/backend" && "$PY" -m on_their_own.api.schema_export schema ) > "$OUT/schema.json"
( cd "$ROOT/frontend" && npx --no-install json2ts -i "$OUT/schema.json" -o "$OUT/generated.ts" \
    --bannerComment "/* GENERIERT von scripts/gen_types.sh aus den Pydantic-Modellen – nicht von Hand ändern. */" --unreachableDefinitions )
( cd "$ROOT/backend" && "$PY" -m on_their_own.api.schema_export ts-extra ) >> "$OUT/generated.ts"

if [[ "${1:-}" == "--check" ]]; then
  diff -q "$OUT/schema.json" "$TYPES/schema.json" >/dev/null && diff -q "$OUT/generated.ts" "$TYPES/generated.ts" >/dev/null \
    || { echo "Typen veraltet: scripts/gen_types.sh ausführen." >&2; exit 1; }
  echo "Typen aktuell."
else
  echo "Geschrieben: $TYPES/schema.json, $TYPES/generated.ts"
fi
