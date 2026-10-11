"""Entwicklungswerkzeug: Welt anzeigen und Aktionen von Hand ausführen.

    python -m simulacra.cli world init                  # neue Welt in data/live.db anlegen (nie überschreiben)
    python -m simulacra.cli world show                  # Uhr, Wetter, Agenten
    python -m simulacra.cli world map                   # ASCII-Karte
    python -m simulacra.cli world act alex move_to target=lake
    python -m simulacra.cli world act alex plant seedbed_id=seedbed_1
    python -m simulacra.cli world tick 30
    python -m simulacra.cli world events --since 100 --type agent.dialogue
    python -m simulacra.cli world log alex
"""

import argparse
import json
import sys
from pathlib import Path

from .config import get_settings
from .db.connection import Database
from .world import clock
from .world.engine import WorldEngine
from .world.models import Event

QUIET = {"agent.moved"}  # nur mit -v ausgeben
MAX_WAIT_TICKS = 3000


def _parse_value(v: str):
    try:
        return json.loads(v)
    except ValueError:
        return v


def _fmt_event(e: Event) -> str:
    data = json.dumps(e.data, ensure_ascii=False)
    if len(data) > 160:
        data = data[:157] + "..."
    return f"{clock.fmt(e.sim_minute)}  #{e.seq:<5} {e.type:<28} {','.join(e.agents):<10} {data}"


def _open(args) -> WorldEngine:
    path = Path(args.db) if args.db else get_settings().data_dir / "live.db"
    if args.command != "init" and not path.exists():
        sys.exit(f"Keine Welt unter {path}. Zuerst: python -m simulacra.cli world init")
    path.parent.mkdir(parents=True, exist_ok=True)
    return WorldEngine(Database(path))


def cmd_init(args) -> int:
    eng = _open(args)
    if eng.state.is_seeded():
        print(f"Abbruch: {eng.db.path} enthält bereits eine Welt. Zum Neuanlegen die Datei selbst löschen.")
        return 1
    eng = WorldEngine.create(eng.db, seed=args.seed)
    print(f"Welt '{eng.state.get_meta('world_name')}' angelegt in {eng.db.path} ({clock.fmt(eng.minute)}).")
    return 0


def cmd_show(eng: WorldEngine, args) -> int:
    st = eng.state
    snap = clock.snapshot(eng.minute)
    w = st.weather()
    print(f"{clock.fmt(eng.minute)} ({snap['weekday']}, {snap['phase']}, Licht {snap['daylight']:.2f})  Wetter: {w['kind']} bis {clock.fmt(w['until'])}")
    for a in st.agents():
        act = a.action.type if a.action else "-"
        needs = " ".join(f"{k} {v:.0f}" for k, v in a.needs.items())
        held = [o.name for o in st.objects_held(a.id)]
        print(f"  {a.name:<6} {a.pos} {a.location_id:<16} Aktion: {act:<8} Bedürfnisse: {needs}  Inventar: {a.inventory or '-'} Gegenstände: {held or '-'}")
    print(f"  Objekte: {st.object_count()} in der Welt, Ereignisse: {st.conn.execute('SELECT COUNT(*) c FROM events').fetchone()['c']}")
    return 0


def cmd_map(eng: WorldEngine, args) -> int:
    st, g = eng.state, eng.state.grid
    sym = {"grass": ".", "path": ",", "floor": "_", "wall": "#", "water": "~", "tree": "T", "door": "+", "sand": "s"}
    rows = [[sym[g.tile(x, y)] for x in range(g.width)] for y in range(g.height)]
    for o in st.all_objects():
        if o.x is not None and not o.hidden:
            rows[o.y][o.x] = "o" if o.kind not in ("plant", "construction_site") else ("*" if o.kind == "plant" else "x")
    for n in st.all_nodes():
        rows[n.y][n.x] = "r"
    for a in st.agents():
        rows[a.y][a.x] = a.name[0].upper()
    print("\n".join("".join(r) for r in rows))
    print("o Objekt  r Ressourcenquelle  * Pflanze  x Baustelle  Buchstabe = Agent")
    return 0


def cmd_act(eng: WorldEngine, args) -> int:
    params = {}
    for kv in args.params:
        k, _, v = kv.partition("=")
        params[k] = _parse_value(v)
    res = eng.propose(args.agent, args.action, params)
    shown = [e for e in res.events if args.verbose or e.type not in QUIET]
    for e in shown:
        print(_fmt_event(e))
    if not res.ok:
        print(f"ABGELEHNT [{res.rejected.code.value}]: {res.rejected.text}")
        return 2
    if args.no_wait:
        return 0
    for _ in range(MAX_WAIT_TICKS):
        a = eng.state.agent(args.agent)
        if a.action is None:
            break
        for e in eng.tick():
            if (args.verbose or e.type not in QUIET) and (args.agent in e.agents or e.type.startswith("world.")):
                print(_fmt_event(e))
    else:
        print("Abbruch: Aktion endete nicht innerhalb des Limits.")
        return 3
    print(f"-> {clock.fmt(eng.minute)}")
    return 0


def cmd_tick(eng: WorldEngine, args) -> int:
    for e in eng.advance(args.n):
        if args.verbose or e.type not in QUIET:
            print(_fmt_event(e))
    print(f"-> {clock.fmt(eng.minute)}")
    return 0


def cmd_events(eng: WorldEngine, args) -> int:
    for e in eng.events_since(args.since, 100000):
        if (not args.type or e.type.startswith(args.type)) and (args.verbose or e.type not in QUIET or args.type):
            print(_fmt_event(e))
    return 0


def cmd_log(eng: WorldEngine, args) -> int:
    for r in reversed(eng.action_history(args.agent, args.limit)):
        print(f"{clock.fmt(r['sim_minute'])}  {r['outcome']:<10} {r['action']} {json.dumps(r['params'], ensure_ascii=False)} {r['code'] or ''} {r['text'] or ''}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="simulacra.cli", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("group", choices=["world"])
    ap.add_argument("command", choices=["init", "show", "map", "act", "tick", "events", "log"])
    ap.add_argument("rest", nargs="*")
    ap.add_argument("--db", help="Pfad der Datenbank (Standard: <SIM_DATA_DIR>/live.db)")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--no-wait", action="store_true", help="act: Aktion nur starten, nicht bis zum Ende simulieren")
    ap.add_argument("--since", type=int, default=0)
    ap.add_argument("--type", default="")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    if args.command == "init":
        return cmd_init(args)
    eng = _open(args)
    if args.command == "act":
        if len(args.rest) < 2:
            ap.error("act braucht: AGENT AKTION [schlüssel=wert ...]")
        args.agent, args.action, args.params = args.rest[0], args.rest[1], args.rest[2:]
        return cmd_act(eng, args)
    if args.command == "tick":
        args.n = int(args.rest[0]) if args.rest else 1
        return cmd_tick(eng, args)
    if args.command == "log":
        args.agent = args.rest[0] if args.rest else "alex"
        return cmd_log(eng, args)
    return {"show": cmd_show, "map": cmd_map, "events": cmd_events}[args.command](eng, args)


if __name__ == "__main__":
    sys.exit(main())
