"""Filter: Bild-, Vision-, Embedding-, Merge- und Adapter-Modelle fliegen raus; Dateien werden auf Q4–Q8 und Einzeldateien eingegrenzt."""

import pytest

from simulacra.models import curated, filters as flt

from .conftest import load

PUBLISHERS = set(curated.load().publishers)


def test_trendliste_rauschen_fliegt_raus_textmodelle_bleiben():
    trending = load("list_trending.json") + load("list_qwen.json")
    kept, why = [], {}
    for m in trending:
        r = flt.reject_reason(m, None)
        if r is None:
            kept.append(m["id"])
        else:
            why[m["id"]] = r
    assert why["abenzerps/Qwen-Image-2.1-Uncensored-Quantized"] == flt.NOT_TEXT
    assert why["AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF"] == flt.NOT_TEXT
    assert why["unsloth/embeddinggemma-2-GGUF"] == flt.NOT_TEXT
    assert why["Qwen/Qwen3-Embedding-8B-GGUF"] == flt.NOT_TEXT            # pipeline_tag fehlt, der Name verrät es
    assert why["openbmb/MiniCPM-V-4.7-35B-A3B-gguf"] == flt.VISION
    assert why["Qwen/Qwen3-VL-8B-Instruct-GGUF"] == flt.VISION
    assert why["unsloth/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-GGUF"] == flt.VISION
    assert why["codacus/Qwen3.6-35B-A3B-MicroTurn-Duplex-LoRA"] == flt.ADAPTER
    # echte Textmodelle bleiben, auch die allgemeinen mit Bildfähigkeit (pipeline_tag fehlt oder image-text-to-text)
    for ok in ("Qwen/Qwen3-8B-GGUF", "unsloth/Qwen3.8-27B-GGUF", "unsloth/Qwen3.8-Flash-Next-GGUF", "LiquidAI/LFM2.5-24B-A2B-GGUF", "JetBrains/Mellum2.1-12B-A2.5B-Thinking-GGUF"):
        assert ok in kept, ok
    assert not any("Image" in k or "MiniCPM" in k or "Embedding" in k or "-VL-" in k for k in kept)


def test_herausgeber_positivliste_ist_der_standard_alle_nur_auf_wunsch():
    davidau = next(m for m in load("list_trending.json") if m["id"].startswith("DavidAU/Qwen3.8-27B-TURBO"))
    assert flt.reject_reason(davidau, PUBLISHERS) == flt.PUBLISHER
    assert flt.reject_reason(davidau, None) is None                        # keine inhaltliche Vorauswahl (Frage 39)
    assert flt.is_uncensored(davidau["id"], davidau["tags"])               # nur ein Hinweis, kein Filter


def test_merges_und_adapter():
    base = {"id": "unsloth/Foo-7B-GGUF", "tags": [], "pipeline_tag": "text-generation"}
    assert flt.reject_reason(base, PUBLISHERS) is None
    assert flt.reject_reason({**base, "tags": ["merge"]}, PUBLISHERS) == flt.MERGE
    assert flt.reject_reason({**base, "tags": ["base_model:merge:a/b"]}, PUBLISHERS) == flt.MERGE
    assert flt.reject_reason({**base, "id": "unsloth/Foo-Merge-7B-GGUF"}, PUBLISHERS) == flt.MERGE
    assert flt.reject_reason({**base, "tags": ["base_model:adapter:a/b"]}, PUBLISHERS) == flt.ADAPTER
    assert flt.reject_reason({**base, "private": True}, None) == flt.PRIVATE
    assert flt.reject_reason({**base, "pipeline_tag": "text-to-speech"}, None) == flt.NOT_TEXT
    assert flt.reject_reason({**base, "gguf": {"architecture": "qwen3vl"}}, None) == flt.VISION    # Architektur verrät das Vision-Modell
    assert flt.reject_reason({**base, "pipeline_tag": "image-text-to-text", "gguf": {"architecture": "qwen35"}}, None) is None


@pytest.mark.parametrize("tags, expected", [
    (["license:apache-2.0"], "Apache-2.0"), (["license:gemma"], "Gemma-Lizenz"), (["license:mit"], "MIT"),
    (["license:other", "license_name:nvidia-open-model-license"], "nvidia-open-model-license"),
    (["license:other"], "Sonstige (siehe Modellseite)"), (["license:cc-by-nc-4.0"], "CC-BY-NC-4.0 (nicht kommerziell)"),
    (["license:neueste-lizenz"], "neueste-lizenz"), (["gguf"], None),
])
def test_lizenz_aus_den_tags(tags, expected):
    assert flt.license_of(tags) == expected


def files(name: str) -> dict[str, dict]:
    return {f["file"]: f for f in flt.usable_files(load(f"tree_{name}.json"))}


def test_dateien_nur_q4_bis_q8_einzeldateien():
    f = files("unsloth_Qwen3.8-27B-GGUF")
    assert "Qwen3.8-27B-UD-Q4_K_XL.gguf" in f and "Qwen3.8-27B-Q8_0.gguf" in f and "Qwen3.8-27B-UD-IQ4_XS.gguf" in f
    assert not any("IQ3" in n or "IQ2" in n or "IQ1" in n or "Q2_K" in n or "Q3_K" in n for n in f)
    assert not any(n.startswith(("mmproj", "imatrix")) for n in f)
    sha = f["Qwen3.8-27B-UD-Q4_K_M.gguf"]["sha256"]
    assert sha.startswith("322e194ff797") and len(sha) == 64
    assert f["Qwen3.8-27B-UD-Q4_K_M.gguf"]["size_mb"] == pytest.approx(16464440224 / 1048576)


def test_geteilte_dateien_gesperrte_pruefsummen_und_sonderformate():
    orca = files("orcarouter_Qwen3.8-27B-Uncensored-GGUF")
    assert not any("00001-of" in n for n in orca) and "Qwen3.8-27B-Uncensored-Q4_K_M.gguf" in orca
    assert orca["Qwen3.8-27B-Uncensored-Q4_K_M.gguf"]["sha256"] is None       # bei gesperrten Modellen maskiert Hugging Face die Prüfsumme
    assert set(files("JetBrains_Mellum2.1-12B-A2.5B-Thinking-GGUF")) == {"Mellum2.1-12B-A2.5B-Thinking-Q4_K_M.gguf", "Mellum2.1-12B-A2.5B-Thinking-Q6_K.gguf", "Mellum2.1-12B-A2.5B-Thinking-Q8_0.gguf"}
    assert "LFM2.5-24B-A2B-QAD-Q4_0.gguf" in files("LiquidAI_LFM2.5-24B-A2B-GGUF")
    mini = files("openbmb_MiniCPM-V-4.7-1B-gguf")
    assert not any("mmproj" in n or n.startswith("dspark") for n in mini)
    assert flt.usable_files([{"type": "file", "path": "x-Ternary-mmproj-Q8_0.gguf", "size": 5}, {"type": "directory", "path": "MTP"}, {"type": "file", "path": "mtp-foo-Q4_0.gguf", "size": 5}]) == []


def test_anzeigename():
    assert flt.display_name("Qwen/Qwen3-8B-GGUF") == "Qwen3-8B" and flt.display_name("google/gemma-4-12B-it-qat-q4_0-gguf") == "gemma-4-12B-it-qat-q4_0"
