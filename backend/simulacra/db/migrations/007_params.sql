-- Parameter und Presets (AP07)
CREATE TABLE params (
    key TEXT NOT NULL,
    agent_id TEXT NOT NULL DEFAULT '',          -- leer = global
    value TEXT NOT NULL,                        -- JSON
    updated INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, agent_id)
);

CREATE TABLE presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,                         -- JSON {Schlüssel: Wert | {Agent: Wert}}
    created INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0
);
