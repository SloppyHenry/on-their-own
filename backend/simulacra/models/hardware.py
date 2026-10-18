"""Hardware-Erkennung (AP17c-2): Grafikkarte, Speicher, Platte. Nur Standardbibliothek (läuft auch mit dem System-Python von install.sh).

Die Parser lesen Textausgaben von `nvidia-smi`, `sysctl` und `/proc/meminfo`, damit sie mit aufgezeichneten Ausgaben testbar sind.
`detect()` ruft die Befehle über eine austauschbare Funktion auf."""

from __future__ import annotations

import platform
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

# Nutzbarer Anteil des Speichers für ein Modell (dieselben Zahlen wie bisher in install.sh)
NVIDIA_USABLE = 0.95            # vom freien Grafikspeicher
METAL_USABLE = 2 / 3            # vom gemeinsamen Speicher (Apple Silicon)
CPU_USABLE = 0.6                # vom Arbeitsspeicher
AMD_MIN_VRAM_MB = 2048          # darunter ist es eine Onboard-Grafik mit geteiltem Speicher

# Speicherbandbreite in GB/s (Herstellerangaben, nominal) für die Schätzung der Geschwindigkeit; nicht gemessen
APPLE_BW = {"m1": 68, "m1 pro": 200, "m1 max": 400, "m1 ultra": 800, "m2": 100, "m2 pro": 200, "m2 max": 400, "m2 ultra": 800,
            "m3": 100, "m3 pro": 150, "m3 max": 400, "m3 ultra": 800, "m4": 120, "m4 pro": 273, "m4 max": 546}
NVIDIA_BW = [("5090", 1792), ("4090", 1008), ("3090 ti", 1008), ("3090", 936), ("4080", 717), ("3080 ti", 912), ("3080", 760), ("4070 ti super", 672),
             ("4070 ti", 504), ("4070", 504), ("3070", 448), ("3060 ti", 448), ("4060 ti", 288), ("4060", 272), ("3060", 360), ("2080 ti", 616),
             ("1080 ti", 484)]
DEFAULT_BW = {"nvidia": 300, "metal": 100, "amd": 300, "vulkan": 100, "cpu": 40}


@dataclass
class Hardware:
    kind: str                       # nvidia | metal | amd | vulkan | cpu
    name: str
    vram_mb: int                    # Grafikspeicher gesamt (Metal: gemeinsamer Speicher; vulkan/cpu: 0)
    vram_free_mb: int               # Grafikspeicher frei (andere Prozesse können die Karte belegen)
    ram_mb: int
    free_disk_mb: int
    os: str                         # linux | macos | windows | sonst
    arch: str                       # arm64 | x64 | sonst
    cuda_version: str | None = None
    gpu_count: int = 0
    gpu_names: list[str] = field(default_factory=list)

    @property
    def usable_mb(self) -> int:
        """Speicher, der einem Modell zur Verfügung steht."""
        if self.kind in ("nvidia", "amd"):
            return int(self.vram_free_mb * NVIDIA_USABLE)
        if self.kind == "metal":
            return int(self.ram_mb * METAL_USABLE)
        return int(self.ram_mb * CPU_USABLE)

    @property
    def bandwidth_gbs(self) -> tuple[float, bool]:
        """(Speicherbandbreite, bekannt?). Unbekannte Karten bekommen einen Richtwert je Art."""
        return bandwidth(self.kind, self.gpu_names or [self.name])

    def summary(self) -> str:
        """Eine Zeile für Kopf und Skript, z. B. „Apple M1, 16 GB gemeinsamer Speicher, 180 GB frei“."""
        gb = lambda mb: f"{mb / 1024:.0f}".replace(".", ",")
        if self.kind == "metal":
            mem = f"{gb(self.ram_mb)} GB gemeinsamer Speicher"
        elif self.kind in ("nvidia", "amd"):
            mem = f"{gb(self.vram_mb)} GB Grafikspeicher (frei {gb(self.vram_free_mb)} GB), {gb(self.ram_mb)} GB RAM"
        else:
            mem = f"{gb(self.ram_mb)} GB RAM"
        return f"{self.name}, {mem}, {gb(self.free_disk_mb)} GB frei"


def bandwidth(kind: str, names: list[str]) -> tuple[float, bool]:
    """Bei mehreren Karten zählt die langsamste (Schichten laufen nacheinander)."""
    found: list[float] = []
    for n in names:
        low = n.lower()
        if kind == "metal":
            m = re.search(r"\bm(\d)( pro| max| ultra)?\b", low)
            if m and (key := f"m{m.group(1)}{m.group(2) or ''}") in APPLE_BW:
                found.append(APPLE_BW[key])
        elif kind == "nvidia":
            for pat, bw in NVIDIA_BW:
                if re.search(rf"\b{re.escape(pat)}\b", low):
                    found.append(bw)
                    break
    if found and len(found) == len(names):
        return float(min(found)), True
    return float(DEFAULT_BW.get(kind, 40)), False


# ---------- Parser (reine Funktionen auf Text) ----------

def parse_nvidia_query(text: str) -> list[tuple[str, int, int]]:
    """Ausgabe von `nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits`: (Name, gesamt MB, frei MB) je Karte.
    Zeilen ohne Zahlen (z. B. „[N/A]“ bei virtuellen Karten) werden übersprungen."""
    gpus = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 3 or not parts[1].isdigit():
            continue
        total = int(parts[1])
        free = int(parts[2]) if parts[2].isdigit() else total
        gpus.append((parts[0], total, min(free, total)))
    return gpus


def parse_cuda_version(text: str) -> str | None:
    m = re.search(r"CUDA Version:\s*(\d+(?:\.\d+)*)", text)
    return m.group(1) if m else None


def parse_meminfo(text: str) -> int | None:
    """MemTotal aus /proc/meminfo in MB."""
    m = re.search(r"^MemTotal:\s+(\d+)\s*kB", text, re.M)
    return int(m.group(1)) // 1024 if m else None


def parse_memsize(text: str) -> int | None:
    """Ausgabe von `sysctl -n hw.memsize` (Bytes) in MB."""
    text = text.strip()
    return int(text) // 1048576 if text.isdigit() else None


def amd_from_sysfs(total_bytes: str, used_bytes: str, name: str = "") -> tuple[str, int, int] | None:
    """Werte aus /sys/class/drm/cardN/device/mem_info_vram_{total,used} (amdgpu). Onboard-Grafik mit wenig eigenem Speicher zählt nicht."""
    if not total_bytes.strip().isdigit():
        return None
    total = int(total_bytes) // 1048576
    used = int(used_bytes) // 1048576 if used_bytes.strip().isdigit() else 0
    if total < AMD_MIN_VRAM_MB:
        return None
    return (name.strip() or "AMD-Grafikkarte", total, max(total - used, 0))


# ---------- Erkennung ----------

Runner = Callable[[list[str]], "str | None"]


def run_command(cmd: list[str]) -> str | None:
    """Ausgabe eines Befehls oder None, wenn er fehlt oder scheitert."""
    if shutil.which(cmd[0]) is None:
        return None
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def _read(path: str) -> str | None:
    try:
        return Path(path).read_text()
    except OSError:
        return None


def _amd_gpus(read: Callable[[str], str | None], root: str = "/sys/class/drm") -> list[tuple[str, int, int]]:
    out = []
    try:
        cards = sorted(p.name for p in Path(root).iterdir() if re.fullmatch(r"card\d+", p.name))
    except OSError:
        return out
    for c in cards:
        base = f"{root}/{c}/device"
        if (read(f"{base}/vendor") or "").strip() != "0x1002":
            continue
        gpu = amd_from_sysfs(read(f"{base}/mem_info_vram_total") or "", read(f"{base}/mem_info_vram_used") or "", read(f"{base}/product_name") or "")
        if gpu:
            out.append(gpu)
    return out


def detect(data_dir: Path | str = ".", run: Runner = run_command, read: Callable[[str], str | None] = _read, system: str | None = None, machine: str | None = None) -> Hardware:
    """Erkennt den Rechner. `run` und `read` sind austauschbar (Tests); fehlende Werkzeuge ergeben Prozessor."""
    system = (system or platform.system()).lower()
    machine = (machine or platform.machine()).lower()
    os_name = {"darwin": "macos", "linux": "linux", "windows": "windows"}.get(system, system)
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "amd64": "x64"}.get(machine, machine)
    if os_name == "macos":
        ram = parse_memsize(run(["sysctl", "-n", "hw.memsize"]) or "") or 0
    else:
        ram = parse_meminfo(read("/proc/meminfo") or "") or 0
    p = Path(data_dir).expanduser()
    while not p.exists() and p != p.parent:
        p = p.parent
    try:
        free_disk = shutil.disk_usage(p).free // 1048576
    except OSError:
        free_disk = 0
    base = dict(ram_mb=ram, free_disk_mb=free_disk, os=os_name, arch=arch)

    smi = run(["nvidia-smi", "--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"]) if os_name != "macos" else None
    gpus = parse_nvidia_query(smi or "")
    if gpus:
        cuda = parse_cuda_version(run(["nvidia-smi"]) or "")
        names = [g[0] for g in gpus]
        return Hardware("nvidia", " + ".join(names), sum(g[1] for g in gpus), sum(g[2] for g in gpus), cuda_version=cuda, gpu_count=len(gpus), gpu_names=names, **base)
    if os_name == "macos" and arch == "arm64":
        brand = (run(["sysctl", "-n", "machdep.cpu.brand_string"]) or "").strip() or "Apple Silicon"
        return Hardware("metal", brand, ram, ram, gpu_count=1, gpu_names=[brand], **base)
    if os_name == "linux":
        amd = _amd_gpus(read)
        if amd:
            names = [g[0] for g in amd]
            return Hardware("amd", " + ".join(names), sum(g[1] for g in amd), sum(g[2] for g in amd), gpu_count=len(amd), gpu_names=names, **base)
        if run(["vulkaninfo", "--summary"]) is not None:
            return Hardware("vulkan", "Vulkan-Grafik", 0, 0, gpu_count=1, **base)
    return Hardware("cpu", "Prozessor", 0, 0, **base)
