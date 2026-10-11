-- Weltzustand, erste Fassung (AP01)
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE tiles (x INTEGER NOT NULL, y INTEGER NOT NULL, type TEXT NOT NULL, PRIMARY KEY (x, y));

CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rect TEXT NOT NULL,            -- JSON [x, y, w, h]
    entrances TEXT NOT NULL,       -- JSON [[x, y], ...]
    extra_tiles TEXT NOT NULL,     -- JSON [[x, y], ...]
    props TEXT NOT NULL,           -- JSON
    discovered_by TEXT NOT NULL DEFAULT '[]',
    sort INTEGER NOT NULL
);

CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    location_id TEXT,              -- NULL, solange ein Agent den Gegenstand trägt
    x INTEGER, y INTEGER,
    holder TEXT,                   -- Agent-ID, wenn getragen
    state TEXT NOT NULL DEFAULT '{}',
    portable INTEGER NOT NULL DEFAULT 0,
    owner TEXT,
    created_by TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    known_by TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX objects_location ON objects(location_id);
CREATE INDEX objects_holder ON objects(holder);

CREATE TABLE resources (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    x INTEGER NOT NULL, y INTEGER NOT NULL,
    resource TEXT NOT NULL,
    amount REAL NOT NULL,
    cap REAL NOT NULL,
    regen_per_hour REAL NOT NULL,
    requires_tool TEXT,
    gather_minutes INTEGER NOT NULL
);

CREATE TABLE agents_body (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    x INTEGER NOT NULL, y INTEGER NOT NULL,
    location_id TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    needs TEXT NOT NULL,           -- JSON {energy, hunger, thirst}
    action TEXT,                   -- JSON der laufenden Aktion oder NULL
    move_budget REAL NOT NULL DEFAULT 0,
    facing TEXT NOT NULL DEFAULT 'down'
);

CREATE TABLE inventory (
    agent_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    qty INTEGER NOT NULL,
    PRIMARY KEY (agent_id, resource)
);

CREATE TABLE clock (id INTEGER PRIMARY KEY CHECK (id = 1), minute INTEGER NOT NULL);

CREATE TABLE weather (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    kind TEXT NOT NULL,
    since INTEGER NOT NULL,
    until INTEGER NOT NULL
);

CREATE TABLE events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    type TEXT NOT NULL,
    agents TEXT NOT NULL,
    location_id TEXT,
    data TEXT NOT NULL,
    parent_seq INTEGER
);
CREATE INDEX events_type ON events(type);
CREATE INDEX events_minute ON events(sim_minute);

CREATE TABLE action_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sim_minute INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    params TEXT NOT NULL,
    outcome TEXT NOT NULL,         -- accepted | rejected | completed | failed | interrupted
    code TEXT,
    text TEXT,
    event_seq INTEGER
);
CREATE INDEX action_log_actor ON action_log(actor, id);
