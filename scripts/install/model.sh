# shellcheck shell=bash
# Schritt 5: Modell wählen und laden; Einstellungen (backend/.env) und Startbefehl. Wird von install.sh eingelesen (source), nicht einzeln aufgerufen.
# ---------- 5: Modell ----------
choose_model() {
  step "5/7" "Modell"
  MODEL_FILE=""; MODEL_ALIAS=""
  if [ "$NO_MODEL" = 1 ]; then ok "übersprungen ($([ "$NO_LLM" = 1 ] && echo '--no-llm' || echo '--no-model'))"; return; fi
  # Auswahl und Passung rechnet das Backend (python -m simulacra.models), dieselbe Rechnung wie das Tool; hier nur die erkannten Werte übergeben
  local sel args
  args=(recommend --shell --kind "$GPU_KIND" --name "$GPU_NAME" --ram-mb "$MEM_MB" --vram-mb "$VRAM_MB" --vram-free-mb "$VRAM_FREE_MB")
  if [ -n "$MODEL_KEY" ]; then args+=(--model "$MODEL_KEY"); fi
  sel="$(PYTHONPATH="$ROOT/backend" py -m simulacra.models "${args[@]}")" || die "Die Modellauswahl ist fehlgeschlagen (python -m simulacra.models)."
  case "$sel" in FEHLER*) die "${sel#FEHLER|}";; esac
  local name repo file size fit secs quant level
  IFS='|' read -r _ name repo file size fit secs quant level <<EOF
$sel
EOF
  say "  Empfehlung für diesen Rechner: $name $quant ($(printf '%s' "$size" | tr . ,) GB, $fit), ≈ $(printf '%s' "$secs" | tr . ,) s je Entscheidung (Schätzung)"
  local lddef=j
  case "$level" in
    tight) lddef=n; warn "Der Speicher ist knapp; das Modell läuft vielleicht nur langsam. Mit --model ein kleineres wählen oder --no-model.";;
    no)    lddef=n; warn "Das Modell passt nicht in den nutzbaren Speicher. Mit --model ein kleineres wählen oder --no-model.";;
  esac
  MODEL_FILE="$MODELS_DIR/$file"; MODEL_ALIAS="$name"
  if [ -f "$MODEL_FILE" ]; then ok "$file ist schon da ✓"; return; fi
  if ! ask "$name ($(printf '%s' "$size" | tr . ,) GB) von huggingface.co/$repo laden?" "$lddef"; then MODEL_FILE=""; warn "ohne Modell: später im Tool (Menü → Einstellungen → Modelle) oder mit ./install.sh --update."; return; fi
  if [ "$DRY" = 1 ]; then plan "$file laden (fortsetzbar), SHA-256 gegen Hugging Face prüfen"; return; fi
  local sha
  sha="$(curl -fsSL "https://huggingface.co/api/models/$repo/tree/main" | py -c 'import json,sys; f=sys.argv[1]; print(next((x.get("lfs",{}).get("oid","") for x in json.load(sys.stdin) if x["path"]==f), ""))' "$file")"
  [ -n "$sha" ] || warn "Keine Prüfsumme von Hugging Face erhalten; lade ohne Prüfung."
  fetch "https://huggingface.co/$repo/resolve/main/$file" "$MODEL_FILE" "$sha"
  ok "$file geladen${sha:+, Prüfsumme ✓}"
}

# ---------- Einstellungen (backend/.env) ----------
write_env() {
  local envf="$ROOT/backend/.env" block tmp token=""
  block="$MARK_BEGIN"$'\n'
  if [ "$NO_LLM" = 0 ] && [ -n "$MODEL_ALIAS" ]; then
    block="${block}SIM_LLM_BASE_URL=http://127.0.0.1:$LLM_PORT/v1"$'\n'"SIM_LLM_MODEL=$MODEL_ALIAS"$'\n'
  fi
  if [ "$HEADLESS" = 1 ]; then
    # "::" lauscht auf IPv4 und IPv6 (manche Heimnetz-Namen lösen nur zu IPv6 auf); ohne IPv6 im Kernel bleibt es bei 0.0.0.0
    local bindhost=0.0.0.0; [ -e /proc/net/if_inet6 ] && bindhost="::"
    block="${block}SIM_HOST=$bindhost"$'\n'
    # Zugangsschutz nur mit --token (Standard: aus, wie im Heimnetz üblich). Ein vorhandenes Token bleibt dann bei jedem Lauf gleich.
    if [ "$TOKEN" = 1 ]; then
      if [ -f "$envf" ]; then token="$(sed -n 's/^SIM_ACCESS_TOKEN=//p' "$envf" | head -1)"; fi
      if [ -z "$token" ]; then token="$(py -c 'import secrets; print(secrets.token_hex(16))')"; fi
      block="${block}SIM_ACCESS_TOKEN=$token"$'\n'
    fi
  fi
  block="${block}$MARK_END"
  if [ "$DRY" = 1 ]; then plan "backend/.env schreiben (Block von install.sh$([ "$HEADLESS" = 1 ] && echo ', lauscht im Netz')$([ "$TOKEN" = 1 ] && echo ', mit Zugangsschutz'))"; return; fi
  touch "$envf"
  # eigene Werte außerhalb des Blocks gehen vor: gleiche Schlüssel im Block würden sonst verwirren
  tmp="$(mktemp)"
  awk -v b="$MARK_BEGIN" -v e="$MARK_END" '$0==b {skip=1} !skip {print} $0==e {skip=0}' "$envf" >"$tmp"
  local k
  for k in SIM_LLM_BASE_URL SIM_LLM_MODEL SIM_HOST SIM_ACCESS_TOKEN; do
    if grep -q "^$k=" "$tmp" && printf '%s\n' "$block" | grep -q "^$k="; then
      block="$(printf '%s\n' "$block" | grep -v "^$k=")"; warn "$k steht schon in backend/.env und bleibt unverändert."
    fi
  done
  { cat "$tmp"; printf '%s\n' "$block"; } >"$envf"; rm -f "$tmp"
  chmod 600 "$envf"
  ok "backend/.env geschrieben ✓"
  if [ -n "$token" ]; then say "  Zugangsschutz: SIM_ACCESS_TOKEN steht in backend/.env; die Oberfläche fragt einmal danach."
  elif [ "$HEADLESS" = 1 ]; then warn "Der Server ist im Netz ohne Zugangsschutz erreichbar (mit --token einschalten)."; fi
}

# Befehl für scripts/start.sh (ohne Dienst): eine Zeile mit der Kommandozeile und die Bibliothekenablage
write_llm_cmd() {
  [ "$DRY" = 1 ] && return 0
  if [ -n "$LLAMA_BIN" ] && [ -n "$MODEL_FILE" ] && [ -f "$MODEL_FILE" ]; then
    mkdir -p "$DATA/runtime"
    printf 'LLM_LIB=%q\nLLM_CMD=%q\n' "$LLAMA_LIB" "$(unit_llm_cmd)" >"$DATA/runtime/llm.cmd"
  fi
}
