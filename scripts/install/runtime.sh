# shellcheck shell=bash
# Schritt 4: llama.cpp aus den offiziellen Releases. Wird von install.sh eingelesen (source), nicht einzeln aufgerufen.
# ---------- 4: Laufzeit llama.cpp ----------
# Wählt aus den GitHub-Releases (ggml-org/llama.cpp) die passende Datei; Kandidaten nach Vorliebe, mit Prüfsumme (digest der Release-API).
llama_candidates() {
  local rel; rel="$(curl -fsSL "${OTO_RELEASES_URL:-https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=12}")" || die "GitHub-Releases nicht erreichbar."
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
