# AP24 – Szenen: sichtbare Naturereignisse (Plan, 20.10.2026)

**Auftrag:** Frage 38, Henry, 17.10.2026: „eigenes Paket“ für sichtbare Naturereignisse (Blitz, Feuer, Überschwemmung, Tornado, Meteor). AP18i verweist für die Bilder der Ereignisse von allein hierher. Am 20.10.2026 mit allen Paketen beauftragt.
**Umfang:** L, Schritt 0 plus drei Teilpakete (a–c). **Abhängig von:** AP18i (Ereignisse von allein), AP18d (Spielarten), AP18b (Tagebuch).

## Ziel
Ereignisse, die heute nur im Tagebuch und an veränderten Dingen sichtbar sind, bekommen ein **Bild in der Welt**: Blitz und Regenvorhang, umstürzender Baum, steigendes Wasser, Funkenflug, Sternschnuppen, ein Tornado. Die Bewohner erleben sie als Naturereignis, wie bisher über Wahrnehmung und Wirkungen.

## Festlegungen (Frage 72, Vorschlag)
1. **Reihenfolge der Szenen:** zuerst die, die zu AP18i passen: **Gewitter mit Blitz**, **Baum stürzt um**, **Hochwasser**, **Sternschnuppen**. Danach **Feuer** (nur draußen: Feuerstelle gerät außer Kontrolle, Baum brennt; **kein Hausbrand** in v1) und **Tornado**. **Meteor** nur in der Spielart Gott über die Ereigniseingabe, nie von allein.
2. **Szenen sind Bild, Wirkungen bleiben Operationen.** Eine Szene ändert die Welt nie selbst. Was sie bewirkt (Baum fällt, Weg versperrt, Holz liegt da, Wasser steigt), läuft über die vorhandenen Operationen der Ereigniseingabe (AP08, `events_user/schema.py`: `change_object`, `spawn_object`, `set_weather`, `inform` …). So gelten Prüfung, Wissensverteilung und Spielstand wie immer.
3. **Keine höhere Instanz:** Für die Bewohner hat eine Szene keinen Urheber. Die Wahrnehmungstexte beschreiben, was man sieht („Ein Blitz schlägt in die Eiche am Weg ein.“).
4. **Leistung:** höchstens eine große Szene gleichzeitig, Teilchen höchstens 400, Szene endet spätestens nach 2 Spielstunden. Bei Tempo „Max“ werden Szenen nur als Endbild gezeigt.
5. Jede Szene braucht ein **Mockup und Henrys Abnahme** (Mockup-Treue), auch in der flachen Ansicht.

## Datenformat
**Szenenkatalog** `backend/simulacra/data/szenen.json` (`format: "simulacra-szenen"`, `version: 1`), je Szene:
```json
{ "id": "blitz", "name": "Blitzeinschlag",
  "ziel": "baum",                                   
  "dauer_min": 2,
  "von_allein": true, "nur_gott": false,
  "wahrnehmung": "Ein Blitz schlägt {ort_bei} in {ziel_name} ein.",
  "wirkungen": [ { "op": "change_object", "ziel": "$ziel", "state": { "fallen": true } },
                 { "op": "spawn_object", "kind": "item", "name": "Holz", "near": "$ziel" } ] }
```
`ziel`: `baum`, `ort`, `see`, `feuerstelle`, `himmel` (keins) – woran die Szene hängt; der Auswähler sucht ein passendes Objekt oder einen Ort. `$ziel` wird beim Auslösen ersetzt. **Wichtig:** Felder wie `fallen` müssen im Katalog (AP21) als Zustandsfeld der Art bestehen; fehlt es, ergänzt dieses Paket es im Grundkatalog (mit Gleichlauf-Test).

**Operation** `scene` in der Ereigniseingabe (`events_user/schema.py`): `{ "op": "scene", "scene": "blitz", "target": "<objekt- oder ortskennung, optional>", "at": "<zeit, optional>" }`. Das Backend prüft, wählt ein Ziel, falls keins angegeben ist, sendet `world.scene_started` (mit `scene`, `target`, `location_id`, `x`, `y`, `ends_at`) und führt die Wirkungen aus. Am Ende `world.scene_ended`.

## Schritt 0 – Mockup (eine Sitzung)
`docs/mockups/szenen.html` mit `docs/mockups/szenen/`: je Szene eine Animation über dem Dorfbild (Tiefe und Flach, Tag und Nacht), mit Regler für die Zeit, damit man jedes Bild einzeln ansehen kann. Gezeichnet mit Canvas wie DorfView. Henry nimmt Szene für Szene ab.

## AP24a – Backend: Katalog, Operation, Auslöser
1. `backend/simulacra/events_user/szenen.py` (neu): Katalog laden und prüfen (jede Wirkung ist eine gültige Operation, `$ziel` nur in erlaubten Feldern), `ziel_waehlen(state, szene, rng)`.
2. Operation `scene` in `schema.py`, `validate.py`, `apply.py`, Wortliste für die freie Eingabe in `lexicon.py` („Blitz“, „Gewitter“, „Hochwasser“, „Sternschnuppe“, „Tornado“, „Meteor“).
3. **Wahrnehmung:** `agents/observations.py` bekommt einen Fall für `world.scene_started`: Wer am Ort ist oder freie Sicht hat (draußen, im Umkreis wie bei Wetter), bekommt den Text `wahrnehmung` als Beobachtung mit Wichtigkeit 6. Drinnen hört man nur Donner („Draußen donnert es.“) – Text je Szene in `wahrnehmung_drinnen`, optional.
4. **AP18i-Anbindung:** Ereignisse von allein (`data/ereignisse_welt.json`) dürfen eine Operation `scene` enthalten. Gewitter, umgestürzter Baum, Hochwasser und Sternschnuppennacht bekommen ihre Szene.
5. In der Spielart Leben gibt es die Operation nur über Ereignisse von allein (der Endpunkt der Ereigniseingabe ist dort ohnehin gesperrt, AP18d). `nur_gott`-Szenen nie von allein.
6. **Prüfen:** pytest `tests/events_user/test_szenen.py`: Katalog gültig, Ziel wird gefunden, Wirkungen laufen durch dieselbe Prüfung, Wahrnehmung nur bei denen, die es sehen, kein Prompt nennt einen Urheber, Spielstand mitten in einer Szene speichern und laden (Szene läuft zu Ende oder wird beim Laden beendet; beides ist erlaubt, schreibe auf, welches).

## AP24b – Bild: Szenen-Schicht in der Weltansicht
1. `frontend/src/world/szenen/` (neu): `index.ts` (Register `SZENEN: Record<string, Szene>`), je Szene eine Datei (`blitz.ts`, `baum.ts`, `hochwasser.ts`, `sternschnuppen.ts`) mit `interface Szene { start(ctx: SzenenKontext): void; zeichne(g: CanvasRenderingContext2D, t: number, kamera): void; fertig(t): boolean }`.
2. `teilchen.ts`: ein Teilchenspeicher mit fester Größe (400), wiederverwendet, keine neuen Objekte je Bild.
3. DorfView (`world/dorf/DorfView.ts`) und die flache Ansicht zeichnen die Szenen-Schicht **nach** den Dingen und **vor** den Schildern. Die Uhr der Szene ist die Spielzeit (`ends_at`), damit Pause die Szene anhält.
4. `simStore`: hält laufende Szenen aus `world.scene_started`/`ended`; beim Snapshot die noch laufenden aus `GET /api/state` (neues Feld `scenes`).
5. Ton: Donner, Rauschen, Knistern aus `klang/geraeusche.ts` (vorhanden oder neu aus Code).
6. **Prüfen:** Vitest für die Teilchen (Größe bleibt, alte werden ersetzt); Playwright `e2e/szenen.spec.ts`: Szene per API auslösen (Gott), Bild nach 1 s und nach Ende als Bildvergleich (eigene Goldbilder), Goldbilder ohne Szene unverändert, `leistung.spec.ts` bleibt im Rahmen.

## AP24c – Feuer, Tornado, Meteor
Wie a und b, nach Abnahme der Mockups. Feuer: breitet sich nur auf Bäume und Büsche im Umkreis von 2 Kacheln aus, höchstens 3 Ausbreitungen, Regen löscht; Bewohner bekommen die Option „Feuer löschen“ (Eimer Wasser, neuer Modus im Katalog mit Baukasten). Tornado zieht einen Pfad, wirft Vogelscheuchen um (`upright: false`) und verweht leichte Dinge um 1–3 Kacheln. Meteor (nur Gott) hinterlässt einen Stein (`resource` Stein 10) und einen Krater als Deko.

## Abnahme
Henry sieht in einem Lauf mit Ereignissen „oft“ ein Gewitter mit Blitz, einen umgestürzten Baum mit Holz daneben und eine Sternschnuppennacht, und im Tagebuch, wie die Bewohner darauf reagieren. Bericht `docs/status/AP24.md`.

## Fallen
- **Szene und Wirkung zeitlich:** Der Baum soll erst umfallen, wenn der Blitz zu sehen war. Wirkungen mit `"nach_min": 1` verzögert ausführen (über `events_user/scheduler.py`, gibt es schon für Zeitangaben).
- **Ohne Bild weiterspielen:** Läuft kein Browser, laufen Szenen trotzdem (Ereignisse und Wirkungen), nur ohne Bild.
- **Hochwasser:** Kacheln werden nicht dauerhaft Wasser. Das Bild hebt den Wasserrand; als Wirkung werden Orte am Ufer vorübergehend gesperrt (Regel in `world/rules.py`) und danach wieder freigegeben.

## Nicht in diesem Paket
Hausbrand, Erdbeben, Szenen, die Gebäude zerstören.
