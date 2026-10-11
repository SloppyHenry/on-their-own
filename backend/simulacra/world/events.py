"""Ereignisse: werden in derselben Transaktion wie die Zustandsänderung gespeichert."""

import json
import sqlite3
from datetime import datetime, timezone

from .models import Event


def insert_event(conn: sqlite3.Connection, sim_minute: int, type_: str, agents: list[str] | None = None,
                 location_id: str | None = None, data: dict | None = None, parent_seq: int | None = None) -> Event:
    ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    agents = agents or []
    data = data or {}
    cur = conn.execute(
        "INSERT INTO events (ts, sim_minute, type, agents, location_id, data, parent_seq) VALUES (?,?,?,?,?,?,?)",
        (ts, sim_minute, type_, json.dumps(agents), location_id, json.dumps(data, ensure_ascii=False), parent_seq))
    return Event(seq=cur.lastrowid, ts=ts, sim_minute=sim_minute, type=type_, agents=agents,
                 location_id=location_id, data=data, parent_seq=parent_seq)


def row_to_event(r: sqlite3.Row) -> Event:
    return Event(seq=r["seq"], ts=r["ts"], sim_minute=r["sim_minute"], type=r["type"], agents=json.loads(r["agents"]),
                 location_id=r["location_id"], data=json.loads(r["data"]), parent_seq=r["parent_seq"])
