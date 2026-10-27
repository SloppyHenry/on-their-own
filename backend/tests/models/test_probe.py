"""Probelauf (AP17c-3): Messung, Siegel, Abbruch."""

import json

import pytest

from on_their_own.llm.providers import FakeProvider, LLMError
from on_their_own.models import probe as pr
from on_their_own.models.probe_data import SCENARIOS, build_messages


def answer(option_ids, **over):
    return json.dumps({"option_id": option_ids[0], "reason": "weil", "utterance": "", "importance": 3, **over})


def ok_fn(messages, schema, params):
    return answer(schema["properties"]["option_id"]["enum"])


async def test_alles_gueltig_ist_geprueft():
    steps = []
    res = await pr.run_probe(FakeProvider(fn=ok_fn), "m", on_step=lambda d, n: steps.append((d, n)))
    assert (res.n, res.valid, res.errors, res.valid_pct, res.seal) == (10, 10, 0, 100.0, "checked")
    assert res.tokens_per_s == 20.0 and res.avg_s is not None and steps[0] == (1, 10) and steps[-1] == (10, 10)


async def test_nutzt_den_messprompt_aus_ap00_mit_json_schema():
    p = FakeProvider(fn=ok_fn)
    await pr.run_probe(p, "mein-modell", runs=4)
    assert [c["params"].model for c in p.calls] == ["mein-modell"] * 4 and all(c["params"].response_format == "json_schema" and not c["params"].thinking for c in p.calls)
    assert p.calls[0]["messages"] == build_messages("Alex", SCENARIOS[0]) and p.calls[1]["messages"] == build_messages("Mira", SCENARIOS[0])
    assert p.calls[2]["messages"] == build_messages("Alex", SCENARIOS[1])


async def test_grenze_bei_90_prozent():
    def fn_n_bad(n):
        count = [0]

        def fn(messages, schema, params):
            count[0] += 1
            return "Ich weiß nicht" if count[0] <= n else ok_fn(messages, schema, params)
        return fn
    assert (await pr.run_probe(FakeProvider(fn=fn_n_bad(1)), "m")).seal == "checked"       # 9 von 10 = 90 %: geprüft
    r = await pr.run_probe(FakeProvider(fn=fn_n_bad(2)), "m")                              # 8 von 10 = 80 %
    assert r.seal == "unfit" and r.valid == 8 and r.valid_pct == 80.0


async def test_fehlgeschlagene_anfragen_zaehlen_als_ungueltig():
    res = await pr.run_probe(FakeProvider(fn=lambda m, s, p: (_ for _ in ()).throw(LLMError("timeout", "zu langsam"))), "m")
    assert (res.valid, res.errors, res.seal, res.avg_s, res.tokens_per_s) == (0, 10, "unfit", None, None)


async def test_langsam_ist_mit_einschraenkung(monkeypatch):
    ticks = iter(range(0, 1000, 25))                         # jede Anfrage dauert 25 Sekunden
    monkeypatch.setattr(pr.time, "perf_counter", lambda: next(ticks))
    res = await pr.run_probe(FakeProvider(fn=ok_fn), "m", runs=2)
    assert res.avg_s == 25 and res.seal == "limited"


def test_siegel():
    assert pr.seal_of(100, 5) == "checked" and pr.seal_of(90, 20) == "checked" and pr.seal_of(90, 20.1) == "limited" and pr.seal_of(89.9, 1) == "unfit" and pr.seal_of(0, None) == "unfit"
    assert set(pr.SEALS) == {"checked", "limited", "unfit"}


async def test_abbruch():
    n = []

    def cancelled():
        n.append(1)
        return len(n) > 3
    with pytest.raises(pr.ProbeCancelled):
        await pr.run_probe(FakeProvider(fn=ok_fn), "m", cancelled=cancelled)


def test_validate_erkennt_verpacktes_json_und_falsche_werte():
    ids = ["a", "b"]
    good = answer(ids)
    assert pr.validate(good, ids) == (True, True, json.loads(good))
    strict, valid, _ = pr.validate("Hier: ```json\n" + good + "\n```", ids)
    assert (strict, valid) == (False, True)
    assert pr.validate(answer(["z"]), ids)[1] is False, "Option nicht angeboten"
    assert pr.validate(answer(ids, importance=11), ids)[1] is False and pr.validate(answer(ids, importance=True), ids)[1] is False
    assert pr.validate("", ids)[1] is False and pr.validate("{kaputt", ids)[1] is False


def test_ergebnis_als_woerterbuch():
    r = pr.ProbeResult(10, 9, 1, 5.456, 41.26, "checked", at=1.0)
    assert r.to_dict(hardware="x") == {"n": 10, "valid": 9, "valid_pct": 90.0, "errors": 1, "avg_s": 5.46, "tokens_per_s": 41.3, "seal": "checked", "at": 1.0, "hardware": "x"}
