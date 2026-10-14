-- Dinge im Dorf (AP15): Quellen mit eigenem Namen („Tomaten“) und Quellen, die nur bei bestimmtem Wetter nachwachsen (Regentonne)
ALTER TABLE resources ADD COLUMN regen_weather TEXT;
ALTER TABLE resources ADD COLUMN label TEXT;
