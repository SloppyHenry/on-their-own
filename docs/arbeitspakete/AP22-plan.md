# AP22 – Epochen (Plan, 20.10.2026)

**Auftrag:** 14.10.2026 ([ausblick.md](../ausblick.md), Abschnitt 3): neben dem jetzigen Dorf „eher Mittelalter“ auch **Beginn der Industrialisierung**, **Gegenwart** und **Zukunft (Sci-Fi)**. Am 20.10.2026 beauftragt („auch Gegenstände und Epochen“).
**Umfang:** XL, ein Rahmen-Paket (AP22a) und je Epoche ein Paket mit eigenem Schritt 0 (AP22b–d). **Abhängig von:** AP21 (Gegenstände als Daten, Pflicht), AP18f (Generator mit Stellgrößen), AP20a (Musik als Daten). **Vor:** AP23 nutzt die Paletten der Epochen.

## Ziel
Eine **Epoche** ist ein Paket aus Daten und Bildern: Farben, Gebäude, Dinge, Rohstoffe, Bauvorlagen, Namen, ein Satz für die Bewohner, Generatorregeln, Ereignisse von allein und Musik. Beim Erschaffen einer Welt wählt man die Epoche. Das heutige Dorf wird das Paket **Mittelalter** und sieht genauso aus wie heute.

## Festlegungen (Fragen 67–69, Vorschlag)
1. **Eine Epoche je Welt.** Kein Mischen in v1, kein Wechsel im laufenden Spiel. Die Epoche steht in der Welt (`info.json` der Weltenbibliothek, AP18e) und im Spielstand (Meta `epoche`). Alte Welten und Spielstände ohne Feld gelten als `mittelalter`.
2. **Geschlossenes Dorf:** Auch in Gegenwart und Zukunft gibt es in v1 **kein Geld, kein Telefon, kein Internet und keine Außenwelt**. Die Bewohner leben im Ort, wie heute. Geld und Handel kommen, wenn überhaupt, als eigenes Paket.
3. **Reihenfolge:** Industrialisierung (AP22b), Gegenwart (AP22c), Zukunft (AP22d). Jede Epoche hat ein eigenes Schritt 0 mit Mockup „Bild A“ der Epoche und Abnahme. **Vorher entsteht kein Bild.**
4. **Keine höhere Instanz:** Der Epochensatz im Prompt beschreibt nur die Welt („Du lebst in einer kleinen Siedlung …“), nie „Epoche“, „Szenario“ oder „Simulation“.
5. Die Bedürfnisse (Energie, Hunger, Durst, Geselligkeit, Ruhe, Wärme) bleiben in allen Epochen gleich. Eine Epoche darf nur die Schalter `enabled` (z. B. Wärme) und die Texte ändern.

## Aufbau eines Epochenpakets
**Backend** `backend/simulacra/data/epochen/<id>/`:
| Datei | Inhalt |
|---|---|
| `epoche.json` | `format: "simulacra-epoche"`, `version: 1`, `id`, `name` (Anzeige, z. B. „Mittelalter“), `kurz` (eine Zeile für die Auswahl), `welt_satz` (Prompt, siehe unten), `orts_woerter` (`dorf`, `platz`, `haus` …), `beduerfnisse` (Schalter), `katalog` (Liste der Katalog-Pakete, z. B. `["grund", "mittelalter"]`), `musik` (Standardzuordnung, Format AP20), `generator` (siehe unten) |
| `katalog/` | Katalog-Paket der Epoche im Format von AP21 (`dinge.json`, `rohstoffe.json`, `bauvorlagen.json`): nur die Dinge, die es **zusätzlich** zum Grundpaket gibt oder die das Grundpaket in dieser Epoche **ersetzen** (Feld `ersetzt: "lantern"`) |
| `gebaeude/` | Gebäudearten wie heute `data/gebaeude/*.json` (Bänder, Räume, Front) |
| `namen.json` | Ortsnamen, Hausnamen, Läden, Werkstätten …, gleiche Schlüssel wie heute `generator/names.py` |
| `ereignisse_welt.json` | Katalog der Ereignisse von allein (Format AP18i) |

**Frontend** `frontend/src/world/epochen/<id>/`:
| Datei | Inhalt |
|---|---|
| `palette.ts` | Farben mit **denselben Schlüsseln** wie `WP` in `art/palette.ts` (Gras, Weg, Wasser, Holz, Dach, Wand …) plus eigene |
| `bausteine.ts` | Gebäudebilder (wie `art/bausteine.ts`: Wohnhaus, Werkstatt, Laden …) |
| `dinge.ts` | Bilder der Dinge, die die Epoche neu bringt (Schlüssel = `bild.code` im Katalog) |
| `index.ts` | `export const EPOCHE: EpochenBild = { id, palette, bausteine, dinge }` |

**Der Satz für die Bewohner** ersetzt in `agents/prompts.py` (`system_prompt`) den festen Text „Du lebst mit anderen in einem kleinen Dorf am See, mit Wohnhaus, Garten, Wald und einem zentralen Platz“. Für `mittelalter` steht genau dieser Text in `welt_satz`, damit der Prompt sich nicht ändert (Prompt-Cache, Gleichlauf).

**Generator** (`generator` in `epoche.json`): `dorfformen` (erlaubte Formen aus AP18f), `gebaeude_mix` (Rollen → Gebäudeart-Datei → Anzahl-Spannen), `deko` (Liste der Deko-Arten mit Gewicht: Bäume, Büsche, Laternen …), `boden` (welche Bodenarten: Gras, Pflaster, Asphalt, Metallplatten), `wasser` (Seen ja/nein, Fluss, Kanal). Der Generator liest diese Regeln statt fester Listen in `layout.py`, `kits.py`, `names.py`.

## AP22a – Rahmen: das Mittelalter wird ein Paket (keine sichtbare Änderung)
1. **Gleichlauf** aus AP21 (`test_katalog_gleichlauf.py`) und **Goldbilder** (`e2e/golden.spec.ts`, `flach.spec.ts`) müssen vor und nach jedem Schritt grün sein. Zusätzlich: Generator-Fixtures (`frontend/src/world/dorf/fixtures/dorf-seed-12.json` und die aus AP18f) bleiben byte-gleich.
2. Backend `backend/simulacra/epochen.py` (neu): `load(id) -> Epoche` (Pydantic, `extra="forbid"`), `liste()`, Prüfungen (Katalog-Pakete vorhanden, Gebäudearten gültig, Namenslisten nicht leer, `welt_satz` ohne Wörter aus `META_RE`).
3. `data/epochen/mittelalter/` anlegen: `epoche.json` mit dem heutigen Satz, `katalog: ["grund"]`, Musik = `STANDARD_ZUORDNUNG` aus AP20, Generatorregeln = die heutigen Werte (aus `layout.py`, `kits.py`, `names.py` herausgezogen, **nicht** neu erfunden). `gebaeude/` = die heutigen Dateien aus `data/gebaeude/` (verschieben, der alte Ordner fällt weg). `namen.json` = die Listen aus `generator/names.py`.
4. Meta `epoche` im Spielstand; `simulation/newsim.py` und der Generator nehmen die Epoche an (`Params.epoche`, Standard `mittelalter`). Der Katalog der laufenden Welt = `katalog` der Epoche (AP21 `katalog.load`).
5. Frontend: `frontend/src/world/epochen/mittelalter/` mit `palette.ts` = heutiges `WP` (`art/palette.ts` exportiert danach `WP` aus der aktiven Epoche weiter, damit kein Import geändert werden muss), `bausteine.ts`/`dinge.ts` leiten auf die heutigen Funktionen weiter. `epochenStore` (Zustand) setzt die aktive Epoche aus dem Snapshot (`meta.epoche`), Zeichen-Zwischenspeicher (`memo`, `decorSprite`-Cache) werden beim Wechsel geleert.
6. **Auswahl:** Assistent, Schritt Welt, und Editoren › Welten › Welt erzeugen bekommen eine Auswahl „Epoche“ (nur Mittelalter wählbar, die anderen ausgegraut mit „kommt später“).
7. **Prüfen:** Gleichlauf, Goldbilder, Generator-Fixtures unverändert; pytest `tests/epochen/` (Laden, Fehlermeldungen, alte Spielstände ohne Feld = Mittelalter, Prompt enthält `welt_satz` wörtlich und kein „Epoche“).

## Je Epoche (AP22b Industrialisierung, AP22c Gegenwart, AP22d Zukunft)
Jedes dieser Pakete hat **drei Schritte**:

**Schritt 0 – Mockup und Katalog (eine Sitzung, kein Anwendungscode).**
- Mockup `docs/mockups/epoche-<id>.html` nach dem Vorbild von Mockup A (`docs/mockups/`, das abgenommene Dorfbild): ein Dorf der Epoche bei Tag und Nacht, in Tiefe und Flach, ein Innenraum (wie innen2), alle neuen Dinge einzeln mit Zuständen, zwei Figuren in Kleidung der Epoche (Teile aus AP19).
- Katalogvorschlag als Tabelle im Plan `docs/arbeitspakete/AP22<x>-<id>.md`: Gebäude, Dinge mit Modi (nur Baukasten aus AP21, Handler nur mit Begründung), Rohstoffe, Bauvorlagen, Ereignisse von allein, Musikstücke, Namen.
- **Abnahme** von Bild und Katalog.

**Schritt 1 – Daten und Bild.** Paket nach dem Aufbau oben, Bilder 1:1 nach Mockup. Je neues Ding ein Test im Stil der Regentonne aus AP21d (Bewohner benutzt es mit Fake-Modell, Wirkung stimmt). Goldbild der neuen Epoche (eigene Datei `e2e/epoche-<id>.spec.ts`).

**Schritt 2 – Generator und Probelauf.** Generatorregeln der Epoche, Eigenschaftstest aus AP18f mit dieser Epoche (alles erreichbar, Bild und Kacheln gleich), Langlauf mit Fake-Modell 1 Spieltag (`scripts/langlauf.py --mode fake`), ein kurzer Lauf mit echtem Modell, wenn verfügbar (sonst im Bericht vermerken). Bericht `docs/status/AP22<x>.md`.

### Vorschläge für die Kataloge (werden im jeweiligen Schritt 0 abgenommen)
| | Industrialisierung (um 1850) | Gegenwart | Zukunft (Sci-Fi) |
|---|---|---|---|
| Satz für die Bewohner | „… in einer kleinen Siedlung am Fluss, mit Wohnhäusern, einer Werkstatt mit Dampfmaschine, Gärten und einem Marktplatz“ | „… in einem kleinen Ort am See, mit Wohnhäusern, einem Laden, Gärten und einem Platz mit Café“ | „… in einer kleinen Siedlung unter einer Kuppel, mit Wohnmodulen, Gewächshaus, Werkstatt und einem zentralen Platz“ |
| Gebäude | Backsteinhaus, Werkstatt mit Schlot, Laden, Lagerhaus, Waschhaus | Einfamilienhaus, Laden, Café, Werkstatt/Garage, Gemeindehaus | Wohnmodul, Gewächshaus, Werkstatt, Energiestation, Gemeinschaftskuppel |
| Neue Dinge (Modi) | Gaslaterne (anzünden/löschen), Dampfmaschine (anheizen: 2 Kohle → `powered`), Pumpe (Wasser holen), Nähmaschine (nähen: Stoff → Kleidung), Zeitung am Brett (lesen) | Kühlschrank (Nahrung ablegen/holen, Handler `store`), Herd elektrisch (kochen ohne Holz), Fahrrad (fahren: schneller zu Orten), Grill (grillen), Radio (einschalten: Ruhe −) | Synthesizer (Nahrung aus Biomasse), Wasseraufbereiter, Reparaturbot (reparieren), Hydrokultur-Beet (pflanzen, gießen), Lichtpaneel |
| Rohstoffe | Holz, Kohle, Eisen, Stoff, Nahrung, Wasser, Samen | Holz, Stein, Nahrung, Wasser, Samen, Werkzeugteile | Biomasse, Metall, Energiezellen, Wasser, Samen |
| Bauvorlagen | Bank, Zaun, Gaslaterne, Pumpe, Werkbank | Bank, Hochbeet, Grill, Fahrradständer | Lichtpaneel, Hydrokultur-Beet, Sitzbank, Antenne |
| Ereignisse von allein | Rauch aus dem Schlot zieht übers Dorf, Hochwasser am Fluss, Kohlelieferung liegt am Weg | Stromausfall (Herd und Licht aus), Gewitter, Igel im Garten | Staubsturm außerhalb der Kuppel (drinnen bleiben), Energieschwankung, Meteoritenschauer am Himmel |
| Musik | Drehorgel-Klang (Instrument `puls25` mit Walzer-Swing) | heutige Stücke, schneller | Flächen, `spieluhr`, langsame Akkorde |

Wo eine Epoche ein Ding braucht, das der Baukasten nicht kann (z. B. Fahrrad = schneller gehen), entscheidet Schritt 0: weglassen, oder den Baukasten um einen Baustein erweitern (`gehtempo {faktor, minuten}`), mit Gleichlauf-Test für das Grundpaket.

## Fallen
- **Palette:** Viele Zeichnungen greifen direkt auf `WP` zu. Die Epoche darf nur **Werte** ändern, keine Schlüssel entfernen. Fehlt einer Epoche ein Schlüssel, nimm den aus dem Mittelalter (Test listet fehlende).
- **Zwischenspeicher:** Alle `memo`-Speicher (Figuren, Dinge, Deko, Boden) müssen beim Epochenwechsel geleert werden, sonst mischen sich Bilder.
- **Prompt-Cache:** Der Anfang des Systemprompts soll gleich bleiben (siehe Kommentar in `system_prompt`). `welt_satz` steht an derselben Stelle wie der heutige Text.
- **Texte:** `phrases.py` enthält Wörter wie „Haus“ und „Dorf“ (`loc_to`, Wegweiser). Was je Epoche anders heißen muss, kommt in `orts_woerter`. Nicht alles auf einmal ändern; im Schritt 0 die Liste festlegen.

## Nicht in diesem Paket
Epochen mischen oder wechseln, Geld und Handel, Außenwelt, neue Bedürfnisse.
