"""Ereignisse: werden in derselben Transaktion wie die Zustandsänderung gespeichert."""

import json
import sqlite3
from datetime import datetime, timezone

from ..events import types as event_types
from ..events.ulid import new_event_id
from .models import Event

COLUMNS = "seq, ts, sim_minute, type, agents, location_id, data, parent_seq, event_id, category, visibility"


def insert_event(conn: sqlite3.Connection, sim_minute: int, type_: str, agents: list[str] | None = None,
                 location_id: str | None = None, data: dict | None = None, parent_seq: int | None = None) -> Event:
    agents = agents or []
    data = data or {}
    if event_types.STRICT:
        event_types.validate(type_, data)
    ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    event_id, category, visibility = new_event_id(), event_types.category_of(type_), event_types.visibility_of(type_, agents)
    cur = conn.execute(
        "INSERT INTO events (ts, sim_minute, type, agents, location_id, data, parent_seq, event_id, category, visibility) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (ts, sim_minute, type_, json.dumps(agents), location_id, json.dumps(data, ensure_ascii=False), parent_seq, event_id, category, visibility))
    caused_by = None
    if parent_seq is not None:
        r = conn.execute("SELECT event_id FROM events WHERE seq=?", (parent_seq,)).fetchone()
        caused_by = r["event_id"] if r else None
    return Event(seq=cur.lastrowid, ts=ts, sim_minute=sim_minute, type=type_, agents=agents, location_id=location_id, data=data,
                 parent_seq=parent_seq, event_id=event_id, category=category, visibility=visibility, caused_by=caused_by)


def row_to_event(r: sqlite3.Row, caused_by: str | None = None) -> Event:
    return Event(seq=r["seq"], ts=r["ts"], sim_minute=r["sim_minute"], type=r["type"], agents=json.loads(r["agents"]),
                 location_id=r["location_id"], data=json.loads(r["data"]), parent_seq=r["parent_seq"], event_id=r["event_id"],
                 category=r["category"] or event_types.category_of(r["type"]),
                 visibility=r["visibility"] or event_types.visibility_of(r["type"], json.loads(r["agents"])), caused_by=caused_by)
