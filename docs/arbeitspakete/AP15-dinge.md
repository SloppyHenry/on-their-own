# AP15 – Dinge im Dorf: Deko wird benutzbar

**Auftrag:** Henry, 14.10.2026 („erst Deko, dann Weltgenerator“; Auswahl siehe unten) · **Abhängig von:** AP14 · **Vor:** AP12 · **Umfang:** L · Branch `ap/15-dinge` (baut auf `ap/14-startwelt-a` auf)

## Ziel
Was im Dorf und im Haus nach Mockup A und innen2 zu sehen ist, soll zum großen Teil echte Dinge werden: Die Agenten nehmen sie wahr, bekommen Handlungen dafür angeboten, und ihr Zustand ist im Bild zu sehen (Laterne brennt, Vogelscheuche liegt, Katze schläft auf dem Sofa). Das Aussehen bleibt das abgenommene: Dieselben Sprites stehen an denselben Stellen, nur kommen sie jetzt aus dem Weltzustand statt aus `look.decor`.

## Entscheidungen (Henry, 14.10.2026)
Ausgewählt wurde alles aus dem Vorschlag:

| Ding | Handlungen | Wirkung |
|---|---|---|
| **Boot** am Steg | rudern; vom Boot angeln | Rudern: Erholung (wie Sitzen, etwas länger). Angeln vom Boot: Fangchance 85 % statt 70 % am Ufer. Immer nur eine Person im Boot. |
| **Laternen** (3) | anzünden, löschen | Leuchten nur, wenn sie brennen. **Nur die Agenten schalten** (kein Automatismus): Vergessen sie es, bleibt das Dorf nachts dunkel. Kein Holz nötig. |
| **Briefkasten** | Brief an jemanden einwerfen; eigene Post abholen | Briefe sind privat (nur der Empfänger liest sie). Wer Post hat, nimmt das wahr („Im Briefkasten liegt Post für dich“). |
| **Tomaten** (3), **Sonnenblumen** (3) | pflücken / Kerne sammeln | Tomaten → Nahrung, Sonnenblumen → Samen; wachsen langsam nach. |
| **Regentonnen** (2 Fässer im Garten) | Wasser schöpfen, Beete direkt gießen | Füllen sich nur bei Regen und Sturm. |
| **Apfelbäume** (2, die mit roten Früchten) | Äpfel pflücken | Nahrung, wächst langsam nach. |
| **Wegweiser** | lesen | Nennt die Orte mit Richtung; wer ihn liest, kennt danach diese Orte (gelten als entdeckt). |
| **Steine am Ufer** (3) | Stein brechen (mit Spitzhacke) | Ersetzen die bisher unsichtbare Steinquelle am See. |
| **Vogelscheuche** | aufrichten | Sturm kann sie umwerfen (sie liegt dann im Bild). Liegt sie, wachsen die Pflanzen im Garten halb so schnell (Vögel). |
| **Schilf** (5) | schneiden | Neuer Rohstoff **Schilf**. Neuer Bauplan **Korb** (2 Schilf, an der Werkbank): Wer einen Korb trägt, hat 3 Tragplätze mehr. |
| **Katze** | streicheln | Etwas Gesellschaft; die Katze wechselt alle paar Stunden ihren Platz im Haus (Sofa, Bett, Fenster, Küche) und schläft nachts. |
| **Sessel** | sitzen | wie Sofa und Bank |
| **Kerze**, **Stehlampen** (2) | anzünden / einschalten, löschen / ausschalten | Leuchten abends nur, wenn sie an sind. |
| **Schrank**, **Kisten** (2), dazu die vorhandene **Truhe** | etwas hineinlegen, herausnehmen | Ablage für Rohstoffe und tragbare Dinge, sichtbar in „ansehen“. |

Reine Deko bleiben: Bäume ohne Früchte, Büsche, Zaun, Pfähle, Bilder, Fenster, Regale an der Wand, Pflanzen im Haus, Teppiche, Haus.

## Weitere Festlegungen
- **Weltdatei:** Die bisherigen Deko-Einträge werden Objekte (`objects`) und Quellen (`resource_nodes`) mit Kachel; ihre Bildstelle und ihr Sprite stehen weiter in `look.place` (draußen) bzw. werden aus der Kachel abgeleitet (drinnen). Die Startwelt wird wie bisher mit `scripts/startwelt_a.mjs` erzeugt.
- **Bild:** Gleiches Sprite wie im Mockup, Zustand nur dort, wo er sichtbar sein soll (Laterne/Kerze/Lampe an oder aus, Vogelscheuche steht oder liegt, Katze an ihrem Platz, Regentonne voll oder leer). Ein Ding im Boot oder am Briefkasten bekommt kein eigenes Bild.
- **Neue Handlungen der Agenten** laufen über den bestehenden Befehl `use` mit neuen Modi (`row`, `post`, `collect`, `fix`, `pet`, `store`, `retrieve`) und über `gather` für die neuen Quellen. Bewertung im Optionsgenerator mit eigenen Arten, damit Persönlichkeit und Bedürfnisse wirken.
- **Mitspieler-Vorschau:** Das Kontextmenü bietet die neuen Handlungen mit an; die Namensblase zeigt die neuen Dinge.
- **Alte Spielstände** behalten ihre Welt; unbekannte Arten laden dort wie bisher als passive Objekte.

## Schritte (je ein Commit, mit Tests)
1. Backend: neue Objektarten und Modi (Boot, Laterne, Kerze, Lampe, Briefkasten, Wegweiser, Vogelscheuche, Katze, Sessel, Schrank, Kiste, Truhe), Rohstoff Schilf, Bauplan Korb mit Tragplätzen, Regentonne bei Regen, Sturm wirft die Vogelscheuche um, Wachstum ohne Vogelscheuche halb so schnell.
2. Backend: Startwelt mit den neuen Dingen und Quellen; Wahrnehmung (Post), Optionen, Bewertung, Phrasen, Ereignistexte; Typen für das Frontend.
3. Frontend: Dinge aus dem Zustand zeichnen (draußen und drinnen), Zustand im Bild, Licht nur von brennenden Laternen und Lampen, Namensblase und Kontextmenü.
4. Probelauf mit Fake-Modell (werden die Dinge benutzt?), Browser-Tests, Bilder, Doku, Statusbericht.

Ausrollen nur nach Henrys Freigabe.
