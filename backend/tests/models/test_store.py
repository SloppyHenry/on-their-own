"""Bestand der installierten Modelle (AP17c-3)."""

from on_their_own.models.store import Installed, ModelStore

from .fakes import put_model


def test_leer(tmp_path):
    s = ModelStore(tmp_path)
    assert s.list() == [] and s.get("x") is None and s.probes() == {} and s.delete("x") is False


def test_dateien_von_aussen_erscheinen_ohne_herkunft(tmp_path):
    put_model(tmp_path, "Qwen3-8B-Q4_K_M")
    (tmp_path / "models" / "halb.gguf.part").write_text("x")
    (tmp_path / "models" / "readme.txt").write_text("x")
    [m] = ModelStore(tmp_path).list()
    assert (m.id, m.file, m.source, m.repo, m.sha256, m.quant) == ("Qwen3-8B-Q4_K_M", "Qwen3-8B-Q4_K_M.gguf", "extern", None, None, "Q4_K_M")


def test_eintrag_mit_herkunft_und_aenderung_der_datei(tmp_path):
    s = ModelStore(tmp_path)
    f = put_model(tmp_path, "m-Q4_K_M", "abc")
    s.add(Installed("m-Q4_K_M", f.name, "M", 3, "Q4_K_M", "a/b", "f" * 64, "Apache-2.0"))
    [m] = s.list()
    assert m.source == "tool" and m.repo == "a/b" and m.license == "Apache-2.0" and m.installed_at
    f.write_text("anders und länger")                                       # Größe passt nicht mehr zum Eintrag: nicht mehr als geprüft ausgeben
    assert s.list()[0].source == "extern" and s.list()[0].sha256 is None


def test_loeschen_entfernt_datei_eintrag_und_messung(tmp_path):
    s = ModelStore(tmp_path)
    f = put_model(tmp_path, "m", "abc")
    s.add(Installed("m", f.name, "M", 3))
    s.save_probe("m", {"seal": "checked"})
    assert s.delete("m") is True
    assert not f.exists() and s.list() == [] and s.probes() == {} and s.delete("m") is False
    assert "m" not in (tmp_path / "models" / "installed.json").read_text()


def test_kaputte_dateien_stoeren_nicht(tmp_path):
    (tmp_path / "models").mkdir()
    (tmp_path / "models" / "installed.json").write_text("{kein json")
    (tmp_path / "models" / "probes.json").write_text("[1,2]")
    put_model(tmp_path, "m")
    assert [m.id for m in ModelStore(tmp_path).list()] == ["m"] and ModelStore(tmp_path).probes() == {}
