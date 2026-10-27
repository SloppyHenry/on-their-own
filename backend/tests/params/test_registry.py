"""Meta-Tests der Parameter-Registry: Jeder Regler hat einen Verbraucher, einen echten Wirkungstest und einen ehrlichen Wert."""

import ast
import importlib
from pathlib import Path

import pytest
from agents.conftest import make_sim

from on_their_own.params.registry import REGISTRY, SPEC_LIST, schema
from on_their_own.params.spec import EFFECTS, GROUPS, validate

ROOT = Path(__file__).resolve().parents[2]
IDS = [s.key for s in SPEC_LIST]


@pytest.fixture(scope="module")
def fresh():
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()


def spec_of(key):
    return REGISTRY[key]


def test_registry_is_complete_and_consistent():
    assert len(SPEC_LIST) >= 60
    assert {s.group for s in SPEC_LIST} <= set(GROUPS)
    for s in SPEC_LIST:
        assert s.effect in EFFECTS and s.scope in ("global", "agent") and s.type in ("int", "float", "bool", "enum", "text"), s.key
        assert s.label and s.help and s.apply and s.read, s.key
        if s.type in ("int", "float"):
            assert s.min is not None and s.max is not None and s.min < s.max and s.step, s.key
        if s.type == "enum":
            assert s.options, s.key
    assert set(schema()) == {"groups", "specs"} and len(schema()["specs"]) == len(SPEC_LIST)


@pytest.mark.parametrize("key", IDS)
def test_every_parameter_has_a_consumer_and_a_real_effect_test(key):
    s = spec_of(key)
    assert s.consumers, f"{key}: kein Verbraucher angegeben"
    for c in s.consumers:                                             # der Verbraucher gibt es wirklich im Code
        mod, attr = c.split(":")
        source = Path(importlib.import_module(mod).__file__).read_text()
        assert attr in source, f"{key}: '{attr}' kommt in {mod} nicht vor"
    path, name = s.effect_test.split("::")
    tree = ast.parse((ROOT / path).read_text())
    fn = next((n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name), None)
    assert fn is not None, f"{key}: Wirkungstest {s.effect_test} fehlt"
    assert any(isinstance(n, ast.Assert) for n in ast.walk(fn)), f"{key}: {name} prüft nichts"


@pytest.mark.parametrize("key", IDS)
def test_fresh_simulation_reads_the_default_from_the_consumer(fresh, key):
    s = spec_of(key)
    for a in (fresh.params.agents() if s.scope == "agent" else [None]):
        assert s.read(fresh, a) == s.default_value(fresh, a), key


@pytest.mark.parametrize("key", [k for k in IDS if not spec_of(k).locked and not spec_of(k).check])
def test_apply_then_read_roundtrip(key):
    sim = make_sim()
    sim.store.ensure_all()
    s = spec_of(key)
    for a in (["alex"] if s.scope == "agent" else [None]):
        value = _other_value(s, sim, a)
        s.apply(sim, value, a)
        assert s.read(sim, a) == value, f"{key}: gesetzter Wert kommt beim Verbraucher nicht an"
    sim.close()


def _other_value(s, sim, agent):
    d = s.default_value(sim, agent)
    if s.type == "bool":
        return not d
    if s.type == "enum":
        return next(o for o, _ in s.options if o != d and o != "custom")
    if s.type == "text":
        return "ein neuer Text"
    cand = [s.min + s.step * 2, s.max - s.step * 2, s.min, s.max]
    v = next(c for c in cand if c != d)
    return int(v) if s.type == "int" else float(v)


@pytest.mark.parametrize("key", [k for k in IDS if spec_of(k).type in ("int", "float")])
def test_out_of_range_values_are_rejected_not_clamped(key):
    s = spec_of(key)
    assert not validate(s, s.max + s.step)[0] and not validate(s, s.min - s.step)[0]
    assert validate(s, s.min)[0] and validate(s, s.max)[0] or s.step > 1
    assert not validate(s, "viel")[0] and not validate(s, True)[0]


def test_text_enum_bool_validation():
    assert not validate(spec_of("world.movement"), "überall")[0]
    assert not validate(spec_of("sim.power_save"), "ja")[0]
    ok, text = validate(spec_of("profile.description"), "  fröhlich  ")
    assert ok and text == "fröhlich"
    assert not validate(spec_of("profile.description"), "x" * 601)[0]
    assert not validate(spec_of("memory.summary_interval"), 30)[0] and validate(spec_of("memory.summary_interval"), 48)[0]
    assert not validate(spec_of("memory.max_in_context"), 6.5)[0]


def test_the_model_is_locked_during_a_run():
    assert spec_of("llm.model").locked and "neue Simulation" in spec_of("llm.model").locked
