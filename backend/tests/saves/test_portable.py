"""Export und Import: identischer Stand, strenge Prüfung manipulierter Dateien, nie über den Live-Stand."""

import hashlib
import io
import json
import sqlite3
import zipfile

import pytest

from simulacra.saves.service import SaveError

from .conftest import dump


def rezip(data: bytes, *, db=None, manifest_update=None, extra=None, drop=None) -> bytes:
    """ZIP mit veränderten Teilen neu bauen; die Prüfsumme im Manifest passt zur (veränderten) Datenbank, damit die jeweils andere Prüfung greift."""
    z = zipfile.ZipFile(io.BytesIO(data))
    state, manifest = z.read("state.db"), json.loads(z.read("manifest.json"))
    state = db(state) if db else state
    manifest["sha256"] = hashlib.sha256(state).hexdigest()
    manifest.update(manifest_update or {})
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as w:
        if drop != "state.db":
            w.writestr("state.db", state)
        if drop != "manifest.json":
            w.writestr("manifest.json", json.dumps(manifest))
        for name, content in (extra or {}).items():
            w.writestr(name, content)
    return out.getvalue()


def edit_db(tmp_path, sql):
    def go(state: bytes) -> bytes:
        p = tmp_path / "edit.db"
        p.write_bytes(state)
        c = sqlite3.connect(p)
        c.executescript(sql)
        c.commit()
        c.close()
        return p.read_bytes()
    return go


@pytest.fixture
async def exported(sim):
    await sim.runner.step(30)
    entry = await sim.engine.db.run(lambda: sim.saves.create("Export-Test", "für den Test"))
    data, filename = await sim.engine.db.run(lambda: sim.saves.export(entry["id"]))
    return entry, data, filename


async def test_export_contains_state_and_manifest(exported):
    entry, data, filename = exported
    z = zipfile.ZipFile(io.BytesIO(data))
    assert sorted(z.namelist()) == ["manifest.json", "state.db"] and filename == "simulacra-Export-Test.zip"
    m = json.loads(z.read("manifest.json"))
    assert m["format"] == 1 and m["name"] == "Export-Test" and m["sim_minute"] == entry["sim_minute"] and m["sha256"] == hashlib.sha256(z.read("state.db")).hexdigest()
    assert m["schema_version"] == entry["schema_version"] and m["contents"]["events"] > 0 and m["app_version"]


async def test_export_then_import_gives_an_identical_new_save_and_leaves_the_live_state_alone(sim, exported):
    entry, data, _ = exported
    live_minute = sim.engine.minute
    imported = await sim.engine.db.run(lambda: sim.saves.import_bytes(data))
    assert imported["kind"] == "import" and imported["id"] != entry["id"] and imported["name"] == "Export-Test (Import)" and imported["sim_minute"] == entry["sim_minute"]
    assert dump(sim.saves.index.path(imported["id"])) == dump(sim.saves.index.path(entry["id"]))
    assert sim.engine.minute == live_minute and len(sim.saves.list()) == 2
    again = await sim.engine.db.run(lambda: sim.saves.import_bytes(data))                                     # derselbe Import zweimal: eigener Name
    assert again["name"] == "Export-Test (Import) 2"
    await sim.load_save(imported["id"])                                                                        # und der importierte Stand lässt sich laden
    assert sim.engine.minute == entry["sim_minute"]


async def test_tampered_or_foreign_files_are_rejected(sim, exported, tmp_path):
    _, data, _ = exported
    before = len(sim.saves.list())
    cases = {
        "keine ZIP-Datei": b"das ist kein zip",
        "Prüfsumme": _swap_state_keep_manifest(data),
        "fremde Datei im ZIP": rezip(data, extra={"evil.sh": "rm -rf /"}),
        "Manifest fehlt": rezip(data, drop="manifest.json"),
        "Datenbank fehlt": rezip(data, drop="state.db"),
        "neuere Schema-Version": rezip(data, manifest_update={"schema_version": 999}),
        "falsches Format": rezip(data, manifest_update={"format": 2}),
        "fremde Tabelle": rezip(data, db=edit_db(tmp_path, "CREATE TABLE passwoerter(x);")),
        "Auslöser": rezip(data, db=edit_db(tmp_path, "CREATE TRIGGER t AFTER INSERT ON events BEGIN DELETE FROM memories; END;")),
        "Sicht": rezip(data, db=edit_db(tmp_path, "CREATE VIEW v AS SELECT * FROM events;")),
        "Schema der Datenbank neuer": rezip(data, db=edit_db(tmp_path, "PRAGMA user_version = 99;"), manifest_update={"schema_version": 99}),
    }
    for label, blob in cases.items():
        with pytest.raises(SaveError) as e:
            await sim.engine.db.run(lambda b=blob: sim.saves.import_bytes(b))
        assert e.value.status == 422, label
    assert len(sim.saves.list()) == before and not list(sim.saves.dir.glob("import*"))                      # nichts angelegt


def _swap_state_keep_manifest(data: bytes) -> bytes:
    z = zipfile.ZipFile(io.BytesIO(data))
    state = bytearray(z.read("state.db"))
    state[100] ^= 0xFF                                                                                         # ein Byte verändert, das Manifest nennt noch die alte Prüfsumme
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as w:
        w.writestr("state.db", bytes(state))
        w.writestr("manifest.json", z.read("manifest.json"))
    return out.getvalue()


async def test_reasons_are_understandable(sim, exported):
    _, data, _ = exported
    for blob, text in ((_swap_state_keep_manifest(data), "Prüfsumme"), (rezip(data, manifest_update={"schema_version": 999}), "neueren Version"), (b"x", "keine ZIP")):
        with pytest.raises(SaveError) as e:
            await sim.engine.db.run(lambda b=blob: sim.saves.import_bytes(b))
        assert text in e.value.text


async def test_a_database_that_fails_the_integrity_check_is_rejected(sim, exported):
    _, data, _ = exported
    z = zipfile.ZipFile(io.BytesIO(data))
    state = bytearray(z.read("state.db"))
    for i in range(4096 * 3, 4096 * 3 + 200):                                                                  # eine ganze Seite zerstören, Prüfsumme neu berechnen
        state[i] = 0xAB
    blob = rezip(data, db=lambda s: bytes(state))
    with pytest.raises(SaveError) as e:
        await sim.engine.db.run(lambda: sim.saves.import_bytes(blob))
    assert e.value.status == 422
