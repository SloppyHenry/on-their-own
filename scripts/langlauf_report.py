"""Langlauf-Bericht (AP11): liest die Messreihen aus scripts/langlauf.py und schreibt docs/status/langlauf.md samt Diagrammen.

  backend/.venv/bin/python scripts/langlauf_report.py data/langlauf/real data/langlauf/fake

Je Lauf: Kopfdaten, Prüfung gegen die Grenzwerte, Messtabelle (alle 5 min) und drei Diagramme (SVG, hell und dunkel).
Serien und Konversationslängen kommen aus der Datenbank des Laufs (gleiche Auswertung wie der Abnahmetest K16).
"""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("langlauf", ROOT / "scripts" / "langlauf.py")
langlauf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(langlauf)
LIMITS = langlauf.LIMITS
OUT_MD = ROOT / "docs" / "status" / "langlauf.md"
OUT_IMG = ROOT / "docs" / "status" / "img"
MAX_TURNS = 8                                    # SIM_SIM_CONVERSATION_MAX_TURNS (Standard)


def nice_max(v: float) -> float:
    if v <= 0:
        return 1.0
    mag = 10 ** len(str(int(v))) / 10
    for m in (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if v <= m * mag:
            return m * mag
    return 10 * mag


def svg_line(title: str, unit: str, xs: list[float], ys: list[float], note: str = "") -> str:
    """Eine Reihe, eine Achse: dünne Linie, Punkte an den Messungen, letzter Wert direkt beschriftet."""
    w, h, l, r, t, b = 340, 190, 46, 54, 34, 30
    pw, ph = w - l - r, h - t - b
    xmax, ymax = max(xs[-1], 1e-9), nice_max(max(ys))
    px = lambda x: l + pw * x / xmax                     # noqa: E731
    py = lambda y: t + ph * (1 - y / ymax)               # noqa: E731
    grid = "".join(f'<line class="g" x1="{l}" x2="{l + pw}" y1="{py(ymax * i / 4):.1f}" y2="{py(ymax * i / 4):.1f}"/>'
                   f'<text class="m" x="{l - 6}" y="{py(ymax * i / 4) + 4:.1f}" text-anchor="end">{ymax * i / 4:g}</text>' for i in range(5))
    step = 0.5 if xmax <= 2 else 1 if xmax <= 6 else 2 if xmax <= 12 else 4
    ticks = [i * step for i in range(int(xmax / step) + 1)]
    xt = "".join(f'<text class="m" x="{px(hh):.1f}" y="{t + ph + 18}" text-anchor="middle">{hh:g} h</text>' for hh in ticks)
    pts = " ".join(f"{px(x):.1f},{py(y):.1f}" for x, y in zip(xs, ys))
    dots = "".join(f'<circle class="d" cx="{px(x):.1f}" cy="{py(y):.1f}" r="2.5"><title>{x:.2f} h: {y:g} {unit}</title></circle>' for x, y in zip(xs, ys))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            '<style>svg{background:#fcfcfb}.t{font:600 13px system-ui,sans-serif;fill:#0b0b0b}.m{font:11px system-ui,sans-serif;fill:#52514e}'
            '.g{stroke:#e4e3df;stroke-width:1}.s{fill:none;stroke:#2a78d6;stroke-width:2;stroke-linejoin:round}.d{fill:#2a78d6;stroke:#fcfcfb;stroke-width:2}'
            '@media (prefers-color-scheme: dark){svg{background:#1a1a19}.t{fill:#fff}.m{fill:#c3c2b7}.g{stroke:#383835}.s{stroke:#3987e5}.d{fill:#3987e5;stroke:#1a1a19}}</style>'
            f'<text class="t" x="{l}" y="18">{title} ({unit})</text><text class="m" x="{w - 6}" y="18" text-anchor="end">{note}</text>'
            f'{grid}{xt}<polyline class="s" points="{pts}"/>{dots}'
            f'<text class="m" x="{px(xs[-1]) + 6:.1f}" y="{py(ys[-1]) + 4:.1f}">{ys[-1]:g}</text></svg>')


def rate(a: dict, b: dict, get) -> float:
    dt = (b["t_s"] - a["t_s"]) / 60
    return round((get(b) - get(a)) / dt, 1) if dt > 0 else 0.0


def report(out: Path) -> tuple[str, list[tuple[str, bool]]]:
    rows = [json.loads(x) for x in (out / "samples.jsonl").read_text().splitlines() if x.strip()]
    meta = json.loads((out / "meta.json").read_text())
    name, first, last = out.name, rows[0], rows[-1]
    hours = (last["t_s"] - first["t_s"]) / 3600
    sim_days = (last["sim_minute"] - first["sim_minute"]) / 1440
    db = langlauf.db_metrics(out)
    growth = (last["db_mb"] - first["db_mb"]) / sim_days if sim_days > 0 else 0.0
    streaks = db["streaks"]
    llm = meta["health"]["llm"]
    checks = [
        (f"kein Absturz ({len(rows)} Messungen, Server lief bis zum Ende)", all(r["alive"] for r in rows)),
        (f"RAM höchstens {max(r['rss_mb'] for r in rows):g} MB (Grenze {LIMITS['rss_mb']} MB)", max(r["rss_mb"] for r in rows) < LIMITS["rss_mb"]),
        (f"DB-Wachstum {growth:.2f} MB je Sim-Tag (Grenze {LIMITS['db_mb_per_sim_day']} MB)", growth < LIMITS["db_mb_per_sim_day"]),
        ("Fehlerserie höchstens " + ", ".join(f"{a} {s['error_streak']}" for a, s in streaks.items()) + f" (Grenze {LIMITS['error_streak']})",
         all(s["error_streak"] <= LIMITS["error_streak"] for s in streaks.values())),
        ("gleiche überwachte Aktion in Folge höchstens " + ", ".join(f"{a} {s['guarded_streak']}" for a, s in streaks.items()) + f" (Grenze < {LIMITS['action_streak']})",
         all(s["guarded_streak"] < LIMITS["action_streak"] for s in streaks.values())),
        (f"Gesprächslänge höchstens {db['conversation_max_turns']} Beiträge (Höchstwert {MAX_TURNS})", db["conversation_max_turns"] <= MAX_TURNS),
        (f"Lücken in den Ereignisnummern beim Mitlesen: {last['ws']['gaps']}", last["ws"]["gaps"] == 0),
    ]
    info = ", ".join(f"{a} {s['action_streak']}× `{s['action_streak_key']}`" for a, s in streaks.items())
    lines = [f"## Lauf `{name}` ({'echtes Modell' if meta['mode'] == 'real' else 'Fake-LLM'})", "",
             f"- Start {meta['started']}, Dauer {hours:.2f} h Echtzeit, Tempo `{meta['speed']}`, Standard-Preset",
             f"- Modell `{llm['configured_model']}` über `{llm['base_url']}`" if meta["mode"] == "real" else "- deterministisches Fake-LLM der Browser-Tests (kein Netz)",
             f"- Simulierte Zeit: {sim_days:.1f} Sim-Tage (Minute {first['sim_minute']} bis {last['sim_minute']})",
             f"- Entscheidungen {last['stats']['decisions']} (gültig {last['stats']['valid']}, Rückfall {last['stats']['fallback']}), "
             f"LLM-Aufrufe {last['llm']['calls']}, LLM-Fehler {last['llm']['errors']}",
             f"- Ereignisse {db['events']}, Objekte {db['objects']}, Schutz-Eingriffe {db['guards']}, Gespräche {db['conversations']}, "
             f"fehlgeschlagene Aktionen {db['failed_actions']}",
             f"- Aktive Erinnerungen am Ende: {', '.join(f'{a} {n}' for a, n in db['memories_active'].items())} (archiviert {db['memories_archived']})", "",
             "| Prüfung | Ergebnis |", "|---|---|"]
    lines += [f"| {text} | {'✅' if ok else '❌'} |" for text, ok in checks]
    lines += ["", f"Zur Information (nicht vom Wiederholungsschutz überwacht): längste Folge gleicher Aktionen einschließlich Warten und Gesprächszügen: {info}.", ""]
    head = "| Uhrzeit | Sim-Zeit | Entsch./min | Rückfall | Ø Antwort s | RAM MB | DB MB | Ereign./min | Objekte | Erinnerungen | Eingriffe |"
    lines += [head, "|" + "---|" * (head.count("|") - 1)]
    xs, rss, dbm, dpm = [], [], [], []
    for prev, r in zip([None] + rows[:-1], rows):
        d = rate(prev, r, lambda s: s["stats"]["decisions"]) if prev else 0.0
        e = rate(prev, r, lambda s: s["db"]["events"]) if prev else 0.0
        m, day = r["sim_minute"], r["sim_minute"] // 1440 + 1
        mem = "/".join(str(n) for n in r["db"]["memories_active"].values())
        lines.append(f"| {r['wall'][11:16]} | T{day} {m % 1440 // 60:02d}:{m % 60:02d} | {d:g} | {r['stats']['fallback']} | {r['llm']['avg_response_s'] or 0:.2f} | "
                     f"{r['rss_mb']:g} | {r['db_mb']:g} | {e:g} | {r['db']['objects']} | {mem} | {r['db']['guards']} |")
        if prev:
            xs.append(round((r["t_s"] - first["t_s"]) / 3600, 3))
            rss.append(r["rss_mb"])
            dbm.append(r["db_mb"])
            dpm.append(d)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    charts = [("ram", svg_line("RAM des Servers", "MB", xs, rss, f"Grenze {LIMITS['rss_mb']} MB")),
              ("db", svg_line("Datenbank", "MB", xs, dbm, f"{growth:.1f} MB je Sim-Tag")),
              ("entscheidungen", svg_line("Entscheidungen", "/min", xs, dpm))]
    for key, svg in charts:
        (OUT_IMG / f"langlauf-{name}-{key}.svg").write_text(svg)
    lines += ["", " ".join(f"![{key}](img/langlauf-{name}-{key}.svg)" for key, _ in charts), ""]
    return "\n".join(lines), checks


def main(argv: list[str]) -> int:
    parts, ok = [], True
    for d in argv:
        text, checks = report(Path(d).resolve())
        parts.append(text)
        ok &= all(c for _, c in checks)
    head = ["# Langlauf (AP11)", "",
            "Erzeugt mit `scripts/langlauf_report.py` aus den Messreihen von `scripts/langlauf.py` (Messung alle 5 min, Server als eigener "
            "Prozess, ein WebSocket-Leser wie ein Browser). Grenzwerte aus AP11: RAM < 1 GB, DB-Wachstum < 50 MB je Sim-Tag, keine "
            "Fehlerserie > 5, keine überwachte Aktion ≥ 5× hintereinander, Gesprächslänge ≤ Höchstwert.", "",
            f"**Gesamtergebnis: {'alle Grenzwerte eingehalten' if ok else 'mindestens ein Grenzwert verletzt'}.**", ""]
    OUT_MD.write_text("\n".join(head + parts) + "\n")
    print(f"geschrieben: {OUT_MD}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
