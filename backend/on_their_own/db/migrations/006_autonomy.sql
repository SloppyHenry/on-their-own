-- Autonomie (AP06): Ziele, Bedürfnisse, Beziehungen, Fehlschläge, Sperren, erweitertes Entscheidungsprotokoll
CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    kind TEXT NOT NULL,                        -- long | short
    text TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',      -- active | paused | achieved | abandoned
    condition TEXT,                            -- JSON: Erfüllungsbedingung gegen den Weltzustand (nur kurzfristige Ziele)
    plan TEXT NOT NULL DEFAULT '[]',           -- JSON [{step, kind, target}]
    plan_step INTEGER NOT NULL DEFAULT 0,
    progress REAL NOT NULL DEFAULT 0,          -- 0-1
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    last_progress INTEGER NOT NULL,            -- Simulationsminute des letzten Fortschritts
    failures INTEGER NOT NULL DEFAULT 0,       -- abgelehnte oder gescheiterte Planschritte in Folge
    replans INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    reason TEXT NOT NULL DEFAULT '',
    memory_id TEXT                             -- gespiegelte Absichts-Erinnerung (AP05)
);
CREATE INDEX goals_agent ON goals(agent_id, state, kind);

CREATE TABLE agent_needs (
    agent_id TEXT PRIMARY KEY,
    social REAL NOT NULL DEFAULT 20,           -- Dringlichkeit 0-100 (hoch = dringend)
    calm REAL NOT NULL DEFAULT 20,
    warmth REAL NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE relations (
    agent_id TEXT NOT NULL,                    -- Sicht dieses Agenten
    other_id TEXT NOT NULL,
    trust REAL NOT NULL DEFAULT 50,
    sympathy REAL NOT NULL DEFAULT 50,
    tension REAL NOT NULL DEFAULT 10,
    familiarity REAL NOT NULL DEFAULT 30,
    shared TEXT NOT NULL DEFAULT '[]',         -- JSON: gemeinsame Erlebnisse (Kurztexte)
    conflicts TEXT NOT NULL DEFAULT '[]',      -- JSON: offene Konflikte
    updated INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent_id, other_id)
);

CREATE TABLE relation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    other_id TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    deltas TEXT NOT NULL,                      -- JSON {trust: +2, ...}
    reason TEXT NOT NULL,
    source TEXT NOT NULL,                      -- rule | reflection
    event_seq INTEGER
);
CREATE INDEX relation_log_agent ON relation_log(agent_id, other_id, id);

CREATE TABLE failed_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    action TEXT NOT NULL,
    params TEXT NOT NULL,
    code TEXT NOT NULL,                        -- Ablehnungscode der Engine
    text TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '{}',        -- JSON: Ort, Ziel, Entscheidung
    event_seq INTEGER
);
CREATE INDEX failed_actions_agent ON failed_actions(agent_id, id);

CREATE TABLE action_locks (
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,                         -- Option.key (Aktion + Ziel)
    until INTEGER NOT NULL,                    -- Simulationsminute
    reason TEXT NOT NULL,
    PRIMARY KEY (agent_id, key)
);

ALTER TABLE decisions ADD COLUMN goal_id TEXT;
ALTER TABLE decisions ADD COLUMN trace TEXT;     -- JSON: Ziel, Planschritt, Abruf, Rang der gewählten Option, Erklärung, Zieländerung
