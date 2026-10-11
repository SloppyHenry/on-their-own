# Freie Ereigniseingabe (AP08)

Ein Text in der Leiste am unteren Rand wird zu **echten Veränderungen** von Welt und Wissensständen. Nichts davon ist ein bloßer Dialog.

## Ablauf (`backend/simulacra/events_user/`)
```
Text → Regelparser (rules.py) ──erkannt──┐
         │ nein                          │
         ▼                               ▼
   Sprachmodell (interpret.py)     Operationen (schema.py)
   nur im JSON-Schema                    │
         └────────────────────────► Prüfung gegen die Welt (validate.py)
                                          │  Rückfrage ◄─ mehrdeutig
                                          │  abgelehnt ◄─ unmöglich, zu groß, nicht im Katalog
                                          ▼
                              Vorschau (komplex oder vom Modell gedeutet) → Bestätigung
                                          ▼
                    Ausführen in EINER Transaktion (apply.py) → Ereignisse → Beobachtungen → Erinnerungen
```
- **Regelparser** (deutsch, mit Beugungen): Wetter, „X findet Y in Z“, Ressourcen knapp/reichlich, „A erfährt, dass …“, Einladungen und Nachrichten, Nebenfiguren und Tiere, Stromausfall, Situationen („Beide entdecken …“), Veranstaltungen („… findet morgen ein Markt statt“), neue Orte („Hinter dem See liegt eine Höhle“), Anweisungen. Zeiten: „heute“, „morgen“, „um 18 Uhr“, „heute Abend“, Dauern wie „für drei Tage“. Ein Pronomen am Satzanfang („Er findet …“) wird **erfragt**, nie geraten.
- **Sprachmodell** nur für Eingaben ohne sichere Regel. Es antwortet im Schema (Operationen aus dem Katalog, `confidence`, `clarification`). Seine Antwort läuft durch dieselbe Prüfung wie jede Eingabe, und **was es deutet, wird nie ungesehen ausgeführt**: immer erst die Vorschau. Der Text des Benutzers steht im Prompt abgetrennt in Anführungszeichen als Daten.
- **Prüfung:** Namen werden zu Kennungen, unbekannte Orte, Figuren, Objektarten, Zustandsfelder oder Operationen werden abgelehnt, ebenso zu viele Operationen (höchstens 5), Objekt-, Nebenfiguren- (3) und Planungsgrenzen (50). Bei Mehrdeutigkeit („im Haus“: welcher Raum?) kommt eine Rückfrage mit Auswahl.
- **Vorschau** (Klartext je Operation) bei mehreren Operationen, neuen Orten, Nebenfiguren, geplanten Ereignissen, Anweisungen und allem, was das Modell gedeutet hat.

## Operationen (fester Katalog, `schema.py`)
`set_weather`, `spawn_object`, `give_object`, `change_object`, `add_location`, `change_resource`, `inform`, `message` (auch Einladung), `schedule`, `spawn_npc`, `situation`, sowie die **Anweisungen** `move_agent`, `suggest_goal`, `temp_param`. Anweisungen sind nur im **Eingriffsmodus** erlaubt und im Protokoll als Eingriff markiert; Weltereignisse gehen in jedem Modus.

| Operation | Wirkung in der Welt |
|---|---|
| `set_weather` | Wetter mit Dauer, alle nehmen es wahr |
| `spawn_object` | Objekt am Ort; „X findet“ = verborgen und nur X bekannt (`known_by`), X entdeckt es sofort; optional befristet |
| `change_object` | Zustand ändern (Strom aus: `stove.powered=false`, Kochen wird abgelehnt); optional befristet |
| `add_location` | freies Rechteck (6×5) neben dem Anker in der Himmelsrichtung, sonst Ablehnung |
| `change_resource` | Bestand, Obergrenze und Nachwuchs der Quellen mit Faktor; befristet mit genauer Rücknahme |
| `inform` / `message` | nur die Empfänger erfahren es (siehe unten) |
| `schedule` | Eintrag in `scheduled_events`; löst zur Zeit aus, Erzeugtes verschwindet nach der Dauer |
| `spawn_npc` | Nebenfigur (siehe unten) |
| `situation` | Objekt (z. B. verschlossene Tür) und Wahrnehmung bei den genannten Agenten |
| `temp_param` | Parameter befristet ändern (ohne ihn zu speichern), mit Rücknahme |

## Wissensverteilung
`knowledge.deliver` erzeugt je Empfänger ein Ereignis `agent.informed` (Sichtbarkeit nur für ihn). Daraus entsteht über die normale Beobachtungskette eine Erinnerung **nur bei ihm** (Art Fakt, mit Quelle: „von Alex“, „in einem Brief“, je Modus „von der Schöpferinstanz“ oder „als Stimme von außen“, im Beobachtermodus natürlich ohne Quelle). Einladungen schaffen zusätzlich eine offene Absicht mit Termin. Wahrheitsgehalt (wahr, Gerücht, falsch) steht im Ereignis für den Beobachter; der Empfänger weiß ihn nicht, ein Gerücht wird als Gerücht erzählt. Genannte Figuren (`about`) sind für den Abruf der Erinnerung verknüpft.

## Zeit
Tabelle `scheduled_events`: `fire` (Operationen später ausführen) und `revert` (befristete Wirkung mit den genauen alten Werten zurücknehmen). Ausgelöst je Tick auf dem DB-Thread, mit Ereignissen `simulation.event_fired` und `simulation.effect_ended`. Überleben Neustarts.

## Nebenfiguren (vereinfacht, offen gekennzeichnet; Frage 5)
Sichtbare Figuren ohne KI-Profil: **kein eigenes Gedächtnis, keine Ziele, keine Entscheidungen**. Sie gehen regelbasiert zwischen Orten, können angesprochen werden und antworten mit einem kurzen Satz des Sprachmodells aus ihrer Beschreibung (`npc.py`), und gehen nach ihrer Aufenthaltsdauer (Körper und Eintrag werden entfernt). Die KI-Agenten nehmen sie wie jeden Bewohner wahr (sie können mit ihnen sprechen und ihnen etwas geben). Die Oberfläche kennzeichnet sie als „Nebenfigur“.

## Schutz
10 Eingaben je Minute, 1000 Zeichen, Idempotency-Key, höchstens 3 Nebenfiguren und 50 geplante Ereignisse, höchstens 14 Tage im Voraus, höchstens 5 Operationen. Scheitert eine Operation bei der Ausführung, wird das ganze Ereignis zurückgerollt.
