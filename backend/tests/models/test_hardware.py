"""Hardware-Erkennung: Parser mit aufgezeichneten Ausgaben, Auswahl der Art, nutzbarer Speicher."""

from pathlib import Path

from on_their_own.models import hardware as h

REC = Path(__file__).resolve().parent.parent / "fixtures" / "hardware"


def test_nvidia_belegte_karte_zaehlt_den_freien_speicher():
    """Aufgezeichnet auf thirdtux: auf der RTX 3060 belegt ein fremder Dienst fast alles."""
    gpus = h.parse_nvidia_query((REC / "nvidia_smi_query_thirdtux_busy.txt").read_text())
    assert gpus == [("NVIDIA GeForce RTX 3060", 12288, 749)]
    assert h.parse_cuda_version((REC / "nvidia_smi_header_thirdtux.txt").read_text()) == "13.2"


def test_nvidia_mehrere_karten_und_kaputte_zeilen():
    text = "NVIDIA GeForce RTX 3090, 24576, 20000\nNVIDIA GeForce RTX 3060, 12288, 12000\n[N/A], [N/A], [N/A]\n\nNVIDIA Tesla T4, 15360, [N/A]\n"
    assert h.parse_nvidia_query(text) == [("NVIDIA GeForce RTX 3090", 24576, 20000), ("NVIDIA GeForce RTX 3060", 12288, 12000), ("NVIDIA Tesla T4", 15360, 15360)]
    assert h.parse_nvidia_query("") == [] and h.parse_nvidia_query("Failed to initialize NVML: Driver/library version mismatch") == []
    assert h.parse_cuda_version("kein CUDA hier") is None


def test_meminfo_und_memsize():
    assert h.parse_meminfo("MemTotal:       16270588 kB\nMemFree:          169696 kB\n") == 15889
    assert h.parse_meminfo("") is None
    assert h.parse_memsize((REC / "sysctl_memsize_m1.txt").read_text()) == 16384
    assert h.parse_memsize("abc") is None


def fake(table: dict[str, str | None], files: dict[str, str] | None = None):
    run = lambda cmd: table.get(" ".join(cmd))
    read = lambda path: (files or {}).get(path)
    return run, read


def test_apple_silicon_nutzbar_ist_ein_drittel_weniger(tmp_path):
    run, read = fake({"sysctl -n hw.memsize": (REC / "sysctl_memsize_m1.txt").read_text(), "sysctl -n machdep.cpu.brand_string": (REC / "sysctl_brand_m1.txt").read_text()})
    hw = h.detect(tmp_path, run, read, system="Darwin", machine="arm64")
    assert (hw.kind, hw.name, hw.os, hw.arch, hw.ram_mb) == ("metal", "Apple M1", "macos", "arm64", 16384)
    assert hw.usable_mb == 10922                      # 2/3 des gemeinsamen Speichers
    assert hw.bandwidth_gbs == (68.0, True)
    assert hw.free_disk_mb > 0 and "16 GB gemeinsamer Speicher" in hw.summary()


def test_nvidia_aus_aufgezeichneten_ausgaben(tmp_path):
    run, read = fake({"nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits": (REC / "nvidia_smi_query_thirdtux_busy.txt").read_text(),
                      "nvidia-smi": (REC / "nvidia_smi_header_thirdtux.txt").read_text()}, {"/proc/meminfo": "MemTotal:       16270588 kB\n"})
    hw = h.detect(tmp_path, run, read, system="Linux", machine="x86_64")
    assert (hw.kind, hw.vram_mb, hw.vram_free_mb, hw.cuda_version, hw.gpu_count) == ("nvidia", 12288, 749, "13.2", 1)
    assert hw.usable_mb == int(749 * 0.95)           # frei, nicht gesamt
    assert hw.bandwidth_gbs == (360.0, True)


def test_mehrere_karten_werden_summiert_langsamste_bestimmt_die_bandbreite(tmp_path):
    two = "NVIDIA GeForce RTX 3090, 24576, 24000\nNVIDIA GeForce RTX 3060, 12288, 12000\n"
    run, read = fake({"nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits": two, "nvidia-smi": "CUDA Version: 12.4"}, {"/proc/meminfo": "MemTotal: 33554432 kB\n"})
    hw = h.detect(tmp_path, run, read, system="Linux", machine="x86_64")
    assert (hw.gpu_count, hw.vram_mb, hw.vram_free_mb, hw.name) == (2, 36864, 36000, "NVIDIA GeForce RTX 3090 + NVIDIA GeForce RTX 3060")
    assert hw.bandwidth_gbs == (360.0, True)


def test_unbekannte_karte_bekommt_richtwert(tmp_path):
    run, read = fake({"nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits": "NVIDIA Zukunftskarte 9999, 8192, 8000\n"}, {"/proc/meminfo": "MemTotal: 8388608 kB\n"})
    assert h.detect(tmp_path, run, read, system="Linux", machine="x86_64").bandwidth_gbs == (300.0, False)


def test_fehlendes_nvidia_smi_ergibt_prozessor(tmp_path):
    run, read = fake({}, {"/proc/meminfo": "MemTotal:       16270588 kB\n"})
    hw = h.detect(tmp_path, run, read, system="Linux", machine="x86_64")
    assert (hw.kind, hw.vram_mb, hw.ram_mb, hw.gpu_count) == ("cpu", 0, 15889, 0)
    assert hw.usable_mb == int(15889 * 0.6) and hw.bandwidth_gbs == (40.0, False)


def test_amd_ueber_sysfs_und_onboard_grafik_zaehlt_nicht(tmp_path):
    gb = 1024 ** 3
    assert h.amd_from_sysfs(str(16 * gb), str(2 * gb), "AMD Radeon RX 7800 XT") == ("AMD Radeon RX 7800 XT", 16384, 14336)
    assert h.amd_from_sysfs(str(512 * 1024 ** 2), "0") is None      # APU: wenig eigener Speicher, der Rest ist geteilter RAM
    assert h.amd_from_sysfs("n/a", "") is None
    root = tmp_path / "drm"
    (root / "card0" / "device").mkdir(parents=True)
    (root / "card0" / "device" / "vendor").write_text("0x1002\n")
    (root / "card0" / "device" / "mem_info_vram_total").write_text(str(8 * gb))
    (root / "card0" / "device" / "mem_info_vram_used").write_text(str(1 * gb))
    files = {str(p): p.read_text() for p in root.rglob("*") if p.is_file()}
    assert h._amd_gpus(files.get, str(root)) == [("AMD-Grafikkarte", 8192, 7168)]


def test_vulkan_ohne_groessenangabe_zaehlt_wie_prozessor(tmp_path):
    run, read = fake({"vulkaninfo --summary": "GPU0: ..."}, {"/proc/meminfo": "MemTotal: 16777216 kB\n"})
    hw = h.detect(tmp_path, run, read, system="Linux", machine="x86_64")
    assert hw.kind == "vulkan" and hw.usable_mb == int(16384 * 0.6)


def test_windows_und_unbekannte_systeme_ergeben_prozessor(tmp_path):
    run, read = fake({})
    hw = h.detect(tmp_path, run, read, system="Windows", machine="AMD64")
    assert (hw.kind, hw.os, hw.arch) == ("cpu", "windows", "x64")


def test_datenordner_der_noch_nicht_existiert_nutzt_den_naechsten_vorhandenen(tmp_path):
    run, read = fake({}, {"/proc/meminfo": "MemTotal: 1048576 kB\n"})
    assert h.detect(tmp_path / "gibt" / "es" / "nicht", run, read, system="Linux", machine="x86_64").free_disk_mb > 0


def test_run_command_ohne_programm_und_bei_fehler():
    assert h.run_command(["gibt-es-bestimmt-nicht-xyz"]) is None
    assert h.run_command(["false"]) is None
    assert h.run_command(["echo", "hallo"]).strip() == "hallo"
