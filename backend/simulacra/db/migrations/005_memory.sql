-- Gedächtnis (AP05): Erinnerungen je Agent, Suchindex, Wissen, Abrufprotokoll, Reflexionszustand
CREATE TABLE memories (
    id TEXT PRIMARY KEY,                       -- ULID
    agent_id TEXT NOT NULL,                    -- Besitzer; jede Abfrage filtert danach
    kind TEXT NOT NULL,                        -- episode | fact | relation | intention | reflection | summary
    text TEXT NOT NULL,                        -- Sicht des Agenten
    keywords TEXT NOT NULL DEFAULT '',         -- normalisierte Stichwörter, durch Leerzeichen getrennt
    persons TEXT NOT NULL DEFAULT '[]',        -- JSON: beteiligte Personen
    location_id TEXT,
    importance INTEGER NOT NULL,               -- 1-10
    shared INTEGER NOT NULL DEFAULT 0,         -- gemeinsames Erlebnis
    sim_created INTEGER NOT NULL,
    sim_last_access INTEGER,
    access_count INTEGER NOT NULL DEFAULT 0,
    source_event_id TEXT,
    source_memory_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',     -- active | archived
    intention_state TEXT,                      -- open | done | dropped
    intention_due INTEGER
);
CREATE INDEX memories_agent ON memories(agent_id, status, sim_created);
CREATE INDEX memories_agent_kind ON memories(agent_id, kind, status);

CREATE VIRTUAL TABLE memories_fts USING fts5(text, keywords, content='memories', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, text, keywords) VALUES (new.rowid, new.text, new.keywords);
END;
CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, text, keywords) VALUES ('delete', old.rowid, old.text, old.keywords);
END;
CREATE TRIGGER memories_au AFTER UPDATE OF text, keywords ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, text, keywords) VALUES ('delete', old.rowid, old.text, old.keywords);
    INSERT INTO memories_fts(rowid, text, keywords) VALUES (new.rowid, new.text, new.keywords);
END;

CREATE TABLE retrievals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    decision_id INTEGER,                       -- Entscheidung, für die abgerufen wurde
    query TEXT NOT NULL,
    items TEXT NOT NULL,                       -- JSON [{id, score, parts}]
    tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX retrievals_agent ON retrievals(agent_id, id);

CREATE TABLE known_objects (
    agent_id TEXT NOT NULL,
    object_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',             -- zuletzt gesehener Zustand (kann veraltet sein)
    location_id TEXT,
    seen_at INTEGER NOT NULL,
    PRIMARY KEY (agent_id, object_id)
);

CREATE TABLE known_locations (
    agent_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    discovered_at INTEGER NOT NULL,
    visits INTEGER NOT NULL DEFAULT 0,
    last_visit INTEGER,
    PRIMARY KEY (agent_id, location_id)
);

CREATE TABLE memory_state (
    agent_id TEXT PRIMARY KEY,
    importance_since_reflection INTEGER NOT NULL DEFAULT 0,
    last_reflection_minute INTEGER,
    last_reflection_day INTEGER NOT NULL DEFAULT 0,
    last_summary_day INTEGER NOT NULL DEFAULT 0
);
