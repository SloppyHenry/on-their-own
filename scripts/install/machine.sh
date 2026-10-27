# shellcheck shell=bash
# Schritte 1 bis 3: Rechner erkennen und prüfen, Voraussetzungen, Projekt einrichten. Wird von install.sh eingelesen (source), nicht einzeln aufgerufen.
# ---------- Rechner erkennen ----------
detect_hw() {
  case "$(uname -s)" in Darwin) OS=macos;; Linux) OS=linux;; *) die "Betriebssystem $(uname -s) wird nicht unterstützt (Linux und macOS).";; esac
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64;; x86_64|amd64) ARCH=x64;; *) die "Architektur $(uname -m) wird nicht unterstützt.";; esac
  if [ "$OS" = macos ]; then MEM_MB=$(( $(sysctl -n hw.memsize) / 1048576 )); else MEM_MB=$(awk '/^MemTotal/ {print int($2/1024)}' "${SIMULACRA_MEMINFO:-/proc/meminfo}"); fi
  GPU_KIND=cpu; GPU_NAME=""; VRAM_MB=0; VRAM_FREE_MB=0; CUDA_VER=""
  local nv
  if have nvidia-smi && nv="$(nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)" && [ -n "$nv" ]; then
    GPU_KIND=nvidia; GPU_NAME="${nv%%,*}"
    VRAM_MB="$(printf '%s' "$nv" | awk -F, '{gsub(/[^0-9]/,"",$2); print $2}')"
    VRAM_FREE_MB="$(printf '%s' "$nv" | awk -F, '{gsub(/[^0-9]/,"",$3); print ($3==""?$2:$3)}')"
    VRAM_FREE_MB="${VRAM_FREE_MB:-$VRAM_MB}"
    CUDA_VER="$(nvidia-smi 2>/dev/null | sed -n 's/.*CUDA Version: *\([0-9][0-9.]*\).*/\1/p' | head -1 || true)"
  elif [ "$OS" = macos ] && [ "$ARCH" = arm64 ]; then
    GPU_KIND=metal; GPU_NAME="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'Apple Silicon')"
  elif [ "$OS" = linux ] && [ -z "${SIMULACRA_NO_VULKAN:-}" ] && { have vulkaninfo || ls /usr/share/vulkan/icd.d/*.json >/dev/null 2>&1; }; then
    GPU_KIND=vulkan; GPU_NAME="Vulkan-Grafik"
  fi
  CUDA_MAJOR="${CUDA_VER%%.*}"; CUDA_MAJOR="${CUDA_MAJOR:-0}"
  # Speicher, der dem Modell zur Verfügung steht: Grafikspeicher, bei Apple Silicon zwei Drittel des gemeinsamen Speichers, sonst RAM
  case "$GPU_KIND" in
    nvidia) USABLE_MB=$(( VRAM_FREE_MB * 95 / 100 ));;        # frei, nicht gesamt: ein anderer Dienst kann die Karte belegen
    metal)  USABLE_MB=$(( MEM_MB * 2 / 3 ));;
    *)      USABLE_MB=$(( MEM_MB * 6 / 10 ));;
  esac
  FREE_MB=$(df -Pk "$ROOT" 2>/dev/null | awk 'NR==2 {print int($4/1024)}'); FREE_MB="${FREE_MB:-0}"
}

fmt_gb() { awk -v m="$1" 'BEGIN { printf "%.1f", m/1024 }' | tr . ,; }

# ---------- 1: Rechner prüfen ----------
check_machine() {
  step "1/7" "Rechner prüfen"
  detect_hw
  say "  System        $OS $ARCH"
  case "$GPU_KIND" in
    nvidia) say "  Beschleuniger NVIDIA $GPU_NAME, $(fmt_gb "$VRAM_MB") GB Grafikspeicher, davon frei $(fmt_gb "$VRAM_FREE_MB") GB (CUDA ${CUDA_VER:-unbekannt})"
            if [ $(( VRAM_FREE_MB * 100 / VRAM_MB )) -lt 60 ]; then warn "Die Grafikkarte ist zum großen Teil belegt (andere Prozesse). Ein Modell muss in den freien Speicher passen; nichts wird beendet oder verdrängt."; fi;;
    metal)  say "  Beschleuniger Metal ($GPU_NAME), $(fmt_gb "$MEM_MB") GB gemeinsamer Speicher";;
    vulkan) say "  Beschleuniger Vulkan-Grafik (Größe unbekannt)";;
    *)      say "  Beschleuniger keiner erkannt (Prozessor)";;
  esac
  say "  Arbeitsspeicher $(fmt_gb "$MEM_MB") GB, nutzbar für Modelle ca. $(fmt_gb "$USABLE_MB") GB, frei auf dem Datenträger $(fmt_gb "$FREE_MB") GB"
  if have git; then ok "git ✓"; else warn "git fehlt (nur zum Aktualisieren nötig)"; fi
  case "$ROOT" in *" "*) die "Der Projektordner enthält Leerzeichen ($ROOT); die Dienstdateien kommen damit nicht zurecht. Bitte in einen Ordner ohne Leerzeichen verschieben.";; esac
  have curl || die "curl fehlt."
  have tar  || die "tar fehlt."
  if have uv; then ok "uv ✓"; else warn "uv fehlt (wird in Schritt 2 geholt)"; fi
  NODE_OK=0
  if have node; then
    local nm; nm="$(node --version | sed 's/^v//;s/\..*//')"
    if [ "$nm" -ge 22 ] 2>/dev/null; then NODE_OK=1; ok "node $(node --version) ✓"; else warn "node $(node --version) ist zu alt (22 oder neuer nötig)"; fi
  else warn "node fehlt (wird in Schritt 2 geholt)"; fi
  [ "$FREE_MB" -ge 3000 ] || warn "Wenig Platz frei (unter 3 GB); Modelle brauchen mehr."
  if port_busy "$APP_PORT"; then warn "Port $APP_PORT (Oberfläche) ist schon belegt. Läuft dort eine frühere Installation, ist das in Ordnung; sonst einen anderen Port wählen: SIMULACRA_PORT=$((APP_PORT + 1)) ./install.sh"; fi
  if port_busy "$LLM_PORT"; then warn "Port $LLM_PORT (Modell) ist schon belegt. Läuft dort eine frühere Installation, ist das in Ordnung; sonst: SIMULACRA_LLM_PORT=$((LLM_PORT + 1)) ./install.sh"; fi
}

# ---------- 2: Voraussetzungen ----------
install_prereqs() {
  step "2/7" "Voraussetzungen"
  export PATH="$LOCAL_BIN:$PATH"
  local did=0
  if ! have uv; then
    did=1
    if ask "uv (Python-Verwaltung) in ~/.local/bin installieren (offizieller Installer von astral.sh, kein sudo)?" j; then
      if [ "$DRY" = 1 ]; then plan "uv über https://astral.sh/uv/install.sh installieren"; else curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null; have uv || die "uv wurde installiert, ist aber nicht im PATH ($LOCAL_BIN)."; ok "uv installiert ✓"; fi
    else die "ohne uv geht es nicht."; fi
  fi
  if [ "$NODE_OK" != 1 ]; then
    did=1
    if ask "Node.js 24 nach ~/.local/share/simulacra/node installieren (von nodejs.org, mit Prüfsumme, kein sudo)?" j; then
      install_node
    else die "ohne Node.js 22 oder neuer lässt sich die Oberfläche nicht bauen."; fi
  fi
  [ "$did" = 1 ] || ok "nichts zu tun ✓"
}

install_node() {
  local base="https://nodejs.org/dist/latest-v24.x" osn arch sums file sha dir
  case "$OS" in macos) osn=darwin;; *) osn=linux;; esac
  case "$ARCH" in arm64) arch=arm64;; *) arch=x64;; esac
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || die "Node-Prüfsummen nicht erreichbar ($base)."
  file="$(printf '%s\n' "$sums" | awk -v p="-$osn-$arch.tar.gz" 'index($2,p) && $2 ~ /^node-v/ {print $2; exit}')"
  sha="$(printf '%s\n' "$sums" | awk -v f="$file" '$2==f {print $1}')"
  [ -n "$file" ] && [ -n "$sha" ] || die "Keine passende Node-Datei für $osn-$arch gefunden."
  dir="$HOME/.local/share/simulacra/node"
  if [ "$DRY" = 1 ]; then plan "$file laden, Prüfsumme prüfen und nach $dir entpacken"; export PATH="$dir/bin:$PATH"; return; fi
  local tmp; tmp="$(mktemp -d)"
  fetch "$base/$file" "$tmp/$file" "$sha"
  rm -rf "$dir"; mkdir -p "$dir"; tar -xzf "$tmp/$file" -C "$dir" --strip-components=1; rm -rf "$tmp"
  export PATH="$dir/bin:$PATH"
  ok "Node $(node --version) installiert ✓ (nur für den Bau; zur Laufzeit nicht nötig)"
}

# ---------- 3: Projekt ----------
setup_project() {
  step "3/7" "Projekt einrichten"
  [ -f "$ROOT/backend/pyproject.toml" ] || die "Das ist kein Ordner von On Their Own ($ROOT)."
  if [ "$UPDATE" = 1 ] && [ -d "$ROOT/.git" ] && have git; then
    if [ "$DRY" = 1 ]; then plan "git pull --ff-only"; else git -C "$ROOT" pull --ff-only || warn "git pull nicht möglich (lokale Änderungen?), arbeite mit dem vorhandenen Stand weiter."; fi
  fi
  if [ "$DRY" = 1 ]; then plan "backend/.venv anlegen (Python 3.14 über uv) und requirements.lock installieren"; plan "frontend: npm ci und npm run build"; return; fi
  ( cd "$ROOT/backend" || exit 1
    [ -x .venv/bin/python ] || quiet uv venv .venv --python 3.14
    quiet uv pip install --python .venv/bin/python -r requirements.lock
    quiet uv pip install --python .venv/bin/python -e . )
  ok "Backend-Umgebung (uv, requirements.lock) ✓"
  ( cd "$ROOT/frontend" && quiet npm ci --no-audit --no-fund && quiet npm run build )
  ok "Frontend gebaut (frontend/dist) ✓"
  mkdir -p "$DATA" "$LOGS"
}
