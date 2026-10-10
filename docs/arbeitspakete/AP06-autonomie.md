# AP06 – Ziele, Bedürfnisse, Beziehungen, Schutzmechanismen, Erklärbarkeit

**Auftrag:** §4, §5, §13, §15 · **Abhängig von:** AP05 · **Umfang:** L · **Meilenstein:** M3

## Ziel
Die Agenten verfolgen eigene kurz- und langfristige Ziele, reagieren auf Bedürfnisse und entwickeln Beziehungen aus ihren Interaktionen. Persönlichkeitswerte wirken messbar über die Bewertung der Optionen. Schleifen und festgefahrene Pläne werden erkannt und aufgelöst. Jede Entscheidung ist anhand echter Daten erklärbar.

## Lieferumfang
1. Zielsystem (Ziele, Teilziele, Pläne) mit Persistenz.
2. Bedürfnisse, einzeln schaltbar, und Stimmung.
3. Beziehungsmodell zwischen den Agenten.
4. Bewertungsfunktion (Scoring) mit allen Faktoren und Persönlichkeitswerten.
5. Schutzmechanismen nach §15 mit Historie fehlgeschlagener Aktionen.
6. Strukturiertes Entscheidungsprotokoll und Erklärtext.
7. Anzeige in Agentenübersicht und Detailpanel.

## Zielsystem (`agents/goals.py`)
- **Langfristige Ziele:** aus dem Profil (z. B. „etwas Bleibendes bauen“) oder vom Agenten neu gesetzt (Autonomie, AP07). Zustand `active`, `paused`, `achieved`, `abandoned`.
- **Kurzfristige Ziele:** konkret und prüfbar, z. B. „Bank im Garten bauen“, „Pilze im Wald finden“, „mit Mira über den Garten reden“. Jedes Ziel hat eine **Erfüllungsbedingung** gegen den Weltzustand (Objekt existiert, Ort besucht, Gespräch mit Thema stattgefunden), damit nicht das Modell entscheidet, ob es erreicht ist.
- **Plan:** Folge von Schritten (Planungshorizont als Parameter: 1–8 Schritte). Erzeugt per LLM im JSON-Schema aus den *bekannten* Möglichkeiten; jeder Schritt muss auf eine Aktionsart abbildbar sein.
- **Zielwechsel:** neuer Vorschlag aus Gespräch, Bedürfnis, Ereignis oder eigener Idee. Zielpersistenz (Parameter) bestimmt, wie hoch der Vorteil sein muss, damit gewechselt wird.
- Ereignis `agent.goal_changed` mit altem/neuem Ziel und Grund.
- Ziele werden als `intention`-Erinnerungen gespiegelt (AP05), damit sie Neustarts überleben und abrufbar sind.

## Bedürfnisse und Stimmung (`agents/needs.py`)
| Bedürfnis | Sinkt durch | Steigt durch | Schaltbar |
|---|---|---|---|
| Energie | Zeit, Arbeit, Bauen | Schlafen, Ausruhen | ja |
| Hunger | Zeit | Essen | ja |
| Geselligkeit | Zeit allein | Gespräche, gemeinsame Aktivität | ja |
| Ruhe | Gespräche, Lärm | Alleinsein, ruhige Orte | ja |
| Wärme | Regen, Nacht draußen | Haus, Feuer | ja (Standard aus) |

- Verbrauchsraten sind Parameter (AP07). **Ist ein Bedürfnis ausgeschaltet, taucht es weder in Bewertung noch Prompt auf** (§8.4).
- Kritische Schwelle (z. B. Energie < 15) erzeugt einen *dringenden Anlass* mit Vorrang (siehe Priorisierung).
- Stimmung: Wert −1 … +1 aus Bedürfnissen, jüngsten Erfolgen/Misserfolgen und Gesprächsverlauf; dazu ein Wort („zufrieden“, „gereizt“, „müde“). Wird als Verhalten behandelt, nicht als Gefühl im eigentlichen Sinn (§4).

## Beziehungen (`agents/relations.py`)
- Je Richtung (Alex→Mira, Mira→Alex) getrennt: Vertrauen, Sympathie, Spannung, Vertrautheit (0–100), dazu Liste gemeinsamer Erlebnisse und offener Konflikte.
- Änderungen nur durch Ereignisse mit Regeln (angenommener Vorschlag, Hilfe, Geschenk, abgelehnte Bitte, Streit im Gespräch) und durch Beziehungsreflexion (AP05) in kleinen, begrenzten Schritten.
- Kein Zielzustand vorgegeben: keine Romantik, kein Drehbuch (§4). Die Werte beeinflussen nur Bewertung und Gesprächston.
- Ereignis `agent.relation_changed` (Kategorie *planning*).

## Bewertung der Optionen (`agents/scoring.py`)
Jede gültige Option bekommt eine Punktzahl als Summe benannter Faktoren. Diese Faktoren erscheinen 1:1 im Entscheidungsprotokoll.

| Faktor | Quelle | Beispiel-Wirkung |
|---|---|---|
| `goal_progress` | aktives Ziel, Planschritt | Option bringt Ziel voran |
| `need_relief` | Bedürfnisse | Hunger hoch → Essen hoch bewertet |
| `exploration` | `known_locations/objects` × Neugier × Explorationsparameter | unbekannter Ort bevorzugt |
| `social` | Geselligkeit × Gesprächsinitiative × Initiative-Parameter × Beziehung | Gespräch anfangen |
| `calm` | Ruhebedürfnis | ruhige Orte, Alleinsein |
| `helpfulness` | Hilfsbereitschaft × erkennbarer Bedarf des anderen | helfen, geben |
| `cooperation` | Kooperationsneigung × gemeinsames Vorhaben | gemeinsam arbeiten |
| `risk` | Risikobereitschaft × Risiko der Option (Sturm, Dunkelheit, unbekannt) | riskante Optionen gedämpft oder gesucht |
| `conflict` | Konfliktbereitschaft × offene Konflikte | ansprechen vs. ausweichen |
| `proposal_accept` | Annahmebereitschaft × Beziehung | Vorschlag des anderen annehmen |
| `plan_stick` | Zielpersistenz × Spontaneität | beim Plan bleiben vs. abweichen |
| `autonomy` | Autonomie | eigene Vorhaben vs. Reaktion auf Ereignisse |
| `repetition_penalty` | Aktionshistorie | gleiche Aktion kurz hintereinander abgewertet |
| `failure_penalty` | Fehlschlaghistorie | zuletzt gescheiterte Option abgewertet |

- Spontaneität fügt eine kontrollierte Zufallskomponente hinzu (fester Seed je Simulation, damit Läufe reproduzierbar sind).
- Das Modell bekommt die besten K Optionen mit kurzer Faktorbeschreibung; es darf eine niedriger bewertete wählen, die Abweichung wird protokolliert.
- **Nachweis der Wirkung:** Für jeden Persönlichkeitswert gibt es einen Test, der zeigt, dass ein höherer Wert die Reihenfolge der Optionen in einer festen Situation in die erwartete Richtung verschiebt (Grundlage für §17 Nr. 8).

## Priorisierung
Reihenfolge, in der Anlässe eine Entscheidung auslösen oder vorziehen:
1. Sicherheit/kritische Bedürfnisse (Energie, Sturm draußen).
2. Direkte Ansprache durch den anderen Agenten.
3. Vom Benutzer eingespielte Ereignisse, die den Agenten betreffen (AP08).
4. Laufender Planschritt.
5. Eigeninitiative.

## Schutzmechanismen (`agents/guards.py`, §15)
| Problem | Erkennung | Reaktion |
|---|---|---|
| Wiederholte Aktion | gleiche Aktion + Ziel ≥ 3× in den letzten N Entscheidungen | starke Abwertung; danach Sperre für X Sim-Minuten |
| Gesprächsschleife | Ähnlichkeit (normalisierte Wortmengen) zwischen Beiträgen über Schwelle, oder Gespräch > Höchstlänge | Gespräch beenden, Beiden Erinnerung „Gespräch drehte sich im Kreis“ |
| Festgefahrener Plan | Planschritt k-mal abgelehnt oder Ziel ohne Fortschritt über Zeitgrenze | 1. Neuplanung, 2. Alternativziel, 3. Ruhemodus (`resting_mode`) für eine Weile |
| Widersprüchliche Ziele | zwei aktive Ziele mit unvereinbaren Bedingungen (z. B. gleiches Objekt anders nutzen) | jüngeres pausieren, Protokoll |
| Zu viele LLM-Aufrufe | Rate-Limit je Minute (global und je Agent) | Entscheidung verschieben, Agent wartet |
| Verbrauch ohne Fortschritt | Ressourcen sinken, kein Ziel kommt voran über Zeitraum | Ziel überprüfen, ggf. Ruhemodus |
| Fehlerhafte Antworten in Folge | Zähler je Agent | Ruhemodus und Systemmeldung |

Tabelle `failed_actions` (Agent, Zeitpunkt, Aktion, Parameter, Ablehnungscode, Kontext) als nachvollziehbare Historie; im Agenten-Detail und im Protokoll filterbar.

## Entscheidungsprotokoll und Erklärung (`agents/explain.py`, §13)
Jede Entscheidung speichert strukturiert:
- aktives Ziel und Planschritt,
- abgerufene Erinnerungen (IDs, Punkte),
- erwogene Optionen mit Faktoren und Punkten,
- gewählte Option, ob sie die bestbewertete war,
- Ergebnis (ausgeführt/abgelehnt mit Code),
- Zieländerung als Folge.

Der Erklärtext wird **aus diesen Daten per Vorlage** erzeugt, nicht vom Modell nachträglich erfunden, z. B.:
„Alex geht zum See, weil sein Ziel *Wald und See erkunden* aktiv ist (+3,1), der See ihm noch unbekannt ist (+2,4) und seine Energie ausreicht.“
Das `intent`-Feld des Modells wird zusätzlich als „vom Agenten genannter Zweck“ gekennzeichnet angezeigt.

## Frontend
- Agentenübersicht jetzt vollständig: Ziel kurz/lang, Stimmung, Energie und aktive Bedürfnisse als schmale Balken, Status, letzte Aktion.
- Agenten-Detail: Ziele mit Plan und Fortschritt, Beziehung zum anderen (Werte und jüngste Änderungen mit Grund), Fehlschläge.
- Protokoll: Entscheidungen als *Planung*-Einträge mit „Warum?“-Aufklappbereich (Faktoren als kleine Balken).

## Module
`agents/goals.py`, `agents/plans.py`, `agents/needs.py`, `agents/mood.py`, `agents/relations.py`, `agents/scoring.py` (Ausbau), `agents/factors/*.py`, `agents/guards.py`, `agents/explain.py`; Frontend `src/panels/GoalView.tsx`, `NeedsBars.tsx`, `RelationView.tsx`, `src/timeline/DecisionDetail.tsx`.

## Tests
- Je Faktor ein Einheitstest, je Persönlichkeitswert ein Richtungstest.
- Ausgeschaltetes Bedürfnis: kein Einfluss auf Punkte, nicht im Prompt.
- Zielerfüllung über Weltbedingung, nicht über Modelltext.
- Schleifen: erzwungene identische Antworten des Fake-LLM → Abwertung, Sperre, Gesprächsende.
- Festgefahren: Ziel unerreichbar → Neuplanung → Alternativziel → Ruhemodus.
- Erklärtext enthält nur Faktoren, die tatsächlich im Protokoll stehen.
- Langlauf mit Fake-LLM über 7 Sim-Tage: keine Endlosschleife, Gedächtnis- und Ereignismengen unter Grenzen.

## Abnahme
- [ ] Mit echtem Modell über mindestens einen Sim-Tag: beide verfolgen erkennbar eigene Ziele, wechseln Ziele begründet, Beziehungswerte verändern sich mit nachvollziehbaren Gründen.
- [ ] „Warum?“ ist bei jeder Entscheidung verfügbar und deckt sich mit den Rohdaten.
- [ ] Erzwungene Schleifen werden in Tests und im Live-Lauf aufgelöst.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Bewertung dominiert, Modell wird überflüssig | Modell wählt frei aus Top-K und schreibt alle Inhalte; Anteil „nicht bestbewertete Option gewählt“ wird gemessen |
| Zu viele Faktoren, schwer zu verstehen | Faktoren mit Klartextnamen, Gewichte dokumentiert in `docs/konfiguration.md` |
