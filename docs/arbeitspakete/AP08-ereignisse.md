# AP08 – Freie Ereigniseingabe und Wissensverteilung

**Auftrag:** §10, §11 (Eingriff), §17 Nr. 10–11 · **Abhängig von:** AP07 · **Umfang:** L · **Meilenstein:** M5

## Ziel
Ein dauerhaft sichtbares Texteingabefeld, über das du während der laufenden Simulation beliebige Ereignisse beschreibst. Das Backend wandelt den Text in ein strukturiertes, geprüftes Ereignis um, fragt bei Unklarheit nach, führt es über die Welt-Engine aus und verteilt das Wissen nur an die vorgesehenen Agenten. Das Ergebnis ist eine echte Veränderung von Welt und Wissensständen, nicht nur ein Dialog.

## Ablauf (§10.1)
```
Text ──► 1 Regelparser ──► erkannt? ──ja──► 3 Strukturiertes Ereignis
             │ nein                               │
             ▼                                    ▼
        2 LLM-Interpretation            4 Prüfung durch Welt-Engine
        (nur in Schema)                           │
                                     eindeutig & gültig? ──nein──► Rückfrage / Fehler
                                                  │ ja
                                                  ▼
                                   5 Vorschau (optional, bei komplexen)
                                                  ▼
                       6 Ausführen in einer Transaktion → Weltänderungen
                       7 Beobachtungen an Empfänger → 8 Erinnerungen
                       9 `simulation.event_injected` + Folgeereignisse im Protokoll
```

## Strukturierte Ereignisse (`events_user/schema.py`)
Ein Ereignis ist eine Liste von **Operationen** aus einem festen Katalog. Nur diese Operationen kann ein Benutzerereignis auslösen; jede läuft durch die Welt-Engine.

| Operation | Felder | Beispiel |
|---|---|---|
| `set_weather` | Wetter, Dauer | „Heute beginnt es zu regnen.“ |
| `spawn_object` | Objektart, Name, Beschreibung, Ort, Kachel (optional), verborgen ja/nein, Zustand | „Im Wald wird ein unbekannter Gegenstand entdeckt.“ |
| `give_object` | Objekt, Agent | „Alex findet eine alte Karte im Haus.“ → `spawn_object` im Haus + Fund durch Alex |
| `change_object` | Objekt, Zustandsänderung | „Der Strom im Haus fällt aus.“ → Licht/Herd im Haus `powered: false` |
| `add_location` | Name, Lage (angrenzend an bestehenden Ort), Typ | „Hinter dem See liegt eine Höhle.“ |
| `change_resource` | Ressource, Ort/alle, Faktor oder Menge, Dauer | „Für drei Tage sind die Ressourcen knapp.“ |
| `inform` | Empfänger, Inhalt, Quelle (wer hat es erzählt / woher), Wahrheitsgehalt | „Mira erfährt, dass Alex gestern allein am See war.“ |
| `message` / `invite` | Empfänger, Absender (Figur oder „Brief“), Inhalt, Termin, Ort | „Mira erhält eine Einladung zu einem Fest.“ |
| `schedule` | Zeitpunkt oder Zeitfenster, enthaltene Operationen | „Am Platz findet morgen ein Markt statt.“ |
| `spawn_npc` | Name, Beschreibung, Ort, Verhalten (einfach), Aufenthaltsdauer | „Ein Fremder zieht in das Dorf.“ |
| `situation` | betroffene Agenten, Beschreibung, beteiligte Objekte | „Beide entdecken eine verschlossene Tür.“ → Tür-Objekt `locked` + Wahrnehmung bei beiden |
| `move_agent` | Agent, Ziel | Systemeingriff |
| `suggest_goal` | Agent, Ziel | Systemeingriff (direkte Anweisung) |
| `temp_param` | Parameter, Wert, Dauer | „Für eine Stunde ist alles doppelt so schnell.“ |

**Weltereignis vs. Anweisung (§10.2):** Operationen sind entweder `world` (passiert in der Welt, Agenten nehmen es über Wahrnehmung wahr) oder `directive` (`move_agent`, `suggest_goal`, `temp_param`). Direktiven sind nur im Eingriffsmodus erlaubt und werden im Protokoll deutlich als Benutzereingriff markiert.

**Nebenfiguren (`spawn_npc`):** Vereinfachung, offen gekennzeichnet: Nebenfiguren sind sichtbare Figuren mit einfachem Regelverhalten (gehen zwischen Orten, können angesprochen werden, antworten mit kurzen LLM-Sätzen aus einer Beschreibung), aber ohne eigenes Gedächtnis und ohne Ziele. Ausbau zu vollwertigen Agenten ist eine spätere Option.

## Regelparser (`events_user/rules.py`)
Deterministische Muster für häufige Fälle (deutsch, mit Varianten):
- Wetterwörter (Regen, Sturm, Nebel, Schnee, Sonne) + Zeitangaben („heute“, „für zwei Stunden“).
- „X findet/entdeckt Y in/im Z“ → `spawn_object` + Fund.
- „Ressourcen/Holz/Nahrung knapp/reichlich für N Tage“.
- „A erfährt/hört, dass …“ → `inform` an A.
- „Morgen/um 18 Uhr/am Abend …“ → `schedule`.
- Namen der Agenten, Orte und bekannte Objektarten über ein Wörterbuch aus dem Weltzustand.
Trifft eine Regel sicher zu, wird das LLM nicht gefragt.

## LLM-Interpretation (`events_user/interpret.py`)
- Nur für Eingaben, die keine Regel sicher erkennt.
- Prompt enthält den Operationskatalog, aktuelle Orte, Objekte, Agenten und Zeit; Antwort zwingend im JSON-Schema der Operationen plus Felder `confidence` und `clarification_needed` (mit Frage und Auswahlmöglichkeiten).
- Ergebnis wird wie jede andere Eingabe validiert: unbekannte Orte/Agenten, unmögliche Werte, zu viele Operationen (Grenze z. B. 5), Objektgrenze → abgelehnt oder Rückfrage.
- Das LLM kann keine Operation erfinden, die nicht im Katalog steht, und nie direkt in die Datenbank schreiben.

## Rückfragen und Vorschau (§10.4)
- **Rückfrage**, wenn Zuordnung unklar ist (z. B. „im Haus“ – welcher Raum?, „er“ – welcher Agent?, „ein Fest“ – wann?). Antwort per Auswahl oder Freitext; danach erneute Prüfung.
- **Vorschau** bei mehreren Operationen, neuen Orten, Nebenfiguren oder Direktiven: zeigt geplante Änderungen in Klartext („Objekt *alte Karte* wird in *Wohnzimmer* erzeugt; Alex nimmt es wahr“). Ausführen erst nach Bestätigung.
- Weitreichende Änderungen (z. B. alle Ressourcen auf null, Agent löschen) sind nicht im Katalog und werden abgelehnt.

## Wissensverteilung (§10.3, §17 Nr. 11)
- Jede Operation erzeugt Beobachtungen mit expliziter `visibility`:
  - Weltänderungen: wer am Ort ist oder hinkommt, nimmt sie wahr (z. B. Regen alle draußen sofort, drinnen am Fenster). Verborgene Objekte erst beim Entdecken.
  - `inform`/`message`: **nur** die genannten Empfänger. Der Inhalt wird beim Empfänger als `fact` bzw. `episode` mit Quelle gespeichert („Mira hat gehört, dass …“), mit Wahrheitsgehalt (wahr, Gerücht, falsch), damit Missverständnisse möglich sind.
- Beobachtermodus: eingespielte Ereignisse erscheinen den Agenten als natürliche Vorkommnisse; im Schöpfermodus kann die Quelle „die Schöpferinstanz“ sein; im Eingriffsmodus dürfen Nachrichten als „Stimme von außen“ gekennzeichnet werden.

## Ausführung und Zeit
- Sofortige Ereignisse laufen im nächsten Tick, innerhalb einer Transaktion.
- Geplante Ereignisse liegen in Tabelle `scheduled_events` und werden von der Simulationsschleife zum Zeitpunkt ausgelöst; zeitlich begrenzte Wirkungen (Knappheit für 3 Tage, `temp_param`) haben einen Endzeitpunkt mit automatischer Rücknahme und eigenem Protokolleintrag.
- Benutzerereignisse haben in der Priorisierung (AP06) Stufe 3: betroffene Agenten entscheiden beim nächsten freien Moment neu.

## Missbrauchs- und Lastschutz
- Rate-Limit (z. B. 10 Ereignisse pro Minute), Längenlimit (1000 Zeichen), Idempotenz-Schlüssel.
- Obergrenzen: Objekte, Nebenfiguren (z. B. 3), geplante Ereignisse (z. B. 50).
- Alle Texte werden als Daten behandelt; Eingaben können keine Systemprompts überschreiben (Prompt-Abschnitte klar getrennt, Text in Anführungen).

## Ereignis-UI (`EventComposer`, §10.4)
- Feste Leiste am unteren Rand der Leitstelle, immer erreichbar.
- Enter sendet, Shift+Enter neue Zeile.
- Vorschläge: Liste von Beispielen, zusätzlich kontextabhängig (Orte und Objekte aus dem Zustand) und zuletzt verwendete Eingaben.
- Optionale Auswahl betroffener Agenten (Chips) und Zeitpunkt (sofort, in N Minuten, Uhrzeit, Tag).
- Verarbeitungsstatus in der Leiste: „wird gelesen …“, „Rückfrage“, „Vorschau“, „ausgeführt ✓“, „abgelehnt: Grund“.
- Ergebnis verlinkt auf die erzeugten Protokolleinträge und, falls ein Objekt entstand, zentriert die Weltansicht darauf.
- Verlauf der eigenen Eingaben mit Status.

## API
| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/inject/parse` | Text → Vorschlag (Operationen, Rückfrage, Vorschau-Text), ändert nichts |
| POST | `/api/inject/confirm` | bestätigten Vorschlag ausführen (mit Vorschlags-ID und Idempotenz-Schlüssel) |
| GET | `/api/inject/history` | eigene Eingaben mit Status |
| GET/DELETE | `/api/scheduled` | geplante Ereignisse ansehen und absagen |

## Module
`events_user/schema.py`, `rules.py`, `lexicon.py`, `interpret.py`, `validate.py`, `apply.py`, `knowledge.py`, `scheduler.py`, `npc.py`, `api/routes_inject.py`; Frontend `src/composer/EventComposer.tsx`, `Suggestions.tsx`, `ClarifyDialog.tsx`, `PreviewCard.tsx`, `InjectHistory.tsx`.

## Tests
- **Alle elf Beispielsätze aus §10** als Testfälle (Regelparser bzw. Fake-LLM) mit erwarteten Operationen und erwartetem Weltzustand danach.
- „Alex findet eine alte Karte im Haus“: Objekt `map` existiert in einem Hausraum, Alex kennt es, Mira nicht (§10.3).
- „Mira erfährt, dass Alex gestern allein am See war“: nur Mira hat den `fact`; Alex' Gedächtnis unverändert; Abruf von Alex findet nichts (§17 Nr. 11).
- Mehrdeutig („Er findet etwas“) → Rückfrage, keine Änderung.
- LLM liefert unbekannte Operation, unbekannten Ort, zu viele Operationen → abgelehnt, Zustand unverändert.
- Geplantes Ereignis wird zum Zeitpunkt ausgelöst; befristete Knappheit endet automatisch.
- Persistenz: eingespielte Ereignisse und ihre Folgen überleben Neustart (§17 Nr. 10).
- Playwright: Eingabe tippen, Enter, Vorschau bestätigen, Objekt erscheint in der Welt und im Protokoll.

## Abnahme
- [ ] Die elf Beispiele funktionieren live mit sichtbarer Wirkung in Welt, Protokoll und den richtigen Gedächtnissen.
- [ ] Unklare Eingaben führen zu Rückfragen, nicht zu Vermutungen.
- [ ] Wissenstrennung im Gedächtnis-Inspektor nachvollziehbar.
