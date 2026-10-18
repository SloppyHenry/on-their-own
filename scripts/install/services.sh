# shellcheck shell=bash
# Schritte 6 und 7: Dienste, Abschluss, Entfernen. Wird von install.sh eingelesen (source), nicht einzeln aufgerufen.
# ---------- 6: Dienste ----------
unit_llm_cmd() { printf '%s -m %s --alias %s --host 127.0.0.1 --port %s -c 8192 -ngl 99 --parallel 1 --jinja' "$LLAMA_BIN" "$MODEL_FILE" "$MODEL_ALIAS" "$LLM_PORT"; }

install_services() {
  step "6/7" "Dienst"
  SERVICE=0
  local def=n; [ "$HEADLESS" = 1 ] && def=j
  local what="Simulacra"; [ -n "$LLAMA_BIN" ] && [ -n "$MODEL_FILE" ] && what="Simulacra und das Modell"
  local mgr; if [ "$OS" = macos ]; then mgr="launchd (~/Library/LaunchAgents)"; else mgr="systemd --user"; fi
  if ! ask "$what beim Anmelden automatisch starten ($mgr)?" "$def"; then
    say "  Ohne Dienst: ${C_Q}scripts/start.sh${C_0} startet alles im Vordergrund."
    return
  fi
  SERVICE=1
  if [ "$DRY" = 1 ]; then plan "Dienstdateien anlegen und starten ($mgr)"; return; fi
  mkdir -p "$LOGS"
  local py="$ROOT/backend/.venv/bin/python" withllm=0
  [ -n "$LLAMA_BIN" ] && [ -n "$MODEL_FILE" ] && [ -f "$MODEL_FILE" ] && withllm=1
  if [ "$OS" = linux ]; then
    have systemctl || die "systemctl fehlt; ohne Dienst weitermachen mit scripts/start.sh."
    local d="$HOME/.config/systemd/user"; mkdir -p "$d"
    if [ "$withllm" = 1 ]; then
      cat >"$d/simulacra-llm.service" <<EOF
[Unit]
Description=Simulacra: Sprachmodell (llama.cpp)
[Service]
Environment=LD_LIBRARY_PATH=$LLAMA_LIB
ExecStart=$(unit_llm_cmd)
Restart=on-failure
[Install]
WantedBy=default.target
EOF
    fi
    cat >"$d/simulacra.service" <<EOF
[Unit]
Description=Simulacra
$([ "$withllm" = 1 ] && echo "After=simulacra-llm.service")
[Service]
WorkingDirectory=$ROOT/backend
Environment=SIM_DATA_DIR=$DATA
Environment=SIM_STATIC_DIR=$ROOT/frontend/dist
Environment=SIM_PORT=$APP_PORT
ExecStart=$py -m simulacra
Restart=on-failure
[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    if [ "$withllm" = 1 ]; then systemctl --user enable simulacra-llm.service >/dev/null 2>&1; systemctl --user restart simulacra-llm.service; fi
    systemctl --user enable simulacra.service >/dev/null 2>&1; systemctl --user restart simulacra.service
    ok "Dienste angelegt und gestartet (systemctl --user status simulacra) ✓"
    if [ "$HEADLESS" = 1 ] && have loginctl; then if loginctl enable-linger "$USER" >/dev/null 2>&1; then ok "Start auch ohne Anmeldung (linger) ✓"; else warn "Damit die Dienste ohne Anmeldung laufen: sudo loginctl enable-linger $USER"; fi; fi
  else
    local d="$HOME/Library/LaunchAgents" uid; uid="$(id -u)"; mkdir -p "$d"
    if [ "$withllm" = 1 ]; then
      cat >"$d/de.simulacra.llm.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>de.simulacra.llm</string>
<key>ProgramArguments</key><array>$(for a in $(unit_llm_cmd); do printf '<string>%s</string>' "$a"; done)</array>
<key>EnvironmentVariables</key><dict><key>DYLD_LIBRARY_PATH</key><string>$LLAMA_LIB</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$LOGS/llm.log</string><key>StandardErrorPath</key><string>$LOGS/llm.log</string>
</dict></plist>
EOF
    fi
    cat >"$d/de.simulacra.app.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>de.simulacra.app</string>
<key>ProgramArguments</key><array><string>$py</string><string>-m</string><string>simulacra</string></array>
<key>WorkingDirectory</key><string>$ROOT/backend</string>
<key>EnvironmentVariables</key><dict><key>SIM_DATA_DIR</key><string>$DATA</string><key>SIM_STATIC_DIR</key><string>$ROOT/frontend/dist</string><key>SIM_PORT</key><string>$APP_PORT</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$LOGS/backend.log</string><key>StandardErrorPath</key><string>$LOGS/backend.log</string>
</dict></plist>
EOF
    local l
    for l in de.simulacra.llm de.simulacra.app; do
      [ -f "$d/$l.plist" ] || continue
      launchctl bootout "gui/$uid/$l" >/dev/null 2>&1 || true
      launchctl bootstrap "gui/$uid" "$d/$l.plist"
    done
    ok "Dienste angelegt und gestartet (launchctl list | grep simulacra) ✓"
  fi
}

# ---------- 7: Fertig ----------
finish() {
  step "7/7" "Fertig"
  local url="http://127.0.0.1:$APP_PORT"
  if [ "$DRY" != 1 ] && [ "$SERVICE" = 1 ]; then
    for _ in $(seq 1 60); do curl -fsS "$url/api/health" >/dev/null 2>&1 && break; sleep 2; done
    if curl -fsS "$url/api/health" >/dev/null 2>&1; then ok "Selbsttest: Simulacra antwortet ✓"; else warn "Simulacra antwortet noch nicht; Logs: $LOGS"; fi
    if [ -n "$MODEL_FILE" ] && [ -n "$LLAMA_BIN" ]; then
      for _ in $(seq 1 90); do curl -fsS "http://127.0.0.1:$LLM_PORT/health" >/dev/null 2>&1 && break; sleep 2; done
      if curl -fsS "http://127.0.0.1:$LLM_PORT/health" >/dev/null 2>&1; then ok "Selbsttest: das Modell ist geladen ✓"; else warn "Das Modell antwortet noch nicht (langer Ladevorgang möglich); Log: $LOGS/llm.log"; fi
    fi
  fi
  say "  Oberfläche    $url$([ "$HEADLESS" = 1 ] && echo "  (im Netz: http://$(hostname):$APP_PORT)")"
  say "  Daten         $DATA"
  say "  Aktualisieren ./install.sh --update"
  if [ "$DRY" = 1 ]; then printf '\n%sDas war ein Trockenlauf; es wurde nichts verändert.%s\n' "$C_W" "$C_0"; fi
}

uninstall() {
  step "–" "Simulacra entfernen"
  if [ "$OS" = linux ]; then
    local u; for u in simulacra simulacra-llm; do run systemctl --user disable --now "$u.service" 2>/dev/null || true; run rm -f "$HOME/.config/systemd/user/$u.service"; done
    run systemctl --user daemon-reload 2>/dev/null || true
  else
    local l; for l in de.simulacra.app de.simulacra.llm; do run launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; run rm -f "$HOME/Library/LaunchAgents/$l.plist"; done
  fi
  ok "Dienste entfernt ✓"
  if [ "$PURGE" = 1 ] && ask "Auch alle Daten ($DATA: Spielstände, Modelle, Laufzeit) löschen? Das ist endgültig." n; then run rm -rf "$DATA"; ok "Daten gelöscht"; else say "  Daten bleiben in $DATA (mit --purge auch löschen)."; fi
}
