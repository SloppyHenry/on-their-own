#!/usr/bin/env python3
"""LLM-Sondierung für AP00: misst JSON-Treue, Denkmodus, Kosten, Prompt-Cache, Modellwechsel.

Aufruf (aus dem Projektordner, mit dem Backend-venv, damit die Konfiguration gilt):
    backend/.venv/bin/python scripts/probe_llm.py --models bonsai2-27b,qwen3.8-9b-uncensored
Optionen: --runs 20 (Durchläufe je Variante ohne Denken), --think-runs 10 (mit Denken),
          --cache-rounds 6, --only A2,C2 (nur diese Varianten), --out data/probe/
Die Ergebnisse landen als JSON in data/probe/ und als Tabellen auf stdout.
"""

import argparse
import json
import re
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from simulacra.config import Settings  # noqa: E402

THINK = {"default": {}, "off": {"chat_template_kwargs": {"enable_thinking": False}},
         "low": {"reasoning_effort": "low"}}

# Name -> (Antwortformat, Denkmodus)
VARIANTS = {
    "A1": ("prompt", "default"), "A2": ("prompt", "off"),
    "B1": ("object", "default"), "B2": ("object", "off"),
    "C1": ("schema", "default"), "C2": ("schema", "off"), "C3": ("schema", "low"),
}

RULES = """Du bist eine Figur in einer kleinen, ruhigen Dorfwelt und entscheidest selbst, was du als Nächstes tust.
Regeln: Wähle genau eine der angebotenen Optionen. Erfinde keine Optionen. Du sprichst Deutsch.
Antworte ausschließlich mit einem JSON-Objekt der Form:
{"option_id": "<id aus der Liste>", "reason": "<ein Satz, warum>", "utterance": "<was du laut sagst, oder leer>", "importance": <ganze Zahl 1-10, wie erinnerungswürdig>}"""

PERSONAS = {
    "Alex": """Du bist Alex, 34, ehemaliger Tischler, ruhig und bedacht. Du erkundest gern und bastelst an Dingen.
Persönlichkeit (0-100): Geselligkeit 40, Neugier 75, Hilfsbereitschaft 60, Risikobereitschaft 35, Konfliktbereitschaft 25, Bedürfnis nach Ruhe 65.
Kommunikationsstil: knapp, trocken, gelegentlich ein leiser Scherz.""",
    "Mira": """Du bist Mira, 31, Gärtnerin und Geschichtenerzählerin, warmherzig und lebhaft. Du suchst Gespräche und Gemeinschaft.
Persönlichkeit (0-100): Geselligkeit 80, Neugier 60, Hilfsbereitschaft 75, Risikobereitschaft 50, Konfliktbereitschaft 30, Bedürfnis nach Ruhe 35.
Kommunikationsstil: erzählend, herzlich, stellt Fragen.""",
}

SCENARIOS = [
    {"zeit": "Tag 2, 07:40 (Morgen)", "ort": "Küche im Wohnhaus", "naehe": "{other} (steht am Herd)",
     "bed": "Energie 72, Hunger 61, Geselligkeit 40", "ziel": "Den Garten für den Winter vorbereiten",
     "mem": ["Gestern am See: seltsame Spuren im Schlamm gesehen.", "{other} hat gestern Brot gebacken und es geteilt.",
             "Im Schuppen liegt noch Werkzeug unsortiert.", "Die Tür zum Keller klemmt.", "Vor drei Tagen: Streit um die Küchenordnung, ruhig beigelegt."],
     "opt": [("essen", "Am Tisch frühstücken (Vorrat: 4 Brote)"), ("sprechen", "Mit {other} ein Gespräch beginnen"),
             ("garten", "In den Garten gehen und arbeiten"), ("see", "Zum See wandern (unbekannte Spuren prüfen)"),
             ("schuppen", "Im Schuppen Werkzeug sortieren"), ("ruhen", "Sich im Wohnzimmer ausruhen")]},
    {"zeit": "Tag 2, 13:15 (Mittag)", "ort": "Zentraler Platz", "naehe": "niemand",
     "bed": "Energie 55, Hunger 30, Geselligkeit 70", "ziel": "Neue Orte im Wald entdecken",
     "mem": ["Heute früh mit {other} gefrühstückt, gutes Gespräch.", "Am Waldrand steht ein umgestürzter Baum, dahinter ein Pfad.",
             "Der Brunnen auf dem Platz gibt klares Wasser.", "{other} wollte nachmittags Pilze suchen."],
     "opt": [("wald_pfad", "Dem Pfad hinter dem umgestürzten Baum folgen"), ("brunnen", "Wasser am Brunnen holen"),
             ("haus", "Zurück zum Wohnhaus gehen"), ("bank", "Auf der Bank sitzen und beobachten"),
             ("see", "Zum See gehen"), ("rufen", "Nach {other} rufen und fragen, wo sie/er ist")]},
    {"zeit": "Tag 3, 19:50 (Abend)", "ort": "Wohnzimmer", "naehe": "{other} (liest)",
     "bed": "Energie 28, Hunger 55, Geselligkeit 50", "ziel": "Eine kleine Bank für den Garten bauen",
     "mem": ["{other} wirkte beim Abendessen bedrückt und sagte wenig.", "Holzvorrat im Schuppen: 6 Bretter, genügt für die Bank.",
             "Am Nachmittag ist beim Holzsägen ein Brett gesplittert.", "Draußen zieht Regen auf."],
     "opt": [("fragen", "{other} fragen, was los ist"), ("schlafen", "Ins Bett gehen"), ("lesen", "Selbst ein Buch nehmen und lesen"),
             ("kochen", "Eine Suppe kochen (Vorrat: 2 Rüben, 1 Brot)"), ("bauen", "Im Schuppen mit der Bank beginnen"),
             ("feuer", "Den Kamin anzünden")]},
    {"zeit": "Tag 4, 10:05 (Vormittag)", "ort": "See", "naehe": "niemand",
     "bed": "Energie 80, Hunger 20, Geselligkeit 25", "ziel": "Herausfinden, wer die Spuren am See hinterlässt",
     "mem": ["Die Spuren führen vom Ufer zum Wald.", "{other} hat gestern gefragt, ob wir zusammen angeln gehen.", "Am Steg liegt ein altes Seil.",
             "Der See ist ruhig, Nebel steigt auf."],
     "opt": [("spuren", "Den Spuren in den Wald folgen"), ("angeln", "Mit der Angel am Steg fischen"), ("seil", "Das alte Seil untersuchen"),
             ("heim", "Zum Haus zurückkehren und {other} abholen"), ("baden", "Im See schwimmen"), ("warten", "Am Ufer warten und beobachten")]},
    {"zeit": "Tag 5, 16:30 (Nachmittag)", "ort": "Garten", "naehe": "{other} (gräbt Beet um)",
     "bed": "Energie 45, Hunger 48, Geselligkeit 62", "ziel": "Eine gemeinsame Ernte für das Fest planen",
     "mem": ["{other} hat vorgeschlagen, am Samstag ein kleines Fest zu feiern.", "Die Kürbisse sind fast reif.",
             "Gestern Missverständnis: {other} dachte, ich wolle das Beet nicht teilen.", "Die Hecke am Nordrand ist ungeschnitten."],
     "opt": [("helfen", "{other} beim Umgraben helfen"), ("ernten", "Kürbisse ernten"), ("klaeren", "Das gestrige Missverständnis ansprechen"),
             ("hecke", "Die Hecke schneiden"), ("pause", "Kurz Pause machen und Wasser trinken"), ("planen", "Mit {other} das Fest planen")]},
]


def build_messages(persona: str, scenario: dict, persona_first: bool = False) -> list[dict]:
    other = "Mira" if persona == "Alex" else "Alex"
    sys_prompt = f"{PERSONAS[persona]}\n\n{RULES}" if persona_first else f"{RULES}\n\n{PERSONAS[persona]}"
    sub = lambda s: s.format(other=other)  # noqa: E731
    opts = "\n".join(f"- {oid}: {sub(text)}" for oid, text in scenario["opt"])
    mems = "\n".join(f"- {sub(m)}" for m in scenario["mem"])
    user = (f"Zeit: {scenario['zeit']}\nOrt: {scenario['ort']}\nIn der Nähe: {sub(scenario['naehe'])}\n"
            f"Bedürfnisse: {scenario['bed']}\nAktuelles Ziel: {scenario['ziel']}\n\nRelevante Erinnerungen:\n{mems}\n\n"
            f"Mögliche Optionen:\n{opts}\n\nWas tust du jetzt? Antworte nur mit dem JSON-Objekt.")
    return [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user}]


def response_format(mode: str, option_ids: list[str]) -> dict:
    if mode == "object":
        return {"response_format": {"type": "json_object"}}
    if mode == "schema":
        schema = {"type": "object", "additionalProperties": False,
                  "required": ["option_id", "reason", "utterance", "importance"],
                  "properties": {"option_id": {"type": "string", "enum": option_ids},
                                 "reason": {"type": "string"}, "utterance": {"type": "string"},
                                 "importance": {"type": "integer", "minimum": 1, "maximum": 10}}}
        return {"response_format": {"type": "json_schema",
                                    "json_schema": {"name": "entscheidung", "strict": True, "schema": schema}}}
    return {}


def validate(content: str, option_ids: list[str]) -> tuple[bool, bool, dict | None]:
    """Gibt (strikt_json, gültig, Objekt) zurück. Gültig = nach Schema, auch wenn in Fences/Text verpackt."""
    def check(obj):
        return (isinstance(obj, dict) and obj.get("option_id") in option_ids and isinstance(obj.get("reason"), str)
                and isinstance(obj.get("utterance"), str) and isinstance(obj.get("importance"), int)
                and not isinstance(obj.get("importance"), bool) and 1 <= obj["importance"] <= 10)
    try:
        obj = json.loads(content)
        return True, check(obj), obj
    except (ValueError, TypeError):
        m = re.search(r"\{.*\}", content or "", re.S)
        try:
            obj = json.loads(m.group(0)) if m else None
        except ValueError:
            obj = None
        return False, check(obj), obj


def call(client: httpx.Client, base: str, headers: dict, model: str, messages: list[dict],
         extra: dict, max_tokens: int = 3000) -> dict:
    """Streaming-Anfrage; misst Zeit bis erstes Token und bis erster Antwortinhalt."""
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "stream": True,
            "stream_options": {"include_usage": True}, **extra}
    t0 = time.perf_counter()
    first_any = first_content = None
    content, reasoning, usage, timings, err = "", "", {}, {}, None
    degenerate = False
    try:
        with client.stream("POST", f"{base}/chat/completions", json=body, headers=headers) as r:
            if r.status_code != 200:
                return {"error": f"HTTP {r.status_code}: {r.read().decode()[:200]}", "total_s": time.perf_counter() - t0}
            for line in r.iter_lines():
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                chunk = json.loads(line[6:])
                if "error" in chunk:
                    err = f"Stream-Fehler: {chunk['error'].get('message', chunk['error'])}"[:200]
                    break
                usage = chunk.get("usage") or usage
                timings = chunk.get("timings") or timings
                for ch in chunk.get("choices", []):
                    d = ch.get("delta", {})
                    if d.get("reasoning_content"):
                        first_any = first_any or time.perf_counter() - t0
                        reasoning += d["reasoning_content"]
                    if d.get("content"):
                        first_any = first_any or time.perf_counter() - t0
                        first_content = first_content or time.perf_counter() - t0
                        content += d["content"]
                        if len(content) > 60 and len(set(content[-40:])) <= 2:
                            degenerate = True  # z. B. '//////': früh abbrechen, spart Minuten
                            break
                if degenerate:
                    break
    except httpx.HTTPError as exc:
        err = f"{type(exc).__name__}: {exc}"
    return {"error": err, "total_s": time.perf_counter() - t0, "first_any_s": first_any, "first_content_s": first_content,
            "content": content, "degeneriert": degenerate, "reasoning_chars": len(reasoning), "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"), "cache_n": timings.get("cache_n"),
            "prompt_n": timings.get("prompt_n"), "prompt_ms": timings.get("prompt_ms"),
            "tps": timings.get("predicted_per_second")}


def mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.fmean(xs) if xs else None


def p95(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[min(len(xs) - 1, int(0.95 * len(xs)))] if xs else None


def summarize(rows: list[dict]) -> dict:
    ok = [r for r in rows if not r.get("error")]
    chosen = [r["obj"]["option_id"] for r in ok if r.get("obj") and r["valid"]]
    return {"n": len(rows), "fehler": len(rows) - len(ok), "degeneriert": sum(bool(r.get("degeneriert")) for r in ok),
            "json_strikt_pct": 100 * sum(r["strict"] for r in ok) / max(1, len(rows)),
            "gueltig_pct": 100 * sum(r["valid"] for r in ok) / max(1, len(rows)),
            "gesamt_s_mittel": mean(r["total_s"] for r in ok), "gesamt_s_p95": p95(r["total_s"] for r in ok),
            "erster_inhalt_s": mean(r["first_content_s"] for r in ok), "prompt_tok": mean(r["prompt_tokens"] for r in ok),
            "ausgabe_tok": mean(r["completion_tokens"] for r in ok), "denk_zeichen": mean(r["reasoning_chars"] for r in ok),
            "tps": mean(r["tps"] for r in ok), "verschiedene_optionen": len(set(chosen))}


def switch_time(client, base, headers, model) -> float | None:
    """Dauer der ersten Mini-Anfrage; > ein paar Sekunden heißt: der Router hat das Modell erst geladen."""
    status = client.get(f"{base}/models", headers=headers).json()["data"]
    loaded = next((m["status"]["value"] for m in status if m["id"] == model), None)
    t0 = time.perf_counter()
    res = call(client, base, headers, model, [{"role": "user", "content": "Sag ok."}], THINK["off"], max_tokens=4)
    dt = time.perf_counter() - t0
    print(f"  Modellwechsel: Status vorher={loaded}, erste Anfrage {dt:.1f}s {res.get('error') or ''}", flush=True)
    return {"status_vorher": loaded, "erste_anfrage_s": dt}


def run_model(client, base, headers, model, args) -> dict:
    print(f"\n=== {model} ===", flush=True)
    result = {"wechsel": switch_time(client, base, headers, model), "varianten": {}, "cache": {}}
    call(client, base, headers, model, build_messages("Alex", SCENARIOS[0]), THINK["off"], 400)  # Aufwärmen
    for name, (mode, think) in VARIANTS.items():
        if args.only and name not in args.only:
            continue
        n = args.runs if think == "off" else args.think_runs
        rows = []
        for i in range(n):
            persona = ("Alex", "Mira")[i % 2]
            sc = SCENARIOS[(i // 2) % len(SCENARIOS)]
            opt_ids = [o[0] for o in sc["opt"]]
            res = call(client, base, headers, model, build_messages(persona, sc),
                       {**THINK[think], **response_format(mode, opt_ids)},
                       max_tokens=600 if think == "off" else 3000)
            if not res.get("error"):
                res["strict"], res["valid"], res["obj"] = validate(res["content"], opt_ids)
            rows.append(res)
            print(f"  {name} {mode}/{think} {i + 1}/{n}: {res.get('error') or ('ok' if res['valid'] else 'DEGENERIERT' if res.get('degeneriert') else 'UNGÜLTIG')} "
                  f"{res['total_s']:.1f}s", flush=True)
        result["varianten"][name] = {"modus": mode, "denken": think, "summary": summarize(rows), "rows": rows}
    result["cache"] = cache_test(client, base, headers, model, args.cache_rounds)
    return result


def cache_test(client, base, headers, model, rounds) -> dict:
    """Wechselt Alex/Mira ab: gemeinsames Präfix (Regeln zuerst) vs. Persona zuerst."""
    out = {}
    extra = {**THINK["off"], **response_format("schema", [o[0] for o in SCENARIOS[0]["opt"]])}
    for label, persona_first in (("gemeinsames_praefix", False), ("persona_zuerst", True)):
        call(client, base, headers, model, [{"role": "user", "content": "Reset " + label}], THINK["off"], 4)
        rows = []
        for i in range(rounds):
            res = call(client, base, headers, model,
                       build_messages(("Alex", "Mira")[i % 2], SCENARIOS[0], persona_first), extra)
            rows.append({k: res.get(k) for k in ("prompt_tokens", "cache_n", "prompt_n", "prompt_ms", "total_s")})
            print(f"  Cache {label} {i + 1}/{rounds}: cache_n={res.get('cache_n')} prompt_n={res.get('prompt_n')} "
                  f"prompt_ms={res.get('prompt_ms') and round(res['prompt_ms'])}", flush=True)
        later = rows[2:] or rows  # erste zwei Anfragen füllen den Cache für beide Personen
        out[label] = {"rows": rows, "prompt_ms_mittel": mean(r["prompt_ms"] for r in later),
                      "cache_anteil": mean((r["cache_n"] or 0) / max(1, (r["cache_n"] or 0) + (r["prompt_n"] or 0)) for r in later)}
    return out


def print_tables(results: dict) -> None:
    for model, res in results.items():
        print(f"\n### {model} – Modellwechsel: {res['wechsel']}")
        print("| Var | Format | Denken | n | gültig % | strikt % | Fehler | degen. | Gesamt s (Ø/p95) | 1. Inhalt s | Prompt-Tok | Ausgabe-Tok | Tok/s | Optionen |")
        print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
        f = lambda x, d=1: "–" if x is None else f"{x:.{d}f}"  # noqa: E731
        for name, v in res["varianten"].items():
            s = v["summary"]
            print(f"| {name} | {v['modus']} | {v['denken']} | {s['n']} | {f(s['gueltig_pct'], 0)} | {f(s['json_strikt_pct'], 0)} | {s['fehler']} | {s['degeneriert']} "
                  f"| {f(s['gesamt_s_mittel'])}/{f(s['gesamt_s_p95'])} | {f(s['erster_inhalt_s'])} | {f(s['prompt_tok'], 0)} "
                  f"| {f(s['ausgabe_tok'], 0)} | {f(s['tps'])} | {s['verschiedene_optionen']} |")
        for label, c in res["cache"].items():
            print(f"Cache {label}: Prompt-Zeit Ø {f(c['prompt_ms_mittel'], 0)} ms, Cache-Anteil {f(100 * (c['cache_anteil'] or 0), 0)} %")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", default=Settings().llm_model)
    ap.add_argument("--runs", type=int, default=20)
    ap.add_argument("--think-runs", type=int, default=10)
    ap.add_argument("--cache-rounds", type=int, default=6)
    ap.add_argument("--only", type=lambda s: s.split(","), default=None)
    ap.add_argument("--out", default=str(ROOT / "data" / "probe"))
    args = ap.parse_args()

    s = Settings()
    key = s.llm_api_key
    headers = {"Authorization": f"Bearer {key.get_secret_value()}"} if key else {}
    base = s.llm_base_url.rstrip("/")
    results = {}
    with httpx.Client(timeout=httpx.Timeout(300.0, connect=5.0)) as client:
        for model in args.models.split(","):
            results[model] = run_model(client, base, headers, model, args)
            out = Path(args.out)
            out.mkdir(parents=True, exist_ok=True)
            (out / f"probe-{datetime.now():%Y%m%d-%H%M%S}-{model}.json").write_text(
                json.dumps({"model": model, "result": results[model]}, ensure_ascii=False, indent=1))
    print_tables(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
