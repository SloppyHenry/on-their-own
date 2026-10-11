# Die Welt erweitern

Es gibt drei Wege, je nachdem, **wann** die Änderung gelten soll.

| Ziel | Weg |
|---|---|
| Nur für **neue** Simulationen | `backend/simulacra/data/world_default.json` (und `blueprints.json`) ändern |
| Auch für eine **bestehende** Simulation | einen **Patch** schreiben und anwenden |
| Zur Laufzeit aus dem Programm (Ereignis-Controller, Mitspieler) | `engine.edit.*` aufrufen |

Die Weltdatei wird nur beim Anlegen einer neuen Welt gelesen. Eine laufende Simulation bleibt dadurch stabil; Änderungen der Datei erreichen sie nicht.

## Was sich ohne Code ändern lässt
Kachelarten, Kacheln, Kartengröße, Orte, Objekte, Ressourcenquellen, Agenten und Bauvorlagen sind Daten. Code ist nur nötig für **neue Objektarten mit eigenem Verhalten** (`world/object_kinds.py`, `world/actions/use_modes.py`) und **neue Aktionen** (`world/actions/__init__.py`).

## Patches
Ein Patch ist eine JSON-Datei mit denselben Abschnitten wie die Weltdatei (nur die benötigten). Er wird **genau einmal** angewendet und ist **atomar**: Scheitert ein Teil, bleibt die Welt unverändert und der Patch gilt als nicht angewendet.

```json
{
  "id": "pavillon-am-platz",
  "description": "Marmor-Pavillon mit Bank",
  "tile_types": {"marble": {"char": "m", "walkable": true, "cost": 1, "color": "#eeeeee", "label": "Marmor"}},
  "extend_map": {"width": 80, "height": 48, "fill": "grass"},
  "tiles": [
    {"rect": [41, 21, 3, 3], "type": "marble"},
    {"at": [20, 30], "rows": ["m.m", " m "]}
  ],
  "locations": [{"id": "pavilion", "name": "Pavillon", "rect": [41, 21, 3, 3], "claim": true}],
  "objects": [{"kind": "bench", "name": "Pavillonbank", "tile": [42, 22]}],
  "resource_nodes": [{"id": "pavilion_well", "tile": [41, 21], "resource": "water", "amount": 999, "cap": 999}],
  "agents": [{"id": "jonas", "name": "Jonas", "tile": [43, 23]}]
}
```

Reihenfolge der Anwendung: `tile_types`, `extend_map`, `tiles`, `locations`, `objects`, `resource_nodes`, `agents`. Im Abschnitt `tiles` steht in `rows` jedes Zeichen für eine Kachelart (`char`); ein **Leerzeichen lässt die Kachel unverändert**, so lassen sich beliebige Formen zeichnen. Unbekannte Abschnittsnamen (Tippfehler) werden abgelehnt.

```bash
cd backend
.venv/bin/python -m simulacra.cli world patch pavillon.json      # anwenden
.venv/bin/python -m simulacra.cli world patches                  # was ist schon angewendet?
```

## Regeln, die immer gelten
- **Kachelarten** sind Daten (Tabelle `tile_types`): `walkable`, `cost` (1–20 Minuten), `char`, `color`, `label`. Dieselbe Definition noch einmal anzulegen ist wirkungslos, eine abweichende wird abgelehnt.
- **Karte** kann nur **wachsen** (bis 256 × 256), bestehende Koordinaten bleiben gleich. Die neue Fläche wird mit einer Kachelart gefüllt und gehört dem Rückfallort `paths`. Der Baumgürtel am alten Rand trennt sie, bis ein Durchgang geöffnet wird.
- **Kacheln** können nicht unbegehbar werden, solange dort ein Agent, ein Objekt oder eine Quelle steht.
- **Orte:** `claim: true` (Standard) übernimmt überlappende Kacheln von bestehenden Orten; `false` lässt sie dort. Objekte, Quellen und Agenten bekommen ihren Ort danach neu zugeordnet (das Ereignis nennt die Zahlen).
- **IDs** von Orten, Objekten, Quellen und Agenten teilen sich einen Namensraum, weil sie alle Ziel von `move_to` sein können.
- **Objekte** brauchen eine bekannte Objektart und ein gültiges Zustandsschema, respektieren `max_objects` und die Tragkraft. Mit `location_id` statt `tile` sucht die Engine einen freien Platz im Ort; mit `hidden` und `known_by` steuert man, wer es sieht.
- **Agenten** können jederzeit dazukommen und nutzen dieselbe Schnittstelle (`propose`) wie alle anderen.
- Jede Änderung erzeugt ein Ereignis (`world.tile_type_added`, `world.tiles_changed`, `world.map_extended`, `world.location_added`, `world.location_updated`, `world.agent_added`, `world.object_created`, `world.object_removed`, `world.resource_added`, `world.patch_applied`).
- Fehler sind `WorldEditError` mit den Codes `exists`, `invalid`, `out_of_bounds`, `blocked`, `unknown`, `limit`.

## Programmschnittstelle
```python
eng.edit.add_tile_type("lava", walkable=False, color="#ff4400", char="L")
eng.edit.set_tiles([(10, 12, "lava")])           # oder eng.edit.paint_rect(x, y, b, h, "lava")
eng.edit.extend_map(80, 48, fill="grass")
eng.edit.add_location("nook", "Leseecke", [37, 21, 3, 3], props={"quiet": True}, claim=True)
eng.edit.update_location("nook", name="Lesenische", props={"quiet": None})   # None löscht ein Feld
eng.edit.add_agent("jonas", "Jonas", [20, 18], capacity=8)
eng.edit.spawn_object("map", "Alte Karte", location_id="house.kitchen", state={"text": "..."}, hidden=True, known_by=["mira"]).value
eng.edit.remove_object("axe")
eng.edit.add_resource_node("clay_pit", [8, 25], "clay", 5, 5, regen_per_hour=0.5)
eng.edit.apply_patch(patch_dict)
```
Jeder Aufruf liefert `EditResult(events, value)`.

## Alte Spielstände
- Datenbanken von vor den Kachelarten werden beim Öffnen automatisch migriert (Migration 002).
- Objektarten, die es im Code nicht mehr gibt, laden als passive, unbekannte Objekte (blockieren nichts, lassen sich ansehen); neue Objekte solcher Arten werden abgelehnt. Objektarten sollten trotzdem nur dazukommen, nicht entfallen.
