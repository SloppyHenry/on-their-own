"""§17 Nr. 8 (Regler wirken), Nr. 9 (Änderung im Betrieb) und Nr. 11 (nur zugängliches Wissen)."""

import ast
import time
import uuid

from api.conftest import api, post

from simulacra.params.registry import SPEC_LIST

from .conftest import ROOT, Server


def other_value(spec: dict, current):
    """Ein gültiger Wert ungleich dem aktuellen, so wie ihn ein Regler setzen würde."""
    t = spec["type"]
    if t == "bool":
        return not current
    if t == "enum":
        return next(o[0] for o in spec["options"] if o[0] != current)
    if t == "text":
        return f"{current} (geändert)" if current else "geändert"
    lo, hi, step = spec["min"], spec["max"], spec["step"] or 1
    v = current + step if current + step <= hi else current - step
    v = max(lo, min(hi, v))
    return int(v) if t == "int" else round(v, 4)


def test_k08_jeder_regler_aendert_seinen_parameter_nachweisbar(server: Server):
    schema = server.get("/api/params/schema")["specs"]
    changed = skipped = 0
    for spec in schema:
        if spec["locked"]:
            skipped += 1                                                                  # z. B. Modell: nur beim Anlegen einer Simulation
            continue
        vals = server.get("/api/params")
        agent = "alex" if spec["scope"] == "agent" else None
        cur = vals["values"][spec["key"]][agent] if agent else vals["values"][spec["key"]]
        new = other_value(spec, cur)
        res = server.patch("/api/params", {"changes": [{"key": spec["key"], "value": new, **({"agent": agent} if agent else {})}]})["results"][0]
        assert res["status"] in ("applied", "pending_next_decision"), (spec["key"], res)
        after = server.get("/api/params")["values"][spec["key"]]
        assert (after[agent] if agent else after) == new, spec["key"]
        if agent:
            assert after["mira"] == vals["values"][spec["key"]]["mira"], f"{spec['key']}: Mira mitverändert"
        changed += 1
    assert changed >= 40 and skipped <= 3


def test_k08_jeder_regler_hat_einen_echten_wirkungstest():
    """Die Wirkungstests aus AP07 laufen in der normalen Suite; hier: jeder Regler verweist auf einen vorhandenen Test, der etwas prüft."""
    missing = []
    for s in SPEC_LIST:
        path, name = s.effect_test.split("::")
        tree = ast.parse((ROOT / "backend" / path).read_text()) if (ROOT / "backend" / path).exists() else ast.parse((ROOT / path).read_text())
        fn = next((n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name), None)
        if fn is None or not any(isinstance(n, ast.Assert) for n in ast.walk(fn)):
            missing.append(s.key)
    assert not missing and len(SPEC_LIST) >= 40


def test_k09_aenderung_im_laufenden_betrieb_wirkt_ab_der_naechsten_entscheidung():
    with api() as c:
        sim = c.sim
        sim.client.provider.delay_s = 0.02
        post(c, "/api/sim/start")
        time.sleep(0.5)
        assert sim.runner.state.value == "running"
        n = len(sim.client.provider.calls)
        r = c.patch("/api/params", headers={"Idempotency-Key": str(uuid.uuid4())}, json={"changes": [{"key": "personality.curiosity", "value": 93, "agent": "alex"}, {"key": "llm.temperature", "value": 0.33}]})
        assert {x["status"] for x in r.json()["results"]} <= {"applied", "pending_next_decision"}
        time.sleep(0.6)
        post(c, "/api/sim/pause")
        later = sim.client.provider.calls[n + 2:]                                         # ein Aufruf kann beim Ändern schon unterwegs sein
        alex = [x for x in later if "Du bist Alex" in x["messages"][0]["content"]]
        assert alex and all("Neugier 93" in x["messages"][0]["content"] for x in alex)
        assert later and all(x["params"].temperature == 0.33 for x in later)
        assert all("Neugier 93" not in x["messages"][0]["content"] for x in sim.client.provider.calls[:n])


async def test_k11_agenten_erhalten_nur_zugaengliches_wissen(sim):
    """Alex findet eine Karte (nur er weiß davon); Mira erfährt etwas (nur sie). Geprüft wird, was wirklich im Prompt steht."""
    sim.inject.rate = 100
    for text in ("Alex findet eine alte Karte im Haus.", "Mira erfährt, dass im Brunnen ein Goldring liegt."):
        p = await sim.inject.parse(text)
        await sim.engine.db.run(lambda p=p: sim.inject.confirm(p["id"]))
    sim.client.provider.calls.clear()
    await sim.runner.step(60)
    calls = sim.client.provider.calls
    alex = [c["messages"] for c in calls if "Du bist Alex" in c["messages"][0]["content"]]
    mira = [c["messages"] for c in calls if "Du bist Mira" in c["messages"][0]["content"]]
    text = lambda msgs: " ".join(m["content"] for m in msgs)  # noqa: E731
    assert alex and mira
    assert any("Karte" in text(m) for m in alex) and not any("Karte" in text(m) for m in mira)
    assert any("Goldring" in text(m) for m in mira) and not any("Goldring" in text(m) for m in alex)
    karte = next(o for o in sim.engine.state.all_objects() if o.kind == "map")
    assert karte.visible_to("alex") and not karte.visible_to("mira")
