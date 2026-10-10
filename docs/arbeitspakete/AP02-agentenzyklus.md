# AP02 – LLM-Client, Agentenzyklus, Simulationsschleife

**Auftrag:** §2 (KI-Anbindung), §4, §5 · **Abhängig von:** AP01 · **Umfang:** L · **Meilenstein:** M1

## Ziel
Alex und Mira handeln selbstständig in der Welt aus AP01, gesteuert über das Modell auf maintux. Der vollständige Zyklus aus §5 läuft, ungültige Modellantworten werden abgefangen, und die Simulation lässt sich starten, pausieren, fortsetzen und schrittweise ausführen. Gedächtnis und Ziele sind hier noch minimal (Kurzzeitspeicher der letzten Ereignisse); der Ausbau folgt in AP05 und AP06.

## Lieferumfang
1. LLM-Client mit Konfiguration, Begrenzung, Wiederholung und Messwerten.
2. Agentenmodell mit Persönlichkeit, Profiltexten und Laufzeitstatus.
3. Optionsgenerator und Entscheidungsprompt.
4. Validierung und Korrekturschleife für Modellantworten.
5. Gesprächslogik zwischen den Agenten.
6. Simulationsschleife mit Steuerbefehlen.
7. Konsolenmodus `python -m simulacra.cli run --ticks 200`.

## LLM-Client (`llm/client.py`, `llm/metrics.py`)
- `httpx.AsyncClient`, Endpunkt `/v1/chat/completions`, Key als Bearer.
- Parameter: Modell, Temperatur, Top-p, max. Ausgabe-Tokens, Timeout, Anzahl Wiederholungen, Antwortformat (aus AP00-Ergebnis), Denkmodus.
- **Semaphore** für gleichzeitige Anfragen (Standard 1, passend zu `parallel = 1` im Router).
- Wiederholung nur bei Netzwerkfehler, 5xx und Timeout, mit Backoff; nie bei 4xx.
- Metriken je Anfrage: Wartezeit in der Warteschlange, Antwortzeit, Prompt-/Ausgabe-Tokens, Tokens/s (aus `timings`), Fehlerart. Gleitende Mittelwerte für die Statusanzeige (AP07).
- Austauschbar: Schnittstelle `LLMProvider` mit `complete(messages, schema, params)`; Implementierungen `OpenAICompatProvider` und `FakeProvider` (für Tests, liefert vorgegebene oder absichtlich kaputte Antworten).

## Agentenmodell (`agents/model.py`)
- **Profil (editierbar):** Name, Geschlecht, Alter, Charakterbeschreibung, Hintergrund, Interessen, Abneigungen, persönliche Ziele, Kommunikationsstil.
- **Persönlichkeitswerte 0–100:** Geselligkeit, Neugier, Hilfsbereitschaft, Risikobereitschaft, Konfliktbereitschaft, Kooperationsneigung, Ruhebedürfnis, Gesprächsinitiative, Annahmebereitschaft für Vorschläge.
- **Laufzeit:** Position, aktuelle Aktion mit Restdauer, Handlungsstatus (`idle`, `deciding`, `acting`, `talking`, `sleeping`, `stuck`, `resting_mode`), letzte Aktion mit Ergebnis, Stimmung (einfacher Wert plus Wort, Ausbau AP06).
- Startprofile in `agents/defaults/alex.json` und `mira.json`, z. B.:
  - **Alex**, 34, ehemaliger Zimmermann, ruhig, handwerklich, neugierig auf den Wald, mag frühe Morgen, mag keinen Lärm; Ziel: etwas Bleibendes bauen.
  - **Mira**, 31, Botanikerin, gesellig, organisiert gern, liebt den Garten und den See, mag keine Unordnung; Ziel: einen Garten anlegen, der das Haus versorgt.
  Die Texte sind Startwerte und im Frontend editierbar (AP07); sie legen keine Handlungen fest.

## Ablauf einer Entscheidung (§5, Schritte 1–10)
1. **Wahrnehmen** (`agents/perception.py`): Ort, Tageszeit, Wetter, sichtbare Objekte und Personen im Sichtradius, laufende Gespräche, Ergebnis der letzten Aktion, neue Beobachtungen seit der letzten Entscheidung. Nur, was der Agent tatsächlich wahrnehmen kann.
2. **Erinnern:** in AP02 die letzten N eigenen Beobachtungen; ab AP05 der Gedächtnisabruf.
3. **Bewerten:** in AP02 einfache Bewertung (Persönlichkeit + Ort + Tageszeit); ab AP06 Bedürfnisse und Ziele.
4. **Optionen erzeugen** (`agents/options.py`): Die Engine liefert alle *gültigen* Aktionen am aktuellen Zustand (z. B. „zum See gehen“, „Pilze sammeln“, „Mira ansprechen“, „Beet bepflanzen“, „ausruhen“). Jede Option bekommt eine Punktzahl und die Faktoren, die sie ausmachen. Die besten K Optionen (Standard 6) plus „etwas anderes vorschlagen“ gehen an das Modell.
5. **Entscheiden** (`agents/planner.py`): Prompt aus festem Systemteil (Rolle, Regeln, Antwortschema), Profil, Wahrnehmung, Erinnerungen, Optionen. Antwortschema:
   ```json
   {"option_id": "o3", "params": {...}, "utterance": "optional, bei speak",
    "intent": "kurzer Zweck", "importance": 1-10, "plan_next": "optional"}
   ```
6. **Validieren:** Pydantic-Prüfung, dann `engine.propose()`. Die Engine entscheidet über Erfolg, nie das Modell.
7. **Ausführen oder ablehnen:** Ergebnis als Ereignis; bei Ablehnung bekommt der Agent den Ablehnungstext als Beobachtung.
8. **Ergebnis wahrnehmen:** fließt in die nächste Wahrnehmung.
9. **Gedächtnis:** in AP02 Ringpuffer; ab AP05 dauerhaft.
10. **Nächstes planen:** `plan_next` wird als Vorschlag gespeichert und in der nächsten Entscheidung als Option bevorzugt.

## Korrekturschleife (§5, §15)
- Antwort kein JSON, Schema verletzt oder `option_id` unbekannt → bis zu R Korrekturversuche (Standard 2) mit kurzer Fehlermeldung an das Modell.
- Danach Rückfall: sichere Aktion `wait 10` mit Protokolleintrag `agent.decision_failed`. Der Weltzustand bleibt unberührt.
- Antwortzeit über Timeout → Abbruch, ebenfalls Rückfall.
- Rohantworten werden nur im Fehlerfall gekürzt protokolliert; vollständige Gedankenketten werden nicht gespeichert (§13).

## Gespräche (`agents/conversation.py`)
- Ein Gespräch ist ein eigener Zustand mit Teilnehmern, Ort, Beitragsliste, Thema und Zähler.
- Beginnt, wenn ein Agent `speak` wählt und der andere in Hörweite ist. Der Angesprochene bekommt bei seiner nächsten Entscheidung „antworten“, „Gespräch beenden“ oder andere Optionen.
- Abbruch nach max. Beiträgen (Standard 8), wenn ein Teilnehmer geht oder bei erkannter Wiederholung (gleiche oder sehr ähnliche Sätze, AP06 verfeinert).
- Vorschläge im Gespräch (z. B. „Lass uns zum See gehen“) werden als `proposal` gespeichert; der andere kann annehmen oder ablehnen (Annahmebereitschaft fließt ein).

## Simulationsschleife (`simulation/engine.py`)
- Zustände: `stopped`, `running`, `paused`, `stepping`.
- Ein Tick: Uhr +1 Minute → laufende Aktionen fortschreiben → Agenten ohne Aktion entscheiden lassen → geplante Ereignisse auslösen → Ereignisse veröffentlichen.
- **Zeit wartet auf Entscheidungen** (Standard): Der Tick ist erst fertig, wenn alle fälligen Entscheidungen da sind. Alternative per Parameter (AP07): Die Zeit läuft weiter, der Agent steht in „überlegt“.
- Entscheidungen der beiden Agenten laufen über die Semaphore nacheinander; die Reihenfolge wechselt, damit keiner bevorzugt wird. Dringende Ereignisse (AP06/AP08) können eine Entscheidung vorziehen.
- Steuerbefehle: Start, Pause (laufende LLM-Anfrage darf zu Ende laufen, danach Halt), Fortsetzen, Einzelschritt (genau ein Tick inkl. fälliger Entscheidungen), Geschwindigkeit (Pause zwischen Ticks), Zurücksetzen (Startwelt neu laden; Sicherung des alten Stands kommt in AP09).
- Grenzen: max. Entscheidungen pro Minute (Echtzeit), min. Abstand zwischen Entscheidungen desselben Agenten.

## Module
`llm/client.py`, `llm/providers.py`, `llm/metrics.py`, `agents/model.py`, `agents/perception.py`, `agents/options.py`, `agents/scoring.py`, `agents/planner.py`, `agents/prompts.py`, `agents/conversation.py`, `simulation/engine.py`, `simulation/control.py`, `cli.py`.

## Tests
- Fake-LLM: gültige Antwort → Aktion ausgeführt; kaputtes JSON → Korrektur → Erfolg; dauerhaft kaputt → `wait`, Weltzustand unverändert (§17 Nr. 15).
- Unbekannte `option_id`, unmögliche Parameter, Behauptung von Erfolg im Text → ohne Wirkung.
- Timeout und Netzwerkfehler → Wiederholung, danach Rückfall.
- Semaphore: nie mehr als N gleichzeitige Anfragen.
- Pause während laufender Anfrage, Einzelschritt, Fortsetzen (§17 Nr. 12).
- Getrennte Kontexte: Alex' Prompt enthält keine Wahrnehmungen von Mira (§17 Nr. 2, 11 Grundlage).
- **Integrationslauf** gegen maintux (als markierter Test, nicht im Standardlauf): 200 Ticks, Messung gültiger Entscheidungen, Fehlerquote, Entscheidungen pro Minute.

## Abnahme
- [ ] Konsolenlauf über 200 Ticks mit dem echten Modell: beide Agenten bewegen sich, nutzen Objekte, sprechen miteinander.
- [ ] Mindestens 90 % der Entscheidungen gültig ohne Rückfall (Wert aus AP00 bestätigen oder begründet anpassen).
- [ ] Pause, Fortsetzen, Einzelschritt in der CLI nachweisbar.
- [ ] Aktionsprotokoll in SQLite mit Optionen, gewählter Option, Ergebnis.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Entscheidungen zu langsam für eine lebendige Welt | Aktionen mit Dauer; Agenten entscheiden nur, wenn sie frei sind; kurze Prompts; Prompt-Cache durch stabile Präfixe |
| Modell wählt immer dieselbe Option | Wiederholungsstrafe in der Bewertung (Grundform hier, Ausbau AP06) |
| Gespräche wirken hölzern | Gesprächsprompt mit letzten Beiträgen und Beziehungsstand; Feinschliff in AP06 |
