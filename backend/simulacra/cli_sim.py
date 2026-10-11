"""Konsole für die Simulation mit Agenten: Stapellauf, interaktive Steuerung, Entscheidungsprotokoll."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from .config import Settings, get_settings
from .llm.providers import FakeProvider, LLMError, OpenAICompatProvider, first_option_fn
from .simulation.builder import Simulation
from .world import clock
from .world.models import Event, ProposeResult

SHOWN = {"agent.dialogue", "conversation.started", "conversation.ended", "conversation.proposal_accepted", "conversation.proposal_declined",
         "agent.decision_failed", "agent.action_failed", "agent.action_rejected", "agent.location_discovered", "world.weather_changed",
         "world.object_created", "simulation.started", "simulation.paused", "simulation.resumed", "simulation.stopped"}


def hm(minute: int) -> str:
    return clock.fmt(minute).replace("Tag ", "T")


def make_sim(args) -> Simulation:
    s = get_settings()
    if args.model:
        s = Settings(**{**s.model_dump(exclude={"llm_api_key"}), "llm_model": args.model})
    path = Path(args.db) if args.db else s.data_dir / "live.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    provider = FakeProvider(fn=first_option_fn) if args.provider == "first" else None
    return Simulation.create(s, path, provider)


def attach_printer(sim: Simulation, quiet: bool = False) -> None:
    if quiet:
        return
    names = {a.id: a.name for a in sim.engine.state.agents()}

    def on_events(events: list[Event]) -> None:
        for e in events:
            if e.type not in SHOWN:
                continue
            if e.type == "agent.dialogue":
                print(f"{hm(e.sim_minute)}  💬 {names[e.data['speaker']]} → {names[e.data['to']]}: «{e.data['text']}»")
            elif e.type == "conversation.ended":
                print(f"{hm(e.sim_minute)}  ·  Gespräch beendet ({e.data['reason_text']}, {e.data['turns']} Beiträge)")
            elif e.type.startswith("conversation.proposal"):
                print(f"{hm(e.sim_minute)}  ·  Vorschlag {'angenommen' if e.type.endswith('accepted') else 'abgelehnt'}: «{e.data['proposal']}»")
            elif e.type == "world.weather_changed":
                print(f"{hm(e.sim_minute)}  ☁  Wetter: {e.data['to']}")
            elif e.type == "world.object_created":
                print(f"{hm(e.sim_minute)}  ✚  neu: {e.data['object']['name']}")
            elif e.type == "agent.location_discovered":
                print(f"{hm(e.sim_minute)}  ⌖  {names[e.agents[0]]} entdeckt: {e.data['location']}")
            elif e.type.startswith("simulation."):
                print(f"{hm(e.sim_minute)}  ▶  {e.type.split('.')[1]}")
            elif e.type in ("agent.action_failed", "agent.action_rejected"):
                print(f"{hm(e.sim_minute)}  ✗  {names[e.agents[0]]}: {e.data.get('text', '')}")

    def on_decision(d, res: ProposeResult) -> None:
        label = d.chosen.label if d.chosen else f"other: {d.action} {json.dumps(d.params, ensure_ascii=False)}"
        flag = "" if d.status == "valid" else f"  ⚠ RÜCKFALL ({(d.error or '')[:80]})"
        denied = "" if res.ok else f"  ✗ Welt: {res.rejected.text}"
        print(f"{hm(d.minute)}  {names[d.agent_id]:<5} → {label}  [{d.intent}]  ({d.latency_ms / 1000:.1f}s){flag}{denied}")

    sim.runner.event_listeners.append(on_events)
    sim.runner.decision_listeners.append(on_decision)


def summary(sim: Simulation) -> dict:
    return {"lauf": sim.runner.stats.summary(), "modell": sim.client.metrics.summary(),
            "orte": {l.id: l.discovered_by for l in sim.engine.state.locations.values() if l.discovered_by}}


async def check_model(sim: Simulation) -> None:
    prov = sim.client.provider
    if isinstance(prov, OpenAICompatProvider):
        try:
            models = await prov.models()
        except LLMError as e:
            sys.exit(f"Modell nicht erreichbar ({prov.base_url}): {e.text}")
        if sim.client.params.model not in models:
            sys.exit(f"Modell '{sim.client.params.model}' nicht im Router. Verfügbar: {', '.join(models)}")
        print(f"Modell: {sim.client.params.model} @ {prov.base_url}")


async def cmd_run(args) -> int:
    sim = make_sim(args)
    await check_model(sim)
    attach_printer(sim, args.quiet)
    print(f"Start {clock.fmt(sim.engine.minute)} · {args.ticks} Ticks · Welt: {sim.db_path}")
    await sim.runner.start(ticks=args.ticks)
    await sim.runner.wait_finished()
    print(f"\nEnde {clock.fmt(sim.engine.minute)}")
    print(json.dumps(summary(sim), ensure_ascii=False, indent=1))
    sim.close()
    return 0


async def cmd_sim(args) -> int:
    sim = make_sim(args)
    await check_model(sim)
    attach_printer(sim)
    print("Befehle: start [ticks] · pause · resume · step [n] · speed SEKUNDEN · status · quit")
    loop = asyncio.get_running_loop()
    while True:
        line = (await loop.run_in_executor(None, lambda: input("sim> ") if sys.stdin.isatty() or True else "quit")).strip().split()
        if not line:
            continue
        cmd, rest = line[0], line[1:]
        try:
            if cmd == "start":
                await sim.runner.start(ticks=int(rest[0]) if rest else None)
            elif cmd == "pause":
                await sim.runner.pause()
            elif cmd == "resume":
                await sim.runner.resume()
            elif cmd == "step":
                print(f"{await sim.runner.step(int(rest[0]) if rest else 1)} Schritt(e) → {clock.fmt(sim.engine.minute)}")
            elif cmd == "speed":
                sim.runner.set_speed(float(rest[0]))
            elif cmd == "status":
                print(sim.runner.state.value, clock.fmt(sim.engine.minute), json.dumps(summary(sim)["lauf"], ensure_ascii=False))
            elif cmd in ("quit", "exit"):
                break
            else:
                print("unbekannter Befehl")
        except (RuntimeError, ValueError) as e:
            print(f"Fehler: {e}")
    await sim.runner.stop()
    sim.close()
    return 0


def cmd_decisions(args) -> int:
    sim = make_sim(args)
    for d in reversed(sim.store.decisions(args.agent, args.limit)):
        print(f"\n{hm(d['sim_minute'])} {d['agent_id']} [{d['status']}] gewählt: {d['chosen']} → {d['action']} {json.dumps(d['params'], ensure_ascii=False)}"
              f"  Ergebnis: {d['outcome']}{' – ' + d['outcome_text'] if d['outcome_text'] else ''}")
        print(f"   Absicht: {d['intent']}  (Wichtigkeit {d['importance']}, {d['latency_ms']} ms, {d['attempts']} Versuch(e))")
        for o in d["options"]:
            mark = "►" if o["id"] == d["chosen"] else " "
            facs = ", ".join(f"{n} {v:+g}" for n, v in o["factors"] if n != "Grundneigung")
            print(f"   {mark} {o['id']}: {o['label']}  [{o['score']}]  {facs}")
    sim.close()
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="simulacra.cli", description="Simulation mit Agenten")
    ap.add_argument("command", choices=["run", "sim", "decisions"])
    ap.add_argument("agent", nargs="?", help="decisions: Agent")
    ap.add_argument("--ticks", type=int, default=200, help="run: Anzahl Simulationsminuten")
    ap.add_argument("--db", help="Datenbank (Standard: <SIM_DATA_DIR>/live.db)")
    ap.add_argument("--model", help="Modellkennung (überschreibt SIM_LLM_MODEL)")
    ap.add_argument("--provider", choices=["llm", "first"], default="llm", help="first = ohne Modell immer die erste Option (Offline-Test)")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--limit", type=int, default=10)
    args = ap.parse_args(argv)
    if args.command == "decisions":
        return cmd_decisions(args)
    return asyncio.run(cmd_run(args) if args.command == "run" else cmd_sim(args))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
