# LLM-Anbindung: Messungen und Standardvariante (AP00)

Gemessen am 10.10.2026 mit `scripts/probe_llm.py` gegen den Router auf maintux (`llama.cpp`-Prism-Fork, RTX 3080, ein Slot, Router-Voreinstellung `reasoning-budget=2048`). Rohdaten: `data/probe/` (git-ignoriert).

**Messprompt:** realistischer Entscheidungsprompt, ca. 480 Tokens (Regeln, Persona Alex oder Mira, Zeit, Ort, Bedürfnisse, Ziel, 4–5 Erinnerungen, 6 Optionen), erwartete Antwort `{option_id, reason, utterance, importance}`. Fünf wechselnde Szenarien, Alex und Mira abwechselnd. Sampling: Router-Voreinstellung (Temperatur 1.0, top-k 20, top-p 0.95).

**Grenzen der Messung:** Die Stichprobe ist klein (20 Durchläufe ohne Denken, nur 4 mit Denken, weil ein Durchlauf bis zu 100 s dauert). Gemessen wurde Formattreue und Zeit, nicht die inhaltliche Qualität der Entscheidungen und Dialoge; die ist erst im echten Agentenzyklus (AP02) beurteilbar.

## Ergebnis: `qwen3.8-9b-uncensored`

| Var | Format | Denken | n | gültig % | strikt JSON % | Gesamt s (Ø / p95) | Ausgabe-Tok | Tok/s |
|---|---|---|---|---|---|---|---|---|
| A1 | nur Prompt | Standard | 4 | 100 | 100 | 30.4 / 69.0 | 624 | 21.4 |
| A2 | nur Prompt | aus | 20 | 50 | 0 | 7.8 / 29.3 | 138 | 21.6 |
| B1 | `json_object` | Standard | 4 | 50 | 50 | 17.0 / 27.8 | 336 | 21.4 |
| B2 | `json_object` | aus | 20 | 80 | 0 | 12.0 / 29.5 | 227 | 21.5 |
| C1 | `json_schema` | Standard | 4 | 100 | 100 | 36.8 / 100.9 | 761 | 21.5 |
| **C2** | **`json_schema`** | **aus** | **20** | **100** | **100** | **5.5 / 7.6** | **88** | **21.6** |
| C3 | `json_schema` | `reasoning_effort: low` | 4 | 75 | 75 | 21.4 / 30.7 | 422 | 21.5 |

„Gültig“ heißt: JSON, Schema erfüllt, `option_id` aus der angebotenen Liste, `importance` ganzzahlig 1–10. „Strikt“ heißt: die Antwort ist als Ganzes parsebar, ohne Markdown-Zäune oder Text drumherum.

Beobachtungen:
- **Ohne Grammatikzwang ist Denken aus unzuverlässig.** A2 und B2 antworten teils in Prosa, ohne JSON oder mit offenem Denkblock (`<think>…` im Inhalt). Der Zwang per `json_schema` löst das vollständig (C2: 20 von 20).
- **Mit Denken ist es 3 bis 7 Mal langsamer** (17 bis 37 s statt 5,5 s), ohne messbaren Gewinn bei der Formattreue.
- **Die Optionswahl streut.** In C2 wurden über die fünf Szenarien 6 verschiedene Optionen gewählt (je 2 bis 4 Mal); die Begründungen beziehen sich auf Ziel und Persönlichkeit.
- **`reasoning_effort: low` (C3)** verkürzt das Denken nur wenig und war in einem von vier Fällen ungültig.
- **Der Router-Wert `reasoning-budget=2048` lässt sich pro Anfrage übersteuern:** `chat_template_kwargs: {"enable_thinking": false}` schaltet das Denken zuverlässig ab (erste Antwort nach 1,5 s). Ein eigener Router-Eintrag ohne Denken ist nicht nötig.
- **Tokengeschwindigkeit** konstant ca. 21,5 Tokens/s.

### Prompt-Cache
Alex und Mira abwechselnd, 6 Anfragen je Aufbau: Prompt-Verarbeitung nach der ersten Runde Ø 95 ms bei 99 % Cache-Anteil, unabhängig davon, ob der gemeinsame Regeltext vor oder nach der Persona steht. **Einschränkung:** Der Test verwendete in jeder Runde dasselbe Szenario; er zeigt, dass der Router die Prompts beider Personen gleichzeitig im Cache hält und der Wechsel nichts verdrängt. Wie viel bei sich ändernden Weltbeschreibungen eingespart wird, hängt vom gemeinsamen Anfang ab. Deshalb gilt weiter die Regel: stabile Teile (Regeln, Persona) vorn, wechselnde Teile (Zeit, Wahrnehmung, Erinnerungen) hinten.

### Modellwechsel
`qwen3.8-9b-uncensored` war entladen; die erste Anfrage dauerte 4,0 s, der Router lädt also schnell. Laut Entscheidung vom 10.10. wird das Modell nur beim Anlegen einer Simulation gewählt, der Wechsel fällt daher nicht im Betrieb an.

## Empfehlung (Standardvariante)

**C2: `response_format` vom Typ `json_schema` (strict, `option_id` als `enum` der gültigen Optionen) plus `chat_template_kwargs: {"enable_thinking": false}`.**
- `max_tokens` 400 für Entscheidungen (gemessen Ø 88, die Schwankung ist gering), Timeout 90 s bleibt als Sicherheitsnetz.
- Die Antwort wird trotzdem mit Pydantic geprüft (Auftrag §5); der Schema-Zwang senkt nur die Zahl der Korrekturversuche.
- Rückfall bei Schema-Fehler vom Server: `json_object` plus Pydantic-Prüfung und ein Korrekturversuch.
- Für schwierige Entscheidungen (Reflexion, Planung, AP05/AP06) kann Denken später gezielt eingeschaltet werden; dort sind 20 bis 40 s je Aufruf einzuplanen.

**Durchsatz:** Ø 5,5 s je Entscheidung bei einem Slot, also höchstens ca. 10 Entscheidungen pro Minute für beide Agenten zusammen (ca. 5 je Agent). Dialogzeilen, Reflexionen und Zusammenfassungen teilen sich denselben Slot. Vorschlag für die Standardwerte in AP02/AP07: Entscheidungsintervall je Agent mindestens 12 s, Geschwindigkeitsstufe 1× entspricht dem Takt, den der Slot hergibt. Die Frage nach einem zweiten Slot (`parallel = 2`) bleibt für die Messungen in AP02 offen (Frage 4).

## Ergebnis: `bonsai2-27b` – derzeit nicht brauchbar

Bonsai erzeugt auf maintux bei den Messprompts nur `////////…` (im Inhalt und, bei eingeschaltetem Denken, schon im Denktext), bis das Token-Limit erreicht ist (ca. 157 s). Bei Schema-Zwang antwortet der Server mit HTTP 500: `Unexpected empty grammar stack after accepting piece: /`.

Was geprüft wurde:
- Mit und ohne Denken, mit `json_object` und `json_schema`, mit `cache_prompt: false`, mit Temperatur 0.6: gleiches Bild.
- Prompt-Teile einzeln (nur Optionsliste, nur Erinnerungen, ohne Umlaute, ohne `/`) und ein harmloser Fließtext-Prompt: gleiches Bild, zeitweise lief ein Fließtext-Prompt aber auch. Es ist also kein Fehler im Prompt und nicht reproduzierbar an einer Prompt-Eigenschaft festzumachen.
- Nach Wechsel auf Qwen 9B und zurück zu Bonsai (frisch geladen): unverändert.
- Dieselben Prompts laufen auf Qwen 9B fehlerfrei.
- Vorversuche mit sehr kurzen Prompts (50–80 Tokens) liefen vorübergehend korrekt (21 Tokens/s).

Auffälligkeiten auf dem Server (nur lesend geprüft): beim Laden meldet der Prism-Fork `fused Gated Delta Net … not supported, set to disabled` und `layer 0 is assigned to device CPU`; die GPU ist mit ca. 9,3 von 10 GB fast voll. Ob ein gemischter CPU/GPU-Betrieb oder ein Fehler der PQ2_0-Kernel die Ursache ist, ist **nicht geklärt**. Änderungen an maintux wurden nicht vorgenommen.

**Folge:** Standardmodell bleibt Qwen 9B. Bonsai wird wieder untersucht, wenn Zugriff auf die Konfiguration von maintux freigegeben ist (z. B. Prüfung der Layer-Verteilung, kleinerer Kontext, ein Lauf mit freier GPU).

## Anderes Modell oder andere Maschine

Die App spricht jeden OpenAI-kompatiblen Endpunkt an (`/v1/chat/completions`, `/v1/models`). Drei Einstellungen genügen (Umgebung, `backend/.env` oder im Container `deploy/.env`):

| Variable | Bedeutung |
|---|---|
| `SIM_LLM_BASE_URL` | Endpunkt, z. B. `http://maintux:8080/v1` oder `http://192.168.178.160:8080/v1` |
| `SIM_LLM_API_KEY_FILE` / `SIM_LLM_API_KEY` | Schlüssel als Datei oder direkt (im Container als Docker-Secret) |
| `SIM_LLM_MODEL` | Vorbelegung für neue Simulationen; muss in `/v1/models` stehen. Eine bestehende Simulation behält ihr Modell (offene Frage 10). |

Voraussetzungen an Modell und Server: JSON-Schema-Zwang (`response_format: json_schema`, bei llama.cpp über Grammatik) oder wenigstens `json_object`; ohne beides steigt die Zahl der Korrekturen stark (Messung oben). Bei Qwen 3.x schaltet `chat_template_kwargs: {"enable_thinking": false}` das Denken ab (`SIM_LLM_THINKING=false`, Standard); andere Modelle ignorieren das Feld. Die Antwortlänge (`SIM_LLM_MAX_TOKENS`, 400) und das Zeitlimit (90 s) passen für 7B–14B-Modelle; größere Modelle brauchen eher ein längeres Zeitlimit.

Seit AP17c lässt sich das auch im Tool einstellen (Menü → Einstellungen → Modelle): Betriebsart **Eingebaut** (On Their Own startet `llama-server` selbst, Modelle von Hugging Face) oder **Externer Server** mit Adresse und Schlüssel; der **Probelauf** dort misst dieselben Dinge wie diese Sondierung (gültige Antworten, Sekunden je Entscheidung, Token/s) mit dem Messprompt von `scripts/probe_llm.py`, aber nur die Standardvariante (Schema, ohne Denken, zehn Anfragen). Eine Umgebungsvariable `SIM_LLM_BASE_URL` geht dem Tool vor. Schnittstelle: [schnittstellen.md](schnittstellen.md#modellverwaltung-ap17c-3--4).

Nach einem Wechsel prüfen: `GET /api/health` (Router erreichbar, Modell bekannt) und einige Entscheidungen im Protokoll ansehen (Anteil gültiger Antworten, Antwortzeit in der Statusanzeige).

### Messung auf SecondTux (12.10.2026)

Router auf SecondTux (RTX 3060, 12 GB), `qwen3.8-9b` (Q8_0), ein Slot, Variante C2. Aus dem Langlauf mit echtem Modell ([status/langlauf.md](status/langlauf.md)): Ø ca. 4 s je Anfrage bei ca. 1440 Prompt- und 115 Antwort-Tokens, ca. 35 Tokens/s, ca. 11 Entscheidungen pro Minute für beide Agenten zusammen, in der ersten Stunde keine ungültige Antwort. Damit ist die 3060 mit dem Q8-Modell etwas schneller als maintux mit dem Uncensored-Modell (Ø 4,5 s, AP02).

## Nicht gemessen
- Die Modelle `qwen3.8-27b-uncensored` und `qwen3-coder-30b-uncensored`.
- Inhaltliche Qualität über viele Entscheidungen hinweg.
- Parallele Anfragen (der Router erlaubt einen Slot).
