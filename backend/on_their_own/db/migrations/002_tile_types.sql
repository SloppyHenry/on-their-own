-- Kachelarten als Daten statt Code (AP01-Erweiterung). Bestehende Welten bekommen die acht Ursprungsarten.
CREATE TABLE tile_types (
    id TEXT PRIMARY KEY,
    char TEXT UNIQUE,              -- Zeichen in Kartenzeilen (optional)
    walkable INTEGER NOT NULL,
    cost INTEGER NOT NULL,         -- Minuten je Kachel
    color TEXT,                    -- Ersatzfarbe für das Frontend
    label TEXT NOT NULL
);

INSERT INTO tile_types(id, char, walkable, cost, color, label) VALUES
    ('grass', '.', 1, 2, '#5f8f4b', 'Gras'),
    ('path',  ',', 1, 1, '#b59a6a', 'Weg'),
    ('floor', '_', 1, 1, '#9c7b57', 'Boden'),
    ('wall',  '#', 0, 0, '#4a4a52', 'Wand'),
    ('water', '~', 0, 0, '#3f6fa8', 'Wasser'),
    ('tree',  'T', 0, 0, '#2f5d34', 'Baum'),
    ('door',  '+', 1, 1, '#7a5230', 'Tür'),
    ('sand',  's', 1, 2, '#d8c48a', 'Sand');
