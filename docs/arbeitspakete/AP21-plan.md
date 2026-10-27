# AP21 – Gegenstände als Daten (Plan, 20.10.2026)

**Auftrag:** 20.10.2026: „baue direkt alle APs – auch Gegenstände und Epochen“. Grundlage ist der Ausblick ([ausblick.md](../ausblick.md), Abschnitt 4): „Erst die Objektarten als Daten (Voraussetzung für Epochen **und** Baustein-Editor), dann Epochenpakete, dann der Editor.“
**Umfang:** L, vier Teilpakete (a–d), je eine Sitzung. **Abhängig von:** AP18g (dort kommen neue Bauvorlagen hinzu; AP21 überführt sie gleich mit). **Ermöglicht:** AP22 (Epochen) und AP23 (Baustein-Editor).
**Sichtbare Änderung im Spiel:** keine. Das ist ein Umbau unter der Haube. Am Ende steht eine Anleitung, mit der man eine neue Objektart **ohne Python** anlegt.

## Ziel in einem Satz
Alles, was heute eine Objektart ausmacht und von Hand in sechs Python- und TypeScript-Dateien steht, kommt in **eine Katalogdatei je Paket**. Die Engine liest diese Daten und verhält sich danach Ereignis für Ereignis genauso wie vorher.

## Ausgangslage (Stand main, 20.10.2026)
Eine Objektart ist heute über diese Stellen verteilt:

| Was | Wo | Beispiel |
|---|---|---|
| Art, Name, blockiert, tragbar, Modi, Zustandsschema | `backend/simulacra/world/object_kinds.py` (`KINDS`) | `_k("lantern", "Laterne", modes=("light", "extinguish"), schema={"lit": (bool, False)})` |
| Was ein Modus tut (Prüfen, Dauer, Wirkung) | `world/actions/use_modes.py` (`MODES`) und `use_dinge.py` (`MODES_DINGE`) | `LightFree`, `Extinguish` |
| Optionsart für die Bewertung | `agents/options.py` (`USE_KIND`) | `"light": "light"` |
| Text der Option für das Modell | `agents/phrases.py` (`USE_OPTION`) | `("lantern", "light"): "Die {obj} anzünden"` |
| Text in der dritten Person (Wahrnehmung anderer) | `agents/phrases.py` (`USE_THIRD`) | `"light": "zündet ein Feuer an"` |
| Sonderangebote in den Optionen | `agents/options.py` (`generate`: Briefkasten, Ablagen, Beet, Pflanze, Laternengang) | `if o.kind == "mailbox": …` |
| Bauvorlagen | `backend/simulacra/data/blueprints.json` | `"bench": {"cost": {"wood": 3}, …}` |
| Rohstoffnamen | `agents/phrases.py` (`RES_DE`), `frontend/src/world/player/actions.ts` (`RES_NAME`) | `"wood": "Holz"` |
| Bild | `frontend/src/world/art/things.ts` (`ART`), `world/dorf/sprites.ts` (`decorSprite`) | `ART.bed` |
| Typen fürs Frontend | `api/schema_export.py` erzeugt `OBJECT_KINDS` in `frontend/src/types/generated.ts` | |
| Modusnamen im Frontend | `frontend/src/world/player/actions.ts` (`MODE_LABEL`) | `light: "anzünden"` |

## Festlegungen (gelten für alle Teilpakete)
1. **Gleichlauf ist Pflicht.** Nach jedem Teilpaket ergibt ein Lauf mit Fake-Modell und festem Seed **dieselbe Ereignisfolge** wie vorher (Typ, Agenten, Ort, Daten). Das prüft ein Gleichlauf-Test, der **vor** jeder Änderung entsteht (Teilpaket a, Schritt 1).
2. **Das Modell führt nie Code aus** (Architekturprinzip 6). Daten beschreiben Bedingungen und Wirkungen aus einem festen, geprüften **Baukasten**. Was der Baukasten nicht kann, bleibt ein **benannter Python-Modus** (`"handler": "post"`), der im Katalog nur genannt wird.
3. **Ein Katalog je Paket.** Das Grundpaket heißt `grund` und liegt in `backend/simulacra/data/katalog/grund/`. Epochen (AP22) und eigene Bausteine (AP23) bringen weitere Pakete mit; sie werden in fester Reihenfolge zusammengeführt (`grund` zuerst), und eine Art darf nur einmal vorkommen.
4. **Alte Spielstände laden weiter.** Unbekannte Arten bleiben harmlose passive Objekte wie heute (`object_kinds.spec` → `UNKNOWN`).
5. **Dateien unter 400 Zeilen.** Der Katalog wird darum auf mehrere Dateien verteilt (siehe Format).

## Datenformat `simulacra-katalog`, Version 1
Ordner `backend/simulacra/data/katalog/<paket>/` mit diesen Dateien. Jede Datei ist JSON mit `"format": "simulacra-katalog"`, `"version": 1`, `"paket": "<paket>"` und genau einem Inhaltsschlüssel.

### `dinge.json` (Inhalt `dinge`, eine Liste)
```json
{
  "format": "simulacra-katalog", "version": 1, "paket": "grund",
  "dinge": [
    {
      "art": "lantern",
      "name": "Laterne",
      "blockiert": false,
      "tragbar": false,
      "zustand": { "lit": { "typ": "bool", "standard": false } },
      "bild": { "code": "lamp", "zustand_an": "lit" },
      "modi": {
        "light": {
          "optionsart": "light",
          "option": "Die {obj} anzünden",
          "dritte_person": "zündet ein Feuer an",
          "dauer": 1,
          "bedingungen": [ { "zustand_ist": { "feld": "lit", "wert": false }, "sonst": "{obj} brennt bereits." } ],
          "wirkungen": [ { "zustand_setzen": { "feld": "lit", "wert": true } } ],
          "ereignis": { "typ": "world.object_changed", "aenderung": "lit" }
        },
        "extinguish": { "handler": "extinguish", "optionsart": "extinguish", "option": "Die {obj} löschen", "dritte_person": "löscht ein Feuer" }
      }
    }
  ]
}
```
- `zustand`: Feld → `{typ, standard}`; `typ` ist `bool`, `int`, `str`, `list`, `dict` oder `int|null`. Das entspricht genau dem heutigen `schema` (`(int, type(None))` wird `int|null`).
- `bild.code`: Name einer Zeichenfunktion im Frontend (`ART`-Schlüssel in `art/things.ts` oder Fall in `decorSprite`). AP23 ergänzt `bild.baustein` (eigene Pixeldatei).
- Ein Modus hat **entweder** `handler` (benannter Python-Modus) **oder** `bedingungen`, `dauer`, `wirkungen` und optional `ereignis` (Baukasten; `ereignis` ist das `world.object_changed` mit `change`, das heutige Modi nach einer Zustandsänderung senden). `option` darf fehlen; dann bietet der Optionsgenerator den Modus nicht an (wie heute bei `door.lock`).

### `rohstoffe.json` (Inhalt `rohstoffe`)
`[{"id": "wood", "name": "Holz", "name_spieler": "Holz"}, …]`: `name` steht im Prompt (heute `RES_DE`), `name_spieler` in der Oberfläche (heute `RES_NAME`; dort steht z. B. „Steine“ statt „Stein“, das bleibt so).

### `bauvorlagen.json` (Inhalt `bauvorlagen`)
Dieselben Felder wie heute `data/blueprints.json` (Schlüssel wird `id`). Prüfung: `kind` muss eine Art im zusammengeführten Katalog sein, jeder Rohstoff in `cost` muss in `rohstoffe` stehen.

### Der Baukasten (vollständige Liste, Version 1)
Bedingungen (`bedingungen`, alle müssen gelten; jede hat einen Text `sonst` für die Ablehnung, `{obj}` wird ersetzt):

| Baustein | Bedeutung | Ablehnungscode |
|---|---|---|
| `zustand_ist {feld, wert}` | Zustandsfeld hat genau diesen Wert | `INVALID_TARGET` |
| `zustand_mindestens {feld, wert}` | Zahl ≥ Wert | `INVALID_TARGET` |
| `hat_rohstoff {rohstoff, menge}` | Handelnder trägt mindestens so viel | `MISSING_RESOURCE` |
| `freie_plaetze {anzahl}` | `ctx.free_slots(actor) >= anzahl` | `CAPACITY` |
| `traegt_art {art}` | Handelnder hält ein Ding dieser Art (`held_kind`) | `LOCKED` |
| `nicht_besetzt` | Niemand sonst benutzt das Ding gerade (`busy_with`) | `BUSY` |
| `tageszeit_in {phasen}` | `day`, `dusk`, `night`, `dawn` | `FORBIDDEN_BY_RULES` |

Wirkungen (`wirkungen`, in dieser Reihenfolge beim Abschluss ausgeführt; vorher werden die Bedingungen erneut geprüft wie heute in `finish`):

| Baustein | Bedeutung |
|---|---|
| `zustand_setzen {feld, wert}` | Feld setzen, Objekt speichern |
| `rohstoff {rohstoff, menge}` | `ctx.inv_add(actor, rohstoff, menge)` (negativ = verbrauchen) |
| `zufall {chance, dann: [...], sonst: [...]}` | mit `ctx.rng(actor.id, "<modus>")`, damit der Zufall gleich bleibt |
| `ding_erzeugen {art, name, zustand, beim: "handelnder"}` | wie `Cook.finish` (neues Objekt, Ereignis `world.object_created`, `cause` = Modus) |
| `ding_entfernen` | das benutzte Ding verschwindet (`world.object_removed`, `cause` = Modus) |
| `ereignis {typ, daten}` | zusätzliches Ereignis; `daten` darf `{minuten}`, `{obj_id}`, `{obj_name}` enthalten |

Bedürfnisse (Ausruhen, Schlafen) bleiben in v1 Handler (`sleep`, `sit`), weil sie schrittweise je Minute wirken (`step`). Der Baukasten bekommt in AP23 ggf. `beduerfnis_je_minute`, aber nur, wenn der Gleichlauf das zulässt.

## Teilpakete

### AP21a – Gleichlauf-Test und Katalog mit Handlern (keine Verhaltensänderung)
1. **Gleichlauf-Test zuerst** (noch auf dem alten Code): `backend/tests/world/test_katalog_gleichlauf.py`.
   - Baue eine Simulation wie die Akzeptanztests (`backend/tests/acceptance/conftest.py` zeigt, wie man Engine, Store und Runner mit `FakeProvider` aufsetzt). Die Fake-Antwort wählt deterministisch: **die Option mit dem höchsten Score, bei Gleichstand die erste**. So kommen viele verschiedene Dinge dran.
   - Lauf: Startwelt „Dorf am See“, Seed 4242, Alex und Mira, 3 Spieltage im schnellsten Takt. Zusätzlich je eine kurze Szene pro Objektart: Ein Bewohner steht neben dem Ding und bekommt per Fake genau diesen Modus (Liste aus `object_kinds.KINDS` × `modes`). So wird **jeder** Modus mindestens einmal benutzt.
   - Speichere die Ereignisse als `backend/tests/fixtures/gleichlauf/ereignisse.jsonl` (je Zeile `minute`, `type`, `agents`, `location_id`, `data`; **ohne** `seq`-Zeitstempel der Wanduhr). Der Test vergleicht Zeile für Zeile und zeigt beim ersten Unterschied beide Zeilen.
   - Committe Test und Fixture **allein** („AP21a Schritt 1: Gleichlauf-Test“). Prüfe: Er läuft zweimal hintereinander grün (Determinismus). Ist er nicht deterministisch, suche die Ursache (Wanduhr, `set`-Reihenfolge, `Date.now`) und behebe sie, bevor du weitermachst.
2. **Loader** `backend/simulacra/world/katalog.py` (neu):
   - `load(pakete: list[str]) -> Katalog` liest `data/katalog/<paket>/{dinge,rohstoffe,bauvorlagen}.json`, prüft `format`, `version`, `paket`, und führt zusammen. Doppelte Art → `KatalogFehler("Art 'x' kommt in 'grund' und 'y' vor")`.
   - Pydantic-Modelle für alle Einträge (`Ding`, `Modus`, `Bedingung`, `Wirkung`, `Rohstoff`, `Bauvorlage`) mit `extra="forbid"`, damit Tippfehler auffallen.
   - `Katalog.kinds() -> dict[str, ObjectKind]` erzeugt dieselben `ObjectKind`-Objekte wie heute.
3. **`object_kinds.py` liest den Katalog:** `KINDS` wird beim Import aus `katalog.load(["grund"]).kinds()` gebaut. Die Funktionen `get`, `spec`, `normalize_state` bleiben unverändert (gleiche Signaturen).
4. **`grund/dinge.json` schreiben:** Ein Skript `scripts/katalog_aus_code.py` (einmalig, danach löschen oder in `scripts/` lassen) liest `KINDS`, `all_modes()`, `USE_KIND`, `USE_OPTION`, `USE_THIRD`, `RES_DE` und `blueprints.json` und schreibt die drei Dateien. **Alle Modi bekommen in a `handler`** mit dem Namen der heutigen Klasse in Kleinschreibung (`light`, `light_free`, `boat_fish` …). Reihenfolge der Arten wie in `KINDS`.
5. **Handler-Register** `world/actions/handler.py`: `HANDLER: dict[str, Mode] = {"sleep": Sleep(), "sit": Sit(), …}`. `use_modes.all_modes()` baut daraus `{(art, modus): HANDLER[name]}` aus dem Katalog. Die Klassen selbst bleiben, wo sie sind.
6. **Texte und Bauvorlagen aus dem Katalog:** `USE_KIND`, `USE_OPTION`, `USE_THIRD`, `RES_DE` in `phrases.py`/`options.py` werden aus dem Katalog befüllt (gleiche Namen, damit nichts anderes geändert werden muss). `WorldEngine` lädt die Bauvorlagen aus dem Katalog statt aus `blueprints.json`; die alte Datei wird gelöscht.
7. **Prüfen:** Gleichlauf grün, alle bisherigen Tests grün (`cd backend && .venv/bin/pytest -q`), `scripts/gen_types.sh` erzeugt unverändertes `generated.ts`.

### AP21b – Der Baukasten und die einfachen Modi als Daten
1. `world/actions/baukasten.py` (neu): `class DatenModus(Mode)` mit `validate`, `finish` nach dem Baukasten oben. Je Baustein eine kleine Funktion (`_bed_zustand_ist(ctx, actor, o, args) -> Rejected | None`, `_wirk_rohstoff(ctx, actor, o, act, args)`). Unbekannter Baustein ist ein Ladefehler, nie ein Laufzeitfehler.
2. **Diese Modi werden Daten** (in dieser Reihenfolge, nach jedem Gleichlauf laufen lassen): `lantern/candle/floor_lamp.light` und `.extinguish`, `fireplace/firepit.light` (mit `hat_rohstoff wood 1` und `rohstoff wood -1`, Dauer 5), `extinguish`, `door.lock`, `door.unlock` (mit `traegt_art key` nur wenn `needs_key`; dafür bekommt `zustand_ist` die Form `{"feld": "needs_key", "wert": false, "oder": {"traegt_art": "key"}}`; **oder** du lässt `unlock` als Handler – entscheide nach Lesbarkeit und schreibe es in den Bericht), `scarecrow.fix`, `cat.pet`, `boat.row` (`nicht_besetzt`, Dauer aus Parameter `minutes` 10–90: dafür bekommt `dauer` die Form `{"parameter": "minutes", "standard": 30, "min": 10, "max": 90, "sonst": "Rudern geht von 10 bis 90 Minuten."}`), `fishing_spot.fish` und `boat.fish` (`freie_plaetze 1`, `zufall` mit 0,7 bzw. 0,85), `stove.cook` (`zustand_ist powered true`, `hat_rohstoff food 1`, `hat_rohstoff wood 1`, Wirkungen `rohstoff food -1`, `rohstoff wood -1`, `ding_erzeugen meal`), `plant.harvest` (`zustand_mindestens stage 4`, `freie_plaetze 4`, `ding_entfernen`, `rohstoff food 3`, `rohstoff seeds 1`; **Achtung Reihenfolge:** heute kommt `world.object_removed` vor den Rohstoffereignissen).
3. **Bleiben Handler** (zu verwoben für v1): `sleep`, `sit` (schrittweise Bedürfnisse), `read`, `write` (Inhalte), `post`, `collect` (Briefe), `read_sign` (Kompass), `store`, `retrieve` (Ablagen). Schreibe in `docs/dinge-katalog.md`, warum.
4. Fehlertexte: Die Texte in `sonst` müssen **wörtlich** den heutigen Texten entsprechen (sie stehen in Ereignissen und Prompts).
5. **Prüfen:** Gleichlauf grün nach jedem einzelnen Modus. Ein Unterschied heißt: Reihenfolge der Ereignisse, Zufall-Salz oder Text weicht ab.

### AP21c – Optionsgenerator, Frontend und Typen aus dem Katalog
1. **Sonderangebote** in `agents/options.py` (`mailbox` → Brief an jeden, Ablagen, `seedbed` → pflanzen, `plant` → gießen, Laternengang am Abend) bleiben Python, werden aber an einen **Angebots-Namen** im Katalog gehängt: `"angebote": ["brief_an_jeden"]`, `["ablage"]`, `["pflanzen"]`, `["giessen"]`, `["abends_anzuenden"]`. `options.py` fragt `katalog.angebote(art)` statt `o.kind == "mailbox"`. So bekommt eine neue Art (AP22/23) dieselben Angebote, ohne Python.
2. **Frontend:** `api/schema_export.py` schreibt zusätzlich `MODE_LABELS` (Modus → Verb für das Kontextmenü, neues Feld `verb` im Modus, Werte heute aus `actions.ts` `MODE_LABEL`), `RESOURCES` (id → `name_spieler`) und je Art `bild` nach `generated.ts`. `player/actions.ts` nutzt diese statt eigener Tabellen.
3. **Laufzeit-Katalog für Pakete:** `GET /api/katalog` liefert den zusammengeführten Katalog der laufenden Simulation (für AP22/23, wo Arten zur Laufzeit dazukommen). Das Frontend nutzt ihn **zusätzlich** zu `generated.ts`: Arten, die nur im Laufzeit-Katalog stehen, bekommen Namen und Verben daraus. `simStore` lädt ihn beim Start und nach `simulation.reset`.
4. **Bild nach `bild.code`:** `art/things.ts` sucht erst `ART[o.kind]`, dann `ART[bild.code]`, sonst die neutrale Kiste (wie heute). Damit kann eine neue Art ein vorhandenes Bild benutzen.
5. **Prüfen:** Gleichlauf grün, Vitest grün, Playwright `golden`, `flach`, `player`, `world` grün, Goldbilder unverändert.

### AP21d – Anleitung, Probe und Härtung
1. `docs/dinge-katalog.md`: Aufbau, alle Bausteine mit Beispiel, „Eine neue Objektart ohne Python anlegen“ Schritt für Schritt, Fehlermeldungen des Loaders mit Bedeutung.
2. **Probe mit einer Testart:** Fixture-Paket `backend/tests/fixtures/katalog/probe/` mit einer Art `rain_barrel` („Regentonne“, Bild `barrel`, Modus `fill`: `freie_plaetze 1`, `rohstoff water 1`, Dauer 3). Ein Test lädt `["grund", "probe"]`, stellt die Tonne neben Alex, Fake wählt `fill`, Alex hat danach 1 Wasser, und die Option erscheint mit dem Katalogtext im Prompt. **Die Tonne kommt nicht ins Grundpaket** (neue Dinge nur mit Abnahme).
3. **Loader-Härtung** (Tests in `backend/tests/world/test_katalog.py`): falsches Format, falsche Version, doppelte Art, unbekannter Baustein, Wirkung auf unbekanntes Zustandsfeld, `zustand_setzen` mit falschem Typ, Bauvorlage mit unbekanntem Rohstoff, Optionstext ohne `{obj}` (erlaubt), Text mit Wörtern aus der Wortprüfung (`META_RE` aus `agents/schema.py`: Warnung, keine Sperre). Jede Meldung nennt Datei, Art und Feld auf Deutsch.
4. **Grenzen** (Gleichgewicht, gelten ab jetzt für jedes Paket): `rohstoff` je Benutzung höchstens ±5, `zufall.chance` 0–1, `dauer` 1–240 Minuten, höchstens 8 Modi je Art, höchstens 12 Zustandsfelder. Verstöße sind Ladefehler.

## Tests (Überblick)
- `test_katalog_gleichlauf.py` (Ereignisfolge gleich), `test_katalog.py` (Loader und Grenzen), `test_baukasten.py` (je Baustein ein Test für Erfolg und Ablehnung mit wörtlichem Text), `test_katalog_probe.py` (Regentonne).
- Bestehend und weiter grün: alle Backend-Tests, Vitest, Playwright, insbesondere Prompt-Tests (`tests/agents/test_planner.py`, `test_perception_options.py`) und Akzeptanztests.

## Abnahme
Im Spiel ist kein Unterschied zu sehen im Spiel. Im Bericht `docs/status/AP21.md` stehen: Gleichlauf-Ergebnis, Liste „Daten“ und „Handler“ je Modus, die Regentonne als Beweis, die echten Testzahlen.

## Fallen
- **Reihenfolge der Ereignisse:** `inv_add` erzeugt selbst ein Ereignis. Wirkungen in genau der heutigen Reihenfolge ausführen.
- **Zufall:** Das Salz von `ctx.rng` muss gleich bleiben (`"fish"` für beide Angelarten, siehe `Fish.finish`).
- **Zweimal prüfen:** Heute prüft `finish` die Bedingungen erneut, aber nicht alle (z. B. `Light.finish` nur das Holz). Der Baukasten prüft in `finish` nur die Bedingungen mit `"auch_am_ende": true`. Setze das genau dort, wo der heutige Code erneut prüft.
- **Tür:** `door` hat Modi `lock`, `unlock`, aber die Optionen bieten nur `unlock` an (`options.py`, Bedingung `not (o.kind == "door" and mode != "unlock")`). Im Katalog fehlt darum bei `lock` das Feld `option`.
- **Typen:** `bool` ist in Python ein `int`. Die Prüfung `isinstance(value, bool) and typ is int` aus `normalize_state` muss bleiben.

## Nicht in diesem Paket
Neue Dinge, neue Bilder, Epochen, der Editor. Bedürfnisse als Daten.
