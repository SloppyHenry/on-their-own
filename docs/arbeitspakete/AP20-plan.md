# AP20 – Musik-Editor (Plan, 20.10.2026)

**Auftrag:** Henry, 18.10.2026 ([ausblick.md](../ausblick.md), Nachtrag): „Musik-Editor, in dem man aus Elementen eigene Hintergrundmusik baut“, unter Menü › Editoren. Am 20.10.2026 beauftragt.
**Umfang:** L, Schritt 0 plus vier Teilpakete (a–d). **Abhängig von:** AP18b (Formensprache), AP18a (Esc). Unabhängig von AP19 und AP21, kann also auch früher kommen.

## Ziel
Musikstücke sind **Daten** statt Code. Ein Editor baut aus denselben Bausteinen, die die Spielmusik heute hat, eigene Stücke, spielt sie sofort vor und legt fest, **wann welches Stück spielt** (Tageszeit, Wetter, drinnen, Ort). Die fünf heutigen Stücke klingen danach genauso wie vorher.

## Ausgangslage
- `frontend/src/klang/musik.ts`: `MUS: Record<Stueck, Def>` mit fünf Stücken (`morgen`, `mittag`, `abend`, `nacht`, `drinnen`), `startCodeMusic(key, {rain, night})`. In `playBar` stehen Bass, Fläche, Begleitung, Melodie (Form A A′ B A″ mit Schlusswendung) und Schlagwerk. Zufall: `seeded(key + Date.now())`.
- `Def`: `bpm`, `root` (MIDI), `scale` (`dur`, `moll`, `dorisch`), `prog` (Stufen 0–6), `lead` (`puls25`, `puls50`, `dreieck`, `spieluhr`, `zupf`), `drums` (`leicht`, `voll`, `besen`, `null`), Schalter `pad`, `arp`, `counter`, `walk`, `swing`, `sparse`, `warm`.
- `frontend/src/klang/regie.ts` wählt das Stück: `tageszeit(w)` → `morgen|mittag|abend|nacht`, im Haus `drinnen`; Regen macht Dur zu Moll und langsamer (in `startCodeMusic`).
- Einstellungen Ton: `klang/einstellungen.ts` (`useTon`), Oberfläche `settings/TonSettings.tsx`.
- Vorlagen-Speicher als Vorbild für eine Bibliothek im Backend: `backend/simulacra/agents/templates.py` (`TemplateStore`, mitgelieferte schreibgeschützt, eigene in `data/vorlagen/`).

## Festlegungen
1. **Gleichklang ist Pflicht:** Die fünf Standardstücke erzeugen nach dem Umbau bei gleichem Zufall **dieselben Noten** (Test, siehe a).
2. Mitgelieferte Stücke sind schreibgeschützt („Kopie bearbeiten“), wie die Vorlagen.
3. **Bibliothek** der eigenen Stücke liegt im Backend (`data/musik/eigene-<id>.json`), damit sie für alle Spielstände gilt. Die **Zuordnung** „wann spielt was“ gehört zur Welt (AP18e, `info.json`) und zum Spielstand (Meta `musik`). Ohne Zuordnung gilt die Standardzuordnung, also das heutige Verhalten (Frage 66).
4. Musik ist keine Weltänderung: Die Zuordnung darf man in beiden Spielarten ändern. Die Bewohner merken davon nichts (sie hören keine Musik).
5. Keine Aufnahmen, kein Hochladen von Klangdateien. Alles bleibt Klang aus Code (CC0-Aufnahmen sind nach AP17d aus).

## Datenformat `simulacra-musik`, Version 1
```json
{
  "format": "simulacra-musik", "version": 1,
  "id": "eigene-abendrot", "name": "Abendrot",
  "tempo": 80, "grundton": 57, "tonleiter": "moll",
  "akkorde": [0, 5, 2, 6],
  "melodie": { "instrument": "dreieck", "sparsam": false, "motive": null },
  "bass": "liegend",
  "flaeche": true, "gebrochen": false, "gegenstimme": false,
  "schlagwerk": "besen", "swing": 0.58, "warm": false,
  "lautstaerke": 1.0
}
```
| Feld | Werte | heute |
|---|---|---|
| `tempo` | 40–160 | `bpm` |
| `grundton` | MIDI 45–72 | `root` |
| `tonleiter` | `dur`, `moll`, `dorisch`, neu `mixolydisch` `[0,2,4,5,7,9,10]`, `pentatonik` `[0,2,4,7,9]` (nur 5 Stufen: `deg` muss die Länge der Tonleiter nutzen statt fest 7) | `scale` |
| `akkorde` | 1–8 Stufen, je 0–6 | `prog` |
| `melodie.instrument` | `puls25`, `puls50`, `dreieck`, `spieluhr`, `zupf` | `lead` |
| `melodie.sparsam` | bool | `sparse` |
| `melodie.motive` | `null` (zufällig wie heute) oder `{ "A": Motiv, "B": Motiv }`, Motiv = `{ "rh": [[pos, len], …], "kontur": [int, …] }`, `pos` 0–7, `len` 1–8, höchstens 8 Töne | neu |
| `bass` | `liegend`, `laufend`, `gezupft` | `walk` → laufend, `warm` → gezupft, sonst liegend |
| `flaeche`, `gebrochen`, `gegenstimme` | bool | `pad`, `arp`, `counter` |
| `schlagwerk` | `null`, `leicht`, `voll`, `besen` | `drums` |
| `swing` | 0,5–0,7 (0,5 = gerade) | `swing` (fehlt = 0,5) |
| `warm` | bool (dunkler Klang, gezupfte Begleitung auf 2 und 4) | `warm` |
| `lautstaerke` | 0,2–1,5 | neu, 1,0 |

**Achtung:** Heute hängt der Bass an zwei Schaltern (`walk`, `warm`), und `warm` steuert zusätzlich Lautstärke, Hall und Klangfarbe. Im neuen Format sind `bass` und `warm` getrennt. Die Umrechnung für die fünf Standardstücke muss genau das heutige Verhalten treffen (Test).

**Zuordnung** (`simulacra-musik-zuordnung`, Version 1): geordnete Liste von Regeln, die erste passende gewinnt:
```json
{ "regeln": [
  { "wann": { "drinnen": true }, "stueck": "drinnen" },
  { "wann": { "tageszeit": ["nacht"] }, "stueck": "nacht" },
  { "wann": { "tageszeit": ["morgen"] }, "stueck": "morgen" },
  { "wann": { "tageszeit": ["abend"] }, "stueck": "abend" },
  { "wann": {}, "stueck": "mittag" } ] }
```
`wann` kann enthalten: `tageszeit` (Liste aus `morgen`, `mittag`, `abend`, `nacht`), `drinnen` (bool), `wetter` (Liste aus `clear`, `cloudy`, `rain`, `storm`, `fog`, `snow`), `ort` (Liste von Orts-Kennungen der Welt). Die letzte Regel muss leer sein (Rückfall); die Prüfung verlangt das.

## Schritt 0 – Mockup (eine Sitzung)
`docs/mockups/musik.html` mit `docs/mockups/musik/`, Stil aus `docs/mockups/rework/stil.css`:
- **Bild 1, Bibliothek** (Menü › Editoren › Musik): Karten der Stücke (5 mitgelieferte mit Schloss, eigene), je Karte Vorhören, Kopie bearbeiten, Umbenennen, Export, Löschen. Oben „Neues Stück“.
- **Bild 2, Editor:** oben Leiste mit ▶/■, Taktanzeige 1–8 (A A′ B A″ farbig), Tempo, „Regen“ und „Nacht“ als Vorhör-Schalter. Darunter Gruppen: **Grundlagen** (Name, Grundton als Notenname mit Oktave, Tonleiter), **Akkorde** (1–8 Kästchen mit römischen Stufen I–VII, Klick wechselt, +/−), **Melodie** (Instrument-Chips, Sparsam, „Motive neu würfeln“, „Motive selbst zeichnen“), **Begleitung** (Bass-Chips, Fläche, Gebrochene Akkorde, Gegenstimme, Warm), **Schlagwerk** (Chips), **Ausdruck** (Swing, Lautstärke).
- **Bild 3, Motiv-Raster:** zwei Raster A und B, je 8 Achtel × 15 Tonstufen, Töne setzen durch Klick, Länge durch Ziehen nach rechts.
- **Bild 4, Zuordnung:** Liste der Regeln mit Bedingungen als Chips, Ziehen zum Umsortieren, Stück je Regel als Auswahl. Erreichbar im Editor (Reiter) und in Menü › Einstellungen › Ton („Musik dieser Welt …“).
Henry nimmt ab, bevor a beginnt.

## AP20a – Noten als reine Funktion, Stücke als Daten (kein hörbarer Unterschied)
1. **Noten-Basis sichern (zuerst!):** Teile `playBar` in zwei Hälften:
   - `noten(def, takt, rnd, lage) -> Note[]` in `klang/noten.ts` (neu, **ohne** Web Audio): liefert je Ton `{ spur: "bass"|"flaeche"|"begleitung"|"melodie"|"schlag", klang: string, midi: number, achtel: number, laenge: number, staerke: number, extra?: {...} }`. `achtel` ist die Startzeit in Achteln **mit** Swing-Verschiebung.
   - `spielen(noten, t0, achtel)` in `musik.ts` macht daraus Töne (die heutigen Funktionen `voice`, `pluck`, `bell`, `drum`).
   - Der Zufall wird hineingereicht: `startCodeMusic(key, {rain, night, seed})`; ohne `seed` wie heute `key + Date.now()`.
   - Vitest `klang/noten.test.ts`: für jedes der fünf Stücke × {normal, Regen, Nacht} die Noten der Takte 0–15 mit Seed `"probe"` als Schnappschuss (`toMatchSnapshot`). **Erst Schnappschuss auf dem Code direkt nach dem Aufteilen erzeugen und committen.** Prüfe vorher von Hand im Browser (Einstellungen › Ton), dass es gleich klingt.
2. `klang/stueck.ts` (neu): Typ `Stueck` (Format oben), `pruefe(json) -> Fehler[]` (deutsche Meldungen je Feld), `ausAltemDef(def) -> Stueck`.
3. `klang/stuecke/standard.ts`: die fünf Stücke im neuen Format (Kennungen `morgen`, `mittag`, `abend`, `nacht`, `drinnen`, Namen wie heute `name`). `MUS` fällt weg; `noten` liest das neue Format.
4. `klang/zuordnung.ts`: `stueckFuer(zuordnung, lage: {tageszeit, drinnen, wetter, ort}) -> id` und `STANDARD_ZUORDNUNG` (wie oben). `regie.ts` nutzt das statt der festen Auswahl.
5. **Prüfen:** Schnappschuss unverändert, `klang.test.ts` grün, Vitest für `stueckFuer` (jede Regelart, Reihenfolge, Rückfall), `pruefe` (jede Grenze).

## AP20b – Bibliothek und Zuordnung im Backend
1. `backend/simulacra/musik/` (neu): `schema.py` (Pydantic-Modell wie oben, `extra="forbid"`, Grenzen, Größe höchstens 20 kB), `store.py` (`MusikStore` nach dem Vorbild `TemplateStore`: `list`, `get`, `create`, `update`, `delete`, `duplicate`, `export`, `import_` – Import legt immer neu an, nie überschreiben).
2. Ordner: `data/musik/` neben `data/vorlagen/` (gleiche Ermittlung wie dort: `Path(db_path).parent / "musik"`, siehe `api/routes_newsim.py`; ohne Datenbankdatei nur im Speicher).
3. API `api/routes_musik.py`: `GET/POST /api/musik`, `GET/PUT/DELETE /api/musik/{id}`, `POST /api/musik/{id}/duplicate`, `GET /api/musik/{id}/export`, `POST /api/musik/import`, `GET/PUT /api/musik/zuordnung` (liest und schreibt Meta `musik` der laufenden Simulation). Mitgelieferte Stücke kennt das Backend nur als Kennungen (`morgen` …), damit eine Zuordnung sie nennen darf; ihre Daten liegen im Frontend.
4. Spielstand: Meta `musik` wird mitgespeichert. Beim **Export** eines Spielstands (`saves/portable.py`) kommen die in der Zuordnung genannten **eigenen** Stücke mit in die Datei; beim Import werden sie als neue eigene Stücke angelegt und die Zuordnung umbenannt. Gleiches für Welten (AP18e), sobald es sie gibt.
5. Frontend: `klang/musikStore.ts` lädt Bibliothek und Zuordnung (`api.ts`), `regie.ts` spielt eigene Stücke nach Kennung.
6. **Prüfen:** pytest `tests/musik/` (CRUD, Grenzen, Import legt neu an, Zuordnung ohne Rückfallregel abgelehnt, Zuordnung mit unbekanntem Stück abgelehnt, Spielstand-Export und -Import mit eigenem Stück).

## AP20c – Der Editor
1. `frontend/src/musik/` (neu): `MusikBibliothek.tsx` (Bild 1), `MusikEditor.tsx` (Bild 2), `Zuordnung.tsx` (Bild 4), `editorStore.ts` (Entwurf, ungespeichert-Hinweis, Rückgängig 20 Schritte).
2. **Vorhören:** ▶ startet `startCodeMusic` mit dem Entwurf; jede Änderung gilt ab dem nächsten Takt (Entwurf in einer Referenz lesen, nicht neu starten). Die Spielmusik wird während des Vorhörens leise gestellt und danach wieder eingeblendet.
3. Menü › Editoren bekommt die Kachel **♪ Musik** (`data-testid="editor-musik"`). Esc und Brotkrumen nach AP18a.
4. Aussehen 1:1 nach Mockup.
5. **Prüfen:** Playwright `e2e/musik.spec.ts`: Kopie von „Abend“ anlegen, Tempo ändern, speichern, Liste zeigt sie; Zuordnung „Regen → mein Stück“ setzen; Ton an, Wetter per Ereignis auf Regen (Spielart Gott) → `laeuft.musik` (aus `regie.ts`) nennt das eigene Stück. Export und Import ergeben eine byte-gleiche Datei.

## AP20d – Motive selbst zeichnen
1. `musik/MotivRaster.tsx` (Bild 3): Raster je Motiv, Klick setzt einen Ton (eine Stufe je Achtel), Ziehen verlängert, Rechtsklick löscht. Schreibt `melodie.motive`.
2. `noten` nutzt feste Motive statt der zufälligen, wenn `motive` gesetzt ist. A′ und A″ bleiben Abwandlungen von A (wie heute `vary`), außer der Schalter „genau so“ ist an (neues Feld `melodie.abwandeln`, Standard `true`).
3. **Prüfen:** Vitest: festes Motiv → Melodietöne genau an den gezeichneten Stellen in Takt 0; Playwright: Ton setzen, ▶, keine Fehler in der Konsole.

## Abnahme
Henry baut ein eigenes Stück, hört es vor, ordnet es dem Regen zu und hört es im Spiel, wenn es regnet. Die Standardmusik klingt wie vorher. Bericht `docs/status/AP20.md`.

## Fallen
- **Zeit im Browser:** Der Planer `sched` läuft mit `setTimeout`. Wird der Entwurf während des Spielens geändert, darf kein zweiter Planer entstehen (genau ein `timer`).
- **Tonleiter mit 5 Stufen:** `deg()` rechnet heute fest mit 7. Für `pentatonik` muss überall die Länge der Tonleiter stehen, auch bei der Schlusswendung („Schluss auf dem Grundton“ ist Stufe `länge`, nicht 7).
- **Autoplay:** Vorhören braucht eine Geste des Nutzers (`freigeben()` aus `regie.ts`).

## Nicht in diesem Paket
Musik je Epoche (AP22 legt Standardzuordnungen je Epoche fest), Geräusch-Editor, Aufnahmen.
