"""Welten als Dateien: `data/welten/<id>/welt.json` (Weltdatei wie `world_default.json`, ohne Bewohner und Gedächtnis) und `info.json` (Name, Herkunft, Größe, Zähler, Zeit).

Mitgeliefert sind das „Dorf am See“ (die Startwelt) und drei erzeugte Beispieldörfer; sie sind schreibgeschützt („Kopie bearbeiten“) und liegen nicht auf der Platte, sondern entstehen
aus der Programmdatei beziehungsweise dem Generator (deterministisch aus festem Seed). Export ist die Weltdatei selbst (eine JSON-Datei), Import prüft sie vollständig und
legt immer eine neue Welt an. Spielstände bleiben von alledem unberührt.
"""

import copy
import json
import re
import shutil
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

from ..db.connection import Database
from ..generator import blank
from ..generator.stil import Stil
from ..generator.generate import GenerationError, default_mix, new_world
from ..world import loader

MAX_SIZE = 256
MAX_BYTES = 8 * 1024 * 1024
MAX_WORLDS = 100
ORIGINS = ("mitgeliefert", "leer", "erzeugt", "kopie", "import", "spiel")
EXAMPLES = (("ahornthal", 58, "Ahornthal", "anger", "Dorfwiese mit Ringstraßen"), ("birkenau", 12, "Birkenau", "fluss", "Straße am Fluss, Brücke nach Süden"), ("moorhain", 31, "Moorhain", "streu", "verstreute Höfe an Gassen"))
START_ID = "dorf-am-see"


def platz_startplatz(w: dict) -> list[int] | None:
    """Die Kachel am Dorfplatz (südlich der Mitte) als Startplatz einer erzeugten Welt; None ohne Platz."""
    try:
        r = w["look"]["regions"][0]
        sq = r["shapes"]["squares"][0]
        return [int((r["frame"][0] + sq["x"]) // 16), int((r["frame"][1] + sq["y"] + 10) // 16)]
    except (KeyError, IndexError, TypeError):
        return None


class WorldError(Exception):
    def __init__(self, status: int, text: str, errors: list[str] | None = None):
        super().__init__(text)
        self.status, self.text, self.errors = status, text, errors or []


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40] or "welt"


def _stats(w: dict) -> dict[str, Any]:
    houses = sum(1 for r in ((w.get("look") or {}).get("regions") or []) for _ in r.get("houses", []))
    return {"houses": houses, "locations": len(w["locations"]), "objects": len(w["objects"]), "lakes": sum(len(r["shapes"].get("lakes", [])) for r in ((w.get("look") or {}).get("regions") or []))}


def check_world(w: Any) -> list[str]:
    """Prüft eine Weltdatei vollständig (alle Fehler auf einmal): Aufbau, Größe und ob die Engine sie einlesen kann."""
    if not isinstance(w, dict):
        return ["Die Datei enthält keine Welt (erwartet ein JSON-Objekt)."]
    missing = [k for k in ("schema", "tile_types", "name", "size", "tiles", "locations", "objects", "resource_nodes", "start") if k not in w]
    if missing:
        return [f"Es fehlen Felder: {', '.join(missing)}."]
    errs: list[str] = []
    try:
        W, H = w["size"]
        if not (isinstance(W, int) and isinstance(H, int) and 8 <= W <= MAX_SIZE and 8 <= H <= MAX_SIZE):
            errs.append(f"Die Karte muss zwischen 8×8 und {MAX_SIZE}×{MAX_SIZE} Kacheln groß sein.")
    except (TypeError, ValueError):
        errs.append("size muss [Breite, Höhe] sein.")
    if not isinstance(w["name"], str) or not 1 <= len(w["name"]) <= 60:
        errs.append("Der Name muss 1 bis 60 Zeichen lang sein.")
    if errs:
        return errs
    try:
        db = Database(":memory:")
        try:
            loader.seed_world(db, {**copy.deepcopy(w), "agents": [], "start": w["start"]})
        finally:
            db.close()
    except Exception as e:                                                                  # noqa: BLE001 - jede Unstimmigkeit der Datei wird gemeldet
        errs.append(f"Die Welt lässt sich nicht einlesen: {e}")
    return errs


class WorldLibrary:
    def __init__(self, root: Path | None):
        self.root = root
        self._mem: dict[str, tuple[dict, dict]] = {}                    # ohne Verzeichnis (Tests): Welten im Speicher
        self._builtin: dict[str, tuple[dict, dict]] = {}

    # --- mitgelieferte Welten ----------------------------------------------------------------------------------------
    def _builtins(self) -> dict[str, tuple[dict, dict]]:
        if not self._builtin:
            start = loader.load_world_file(loader.DATA_DIR / "world_default.json")
            self._builtin[START_ID] = (self._strip_agents(start, keep=True), self._info(START_ID, start, "mitgeliefert", readonly=True, note="Alex und Mira, Heimhaus mit fünf Räumen"))
            for wid, seed, name, form, note in EXAMPLES:
                try:
                    world, _ = new_world(seed, name=name, residents=[{"id": f"r{i}", "name": f"R{i}", "home": None} for i in range(1, 9)], mix=default_mix(8), stil=Stil(form=form))
                except GenerationError:
                    continue
                world = self._strip_agents(world)
                world["startplatz"] = platz_startplatz(world)
                self._builtin[wid] = (world, self._info(wid, world, "mitgeliefert", readonly=True, seed=seed, note=note))
        return self._builtin

    @staticmethod
    def _strip_agents(w: dict, keep: bool = False) -> dict:
        w = copy.deepcopy(w)
        if not keep:
            w["agents"] = []
        return w

    @staticmethod
    def _info(wid: str, w: dict, origin: str, readonly: bool = False, seed: int | None = None, note: str = "") -> dict[str, Any]:
        now = datetime.now().isoformat(timespec="seconds")
        return {"id": wid, "name": w["name"], "origin": origin, "readonly": readonly, "size": w["size"], "seed": seed, "note": note, "created": now, "changed": now,
                "startplatz": bool(w.get("startplatz")) or readonly, **_stats(w)}

    # --- Platte ------------------------------------------------------------------------------------------------------
    def _dir(self, wid: str) -> Path:
        return self.root / wid                                           # type: ignore[operator]

    def _ids(self) -> list[str]:
        if self.root is None:
            return sorted(self._mem)
        return sorted(p.name for p in self.root.iterdir() if (p / "welt.json").is_file()) if self.root.exists() else []

    def _read(self, wid: str) -> tuple[dict, dict] | None:
        if wid in self._builtins():
            return copy.deepcopy(self._builtins()[wid][0]), dict(self._builtins()[wid][1])
        if self.root is None:
            hit = self._mem.get(wid)
            return (copy.deepcopy(hit[0]), dict(hit[1])) if hit else None
        d = self._dir(wid)
        if not (d / "welt.json").is_file():
            return None
        try:
            return json.loads((d / "welt.json").read_text(encoding="utf-8")), json.loads((d / "info.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None

    def _write(self, wid: str, world: dict, info: dict) -> None:
        info = {**info, **_stats(world), "name": world["name"], "size": world["size"], "startplatz": bool(world.get("startplatz")), "changed": datetime.now().isoformat(timespec="seconds")}
        if self.root is None:
            self._mem[wid] = (copy.deepcopy(world), info)
            return
        d = self._dir(wid)
        d.mkdir(parents=True, exist_ok=True)
        (d / "welt.json").write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (d / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")

    # --- Öffentliche Aufgaben ------------------------------------------------------------------------------------------
    def list(self) -> list[dict[str, Any]]:
        out = [dict(i) for _, i in self._builtins().values()]
        for wid in self._ids():
            r = self._read(wid)
            if r and wid not in self._builtins():
                out.append(r[1])
        return out

    def get(self, wid: str) -> tuple[dict, dict]:
        r = self._read(wid)
        if r is None:
            raise WorldError(404, f"Diese Welt gibt es nicht (mehr): {wid}.")
        return r

    def _free_id(self, name: str) -> str:
        base = slug(name)
        taken = set(self._ids()) | set(self._builtins())
        wid, n = base, 2
        while wid in taken:
            wid, n = f"{base}-{n}", n + 1
        return wid

    def add(self, world: dict, origin: str, seed: int | None = None, name: str | None = None) -> dict[str, Any]:
        if len(self._ids()) >= MAX_WORLDS:
            raise WorldError(409, f"Die Bibliothek ist voll (höchstens {MAX_WORLDS} eigene Welten).")
        if name:
            world = {**world, "name": name.strip()[:60]}
        errs = check_world(world)
        if errs:
            raise WorldError(422, "Diese Welt ist nicht gültig.", errs)
        wid = self._free_id(world["name"])
        info = self._info(wid, world, origin, seed=seed)
        self._write(wid, world, info)
        return self._read(wid)[1]                                       # type: ignore[index]

    def _writable(self, wid: str) -> tuple[dict, dict]:
        world, info = self.get(wid)
        if info.get("readonly"):
            raise WorldError(403, "Diese Welt ist mitgeliefert und schreibgeschützt. „Kopie bearbeiten“ legt eine eigene an.")
        return world, info

    def save(self, wid: str, world: dict) -> dict[str, Any]:
        _, info = self._writable(wid)
        errs = check_world(world)
        if errs:
            raise WorldError(422, "Diese Welt ist nicht gültig.", errs)
        self._write(wid, world, info)
        return self.get(wid)[1]

    def rename(self, wid: str, name: str) -> dict[str, Any]:
        world, info = self._writable(wid)
        name = name.strip()
        if not 1 <= len(name) <= 60:
            raise WorldError(422, "Der Name muss 1 bis 60 Zeichen lang sein.")
        world["name"] = name
        self._write(wid, world, info)
        return self.get(wid)[1]

    def delete(self, wid: str) -> None:
        self._writable(wid)
        if self.root is None:
            self._mem.pop(wid, None)
        else:
            shutil.rmtree(self._dir(wid), ignore_errors=True)

    def duplicate(self, wid: str) -> dict[str, Any]:
        world, info = self.get(wid)
        copy_name = f"{world['name']} (Kopie)"[:60]
        return self.add(world, "kopie", seed=info.get("seed"), name=copy_name)

    def export_bytes(self, wid: str) -> bytes:
        world, _ = self.get(wid)
        return json.dumps(world, ensure_ascii=False, indent=1).encode("utf-8")

    def import_bytes(self, data: bytes) -> dict[str, Any]:
        if len(data) > MAX_BYTES:
            raise WorldError(413, f"Die Datei ist größer als {MAX_BYTES // 1024 // 1024} MB.")
        try:
            world = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as e:
            raise WorldError(422, f"Die Datei ist kein gültiges JSON: {e}") from None
        return self.add(world, "import")

    def blank(self, name: str, size: str, edge: str) -> dict[str, Any]:
        try:
            return self.add(blank.blank_world(name, size, edge), "leer", name=name)
        except ValueError as e:
            raise WorldError(422, str(e)) from None
