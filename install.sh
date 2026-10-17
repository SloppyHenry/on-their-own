#!/usr/bin/env bash
# Simulacra: Installation in einem Aufruf (Linux und macOS). Plan: docs/arbeitspakete/AP17c-plan.md, Handbuch: docs/installation.md
#
#   ./install.sh                 interaktiv, fragt vor jedem Schritt mit Wirkung nach
#   ./install.sh --yes           ohne Rückfragen (Standardantworten)
#   ./install.sh --dry-run       zeigt nur, was geschehen würde (liest das Netz, ändert nichts)
#   ./install.sh --no-model      kein Modell laden            --no-llm  auch keine Laufzeit (externer Server)
#   ./install.sh --headless      Server ohne Bildschirm: lauscht im Netz, erzeugt einen Zugangsschutz
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
LLM_PORT="${SIMULACRA_LLM_PORT:-8081}"
APP_PORT="${SIMULACRA_PORT:-8090}"
MARK_BEGIN="# --- simulacra install (verwaltet von install.sh) ---"
MARK_END="# --- ende simulacra install ---"

YES=0; DRY=0; NO_MODEL=0; NO_LLM=0; HEADLESS=0; UPDATE=0; UNINSTALL=0; PURGE=0; MODEL_KEY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1;; --dry-run) DRY=1;; --no-model) NO_MODEL=1;; --no-llm) NO_LLM=1; NO_MODEL=1;;
    --headless) HEADLESS=1;; --update) UPDATE=1;; --uninstall) UNINSTALL=1;; --purge) PURGE=1;;
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
  [ -f "$ROOT/backend/pyproject.toml" ] || die "Das ist kein Simulacra-Ordner ($ROOT)."
  if [ "$UPDATE" = 1 ] && [ -d "$ROOT/.git" ] && have git; then
    if [ "$DRY" = 1 ]; then plan "git pull --ff-only"; else git -C "$ROOT" pull --ff-only || warn "git pull nicht möglich (lokale Änderungen?), arbeite mit dem vorhandenen Stand weiter."; fi
  fi
  if [ "$DRY" = 1 ]; then plan "backend/.venv anlegen (Python 3.14 über uv) und requirements.lock installieren"; plan "frontend: npm ci und npm run build"; return; fi
  ( cd "$ROOT/backend"
    [ -x .venv/bin/python ] || quiet uv venv .venv --python 3.14
    quiet uv pip install --python .venv/bin/python -r requirements.lock
    quiet uv pip install --python .venv/bin/python -e . )
  ok "Backend-Umgebung (uv, requirements.lock) ✓"
  ( cd "$ROOT/frontend" && quiet npm ci --no-audit --no-fund && quiet npm run build )
  ok "Frontend gebaut (frontend/dist) ✓"
  mkdir -p "$DATA" "$LOGS"
}

# ---------- 4: Laufzeit llama.cpp ----------
# Wählt aus den GitHub-Releases (ggml-org/llama.cpp) die passende Datei; Kandidaten nach Vorliebe, mit Prüfsumme (digest der Release-API).
llama_candidates() {
  local rel; rel="$(curl -fsSL "${SIMULACRA_RELEASES_URL:-https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=12}")" || die "GitHub-Releases nicht erreichbar."
  printf '%s' "$rel" | py -c '
import json, re, sys
os_, arch, gpu, cuda_major = sys.argv[1:5]
releases = json.load(sys.stdin)
opts = []
if os_ == "macos":
    opts = [("metal", "macos-arm64" if arch == "arm64" else "macos-x64")]
elif arch == "x64":
    if gpu == "nvidia" and int(cuda_major or 0) >= 13: opts.append(("cuda", "ubuntu-cuda-13.4-x64"))
    if gpu == "nvidia" and int(cuda_major or 0) >= 12: opts.append(("cuda", "ubuntu-cuda-12.8-x64"))
    if gpu in ("nvidia", "vulkan"): opts.append(("vulkan", "ubuntu-vulkan-x64"))
    opts.append(("cpu", "ubuntu-x64"))
else:
    if gpu == "nvidia" and int(cuda_major or 0) >= 13: opts.append(("cuda", "ubuntu-cuda-13.4-arm64"))
    if gpu in ("nvidia", "vulkan"): opts.append(("vulkan", "ubuntu-vulkan-arm64"))
    opts.append(("cpu", "ubuntu-arm64"))
def find(rel, pat):
    for a in rel.get("assets", []):
        if re.fullmatch(pat, a["name"]): return a
for kind, suffix in opts:
    pat = r"llama-b\d+-bin-" + re.escape(suffix) + r"\.tar\.gz"
    for rel in releases:
        a = find(rel, pat)
        if not a: continue
        c = find(rel, r"cudart-llama-b\d+-bin-" + re.escape(suffix) + r"\.tar\.gz") if kind == "cuda" else None
        sha = (a.get("digest") or "").replace("sha256:", "")
        csha = ((c or {}).get("digest") or "").replace("sha256:", "")
        print("|".join([kind, rel["tag_name"], a["name"], a["browser_download_url"], sha, (c or {}).get("browser_download_url", ""), csha]))
        break
' "$OS" "$ARCH" "$GPU_KIND" "$CUDA_MAJOR"
}

install_runtime() {
  step "4/7" "Laufzeit llama.cpp"
  LLAMA_BIN=""
  if [ "$NO_LLM" = 1 ]; then ok "übersprungen (--no-llm): ein externer Server wird verwendet"; return; fi
  local cands kind tag name url sha curl_ csha dir
  cands="$(llama_candidates)"
  [ -n "$cands" ] || die "Keine passende llama.cpp-Version in den Releases gefunden ($OS $ARCH, $GPU_KIND). Selbst bauen oder --no-llm verwenden."
  printf '%s\n' "$cands" | while IFS='|' read -r kind tag name _rest; do say "  Kandidat      $kind · $tag · $name"; done
  IFS='|' read -r kind tag name url sha curl_ csha <<EOF
$(printf '%s\n' "$cands" | head -1)
EOF
  if [ "$DRY" = 1 ]; then plan "$name laden, Prüfsumme prüfen und nach $RUNTIME/$tag-$kind entpacken, danach llama-server --version prüfen"; return; fi
  while IFS='|' read -r kind tag name url sha curl_ csha; do
    dir="$RUNTIME/$tag-$kind"
    if [ ! -x "$dir/llama-server" ] && [ -z "$(find "$dir" -name llama-server -type f 2>/dev/null | head -1)" ]; then
      local tmp; tmp="$(mktemp -d)"
      fetch "$url" "$tmp/$name" "$sha"
      mkdir -p "$dir"; tar -xzf "$tmp/$name" -C "$dir"
      if [ -n "$curl_" ]; then fetch "$curl_" "$tmp/cudart.tar.gz" "$csha"; tar -xzf "$tmp/cudart.tar.gz" -C "$dir"; fi
      rm -rf "$tmp"
    fi
    LLAMA_BIN="$(find "$dir" -name llama-server -type f | head -1)"
    LLAMA_LIB="$(dirname "$LLAMA_BIN")"
    if [ -n "$LLAMA_BIN" ] && chmod +x "$LLAMA_BIN" && LD_LIBRARY_PATH="$LLAMA_LIB:${LD_LIBRARY_PATH:-}" DYLD_LIBRARY_PATH="$LLAMA_LIB:${DYLD_LIBRARY_PATH:-}" "$LLAMA_BIN" --version >/dev/null 2>&1; then
      ln -sfn "$dir" "$RUNTIME/current"; ok "$name installiert und geprüft ($kind) ✓"
      local old; for old in "$RUNTIME"/b*-*; do [ -d "$old" ] && [ "$old" != "$dir" ] && rm -rf "$old"; done     # ältere Versionen aufräumen
      return 0
    fi
    warn "$name läuft hier nicht, nehme den nächsten Kandidaten."
    LLAMA_BIN=""
  done <<EOF
$cands
EOF
  die "Keine der llama.cpp-Versionen läuft auf diesem Rechner. Mit --no-llm einen externen Server nutzen."
}

# ---------- 5: Modell ----------
choose_model() {
  step "5/7" "Modell"
  MODEL_FILE=""; MODEL_ALIAS=""
  if [ "$NO_MODEL" = 1 ]; then ok "übersprungen ($([ "$NO_LLM" = 1 ] && echo '--no-llm' || echo '--no-model'))"; return; fi
  local sel
  sel="$(py - "$ROOT/backend/simulacra/data/models.json" "$USABLE_MB" "$MODEL_KEY" <<'PYEOF'
import json, sys
path, usable_mb, key = sys.argv[1], int(sys.argv[2]), sys.argv[3]
models = json.load(open(path))["models"]
usable = usable_mb / 1024
if key:
    m = next((m for m in models if m["key"] == key), None)
    if not m: print("FEHLER|unbekanntes Modell " + key + " (bekannt: " + ", ".join(x["key"] for x in models) + ")"); sys.exit(0)
else:
    fitting = [m for m in models if m["min_gb"] <= usable]
    m = max(fitting, key=lambda x: x["size_gb"]) if fitting else min(models, key=lambda x: x["size_gb"])
fit = "passt gut" if m["min_gb"] <= usable * 0.8 else "passt" if m["min_gb"] <= usable else "KNAPP"
print("|".join([m["key"], m["name"], m["repo"], m["file"], str(m["size_gb"]), fit]))
PYEOF
)"
  case "$sel" in FEHLER*) die "${sel#FEHLER|}";; esac
  local name repo file size fit
  IFS='|' read -r _ name repo file size fit <<EOF
$sel
EOF
  say "  Empfehlung für diesen Rechner: $name Q4_K_M ($(printf '%s' "$size" | tr . ,) GB, $fit)"
  [ "$fit" = KNAPP ] && warn "Der Speicher ist knapp; das Modell läuft vielleicht nur langsam. Mit --model ein kleineres wählen oder --no-model."
  MODEL_FILE="$MODELS_DIR/$file"; MODEL_ALIAS="$name"
  if [ -f "$MODEL_FILE" ]; then ok "$file ist schon da ✓"; return; fi
  local lddef=j; [ "$fit" = KNAPP ] && lddef=n
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
    # Ein vorhandener Zugangsschutz bleibt: der eigene Block wird bei jedem Lauf neu geschrieben, das Token darf dabei nicht verloren gehen.
    if [ -f "$envf" ]; then token="$(sed -n 's/^SIM_ACCESS_TOKEN=//p' "$envf" | head -1)"; fi
    if [ -z "$token" ]; then token="$(py -c 'import secrets; print(secrets.token_hex(16))')"; fi
    # "::" lauscht auf IPv4 und IPv6 (manche Heimnetz-Namen lösen nur zu IPv6 auf); ohne IPv6 im Kernel bleibt es bei 0.0.0.0
    local bindhost=0.0.0.0; [ -e /proc/net/if_inet6 ] && bindhost="::"
    block="${block}SIM_HOST=$bindhost"$'\n'
    [ -n "$token" ] && block="${block}SIM_ACCESS_TOKEN=$token"$'\n'
  fi
  block="${block}$MARK_END"
  if [ "$DRY" = 1 ]; then plan "backend/.env schreiben (Block von install.sh$([ "$HEADLESS" = 1 ] && echo ', lauscht im Netz, Zugangsschutz'))"; return; fi
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
  if [ -n "$token" ]; then say "  ${C_W}Zugangsschutz: SIM_ACCESS_TOKEN steht in backend/.env; die Oberfläche fragt einmal danach.${C_0}"; fi
}

# Befehl für scripts/start.sh (ohne Dienst): eine Zeile mit der Kommandozeile und die Bibliothekenablage
write_llm_cmd() {
  [ "$DRY" = 1 ] && return 0
  if [ -n "$LLAMA_BIN" ] && [ -n "$MODEL_FILE" ] && [ -f "$MODEL_FILE" ]; then
    mkdir -p "$DATA/runtime"
    printf 'LLM_LIB=%q\nLLM_CMD=%q\n' "$LLAMA_LIB" "$(unit_llm_cmd)" >"$DATA/runtime/llm.cmd"
  fi
}

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

main() {
  printf '%sSimulacra Installation%s\n' "$C_P" "$C_0"
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
