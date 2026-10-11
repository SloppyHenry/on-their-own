-- Ereignisse für API und Frontend (AP03): ULID, Kategorie, Sichtbarkeit, Ursache; Idempotenz verändernder Anfragen
ALTER TABLE events ADD COLUMN event_id TEXT;            -- ULID mit Präfix evt_; ältere Ereignisse haben keine
ALTER TABLE events ADD COLUMN category TEXT;            -- world | dialogue | planning | memory | system
ALTER TABLE events ADD COLUMN visibility TEXT;          -- public | agents:[...] | system
CREATE UNIQUE INDEX events_event_id ON events(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX events_category ON events(category, seq);
CREATE INDEX events_location ON events(location_id, seq);
CREATE INDEX events_parent ON events(parent_seq) WHERE parent_seq IS NOT NULL;

CREATE TABLE idempotency (
    key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    status INTEGER NOT NULL,
    response TEXT NOT NULL,
    created_at REAL NOT NULL            -- Echtzeit (Unix-Sekunden); Einträge verfallen nach 24 Stunden
);
