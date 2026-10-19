"""Passung an den Grenzwerten, Zeitschätzung, Namen und Quantisierungen."""

import pytest

from simulacra.models import fit as f
from simulacra.models.hardware import Hardware
from simulacra.models.rank import Item, Variant, make_variant, pick_variant, rank_key, recommend

from .conftest import machine


def test_kv_cache_waechst_mit_der_modellgroesse():
    assert f.kv_cache_mb(4) == 1104 and f.kv_cache_mb(8.2) == 1255 and f.kv_cache_mb(32) < 2200
    assert f.kv_cache_mb(8, context=4096) < f.kv_cache_mb(8)


@pytest.mark.parametrize("size, usable, level", [
    (2240, 5000, "good"),        # genau 70 %
    (2241, 5000, "ok"),          # knapp darüber
    (3240, 5000, "ok"),          # genau 90 %
    (3241, 5000, "tight"),
    (3740, 5000, "tight"),       # genau 100 %
    (3741, 5000, "no"),
    (100, 0, "no"),              # nichts nutzbar (z. B. belegte Karte)
])
def test_stufen_an_den_grenzen(size, usable, level):
    # params_b = 0: nur Cache-Grundlast 960 MB + Puffer 300 MB, damit die Grenzen exakt rechenbar sind
    assert f.fit(size, 0, usable).level == level


def test_label_und_verhaeltnis():
    r = f.fit(2240, 0, 5000)
    assert (r.label, r.need_mb, r.ratio) == ("passt gut", 3500, 0.7)
    assert f.fit(9999, 0, 5000).label == "zu groß"


def test_schaetzung_dicht_und_moe():
    dense = f.estimate(5120, 8.0, None, 68)                       # 5 GB aus 68 GB/s
    assert dense.tokens_per_s == pytest.approx(68 / 5 * 0.7, abs=0.1)
    assert dense.seconds_per_decision == pytest.approx(90 / dense.tokens_per_s + 1.2, abs=0.1)
    moe = f.estimate(18 * 1024, 30.0, 3.0, 68)                    # nur 3 von 30 Milliarden Parametern sind aktiv
    assert moe.seconds_per_decision < dense.seconds_per_decision
    unknown_active = f.estimate(18 * 1024, 30.0, None, 68)       # ohne Angabe: pessimistisch die ganze Datei
    assert unknown_active.seconds_per_decision > moe.seconds_per_decision * 5


def test_quant_aus_dateinamen():
    assert f.quant_of("Qwen3-8B-Q4_K_M.gguf") == "Q4_K_M"
    assert f.quant_of("Qwen3.8-27B-UD-Q4_K_XL.gguf") == "Q4_K_XL"
    assert f.quant_of("gemma-4-12b-it-IQ4_XS.gguf") == "IQ4_XS"
    assert f.quant_of("LFM2.5-24B-A2B-QAD-Q4_0.gguf") == "Q4_0"
    assert f.quant_of("qwen2.5-coder-7b-instruct-q4_k_m.gguf") == "Q4_K_M"
    assert f.quant_of("Mellum-MXFP4_MOE.gguf") == "MXFP4_MOE"
    assert f.quant_of("ModelNameOhneQuant.gguf") is None


def test_nur_q4_bis_q8_kommt_in_frage():
    assert [f.quant_bits(q) for q in ("Q4_K_M", "IQ4_XS", "Q5_0", "Q6_K", "Q8_0", "Q8_K_XL")] == [4, 4, 5, 6, 8, 8]
    assert all(f.quant_bits(q) is None for q in ("Q2_K", "IQ3_XXS", "Q3_K_M", "IQ1_S", "BF16", "F16", "MXFP4"))


def test_parameter_und_aktive_aus_dem_namen():
    assert f.params_from_name("Qwen3-30B-A3B-GGUF") == 30 and f.active_from_name("Qwen3-30B-A3B-GGUF") == 3
    assert f.params_from_name("LFM2.5-24B-A2B") == 24 and f.active_from_name("Mellum2.1-12B-A2.5B-Thinking") == 2.5
    assert f.params_from_name("gemma-4-E4B-it") == 4 and f.params_from_name("Qwen3-0.6B") == 0.6
    assert f.params_from_name("Qwen3.8-27B") == 27 and f.params_from_name("Phi-4-mini") is None
    assert f.active_from_name("Qwen3-8B") is None
    assert 8 < f.params_from_size(4795, "Q4_K_M") < 9             # 5 GB bei 4,8 Bit je Gewicht


def test_nutzbarer_speicher_je_art():
    assert machine("metal", 16).usable_mb == 10922
    assert machine("nvidia", 0, 12, free_gb=10).usable_mb == int(10 * 1024 * 0.95)
    assert machine("cpu", 16).usable_mb == int(16384 * 0.6)


def variant(m: Hardware, quant: str, size_mb: float, params=8.0) -> Variant:
    return make_variant(f"M-{quant}.gguf", quant, size_mb, None, params, None, m)


def test_standarddatei_ist_q4_k_m_sonst_naechstbeste_die_passt():
    m = machine("nvidia", 0, 8)                                    # 7,6 GB nutzbar
    vs = [variant(m, "Q8_0", 8700), variant(m, "Q6_K", 6700), variant(m, "Q5_K_M", 5800), variant(m, "Q4_K_M", 5000), variant(m, "Q4_K_S", 4700)]
    assert pick_variant(vs).quant == "Q4_K_M"
    assert pick_variant([v for v in vs if v.quant != "Q4_K_M"]).quant == "Q4_K_S"
    only_big = [variant(m, "Q8_0", 8700), variant(m, "Q6_K", 6700)]
    assert pick_variant(only_big).quant == "Q6_K" and pick_variant(only_big).fit.level == "no"      # passt nichts: die kleinste Datei
    mid = [variant(m, "Q5_K_M", 5800), variant(m, "Q8_0", 8700)]
    assert pick_variant(mid).quant == "Q5_K_M" and pick_variant(mid).fit.level == "tight"           # knapp zählt noch als passend


def item(name: str, size: float, m: Hardware, source="live", gated=False, downloads=0) -> Item:
    v = variant(m, "Q4_K_M", size)
    return Item(f"x/{name}", name, "x", None, source, v, [v], 8.0, gated=gated, downloads=downloads)


def test_rangfolge_und_empfehlung(m1):
    a, b, c = item("a", 3000, m1), item("b", 4800, m1, "curated"), item("c", 4800, m1, downloads=9)
    ok, tight, big = item("ok", 7100, m1), item("tight", 9000, m1), item("big", 11000, m1)
    gated = item("gated", 4000, m1, gated=True)
    assert [i.variant.fit.level for i in (a, b, ok, tight, big)] == ["good", "good", "ok", "tight", "no"]
    allitems = [a, gated, big, c, tight, ok, b]
    assert [i.name for i in sorted(allitems, key=rank_key)] == ["b", "c", "a", "ok", "tight", "big", "gated"]   # gesperrte zuletzt
    assert [i.name for i in recommend(allitems)] == ["b", "c", "a"]
    assert recommend([big]) == [] and recommend([gated]) == []
    assert [i.name for i in recommend([ok, tight, big])] == ["ok"]          # gibt es nichts, das gut passt, zählt die nächste Stufe
    assert [i.name for i in recommend([tight, big])] == ["tight"]
