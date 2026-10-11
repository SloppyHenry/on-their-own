# Autonomie: Ziele, Bedürfnisse, Beziehungen, Schutz, Erklärung (AP06)

Alles hier ist **Verhalten**, keine Gefühle im eigentlichen Sinn (§4): Zahlen und Regeln, die Bewertung und Gesprächston beeinflussen und nachvollziehbar protokolliert werden. Die Persönlichkeitswerte wirken über die Bewertung der Optionen; das Modell wählt aus den besten Optionen und schreibt alle Inhalte.

## Ziele (`agents/goals.py`, `plans.py`)
- **Langfristig:** aus dem Profil (`goals`), einmalig angelegt, Zustand `active`, `paused`, `achieved`, `abandoned`.
- **Kurzfristig:** höchstens eines aktiv. Das Modell schlägt es im JSON-Schema vor (Text, **Erfüllungsbedingung**, Plan aus 1–8 Schritten); die Welt prüft jede Angabe (Orte, Objektarten, Ressourcen, Personen müssen existieren, die Bedingung darf nicht schon erfüllt sein, Planschritte müssen auf eine Aktionsart abbildbar sein), sonst Korrektur und notfalls Verwerfen.
- **Erfüllung entscheidet die Welt**, nie ein Modelltext. Fünf Bedingungen: `object_count` (Gegenstand einer Art entsteht, optional an einem Ort), `location_visited` (Ort erneut besucht), `has_resource` (genug dabei), `talked_with` (Gespräch mit Person, optional Thema, nach Zielsetzung), `plant_stage` (eigene Pflanze erreicht Stufe). Ausgangswerte (z. B. wie viele Bänke es schon gibt) werden beim Setzen festgehalten.
- **Plan:** jeder passende ausgeführte Schritt rückt vor (Art der Aktion und, falls genannt, das Ziel); abgelehnte oder gescheiterte Planschritte zählen als Fehlschlag. Fortschritt = Bedingungsfortschritt oder Planfortschritt.
- **Wechsel:** `agent.goal_changed` mit altem/neuem Zustand, Grund und ggf. ersetztem Ziel. Zielpersistenz bestimmt, wie lange ein Ziel ohne Fortschritt bleibt (180 Minuten × (0,6 + Zielpersistenz/100)).
- **Spiegelung:** jedes kurzfristige Ziel steht als Absichts-Erinnerung („Mein Ziel: …“, offen/erledigt/aufgegeben) im Gedächtnis (AP05) und überlebt Neustarts.

## Bedürfnisse und Stimmung (`needs.py`, `mood.py`)
- Energie, Hunger, Durst kommen vom Körper der Welt-Engine; Geselligkeit, Ruhe und Wärme sind Zustand des Agenten (`agent_needs`, Dringlichkeit 0–100): Geselligkeit steigt allein (5/Std.) und sinkt zusammen und im Gespräch; Ruhe steigt im Gespräch und bei Sturm, sinkt allein (schneller an ruhigen Orten); Wärme (standardmäßig **aus**) steigt draußen bei Regen, Sturm, Schnee und Nacht, sinkt drinnen und am Feuer.
- **Jedes Bedürfnis ist einzeln schaltbar** (`NeedParams.enabled`, in AP07 in der Oberfläche). Ein ausgeschaltetes taucht **weder in der Bewertung noch im Prompt noch in der Stimmung** auf (Tests).
- Kritische Schwelle (Energie unter 15, sonst ab 80–90) erzeugt einen dringenden Anlass: Zeile „Dringend: …“ im Prompt und Pflichtoptionen (Essen, Trinken, Schlafen).
- **Stimmung** −1 … +1 aus Grundstimmung, Bedürfnissen, den letzten sechs Erfolgen und Misserfolgen und dem Gesprächsverlauf, dazu ein Wort („zufrieden“, „ausgeglichen“, „etwas matt“, bei starker Ursache „erschöpft“, „gereizt“, „einsam“ …). Die Beiträge stehen einzeln in der Oberfläche.

## Beziehungen (`relations.py`)
Je Richtung getrennt: Vertrauen, Sympathie, Spannung, Vertrautheit (0–100), gemeinsame Erlebnisse und offene Konflikte. Änderungen **nur durch Regeln aus Ereignissen** (angenommener/abgelehnter Vorschlag, Geschenk, Gespräch, Gesprächsschleife) und durch Reflexionen (höchstens ±2 je Kennzahl, nur zu Personen, die in den Quellen vorkommen). Regelgewinne sind auf 8 je Kennzahl und Simulationstag begrenzt, Spannung klingt stündlich ab. Jede Änderung hat einen Grund (`relation_log`) und meldet `agent.relation_changed` (Sichtbarkeit `system`). Kein Zielzustand, keine Drehbuchvorgabe.

## Bewertung (`scoring.py`, `factors/*.py`)
Jede gültige Option bekommt die **Summe benannter Faktoren**; sie stehen 1:1 im Entscheidungsprotokoll. Klartextnamen und Gruppen (Spezifikation):

| Gruppe | Faktoren (Klartextname im Protokoll) | Quelle |
|---|---|---|
| `base` | Grundneigung, Weg, Schon genug dabei | Art der Option, Entfernung, Vorrat |
| `goal_progress` | Ziel, Persönliche Ziele, Interessen, Abneigungen, Passt zu Zielen und Interessen des Ortes | aktives Ziel (Planschritt oder Bedingung), Profil |
| `need_relief` | Müdigkeit, Erschöpfung, Hunger, Durst, Bedürfnis Geselligkeit, Wärme | Bedürfnisse (nur eingeschaltete) |
| `exploration` | Neugier, Interessantes Objekt | Neugier der Persönlichkeit |
| `social` | Geselligkeit, Gesprächsinitiative, Gesprächslänge, Beziehung | Persönlichkeit, Sympathie und Vertrautheit |
| `calm` | Ruhebedürfnis, Bedürfnis Ruhe | Persönlichkeit, Ruhebedürfnis |
| `helpfulness` | Hilfsbereitschaft | Persönlichkeit |
| `cooperation` | Kooperation | Persönlichkeit |
| `risk` | Risikobereitschaft, Nacht, Wetter | Risikobereitschaft |
| `conflict` | Konfliktbereitschaft, Spannung | Persönlichkeit, Spannung zum Gegenüber |
| `proposal_accept` | Annahmebereitschaft, Vertrauen | Persönlichkeit, Vertrauen |
| `plan_stick` | Vorhaben, Planbindung | Zielpersistenz × Spontaneität |
| `autonomy` | Eigeninitiative | eigenes Vorhaben statt Reaktion |
| `repetition_penalty` | Wiederholung, Gleiche Art wie zuletzt, Zu oft gewartet, Gesperrt | Aktionshistorie, Sperren |
| `failure_penalty` | Zuletzt gescheitert | `failed_actions` (letzte 4 Stunden) |

Spontaneität vergrößert eine **kontrollierte Zufallskomponente** (fester Seed je Simulation und Zeit). Die Zuordnung steht auch unter `GET /api/factors`. **Wirkung der Persönlichkeit:** für jeden der zwölf Werte (die neun aus AP02 plus Zielpersistenz, Spontaneität, Autonomie) gibt es einen Richtungstest (`tests/autonomy/test_factors.py`).

## Schutzmechanismen (`guards.py`, §15)
| Problem | Erkennung | Reaktion |
|---|---|---|
| Wiederholte Aktion | gleiche Aktion und Ziel 3× in den letzten 6 Entscheidungen | Abwertung, dann **Sperre** 60 Minuten (die Option wird nicht mehr angeboten); Ereignis |
| Gesprächsschleife | Ähnlichkeit der Beiträge (AP02) | Gespräch endet, Ereignis, beide merken „drehte sich im Kreis“, kleine Abwertung der Sympathie |
| Festgefahrener Plan | 3 Planschritte in Folge gescheitert **oder** kein Fortschritt über die Zeitgrenze | 1. Neuplanung (derselbe Weg anders), 2. Alternativziel, 3. Ziel aufgegeben; **drei aufgegebene Ziele in Folge: Ruhemodus** |
| Fehlerhafte Antworten | 3 unbrauchbare Antworten in Folge | Ruhemodus 30 Minuten |
| Zu viele Aufrufe | Rate-Limit (AP02) | Entscheidung verschoben |
| Verbrauch ohne Fortschritt | wie „kein Fortschritt“ des Ziels | Ziel überprüft, ggf. Ruhemodus |
| Widersprüchliche Ziele | **entfällt**: es gibt höchstens ein aktives kurzfristiges Ziel | – |

Jede Auslösung ist ein Ereignis `agent.guard_triggered`. Fehlschläge (`failed_actions`: Aktion, Parameter, Ablehnungscode, Text, Ort, Ziel) sind im Agenten-Detail und im Protokoll (Filter „Fehlschläge“) einsehbar. Zielsetzung und Reflexion laufen mit niedriger Priorität (nicht, solange ein Agent auf eine Entscheidung wartet; bei drei Fehlschlägen in Folge sofort).

## Entscheidungsprotokoll und Erklärung (`explain.py`, §13)
Jede Entscheidung speichert strukturiert (`decisions.trace`): aktives Ziel und Planschritt, Abruf (ID), Optionen mit Faktoren und Punkten, Wahl, **Platz der gewählten Option** und ob sie die bestbewertete war, Stimmung, Faktorgruppen, Ergebnis (ausgeführt/abgelehnt mit Code). Der **Erklärtext entsteht per Vorlage aus diesen Daten** („Alex entscheidet sich für «…», weil es das Ziel «…» voranbringt (Planschritt …) (+26,0) und Neugier mitspielt (+14,0), obwohl es dunkel ist (−9,0).“), ohne Pronomen für den Agenten und ohne Zahlen, die nicht im Protokoll stehen (Test). War die gewählte Option nicht die bestbewertete, steht auch das da. Das `intent`-Feld des Modells erscheint getrennt als „Vom Agenten genannter Zweck“.

## Schnittstellen
`GET /api/overview` (Ziele, Stimmung, Bedürfnisse aller Agenten), `/api/agents/{id}/goals`, `/needs`, `/relations`, `/failures`, `/decisions`, `GET /api/decisions/{id}`, `GET /api/factors`; Ereignisse `agent.goal_changed`, `agent.relation_changed`, `agent.guard_triggered`, `agent.decision` (zusätzlich `why`, `rank`, `goal`, `retrieval_id`). Siehe [schnittstellen.md](schnittstellen.md).
