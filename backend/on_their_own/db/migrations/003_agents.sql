-- Agentenzyklus (AP02): Profile, Laufzeit, Beobachtungen, Gespräche, Entscheidungsprotokoll
CREATE TABLE agent_profiles (
    agent_id TEXT PRIMARY KEY,     -- nur Agenten mit Profil werden von der KI gesteuert
    profile TEXT NOT NULL,         -- JSON
    personality TEXT NOT NULL,     -- JSON, Werte 0-100
    updated_at INTEGER NOT NULL
);

CREATE TABLE agent_runtime (
    agent_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',   -- idle | deciding | acting | talking | sleeping | stuck | resting_mode
    plan_next TEXT NOT NULL DEFAULT '',
    plan_minute INTEGER,
    last_decision_minute INTEGER,
    last_seen TEXT NOT NULL DEFAULT '{}'      -- JSON {agent: {loc, minute}}: wo wurde wer zuletzt gesehen
);

CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    sim_minute INTEGER NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 3,
    event_seq INTEGER
);
CREATE INDEX observations_agent ON observations(agent_id, id);

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participants TEXT NOT NULL,            -- JSON, sortiert
    location_id TEXT,
    started_at INTEGER NOT NULL,
    last_minute INTEGER NOT NULL,
    status TEXT NOT NULL,                  -- opening | active | ended
    end_reason TEXT,
    turns TEXT NOT NULL DEFAULT '[]',      -- JSON [{speaker, text, minute}]
    proposal TEXT,                         -- JSON {by, text, minute, status: queued|open|accepted|declined}
    pending_end TEXT                       -- Agent, der das Gespräch mit seinem nächsten Beitrag beendet
);
CREATE INDEX conversations_status ON conversations(status);

CREATE TABLE decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sim_minute INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL,                  -- valid | fallback
    options TEXT NOT NULL,                 -- JSON: angebotene Optionen mit Punktzahl und Faktoren
    chosen TEXT,
    action TEXT, params TEXT,
    intent TEXT, importance INTEGER, utterance TEXT, plan_next TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    latency_ms INTEGER, prompt_tokens INTEGER, completion_tokens INTEGER,
    error TEXT,
    outcome TEXT, outcome_text TEXT,       -- accepted | rejected (+ Text der Engine)
    event_seq INTEGER
);
CREATE INDEX decisions_agent ON decisions(agent_id, id);
