"""Statistiken (§14): reine SQL-Abfragen auf `events`, `action_log`, `decisions`, `conversations`, `relation_log`, `memories` und `stats_samples`; keine zweite Datenhaltung."""

import json
import re
import sqlite3
from collections import Counter
from typing import Any

STOP = set("und oder aber dass das der die den dem des ein eine einen einem einer ist sind war waren wird werden habe hast hat haben nicht mit von für auf aus bei nach wie auch noch nur schon dann wenn mich dich mir dir uns ihr sich ich du er sie es wir als zum zur zum im am an in zu so ja nein doch hier dort sehr mal gern gerne kann können will wollen soll sollen was wer wo wann warum".split())
REL = ("trust", "sympathy", "tension", "familiarity")


def _range(lo: int | None, hi: int | None, col: str = "sim_minute") -> tuple[str, list[int]]:
    parts, args = [], []
    if lo is not None:
        parts.append(f"{col} >= ?")
        args.append(lo)
    if hi is not None:
        parts.append(f"{col} <= ?")
        args.append(hi)
    return (" AND " + " AND ".join(parts)) if parts else "", args


def _j(s: str) -> Any:
    try:
        return json.loads(s)
    except ValueError:
        return None


def actions(c: sqlite3.Connection, agent: str | None, lo, hi) -> dict[str, Any]:
    w, a = _range(lo, hi)
    q = "SELECT action, outcome, code, text FROM action_log WHERE 1=1" + w + (" AND actor=?" if agent else "")
    rows = c.execute(q, [*a, *([agent] if agent else [])]).fetchall()
    by: dict[str, Counter] = {}
    bad: Counter = Counter()
    for r in rows:
        by.setdefault(r["action"], Counter())[r["outcome"]] += 1
        if r["outcome"] in ("rejected", "failed"):
            bad[(r["code"] or "?", (r["text"] or "")[:90])] += 1
    out = []
    for act, cnt in sorted(by.items(), key=lambda kv: -sum(kv[1].values())):
        done, failed = cnt["completed"], cnt["failed"] + cnt["rejected"] + cnt["interrupted"]
        out.append({"action": act, "started": cnt["accepted"], "completed": done, "failed": failed, "success_rate": round(done / (done + failed), 3) if done + failed else None})
    done, failed = sum(o["completed"] for o in out), sum(o["failed"] for o in out)
    return {"by_action": out, "completed": done, "failed": failed, "success_rate": round(done / (done + failed), 3) if done + failed else None,
            "top_rejections": [{"code": k[0], "text": k[1], "count": n} for k, n in bad.most_common(6)]}


def conversations(c: sqlite3.Connection, agent: str | None, lo, hi) -> dict[str, Any]:
    w, a = _range(lo, hi, "started_at")
    rows = c.execute("SELECT participants, turns FROM conversations WHERE status='ended'" + w, a).fetchall()
    lengths = [len(_j(r["turns"]) or []) for r in rows if not agent or agent in (_j(r["participants"]) or [])]
    w2, a2 = _range(lo, hi)
    prop = Counter()
    for r in c.execute("SELECT type, data FROM events WHERE type IN ('agent.proposal_accepted','agent.proposal_declined')" + w2, a2):
        d = _j(r["data"]) or {}
        if not agent or agent in (d.get("by"), d.get("answered_by")):
            prop[r["type"].rsplit("_", 1)[1]] += 1
    words: Counter = Counter()
    for r in c.execute("SELECT agents, data FROM events WHERE type='agent.dialogue'" + w2, a2):
        d = _j(r["data"]) or {}
        if agent and agent not in (d.get("speaker"), d.get("to")):
            continue
        words.update(x for x in re.findall(r"[a-zäöüß]{4,}", str(d.get("text", "")).lower()) if x not in STOP)
    return {"count": len(lengths), "avg_turns": round(sum(lengths) / len(lengths), 1) if lengths else None, "proposals_accepted": prop["accepted"], "proposals_declined": prop["declined"],
            "keywords": [{"word": w_, "count": n} for w_, n in words.most_common(12)]}


def places(c: sqlite3.Connection, agent: str | None, lo, hi, now: int, names: dict[str, str]) -> dict[str, Any]:
    w, a = _range(lo, hi)
    minutes: Counter = Counter()
    last: dict[str, tuple[int, str]] = {}
    for r in c.execute("SELECT sim_minute, agents, data FROM events WHERE type='agent.location_changed'" + w + " ORDER BY seq", a):
        ag = (_j(r["agents"]) or [None])[0]
        if agent and ag != agent:
            continue
        d = _j(r["data"]) or {}
        if ag in last:
            minutes[last[ag][1]] += r["sim_minute"] - last[ag][0]
        else:
            minutes[d.get("from_location")] += max(0, r["sim_minute"] - (lo or 0)) if lo else 0
        last[ag] = (r["sim_minute"], d.get("to_location"))
    for ag, (m, loc) in last.items():
        minutes[loc] += max(0, (hi if hi is not None else now) - m)
    disc = Counter()
    for r in c.execute("SELECT type, agents FROM events WHERE type IN ('agent.location_discovered','world.object_discovered')" + w, a):
        if not agent or agent in (_j(r["agents"]) or []):
            disc[r["type"]] += 1
    return {"time_by_location": [{"location": k, "name": names.get(k, k), "minutes": v} for k, v in minutes.most_common() if k and v > 0],
            "discovered_locations": disc["agent.location_discovered"], "discovered_objects": disc["world.object_discovered"]}


def series(c: sqlite3.Connection, agent: str, lo, hi) -> dict[str, Any]:
    w, a = _range(lo, hi)
    samples = [dict(r) for r in c.execute("SELECT sim_minute AS minute, energy, hunger, thirst, social, calm, warmth, mood FROM stats_samples WHERE agent_id=?" + w + " ORDER BY sim_minute", [agent, *a])]
    rel: dict[str, list[dict[str, Any]]] = {}
    for other in [r["other_id"] for r in c.execute("SELECT other_id FROM relations WHERE agent_id=?", (agent,))]:
        cur = dict(c.execute("SELECT trust, sympathy, tension, familiarity FROM relations WHERE agent_id=? AND other_id=?", (agent, other)).fetchone())
        log = c.execute("SELECT sim_minute, deltas FROM relation_log WHERE agent_id=? AND other_id=? ORDER BY id DESC", (agent, other)).fetchall()
        pts = [{"minute": c.execute("SELECT minute FROM clock").fetchone()["minute"], **cur}]
        for r in log:                                                              # rückwärts: Wert vor der Änderung = jetzt minus Änderung
            for k, v in (_j(r["deltas"]) or {}).items():
                if k in cur:
                    cur[k] = cur[k] - v
            pts.append({"minute": r["sim_minute"], **cur})
        rel[other] = [p for p in reversed(pts) if (lo is None or p["minute"] >= lo) and (hi is None or p["minute"] <= hi)]
    return {"needs_mood": samples, "relations": rel}


def memories_per_day(c: sqlite3.Connection, agent: str | None, lo, hi) -> list[dict[str, int]]:
    w, a = _range(lo, hi, "sim_created")
    rows = c.execute("SELECT sim_created / 1440 + 1 AS day, kind, COUNT(*) n FROM memories WHERE 1=1" + w + (" AND agent_id=?" if agent else "") + " GROUP BY day, kind ORDER BY day",
                     [*a, *([agent] if agent else [])]).fetchall()
    days: dict[int, dict[str, int]] = {}
    for r in rows:
        d = days.setdefault(r["day"], {"day": r["day"], "memories": 0, "reflections": 0})
        d["reflections" if r["kind"] == "reflection" else "memories"] += r["n"]
    return list(days.values())


def llm(c: sqlite3.Connection, agent: str | None, lo, hi) -> dict[str, Any]:
    w, a = _range(lo, hi)
    r = c.execute("SELECT COUNT(*) n, SUM(status='valid') valid, SUM(status='fallback') fallback, AVG(latency_ms) avg_ms, SUM(COALESCE(prompt_tokens,0)) pt, SUM(COALESCE(completion_tokens,0)) ct, "
                  "SUM(attempts-1) retries FROM decisions WHERE 1=1" + w + (" AND agent_id=?" if agent else ""), [*a, *([agent] if agent else [])]).fetchone()
    return {"decisions": r["n"], "valid": r["valid"] or 0, "fallback": r["fallback"] or 0, "avg_latency_ms": round(r["avg_ms"]) if r["avg_ms"] is not None else None,
            "prompt_tokens": r["pt"] or 0, "completion_tokens": r["ct"] or 0, "corrections": r["retries"] or 0}


def compute(c: sqlite3.Connection, ai_ids: list[str], names: dict[str, str], locations: dict[str, str], agent: str | None = None, lo: int | None = None, hi: int | None = None) -> dict[str, Any]:
    now = c.execute("SELECT minute FROM clock").fetchone()["minute"]

    def one(ag: str | None) -> dict[str, Any]:
        out = {"agent": ag, "name": names.get(ag, "alle") if ag else "alle", "actions": actions(c, ag, lo, hi), "conversations": conversations(c, ag, lo, hi),
               "places": places(c, ag, lo, hi, now, locations), "memories_per_day": memories_per_day(c, ag, lo, hi), "llm": llm(c, ag, lo, hi)}
        out["series"] = series(c, ag, lo, hi) if ag else {"needs_mood": [], "relations": {}}
        return out
    targets = [agent] if agent else ai_ids
    return {"minute": now, "from": lo, "to": hi, "agents": [one(a) for a in targets], "total": one(None) if not agent else None}
