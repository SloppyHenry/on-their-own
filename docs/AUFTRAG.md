# Projekt SIMULACRA – Auftrag (Originaltext)

Autonome KI-Agenten in einer interaktiven, persistenten Simulation.
Dieser Text ist die verbindliche Vorlage. Die Umsetzung ist in `ARBEITSPAKETE.md` in Pakete geschnitten.

## 1. Rolle und Auftrag
Erfahrener Softwarearchitekt, Full-Stack-Entwickler, KI-Agenten-Forscher und UI/UX-Designer.
Entwickle eine vollständige, lokal ausführbare Multi-Agenten-Simulation, inspiriert von „Generative Agents: Interactive Simulacra of Human Behavior“ (Stanford).
Zwei autonome KI-Agenten (ein männlicher, ein weiblicher Charakter) in einer gemeinsam bewohnten virtuellen Welt. Eigene Persönlichkeiten, Erinnerungen, Ziele, Bedürfnisse, Handlungsmöglichkeiten. Sie kommunizieren, erkunden, entwickeln gemeinsame Aktivitäten, erleben Konflikte, bauen Beziehungen auf und organisieren sich im Rahmen ihrer Möglichkeiten eigenständig.
Der Benutzer beobachtet, konfiguriert und beeinflusst die Simulation im Webbrowser.
**Wichtig:** funktionierende Anwendung, kein statischer Prototyp. Alle dargestellten Zustände, Schaltflächen, Slider, Ereignisse und Aktionen müssen mit der Simulationslogik verbunden sein.

## 2. Technischer Rahmen
Lokaler Linux-Rechner mit NVIDIA RTX 3060 / 12 GB VRAM.

**Backend:** Python 3.12 oder kompatibel; FastAPI (HTTP + WebSocket); Pydantic; SQLite (Weltzustand, Erinnerungen, Ereignisse); asynchrone Aufgabensteuerung; austauschbare LLM-Schnittstelle für lokale Inferenz.

**KI-Anbindung:** lokales Qwen-Modell der 9B-Klasse; konfigurierbare OpenAI-kompatible API (z. B. llama.cpp Server); keine zwingende Cloud-Abhängigkeit; Modellname, Endpunkt, Timeout, Kontextlänge und Generierungsparameter konfigurierbar; beide Agenten mit getrennten Systemprompts, Gesprächskontexten und Gedächtnissen; Modellgewichte bei gemeinsamer Verwendung nur einmal geladen.

**Frontend:** React + TypeScript; Vite; Tailwind CSS oder vergleichbar; WebSockets für Live-Updates ohne Polling; interaktive 2D-Welt (Phaser oder Canvas); reaktionsfähiges Desktop-Layout.

Konkrete, zueinander passende Bibliotheksversionen wählen und Installation dokumentieren. Unnötige Abhängigkeiten vermeiden. Die Anwendung funktioniert lokal, sobald das lokale LLM erreichbar ist.

## 3. Die simulierte Welt
Kleine, visuell ansprechende, begehbare Welt. Enthält: Wohnhaus mit getrennten Räumen, Garten, Wald, See, zentraler Platz, Wege zwischen den Orten, Ressourcen und interaktive Gegenstände, Tag-Nacht-Zyklus, simulierte Uhr und Kalender.
Eigenständiger, charmanter Stil: Top-down oder leicht isometrisch, animierte Figuren, klar erkennbare Orte, ruhige, atmosphärische Gestaltung.
Figuren navigieren sichtbar. Ortswechsel, Gespräche, Objektinteraktionen und andere relevante Handlungen werden visuell dargestellt.
Jeder Ort und jedes Objekt hat einen tatsächlichen Zustand im Backend, das Frontend spiegelt ihn. Bewegt ein Agent einen Gegenstand, setzt eine Pflanze oder baut ein Objekt, ändert sich die Welt entsprechend. Keine bloße Animation, die eine Aktion suggeriert, ohne dass sie im Weltzustand stattgefunden hat.

## 4. Die beiden KI-Agenten
**Agent A: Alex** (männlich) und **Agent B: Mira** (weiblich). Je eigener Name, Hintergrund, Persönlichkeit, Präferenzen, Ziele, Interessen, Gedächtnis, Bedürfnisse, Stimmung.
Persönlichkeiten im Frontend editierbar. Keine fest vorgegebenen Rollen: Persönlichkeit beeinflusst Entscheidungen, schreibt aber nicht jede Handlung vor.
Sie entscheiden eigenständig: wohin sie gehen, mit wem sie sprechen, welche Aktivitäten sie beginnen, welche Gegenstände sie benutzen, welche Ziele sie verfolgen, ob sie auf Vorschläge des anderen eingehen, ob sie Pläne ändern, welche Erlebnisse erinnerungswürdig sind.
Beziehungen entwickeln sich aus Interaktionen (Freundschaft, Zusammenarbeit, Meinungsverschiedenheit, Aus-dem-Weg-gehen). Weder romantische Beziehung noch bestimmte Geschichte erzwingen. Geäußerte Gefühle sind beobachtbares Agentenverhalten, kein Beweis für subjektives Erleben oder Bewusstsein.

## 5. Autonomer Agentenzyklus
Pro Agent: 1. Zustand wahrnehmen. 2. Relevante Erinnerungen abrufen. 3. Bedürfnisse, Ziele, laufende Vorhaben bewerten. 4. Entscheidung treffen. 5. Strukturierte Aktion ausgeben. 6. Welt-Engine validiert. 7. Ausführen oder begründet ablehnen. 8. Ergebnis wahrnehmen. 9. Bei Bedarf Gedächtnis aktualisieren. 10. Nächste Handlung planen.
Die Welt-Engine ist verbindliche Instanz für den Weltzustand. Die KI schlägt vor, behauptet aber nie selbst Erfolg.
Strukturierte JSON-Antworten oder validierte Tool-Aufrufe; ungültige Ausgaben abfangen, begrenzte Korrekturversuche.
Implementieren: Erkennung wiederholter Aktionen; Abbruchbedingungen für festgefahrene Pläne; Begrenzung gleichzeitiger LLM-Anfragen; Timeouts und Fehlerbehandlung; definierte Priorisierung dringender Ereignisse; kontrollierbare Entscheidungshäufigkeit; nachvollziehbares Aktionsprotokoll.

## 6. Persistentes Gedächtnis
Je Agent eigenes, dauerhaftes Gedächtnis (übersteht Neustarts, SQLite). Kategorien:
- **Episodisch:** konkrete Ereignisse („Heute Morgen hat Mira mit Alex am See gesprochen.“)
- **Fakten und Wissen:** Orte, Gegenstände, Personen, entdeckte Zusammenhänge.
- **Beziehungen:** Beobachtungen zu Interaktionen, Vertrauen, Sympathie, Konflikten, gemeinsamen Erlebnissen.
- **Offene Vorhaben:** Pläne, langfristige Ziele, unerledigte Aufgaben.
- **Reflexionen:** verdichtete Schlussfolgerungen aus mehreren Ereignissen.

Zunächst effiziente Relevanzsuche über Schlüsselwörter, Zeitnähe, Wichtigkeit, beteiligte Personen; semantische Suche optional später. Nicht den ganzen Chat in jeden Prompt: relevante Erinnerungen zusammenstellen, Kontextverbrauch begrenzen.
Frontend zeigt, wann ein Agent eine Erinnerung speichert oder abruft. Detailansicht zum Untersuchen der Erinnerungen beider Agenten.

## 7. Frontend als Simulationsleitstelle
Beobachtungs- und Steuerzentrale, nicht nur Chatfenster neben Animation. Dunkles, ruhiges Design, dezente Akzentfarben, klare Hierarchie, gut lesbare Typografie, keine überladenen Kacheln, keine unnötigen Effekte.

### 7.1 Vier Bereiche
**A. Weltansicht** (größter Bereich): animierte Figuren, Namen und Aktivitäten, sichtbare Ortswechsel, Sprechblasen, Hervorhebung aktueller Interaktionen, anklickbare Orte und Objekte, sichtbarer Tag-Nacht-Zyklus, Zoom und Navigation. Klick auf Agent: Detailpanel (Ziele, Bedürfnisse, Erinnerungen, jüngste Aktivität). Klick auf Ort: dortige Ereignisse und Gegenstände.

**B. Agentenübersicht** pro Agent, aus echtem Simulationszustand: Name und Charakterbild, Aufenthaltsort, Aktivität, kurzfristiges und langfristiges Ziel, Stimmung, Energie und Bedürfnisse, Handlungsstatus, letzte Aktion.

**C. Live-Ereignisprotokoll** chronologisch, z. B. „08:42 – Mira verlässt das Haus.“ Unterscheidung: tatsächliche Weltaktionen, Dialoge, interne Planungsereignisse, Systemmeldungen. Jedes Ereignis anklickbar für Details.

**D. Simulationssteuerung:** Start, Pause, Fortsetzen, Einzelschritt, Zurücksetzen (mit klarer Bestätigung; gespeicherte Simulationen nicht versehentlich überschreiben), Geschwindigkeit, Speichern, Laden.

## 8. Dynamische Parameter mit Slidern
Separates Einstellungsfenster oder aufklappbare Seitenleiste, während des Betriebs. Slider, Schalter, Dropdowns, Eingabefelder. **Jeder Regler steuert einen real implementierten Parameter, keine dekorativen Slider.** Nach Themen gruppiert.

### 8.1 Autonomie und Entscheidungsverhalten
Autonomie (eigene Vorhaben statt nur Reaktion); Planungshorizont; Initiative (eigene Gespräche/Aktivitäten); Spontaneität (Abweichung von Plänen); Entscheidungsintervall; Zielpersistenz; Exploration (unbekannte Orte/Gegenstände). Prozentwerte 0–100 wo sinnvoll, sonst realistische Einheiten und Grenzen.

### 8.2 Persönlichkeit und soziale Interaktion (je Agent)
Geselligkeit, Neugier, Hilfsbereitschaft, Risikobereitschaft, Konfliktbereitschaft, Kooperationsneigung, Bedürfnis nach Ruhe, Gesprächsinitiative, Bereitschaft Vorschläge anzunehmen. Die Werte fließen nachvollziehbar als Verhaltenspräferenzen in die Entscheidungsauswahl ein, nicht nur als Prompttext.
Editierbare Felder: Charakterbeschreibung, Hintergrundgeschichte, Interessen, Abneigungen, persönliche Ziele, Kommunikationsstil.

### 8.3 Gedächtnis und Reflexion
Max. erinnerte Episoden im aktiven Kontext; Abrufschwelle; Gewichtung Wichtigkeit/Aktualität; Reflexionshäufigkeit; Zusammenfassungshäufigkeit; Gewichtung persönlich vs. gemeinsam; Vergessen bzw. Archivieren. Historie wird nie unbemerkt gelöscht, nur weil sie nicht im aktiven Kontext liegt.

### 8.4 Weltregeln und Bedürfnisse
Ressourcenknappheit; Energieverbrauch; Hunger/optionale Bedürfnisse; Geschwindigkeit des Tageszyklus; Ressourcenverfügbarkeit; Kosten und Dauer von Bauaktionen; Anzahl möglicher Gegenstände; Bewegungsfreiheit; Konsequenzen fehlgeschlagener Aktionen. Funktioniert mit freier Exploration und mit Ressourcen/Bedürfnissen. Nicht aktivierte Bedürfnisse schränken die Agenten nicht heimlich ein.

### 8.5 Modell und Inferenz
LLM-Endpunkt; Modellkennung; Temperatur; Top-p; max. Ausgabelänge; Kontextbudget; max. gleichzeitige Anfragen; Timeout; Anzahl Wiederholungsversuche. Zeige echten Verbindungsstatus, Antwortzeiten, Fehler. Änderungen validieren; Einstellungen mit Modellneustart als solche kennzeichnen.

### 8.6 Geschwindigkeit und Systemlast
Geschwindigkeit in Stufen; einstellbare Pausen zwischen Aktionen; Begrenzung der Entscheidungen pro Minute; optionaler Energiesparmodus; Begrenzung paralleler Modellanfragen. Optionale Anzeige: Entscheidungen/min, mittlere Antwortzeit, Tokens/s (wenn verfügbar), Anzahl Aktionen, fehlgeschlagene Aktionen, Simulationsfortschritt. Geschwindigkeit wirkt auf die tatsächliche Ausführung, nicht nur auf Frontend-Animationen.

## 9. Parameteränderungen im Betrieb
Kein Neustart pro Einstellung. Backend validiert und übernimmt, soweit technisch möglich. Beispiele: höhere Autonomie → mehr eigeninitiierte Ziele; höhere Neugier → unbekannte Orte priorisiert; höhere Geselligkeit → mehr freiwillige Gespräche; häufigere Reflexion → anderer Verdichtungsrhythmus; höhere Geschwindigkeit → weniger Pause; veränderte Knappheit → tatsächlich verfügbare Ressourcen.
Sinnvolle Standardwerte und sichere Grenzen. Unterscheide: sofort wirksam / ab nächster Entscheidung / Neustart oder Modell-Rekonfiguration. Übernahmestatus im Frontend anzeigen.
Benannte Presets (Freie Exploration, Soziale Entwicklung, Kooperative Gemeinschaft, Ressourcenknappheit, Hohe Autonomie, Experimentelle Konfiguration); eigene Presets speichern, laden, duplizieren, löschen.

## 10. Freie Texteingabe für Ereignisse und Eingriffe
Permanentes Texteingabefeld, mit dem der Benutzer während der Simulation Ereignisse auslöst, nicht nur feste Knöpfe. Beispiele: „Heute beginnt es zu regnen.“ / „Im Wald wird ein unbekannter Gegenstand entdeckt.“ / „Alex findet eine alte Karte im Haus.“ / „Mira erhält eine Einladung zu einem Fest.“ / „Ein Fremder zieht in das Dorf.“ / „Im Garten taucht ein verletztes Tier auf.“ / „Der Strom im Haus fällt aus.“ / „Beide entdecken eine verschlossene Tür.“ / „Für die nächsten drei Tage sind die Ressourcen knapp.“ / „Mira erfährt, dass Alex gestern allein am See war.“ / „Am zentralen Platz findet morgen ein Markt statt.“ Die Eingabe löst tatsächliche Veränderungen aus.

### 10.1 Ereignisverarbeitung (Ereignis-Controller)
1. Benutzer gibt Ereignis ein. 2. Backend analysiert. 3. Überführung in strukturierte Form. 4. Welt-Engine prüft Gültigkeit. 5. Ausführen oder bei Unklarheit zur Präzisierung zurückgeben. 6. Weltzustand aktualisieren. 7. Betroffene Agenten erhalten die vorgesehenen Beobachtungen. 8. Relevante Erinnerungen aktualisieren. 9. Ereignis erscheint im Live-Protokoll.
Einfache Ereignisse möglichst deterministisch per Regeln. LLM darf komplexe Eingaben interpretieren, aber nicht ungeprüft beliebige Zustandsänderungen ausführen.

### 10.2 Ereignistypen (mindestens)
- **Weltveränderungen:** Wetter, neue Gegenstände, neue Orte, Ressourcenänderungen, Änderungen an Objekten.
- **Persönlich:** neue Aufgaben, Einladungen, Begegnungen, Nachrichten, neue Informationen.
- **Sozial:** gemeinsame Aktivitäten, weitere Figuren, Missverständnisse, Einladungen zu Veranstaltungen.
- **Zeitlich:** Sonnenaufgang, Fest am nächsten Tag, zeitlich begrenztes Ereignis, längere Abwesenheit.
- **Systemeingriffe:** Agent an Ort bewegen, Ziel vorschlagen, Agent vor Situation stellen, Eigenschaft vorübergehend ändern.

Klar unterscheiden zwischen einem Ereignis in der Welt und einer direkten Anweisung an einen Agenten.

### 10.3 Ereignisse sind keine Erinnerungen
„Alex findet eine Karte“ darf nicht nur einen Dialog erzeugen. Die Karte existiert als Gegenstand am definierten Ort. Reine Informationsereignisse definieren, welche Agenten davon erfahren; nicht jeder weiß automatisch alles. „Mira erfährt, dass Alex allein am See war“ ändert die Wissensstände, ohne die Information anderen Figuren offenzulegen.

### 10.4 Ereignis-UI
Am unteren Rand oder in dauerhaft erreichbarer Leiste. Freie Eingabe; Absenden mit Enter; mehrzeilig per Tastenkombination; Vorschläge; Anzeige der Verarbeitung; Bestätigung; verständliche Fehler; optionale Auswahl betroffener Agenten; optionaler Zeitpunkt; optionale Vorschau komplexer Ereignisse. Bei mehrdeutigen Eingaben nachfragen statt eigenmächtig weitreichend ändern.

## 11. Benutzer als Beobachter und Eingreifender
Standard: Agenten handeln selbstständig. Drei Modi:
- **Beobachtermodus:** Agenten erfahren nicht, ob sie betrachtet werden.
- **Schöpfermodus:** Agenten dürfen wissen, dass eine externe Instanz die Welt geschaffen hat; Rolle per Prompt konfigurierbar.
- **Eingriffsmodus:** Benutzer löst jederzeit Ereignisse aus, verändert Situationen, gibt Agenten Informationen.

Die Modi unterscheiden klar, welche Informationen die Agenten erhalten. Moduswechsel verändert das Gedächtnis nicht rückwirkend.

## 12. Live-Kommunikation und WebSocket-Ereignisse
Alle relevanten Zustandsänderungen gehen vom Backend ans Frontend. Einheitliches Event-Schema: Ereignis-ID, Zeitstempel, Simulationszeit, Typ, betroffene Agenten, Ort, Ereignisdaten, optionale Verknüpfung zu vorherigem Ereignis.
Beispiele: `agent.moved`, `agent.action_started`, `agent.action_completed`, `agent.dialogue`, `agent.memory_created`, `agent.memory_retrieved`, `agent.goal_changed`, `world.object_created`, `world.weather_changed`, `world.resource_changed`, `simulation.paused`, `simulation.resumed`, `simulation.parameter_changed`, `simulation.event_injected`.
Doppelte Ausführung bei wiederholten Requests verhindern. Ereignisse eindeutig identifizierbar und debugbar. Nach Browser-Refresh synchronisiert sich die Oberfläche mit dem aktuellen Weltzustand. WebSocket-Ausfälle zerstören die persistente Simulation nicht; Wiederverbindung mit Synchronisierung.

## 13. Beobachtbare Entscheidungsprozesse
Erklärbar ohne vollständige interne Gedankenkette des Modells. Strukturierte Entscheidungsinformationen: verfolgtes Ziel; abgerufene Erinnerungen; erwogene Optionen; beeinflussende Faktoren; gewählte Aktion; Erfolg; Zieländerung.
Beispiel: „Alex entscheidet sich für einen Spaziergang am See, weil sein aktuelles Erkundungsziel aktiv ist und der Ort noch unbekannt ist.“ Die Erklärung wird aus tatsächlichen Zustandsdaten und Entscheidungsmetadaten abgeleitet; keine nachträglich erfundenen Begründungen.

## 14. Speichern, Laden, Analysieren
Gespeichert wird der gesamte relevante Zustand: Positionen, Objektzustände, Ressourcen, Zeit/Kalender, Ziele, Bedürfnisse, Erinnerungen, Beziehungen, laufende Aufgaben, aktive Ereignisse, Konfiguration, Presets, Ereignisprotokoll.
Implementieren: Autosave; manuelles Speichern; benannte Spielstände; Laden; Export/Import eines vollständigen Stands; Ereignisverlauf mit Filtern; Statistiken über Aktionen und Interaktionen. Ein Neustart verliert keinen Spielstand stillschweigend. Rückspulen optional; falls umgesetzt, wird der Weltzustand tatsächlich wiederhergestellt.

## 15. Schutz vor instabilem Verhalten
Schutz gegen: endlose Gesprächsschleifen; Wiederholung derselben Aktion; widersprüchliche Ziele; ungültige Weltaktionen; zu häufige LLM-Aufrufe; unkontrollierte Ereigniserzeugung; explodierende Gedächtnisgrößen; fehlerhafte Modellantworten; Ressourcenverbrauch ohne Fortschritt.
Nachvollziehbare Historie fehlgeschlagener Aktionen. Steckt ein Agent fest: erst erneuter Planungsversuch, bei wiederholtem Scheitern alternativer Plan oder Ruhemodus. Ereigniseingaben werden validiert. Das lokale LLM kann keine beliebigen Betriebssystembefehle ausführen.

## 16. Codequalität und Architektur
Modular. Backend z. B.: `simulation_engine.py`, `world_state.py`, `world_actions.py`, `agent.py`, `agent_memory.py`, `agent_planner.py`, `event_controller.py`, `event_bus.py`, `llm_client.py`, `database.py`, `api.py`, `config.py`.
Frontend z. B.: `WorldCanvas`, `AgentPanel`, `EventTimeline`, `SimulationControls`, `ParameterSidebar`, `AgentSettings`, `WorldSettings`, `MemoryInspector`, `EventComposer`, `ModelStatus`, `PresetManager`.
Struktur darf verbessert werden, wenn begründet. Keine monolithischen Dateien, keine doppelte Geschäftslogik, keine unnötigen Abhängigkeiten. Welt-Engine unabhängig vom LLM testbar. TypeScript-Typen und Backend-Modelle kompatibel.

## 17. Tests und Akzeptanzkriterien
Funktionsfähig erst, wenn erfüllt:
1. Zwei Agenten existieren gleichzeitig in derselben Welt.
2. Getrennte Gedächtnisse.
3. Beide wählen eigenständig Aktionen.
4. Aktionen verändern den Weltzustand tatsächlich.
5. Dialoge erscheinen live im Browser.
6. Ortswechsel sind in der Welt sichtbar.
7. Erinnerungen überleben einen Neustart.
8. Slider verändern nachweisbar die Parameter.
9. Parameteränderungen im Betrieb übernommen.
10. Freie Texteingaben erzeugen validierte, persistente Ereignisse.
11. Agenten erhalten nur zugängliche Informationen.
12. Pause, Fortsetzen, Einzelschritt korrekt.
13. Browser-Refresh stellt den Zustand wieder her.
14. Funktioniert ohne externe Cloud-LLM-API.
15. Ungültige Modellantworten beschädigen den Weltzustand nicht.
16. Ressourcenverbrauch durch definierte Limits kontrollierbar.

Automatisierte Tests für Weltaktionen, Agentenzyklen, Ereignisverarbeitung, Persistenz und WebSocket-Synchronisierung.

## 18. Phasen
1. Grundsystem (Struktur, Backend, DB, Weltmodell, zwei Agenten, LLM-Anbindung, minimaler Zyklus). 2. Browserwelt (2D-Welt, Figuren, Agentenübersicht, Protokoll, WebSocket). 3. Autonomie und Gedächtnis (Ziele, episodisches Gedächtnis, Reflexion, Planung, Schleifenvermeidung). 4. Interaktive Steuerung (Slider, Agenten-/Weltparameter, Gedächtniseinstellungen, Geschwindigkeit, Presets). 5. Ereigniseingabe (Texteingabe, Interpretation, Validierung, Weltveränderungen, gezielte Informationsweitergabe). 6. Stabilisierung (Tests, Fehlerbehandlung, Persistenztests, Performance, Dokumentation).
Nach jeder Phase eine lauffähige Zwischenversion.

## 19. Arbeitsregeln
Zuerst vorhandene Umgebung und Dateien analysieren; nichts ohne Prüfung überschreiben; konkreten Plan erstellen und umsetzen; Abhängigkeiten installieren und testen; keine erfundenen Testerfolge; Projekt bei jedem Schritt ausführbar; keine Platzhalter bei bereits geforderten Funktionen; Vereinfachungen transparent kennzeichnen; alle Konfigurationsparameter dokumentieren; Start- und Stoppskripte; verständliche README mit Installation; Anbindung des lokalen Qwen-Modells dokumentieren; zum Schluss Projektdateien, Startbefehl und echte Testergebnisse zeigen.
