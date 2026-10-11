-- Freie Ereigniseingabe (AP08): Eingaben mit Status, geplante Ereignisse und Rücknahmen, Nebenfiguren
CREATE TABLE inject_log (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    status TEXT NOT NULL,                      -- needs_clarification | ready | needs_confirmation | executed | rejected | cancelled
    source TEXT NOT NULL DEFAULT 'rule',       -- rule | llm
    ops TEXT NOT NULL DEFAULT '[]',            -- JSON: geprüfte Operationen
    preview TEXT NOT NULL DEFAULT '[]',        -- JSON: Klartext der geplanten Änderungen
    clarification TEXT,                        -- JSON: offene Rückfrage
    reason TEXT NOT NULL DEFAULT '',           -- Grund der Ablehnung
    mode TEXT NOT NULL DEFAULT 'observer',
    agents TEXT NOT NULL DEFAULT '[]',         -- vom Benutzer gewählte Betroffene
    at_minute INTEGER,                         -- gewünschter Zeitpunkt (Simulationsminute), leer = sofort
    created INTEGER NOT NULL,                  -- Simulationsminute
    executed INTEGER,
    event_seqs TEXT NOT NULL DEFAULT '[]'      -- JSON: erzeugte Ereignisse
);

CREATE TABLE scheduled_events (
    id TEXT PRIMARY KEY,
    minute INTEGER NOT NULL,                   -- Auslösezeitpunkt
    kind TEXT NOT NULL,                        -- fire (Operationen ausführen) | revert (befristete Wirkung zurücknehmen)
    ops TEXT NOT NULL,                         -- JSON
    text TEXT NOT NULL DEFAULT '',
    inject_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',    -- pending | done | cancelled
    created INTEGER NOT NULL
);
CREATE INDEX scheduled_due ON scheduled_events(status, minute);

CREATE TABLE npcs (
    agent_id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    stay_until INTEGER NOT NULL,
    last_move INTEGER NOT NULL DEFAULT 0,
    inject_id TEXT
);
