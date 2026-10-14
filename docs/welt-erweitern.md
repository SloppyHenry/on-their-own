# Die Welt erweitern

Es gibt drei Wege, je nachdem, **wann** die Änderung gelten soll.

| Ziel | Weg |
|---|---|
| Nur für **neue** Simulationen | `backend/simulacra/data/world_default.json` (und `blueprints.json`) ändern |
| Auch für eine **bestehende** Simulation | einen **Patch** schreiben und anwenden |
| Zur Laufzeit aus dem Programm (Ereignis-Controller, Mitspieler) | `engine.edit.*` aufrufen |

Die Weltdatei wird nur beim Anlegen einer neuen Welt gelesen. Eine laufende Simulation bleibt dadurch stabil; Änderungen der Datei erreichen sie nicht.

## Was sich ohne Code ändern lässt
Kachelarten, Kacheln, Kartengröße, Orte, Objekte, Ressourcenquellen, Agenten und Bauvorlagen sind Daten. Code ist nur nötig für **neue Objektarten mit eigenem Verhalten** (`world/object_kinds.py`, `world/actions/use_modes.py`, die Dinge im Dorf in `world/actions/use_dinge.py`, was sie von selbst tun in `world/dinge.py`) und **neue Aktionen** (`world/actions/__init__.py`). Damit Agenten eine neue Handlung angeboten bekommen, braucht sie einen Text in `agents/phrases.py` (`USE_OPTION`) und eine Art in `agents/options.py` (`USE_KIND`) mit Grundneigung in `agents/factors/core.py`.

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
  "agents": [{"id": "jonas", "name": "Jonas", "tile": [43, 23]}],
  "links": [[[40, 22], [60, 5]]],
  "look": {"regions": [{"id": "v2", "frame": [0, 320], "bounds": {...}, "shapes": {...}, "decor": [], "lights": [], "place": {}, "houses": []}], "roads": [[[196, 304], [196, 400]]]},
  "max_objects": 300
}
```
`links` setzt Übergänge (Haustüren) zwischen zwei begehbaren Kacheln; `look` hängt Gebiete und Landstraßen an die Darstellung ([unten](#übergänge-und-darstellung-ap14)); `max_objects` hebt die Obergrenze für Objekte an (bis 500). Ein Objekt mit `"anywhere": true` darf auch auf einer nicht begehbaren Kachel stehen (Boot auf dem Wasser, Möbel auf Möbelkacheln wie in der Startwelt). Quellen kennen jetzt auch `label` und `regen_weather`.

Reihenfolge der Anwendung: `max_objects`, `tile_types`, `extend_map`, `tiles`, `locations`, `objects`, `resource_nodes`, `links`, `agents`, `look`. Im Abschnitt `tiles` steht in `rows` jedes Zeichen für eine Kachelart (`char`); ein **Leerzeichen lässt die Kachel unverändert**, so lassen sich beliebige Formen zeichnen. Unbekannte Abschnittsnamen (Tippfehler) werden abgelehnt.

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
- Jede Änderung erzeugt ein Ereignis (`world.tile_type_added`, `world.tiles_changed`, `world.map_extended`, `world.location_added`, `world.location_updated`, `world.agent_added`, `world.links_added`, `world.look_changed`, `world.object_created`, `world.object_removed`, `world.resource_added`, `world.patch_applied`).
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

## Übergänge und Darstellung (AP14)
- **`links`** in der Weltdatei: Liste von Kachelpaaren `[[x, y], [x, y]]`, die wie Nachbarn verbunden sind (in beide Richtungen), z. B. die Haustür draußen und der Flur im Innenbereich. Beide Kacheln müssen begehbar sein. Wegsuche (Backend und Vorschau im Browser) und Bewegung gehen hindurch; Hören und Sehen bleiben getrennt (Ort und Hörweite).
- **`look`** beschreibt, wie die Welt aussieht. **Version 2 (AP12a):** `{"version": 2, "style": "mockup-a", "texShift": [2, 8], "legacy": …, "home": [194, 296], "regions": […], "roads": […]}`. Eine **Region** ist ein Gebiet (Dorf) in eigenen Dorfkoordinaten wie `world.js` (Weltpixel = Dorfkoordinaten + `frame`, eine Kachel hat 16 Weltpixel): `bounds` (Wiese: `left`, `right`, `top`, `bottom`), `shapes` (Listen: `paths`, `squares`, `lakes`, `gardens` mit `beds`, `docks`, `streams`, `bridges`, `pads`), `decor` (Deko wie `wObjects`: Art, x, y, Zusatz), `lights`, `place` (Bildstelle einzelner Objekte und Quellen: `at`, `sprite`, `e`, `more`; so werden Boot, Laternen, Tomaten, Schilf usw. zu echten Dingen, die genauso aussehen wie die Deko) und `houses` (je Haus: `at`, `sprite`, `door` mit `outside` und `inside`, `interior`, `smoke`). `interior` gestaltet die Innenansicht (Puppenhaus): `rect`, `rooms` (je Ort-ID Tapete, Boden, Vorhangfarbe), `wall`, `decor`, `rugs`. `roads` sind Landstraßen zwischen Gebieten (Linienzüge in Weltpixeln). `legacy` nennt den Block des Bodens, dessen Zufall wie in Bild A in einer Folge gewürfelt wird (die Startwelt). Lichtschein aus `lights` an einer Laterne erscheint nur, wenn sie brennt. Stellplätze großer Einrichtung sind als Kachelart „Möbel“ (`m`, nicht begehbar) gesperrt. Die Startwelt wird mit `node scripts/startwelt_a.mjs` aus `docs/mockups/welt-optik/world.js` erzeugt. **Version 1** (ein Dorf mit Einzelstücken `shapes.lake`, `shapes.square`, `door`, `interior` …) lädt über `normalizeLook` (`frontend/src/world/dorf/look.ts`) weiter und ergibt genau dieselbe Version 2.

## Ein ganzes Dorf erzeugen (AP12)
Der Weltgenerator legt neue Dörfer im Stil von Bild A an, als neue Startwelt oder als Erweiterung: [generator.md](generator.md).

## Alte Spielstände
- Datenbanken von vor den Kachelarten werden beim Öffnen automatisch migriert (Migration 002).
- Objektarten, die es im Code nicht mehr gibt, laden als passive, unbekannte Objekte (blockieren nichts, lassen sich ansehen); neue Objekte solcher Arten werden abgelehnt. Objektarten sollten trotzdem nur dazukommen, nicht entfallen.
