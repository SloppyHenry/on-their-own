# AP01 – Weltmodell, Welt-Engine und Datenbank

**Auftrag:** §3, §5 (Schritte 6–7), §16 · **Abhängig von:** AP00 · **Umfang:** L · **Meilenstein:** M1

## Ziel
Eine vollständig ohne LLM testbare Welt: Orte, Wege, Objekte, Ressourcen, Wetter, Uhr und Kalender liegen in SQLite. Eine Welt-Engine nimmt Aktionsvorschläge entgegen, prüft sie, führt sie aus oder lehnt sie begründet ab und meldet jede Änderung als Ereignis. Sie ist die einzige Stelle, die den Weltzustand verändert.

## Lieferumfang
1. Datenmodelle (Pydantic) für Welt, Orte, Kacheln, Objekte, Ressourcen, Agenten-Körper (Position, Inventar, Status), Zeit.
2. Startwelt als Datendatei `backend/simulacra/data/world_default.json` (keine Welt im Code fest verdrahtet).
3. Wegfindung auf dem Kachelraster.
4. Aktionskatalog mit Validierung und Ausführung.
5. Zeitmodell mit Tick, Tageszeit, Kalender, Tag-Nacht-Licht.
6. SQLite-Schicht mit Schema-Version und Migrationen.
7. Kommandozeile `python -m simulacra.cli world` zum Anzeigen und manuellen Ausführen von Aktionen (Entwicklungswerkzeug).

## Weltmodell

### Raster und Orte
- Raster 64 × 40 Kacheln (Kachelgröße im Frontend 32 px). Jede Kachel hat Typ (`grass`, `path`, `floor`, `wall`, `water`, `tree`, `door`, `sand`), begehbar ja/nein, Bewegungskosten.
- **Orte** sind benannte Bereiche mit Rechteck oder Kachelliste, Eingangskacheln und Eigenschaften:

| Ort-ID | Name | Besonderheiten |
|---|---|---|
| `house.living` | Wohnzimmer | Sofa, Tisch, Bücherregal, Kamin |
| `house.kitchen` | Küche | Herd, Vorratsschrank (Ressource Nahrung), Wasserhahn |
| `house.bedroom_a` | Zimmer Alex | Bett, Truhe |
| `house.bedroom_b` | Zimmer Mira | Bett, Schreibtisch |
| `house.workshop` | Werkstatt | Werkbank (Bauaktionen), Werkzeugkiste |
| `garden` | Garten | Beete (pflanzbar), Brunnen, Bank |
| `forest` | Wald | Holz (Ressource), Pilze, Lichtung, unerforschte Bereiche |
| `lake` | See | Steg, Angelplatz, Ufer; Wasser nicht begehbar |
| `square` | Zentraler Platz | Brunnen, Bank, Anschlagtafel, Marktfläche |
| `paths` | Wege | verbinden alle Orte |

- Orte haben ein Feld `discovered_by` (welcher Agent kennt den Ort schon) für Exploration (AP06).
- Neue Orte können zur Laufzeit hinzukommen (AP08), daher Orte als Datensätze, nicht als Aufzählung.

### Objekte
Gemeinsames Modell `WorldObject`: `id`, `kind` (z. B. `bed`, `seedbed`, `plant`, `map`, `door`, `bench`, `item`), `name`, `location_id`, `tile`, `state` (freies, aber pro `kind` per Schema geprüftes Dict, z. B. Pflanze `{stage: 0..4, watered_at}`, Tür `{locked: true}`), `portable`, `owner`, `created_by`, `created_at`, `hidden` (für Gegenstände, die erst entdeckt werden müssen).
Objektarten mit ihren Zustandsschemata stehen in `object_kinds.py` (Registry), damit neue Arten (AP08) nur dort ergänzt werden.

### Ressourcen
`wood`, `food`, `water`, `seeds`, `stone`. Jede Ressource hat Fundorte, Bestand pro Ort, Nachwachsrate pro Sim-Stunde, Obergrenze. Die Knappheit (AP07) skaliert Bestand und Nachwachsrate. Inventar der Agenten mit Kapazitätsgrenze.

### Zeit
- 1 Tick = 1 Simulationsminute. Startzeit Tag 1, 07:00.
- Tageszeit-Phasen: Nacht, Morgendämmerung, Tag, Abenddämmerung; daraus ein Lichtwert 0–1 für das Frontend.
- Kalender mit Wochentag und Tageszähler; geplante Ereignisse (AP08) hängen sich an Zeitpunkte.
- Wetter: `clear`, `cloudy`, `rain`, `storm`, `fog`, `snow` mit Dauer; beeinflusst Bewegungskosten und mögliche Aktionen (z. B. Pflanzen bei Sturm nicht möglich, Regen gießt Beete).

## Aktionskatalog
Jede Aktion ist eine Klasse mit `validate(world, actor, params) -> Ok | Rejected(reason_code, text)` und `apply(world, actor, params) -> list[Event]`. Aktionen haben eine **Dauer** in Sim-Minuten; während der Dauer ist der Agent beschäftigt.

| Aktion | Parameter | Validierung (Auszug) | Wirkung |
|---|---|---|---|
| `move_to` | `target` (Ort-ID oder Objekt-ID) | Ziel existiert, Weg vorhanden, Bewegungsfreiheit erlaubt das Ziel | Pfad berechnen; pro Tick eine Kachel; `agent.moved` je Schritt; Ankunft `agent.arrived` |
| `inspect` | `object_id` | Objekt am selben Ort, sichtbar | Agent lernt Objektzustand; verborgene Objekte in Reichweite werden entdeckt |
| `take` / `drop` | `object_id` | tragbar, am Ort bzw. im Inventar, Kapazität | Objekt wechselt Ort ↔ Inventar |
| `use` | `object_id`, `mode` | Objektart unterstützt den Modus, Zustand passt (z. B. Tür nicht verschlossen) | objektspezifisch: Bett → schlafen, Herd → kochen, Tafel → lesen/schreiben |
| `gather` | `resource` | Ressource am Ort vorhanden, Werkzeug falls nötig | Bestand sinkt, Inventar steigt |
| `plant` | `seedbed_id` | Samen im Inventar, Beet frei, Wetter erlaubt | Pflanze entsteht, wächst über Ticks |
| `water` | `object_id` | Wasser im Inventar oder Brunnen in der Nähe | Pflanze `watered_at` |
| `build` | `blueprint` | Werkbank oder Bauplatz, Ressourcen, Objektgrenze | Baustelle mit Fortschritt; nach Dauer neues Objekt |
| `eat` / `drink` / `rest` / `sleep` | – | passender Ort oder Gegenstand | Bedürfniswerte (AP06) ändern sich |
| `speak` | `to`, `text` | Gesprächspartner in Hörweite (gleicher Ort oder ≤ 4 Kacheln) | `agent.dialogue`; Gesprächslogik in AP02 |
| `give` | `to`, `object_id` | beide am selben Ort | Objekt wechselt Besitzer |
| `wait` | `minutes` | 1–60 | nichts; dient auch als sichere Rückfallaktion |

Bauvorlagen (`blueprints.json`): z. B. Vogelhaus, Bank, Steg-Verlängerung, Feuerstelle, Gartenzaun, mit Kosten und Dauer (beides später per Slider skaliert).

Ablehnungen haben einen festen Code (`not_reachable`, `not_here`, `missing_resource`, `locked`, `capacity`, `forbidden_by_rules`, `invalid_target`, `busy`) und einen Text für Agent und Protokoll. Die Konsequenz einer fehlgeschlagenen Aktion (nur Zeitverlust, Energieverlust oder gar nichts) ist ein Parameter (AP07).

## Wegfindung
A* auf dem Raster mit Bewegungskosten, Türen als Übergänge, Ergebnis-Cache je (Start, Ziel) mit Invalidierung bei Weltänderung. Bewegungsfreiheit (AP07): Liste gesperrter Orte bzw. Radius um das Haus.

## Datenbank
- Eine Datei `data/live.db`, WAL-Modus, ein Schreibzugriff zur Zeit (eigene Schreib-Warteschlange über `asyncio`), Lesen parallel.
- Tabellen (erste Fassung): `meta` (Schema-Version, Seed), `tiles`, `locations`, `objects`, `resources`, `agents_body`, `inventory`, `clock`, `weather`, `events` (wird in AP03 erweitert), `action_log`.
- Jede Aktion läuft in **einer Transaktion**: entweder alle Änderungen und Ereignisse oder keine. Damit kann eine fehlerhafte Antwort den Zustand nie halb verändern (§17 Nr. 15).
- Migrationen als nummerierte SQL-Dateien, beim Start automatisch angewendet.

## Module (je unter 400 Zeilen)
| Datei | Aufgabe |
|---|---|
| `world/models.py` | Pydantic-Modelle |
| `world/state.py` | Laden, Speichern, Abfragen des Weltzustands |
| `world/grid.py` | Raster, Kacheltypen, Sichtweite |
| `world/pathfinding.py` | A*, Cache |
| `world/clock.py` | Tick, Tageszeit, Kalender, Licht |
| `world/weather.py` | Wetterzustand und Wirkungen |
| `world/object_kinds.py` | Objektarten und Zustandsschemata |
| `world/actions/*.py` | eine Datei je Aktionsgruppe (Bewegung, Gegenstände, Ressourcen, Bauen, Soziales) |
| `world/engine.py` | `propose(actor, action) -> Result`, Tick-Fortschritt laufender Aktionen |
| `db/connection.py`, `db/migrations/` | SQLite-Zugriff |

## Tests
- Jede Aktion: gültiger Fall, jeder Ablehnungscode, Wirkung im Zustand, erzeugte Ereignisse.
- Wegfindung: Haus → See, Weg um Wasser herum, gesperrter Ort, unerreichbares Ziel.
- Zeit: 1440 Ticks = ein Tag, Lichtverlauf, Wetterdauer.
- Pflanze wächst über mehrere Sim-Tage, Regen gießt.
- Bauaktion verbraucht Ressourcen und erzeugt nach der Dauer das Objekt.
- Transaktion: Fehler mitten in `apply` → Zustand unverändert.
- Neustart: Zustand schreiben, Engine neu erzeugen, gleicher Zustand.
- Zwei Agenten-Körper gleichzeitig in der Welt (§17 Nr. 1).

## Abnahme
- [ ] Über die CLI lässt sich Alex manuell vom Schlafzimmer zum See bewegen, ein Beet bepflanzen und eine Bank bauen; der Zustand bleibt nach Neustart erhalten.
- [ ] Alle Tests grün, keine Abhängigkeit vom LLM-Modul.
- [ ] Startwelt als Datei, Schema dokumentiert in `docs/schnittstellen.md`.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Aktionskatalog wird zu groß | Erst die Tabelle oben, Erweiterungen nur über die Registry |
| Raster und Grafik passen später nicht zusammen | Kartenformat in AP04 aus derselben JSON-Datei rendern; Tiled-Format als Option prüfen |
