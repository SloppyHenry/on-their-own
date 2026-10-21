# Ausblick (Henry, 14.10.2026): selbst gestalten, Epochen, eigene Bausteine

**Seit 20.10.2026 beauftragt und geplant** (Henry: „baue direkt alle APs“): Figuren-Editor = [AP19](arbeitspakete/AP19-plan.md), Musik-Editor = [AP20](arbeitspakete/AP20-plan.md), Objektarten als Daten = [AP21](arbeitspakete/AP21-plan.md), Epochen = [AP22](arbeitspakete/AP22-plan.md), Baustein-Editor = [AP23](arbeitspakete/AP23-plan.md); dazu Szenen = [AP24](arbeitspakete/AP24-plan.md). Startprompts: [AP19-24-start-prompts.md](arbeitspakete/AP19-24-start-prompts.md). Der Text unten ist der ursprüngliche Ausblick.

Ursprünglich nicht beauftragt, nur vorgemerkt. Reihenfolge nach Henry: erst Gestalten und Figuren, später Epochen, später der Baustein-Editor. Jeder Schritt wird, wie bisher, vor dem Bau geplant und mit Mockups abgenommen.

## 1. Dörfer selbst gestalten
- **Werkzeuge:** Wege ziehen, Seen ausheben, Gärten setzen, Häuser setzen, Häuser **von innen ausschmücken und dekorieren** (Möbel, Wandschmuck, Teppiche, Farben), Bäume und Deko setzen, Gebiete verschieben oder löschen.
- **Was schon trägt:** Die Gestaltung ist Daten (`look` Version 2: Gebiete mit Listen von Wegen, Seen, Gärten, Stegen, Bächen, Plätzen, Häusern mit `interior`, `decor`, `place`). Jede Werkzeugaktion ist eine Änderung dieser Listen plus der Kacheln, Orte und Objekte, also ein **Patch** (`links`, `look`, `tiles`, `objects` …) über `engine.edit`, mit Ereignis, Sicherung und Vorschau wie beim Generator. Die Kacheln leitet `generator/tiles.py` aus denselben Formen ab; der Editor ruft dieselben Funktionen auf (Weg ziehen = Linienzug in `paths` + Kachelraster neu ableiten).
- **Dazu nötig:** Ein Werkzeug-Modus in der Oberfläche (hier setzt `uiStore.appMode = "editor"` an, die Infoleiste ist dort aus), Bearbeiten statt nur Anhängen (Formen ändern und löschen: heute hängt `look` nur an), Rückgängig über Spielstand (AP09), Rechte (wer darf in einer laufenden Welt bauen; Agenten dürfen nur über `build`), Innenansicht als Bearbeitungsfläche (`look.interior` und Objekte).
- **Seit AP12c vorbereitet:** Trockenlauf für beliebige Patches (`POST /api/world/patch/preview`, `WorldEditor.dry_run`), Vorschau-Schicht in der Weltansicht (`editorStore.preview`, Schleier mit Rahmen, Kamerafahrt), Werkzeugleiste im Editor-Modus (`editor/WorldEditor.tsx`). Ein Gestaltungswerkzeug setzt einen Patch ab, bekommt dieselbe Vorschau und übernimmt über denselben Weg mit Sicherung.
- **Zu beachten in AP12c (erledigt):** Die Oberfläche „Welt erweitern“ so bauen, dass die Vorschau-Schicht („Geisterwelt unter Schleier mit Rahmen“) und der Trockenlauf auch für Einzeländerungen taugen, nicht nur für ganze Dörfer.

## 2. Eigene Figuren aus Vorlage-Avataren
- **Ziel:** Man erstellt Figuren auf Basis der Vorlagen (Alex, Mira und weitere) und ändert Farben, Haare, Kleidung usw. Passt zu den Mitspieler-Charakteren (Menschen steuern eigene Figuren, die KIs sehen sie als Gleiche).
- **Was schon trägt:** Die Figuren werden aus Code gezeichnet (`art/people.ts`, `LOOKS` je Kennung mit Farben); neue Figuren bekommen schon heute eine aus der Kennung abgeleitete Figur.
- **Dazu nötig:** Ein Avatar-Datensatz je Figur (Teile: Haut, Haar, Frisur, Kleidung, Farben, Zubehör) im Profil statt im Code, Zeichnen daraus (Teile als Ebenen in allen Blickrichtungen und Gangbildern), ein Editor mit Vorschau, Speichern im Spielstand, API; Figuren ändern sich zur Laufzeit.

## 3. Epochen
- **Ziel:** Neben dem jetzigen Mittelalter-Dorf: **Beginn der Industrialisierung**, **Gegenwart („wie es heute ist“)** und **Zukunft (Sci-Fi)**.
- **Was schon trägt:** Bild, Regeln und Texte hängen an Daten: Palette und Sprites (`art/`), Gebäudearten (`data/gebaeude/`), Objektarten (`object_kinds.py`), Bauvorlagen (`data/blueprints.json`), Orte und Namen, Wetter und Tageszeit.
- **Dazu nötig:** Ein **Epochenpaket** als Einheit: Palette und Sprite-Satz, Gebäude- und Objektkatalog, Bauvorlagen, Rohstoffe, Namenslisten, Texte für die Agenten (Prompt, Wortwahl), eigene Weltgeneratorregeln (Fabrik, Bahnhof, Straße, Hochhaus, Raumstation …), Ereignisse und Bedürfnisse, die sich verändern (Strom, Geld, Arbeit). Der Generator wird dafür **regelbasiert nach Paket**: Layout, Bausteine und Pläne kommen aus dem Paket statt fest im Code. Jedes Paket braucht Mockups und Henrys Abnahme der Optik, wie bei Bild A.
- **Offen:** Mischen von Epochen in einer Welt oder ein Paket je Simulation; Übergänge (Epochenwechsel im Spiel).

## 4. Eigene Bausteine entwerfen, mit Funktionen für die KI
- **Ziel:** In einem Editor eigene Assets (Gegenstände, Möbel, Gebäude, Figurenteile) zeichnen und **Funktionen definieren**, mit denen die KI-Agenten sie benutzen können.
- **Grundsatz bleibt:** Das Modell führt nie Code aus (Architekturprinzip 6); die Engine prüft und führt aus. Funktionen sind darum **deklarativ**: Handlungsmodi mit Bedingungen (Ort, Besitz, Zustand), Wirkungen (Bedürfnisse, Zustand, Rohstoffe, Dauer), Zustandsschema, Anzeigetext für Optionen, Wahrnehmungstext, Zustände im Bild. Das entspricht dem, was heute in `object_kinds.py`, `use_modes.py`, `use_dinge.py`, `agents/phrases.py` und `agents/options.py` je Objektart von Hand steht.
- **Dazu nötig:** (1) Objektarten als **Daten** (heute Code), mit einem kleinen, geprüften Baukasten für Bedingungen und Wirkungen; (2) Optionsgenerator, Bewertung und Texte lesen diese Daten; (3) Zeichnen im Editor (Pixel-Editor mit Palette der Epoche, Zustände, Anker) und Ablage als Asset-Datei; (4) Prüfung vor dem Veröffentlichen (Wirkungen innerhalb von Grenzen, damit ein Baustein das Spiel nicht aus dem Gleichgewicht bringt), Sandbox-Probelauf mit Fake-Modell; (5) Austausch (Export und Import wie Spielstände).
- **Reihenfolge:** Erst die Objektarten als Daten (Voraussetzung für Epochen **und** Baustein-Editor), dann Epochenpakete, dann der Editor.

## Vorschläge für die Reihenfolge der Pakete
1. AP12c (Leitstelle: Welt erweitern, neue Simulation mit Dorf), mit Blick auf Werkzeugmodus und Vorschau.
2. **Gestalten:** Werkzeuge für Wege, Seen, Gärten, Häuser, Innenausstattung (baut auf AP12).
3. **Figuren-Editor.**
4. **Objektarten als Daten** (Refactoring, ohne neue Optik).
5. **Epochen** (je Epoche ein Paket mit Mockups).
6. **Baustein-Editor mit Funktionen.**

## Nachtrag 17.10.2026 (Henry)
Auch **Assets und Häuser sollen selbst entworfen werden können** (gehört zu Nr. 4, Baustein-Editor, ergänzt um eigene Gebäudeformen und Räume). Alle Editoren (Welt, Figuren, später Häuser und Gebäude, Dinge und Assets, Epochen) sind im Startmenü unter dem Obermenüpunkt **Editoren** zusammengefasst.

## Nachtrag 18.10.2026 (Henry): Musik-Editor
Später soll es einen **Musik-Editor** geben, in dem man aus Elementen eigene Hintergrundmusik baut. Er gehört zu den Editoren im Startmenü.
- **Was schon trägt (AP17d):** Die Musik aus Code ist bereits aus Elementen zusammengesetzt (`frontend/src/klang/musik.ts`): Tonart und Tonleiter, Tempo, Akkordfolge, Melodie-Instrument (Pulswelle, Dreieck, Spieluhr, gezupft), Bass (liegend, laufend, gezupft), Fläche, gebrochene Akkorde, Gegenstimme, Schlagwerk (leicht, voll, Besen), Swing, Form A A′ B A″. Jedes Stück ist ein kleiner Datensatz (`MUS`).
- **Dazu nötig:** Stücke als Daten statt im Code (wie bei den Objektarten), ein Editor mit diesen Bausteinen und Vorhören (z. B. Spuren mit Takten, Motive zum Ziehen oder Zeichnen), Zuordnung „wann spielt was“ (Tageszeit, Wetter, drinnen, Ort, Epoche), Speichern im Spielstand oder als Datei zum Austausch.

