"""Weltenbibliothek (AP18e): Welten als eigene Dateien, getrennt von Spielständen. Anlegen, Öffnen, Speichern, Kopieren, Umbenennen, Löschen, Export und Import.

Die Welt-Werkstatt arbeitet auf einer Weltdatei, nicht auf der laufenden Simulation: Die Vorschau entsteht in einer Wegwerf-Simulation im Speicher (`/preview`), der Entwurf
liegt im Browser und wird mit `PUT` gespeichert. Die laufende Simulation bleibt unberührt, die Bewohner merken nichts.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from ..generator import service
from ..generator.area import area_patch
from ..generator.generate import WorldInfo
from ..generator.service import ServiceError, Wish
from ..generator.validate import Report
from ..simulation.builder import Simulation
from ..welten.store import WorldError, WorldLibrary, platz_startplatz
from ..world.export import world_file
from .models_welten import (AddAreaOut, AddAreaRequest, BlankRequest, CreateWorldRequest, FromSimRequest, GenerateWorldRequest, PreviewWorldRequest, RenameRequest, SaveWorldRequest,
                            WorldDoc, WorldInfoOut)

router = APIRouter(prefix="/api/worlds")


def library_of(request: Request) -> WorldLibrary:
    app = request.app
    if getattr(app.state, "library", None) is None:
        db_path = app.state.sim.db_path
        app.state.library = WorldLibrary(None if db_path == ":memory:" else Path(db_path).parent / "welten")
    return app.state.library


def _fail(e: WorldError) -> HTTPException:
    return HTTPException(e.status, "\n".join([e.text] + e.errors))


def _doc(lib: WorldLibrary, wid: str) -> WorldDoc:
    try:
        world, info = lib.get(wid)
    except WorldError as e:
        raise _fail(e) from None
    return WorldDoc(info=WorldInfoOut(**info), world=world)


@router.get("", response_model=list[WorldInfoOut])
async def list_worlds(request: Request):
    return library_of(request).list()


@router.post("", response_model=WorldInfoOut)
async def create(request: Request, body: CreateWorldRequest):
    """Speichern als: legt eine Weltdatei (Entwurf der Werkstatt) unter neuem Namen als eigene Welt an."""
    try:
        return library_of(request).add(body.world, "kopie", name=body.name)
    except WorldError as e:
        raise _fail(e) from None


@router.post("/blank", response_model=WorldInfoOut)
async def blank(request: Request, body: BlankRequest):
    try:
        return library_of(request).blank(body.name, body.size, body.edge)
    except WorldError as e:
        raise _fail(e) from None


@router.post("/generate", response_model=WorldInfoOut)
async def generate(request: Request, body: GenerateWorldRequest):
    """Eine Welt mit einem Dorf erzeugen und in die Bibliothek legen (ohne Bewohner). Derselbe Seed ergibt dieselbe Welt."""
    try:
        world, rep = service.make_world(Wish.of("new", body.seed, body.lake, body.mix, body.style.model_dump() if body.style else None))
        world = {**world, "agents": [], "startplatz": platz_startplatz(world)}
        return library_of(request).add(world, "erzeugt", seed=world["generator"]["seed"], name=body.name or world["name"])
    except ServiceError as e:
        raise HTTPException(e.status, e.text) from None
    except WorldError as e:
        raise _fail(e) from None


@router.post("/from-sim", response_model=WorldInfoOut)
async def from_sim(request: Request, body: FromSimRequest):
    """Die laufende Welt ohne Bewohner und Gedächtnis als Welt sichern."""
    sim = request.app.state.sim
    world = await sim.engine.db.run(lambda: world_file(sim.engine.state, body.name))
    try:
        return library_of(request).add(world, "spiel", name=body.name)
    except WorldError as e:
        raise _fail(e) from None


@router.post("/import", response_model=WorldInfoOut)
async def import_world(request: Request):
    """Eine Weltdatei (JSON, so wie der Export sie liefert) als neue Welt anlegen. Sie wird vollständig geprüft."""
    try:
        return library_of(request).import_bytes(await request.body())
    except WorldError as e:
        raise _fail(e) from None


@router.post("/preview")
async def preview(request: Request, body: PreviewWorldRequest):
    """Vorschau eines Entwurfs: Weltdatei in einer Wegwerf-Simulation im Speicher, daraus der Zustandsabzug. Ändert nichts."""
    from .. import welten
    sim = request.app.state.sim
    errs = welten.store.check_world(body.world)
    if errs:
        raise HTTPException(422, "\n".join(errs))
    return await service.preview_world(sim, body.world, Report())


@router.post("/add-area", response_model=AddAreaOut)
async def add_area(request: Request, body: AddAreaRequest):
    """Gebiet erzeugen: fügt der Welt ein Dorf an (der Generator als Werkzeug der Werkstatt). Gibt die neue Weltdatei zurück; gespeichert wird erst mit `PUT`."""
    from .. import welten
    from ..generator.generate import GenerationError
    errs = welten.store.check_world(body.world)
    if errs:
        raise HTTPException(422, "\n".join(errs))
    sim = request.app.state.sim
    w = Wish.of("extend", body.seed, body.lake, body.mix)
    world = body.world
    tmp = Simulation.create(sim.settings, ":memory:", sim.provider, world=world)
    try:
        def work():
            if body.at is None:
                patch, rep = service.make_extension(tmp, w)
            else:
                patch, rep = area_patch(WorldInfo.from_state(tmp.engine.state), w.seed, (body.at[0], body.at[1]), lake=w.lake, mix=w.mix_dict())
            res = tmp.engine.edit.apply_generated(patch, {"kind": "extend", "seed": w.seed, "requested_seed": w.seed, "village": "?"})
            return world_file(tmp.engine.state, world["name"]) | {"startplatz": world.get("startplatz")}, rep, service._meta(patch)[0], res
        out, rep, village, _ = await tmp.engine.db.run(work)
    except (ServiceError, GenerationError) as e:
        return AddAreaOut(ok=False, error=getattr(e, "text", str(e)))
    finally:
        tmp.close()
    return AddAreaOut(ok=rep.ok, village=village, world=out, report=rep.as_dict())


@router.get("/{wid}", response_model=WorldDoc)
async def get_world(request: Request, wid: str):
    return _doc(library_of(request), wid)


@router.put("/{wid}", response_model=WorldInfoOut)
async def save_world(request: Request, wid: str, body: SaveWorldRequest):
    try:
        return library_of(request).save(wid, body.world)
    except WorldError as e:
        raise _fail(e) from None


@router.patch("/{wid}", response_model=WorldInfoOut)
async def rename(request: Request, wid: str, body: RenameRequest):
    try:
        return library_of(request).rename(wid, body.name)
    except WorldError as e:
        raise _fail(e) from None


@router.delete("/{wid}", status_code=204)
async def delete(request: Request, wid: str):
    try:
        library_of(request).delete(wid)
    except WorldError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/{wid}/duplicate", response_model=WorldInfoOut)
async def duplicate(request: Request, wid: str):
    try:
        return library_of(request).duplicate(wid)
    except WorldError as e:
        raise _fail(e) from None


@router.get("/{wid}/export")
async def export(request: Request, wid: str):
    try:
        data = library_of(request).export_bytes(wid)
    except WorldError as e:
        raise _fail(e) from None
    return Response(data, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{wid}.welt.json"'})
