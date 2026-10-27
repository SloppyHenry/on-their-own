# AP17c – Modelle im Tool und Install-Skript

Teilpakete: [17c-1 Install-Skript](#ap17c-1--install-skript) · [17c-2 Hardware und Katalog](#ap17c-2--hardware-erkennung-und-live-modellkatalog) · [17c-3/-4 Download, Laufzeit, Probelauf, Oberfläche](#ap17c-3-und--4--modellverwaltung-im-tool)

# AP17c-1 – Install-Skript

Plan: [AP17c-plan.md](../arbeitspakete/AP17c-plan.md). Mockup: [modelle.html](../mockups/modelle.html) (Reiter „Install-Skript“). Handbuch: [installation.md](../installation.md).

## Gebaut
- *(18.10.2026 aufgeteilt: `install.sh` enthält Schalter, Hilfen und `main`; die Schritte stehen in `scripts/install/{machine,runtime,model,services}.sh`, damit keine Datei über 400 Zeilen liegt. Verhalten unverändert.)*
- `install.sh` im Projektordner: sieben Schritte wie im Mockup (Rechner prüfen, Voraussetzungen, Projekt, llama.cpp, Modell, Dienst, Fertig mit Selbsttest). Läuft mit der bash 3.2 von macOS. Schalter `--yes`, `--dry-run`, `--no-model`, `--no-llm`, `--headless`, `--model`, `--update`, `--uninstall`, `--purge`.
- `scripts/start.sh`: Modell und Simulacra im Vordergrund, wenn man keinen Dienst will.
- `backend/simulacra/data/models.json`: kuratierte Modelle (Qwen3-4B, -8B, -14B in Q4_K_M, Dateinamen und Größen gegen Hugging Face geprüft).
- Hardware: NVIDIA über `nvidia-smi` (VRAM, CUDA-Version), Apple Silicon über `sysctl` (zwei Drittel des gemeinsamen Speichers), Vulkan an den Treiberdateien, sonst Prozessor.
- llama.cpp: nimmt die offiziellen Releases von `ggml-org/llama.cpp` (heute als Vorabversionen `bNNNNN` markiert, deshalb nicht `/releases/latest`), wählt die erste passende Datei mit Rückfall (CUDA 13.4, CUDA 12.8, Vulkan, Prozessor), prüft den `digest`, entpackt, probiert `llama-server --version` und nimmt bei Fehler den nächsten Kandidaten. Ältere Versionen werden aufgeräumt.
- Modell: größtes Modell der Liste, das in den nutzbaren Speicher passt; Download fortsetzbar, SHA-256 aus der Hugging-Face-API.
- `backend/.env`: nur ein eigener, markierter Block; eigene Einträge außerhalb gehen vor. `--headless` erzeugt `SIM_ACCESS_TOKEN` und `SIM_HOST=0.0.0.0`.
- Dienste: `systemd --user` (Linux) und `launchd` (macOS) für das Modell und für Simulacra; Standard ja bei `--headless`, sonst nein.

## Geprüft
- **Echter Lauf** auf diesem Mac (Apple M1, 16 GB) in einer frischen Kopie: Backend-Umgebung und Oberfläche gebaut, llama.cpp b11714 (Metal) geladen und geprüft, Qwen3-4B (2,5 GB) geladen, Prüfsumme stimmt, `backend/.env` geschrieben. Danach `scripts/start.sh`: `llama-server` meldet gesund, `/api/health` der App zeigt das Modell als erreichbar und verfügbar. Eine Anfrage mit `json_schema` und ohne Denken dauerte 2,9 s bei etwa 20 Token/s. **Nicht geprüft:** `launchd`-Dienste auf dem Mac, `--uninstall`, Linux mit CUDA **und** eigenem Modell (thirdtux hat dafür keinen freien Grafikspeicher).
- **Tests:** `backend/tests/test_install_script.py` (13): Syntax, shellcheck, Auswahl der llama.cpp-Datei und des Modells für Mac, NVIDIA (CUDA 12 und 13), Prozessor ohne Grafik, knappen Speicher, `--model`, `--no-llm`, `--headless`, nicht unterstützte Systeme, Leerzeichen im Pfad, Rückgriff auf das vorige Release.
- Gefunden und behoben beim Testen: ein Absturz durch `pipefail` bei der Token-Erzeugung, ein Rückgabewert der Aufräumschleife, eine Kopie ohne `backend/simulacra/data`.

## Lauf auf thirdtux (17.10.2026, `ssh thirdtux`, Ubuntu, RTX 3060 12 GB, 16 GB RAM)
- Auf der Karte lief schon ein anderer Dienst (Qwen3.6-35B-A3B auf Port 8080, 10,4 von 12 GB belegt, mit API-Schlüssel). Das Skript hätte ohne Korrektur den **gesamten** Grafikspeicher gerechnet und ein 8B- oder 14B-Modell daneben starten wollen. Jetzt zählt es den **freien** Speicher, warnt („Grafikkarte belegt, nichts wird beendet oder verdrängt“), schlägt nur das kleinste Modell mit Standard „nein“ vor.
- Installiert wurde deshalb **nur die App** (`./install.sh --yes --headless --no-llm`): `uv` und Node 24 im Benutzerordner, Backend und Oberfläche, Dienst `simulacra.service` (systemd --user, mit linger). Läuft auf `http://thirdtux:8090`, **ohne Zugangsschutz** (Vorgabe: Token standardmäßig aus; `--token` schaltet ihn ein). Der andere Dienst und seine Grafikkartenbelegung blieben unberührt.
- Es ist noch **kein Modell** für Simulacra eingerichtet (Standardadresse zeigt auf maintux, offline).
- Auf dem Weg gefundene und behobene Fehler: (1) ein zweiter Lauf löschte das Zugangs-Token (Block wurde ohne Token neu geschrieben; Test `test_zweiter_lauf_behaelt_das_token`), (2) `thirdtux` löst nur zu IPv6 auf, der Server lauschte aber nur auf IPv4 (jetzt `::` bei vorhandenem IPv6), (3) die Speicherrechnung ignorierte belegte Grafikkarten.

## Einschränkungen
- CUDA-Auswahl nach der Treiberversion von `nvidia-smi`; bei einem Fehler fällt das Skript auf Vulkan und Prozessor zurück. Auf einer echten NVIDIA-Karte ungetestet.
- Die Liste kuratierter Modelle ist klein; die Live-Liste von Hugging Face kommt mit AP17c-2. Der Probelauf mit dem Messprompt (Siegel) kommt mit AP17c-3.
- Das Backend startet das Modell noch nicht selbst; das tun die Dienste oder `scripts/start.sh`.


# AP17c-2 – Hardware-Erkennung und Live-Modellkatalog

Stand 18.10.2026. Plan: [AP17c-plan.md](../arbeitspakete/AP17c-plan.md) (Bausteine 1, 2). Schnittstelle: [schnittstellen.md](../schnittstellen.md#hardware-und-modellkatalog-ap17c-2).

## Gebaut
- `backend/simulacra/models/`: `hardware.py` (Erkennung, Parser), `fit.py` (Passung, Zeitschätzung, Namen), `rank.py` (Standarddatei, Rangfolge, Empfehlung), `curated.py` (`models.json`), `filters.py`, `hf.py` (Hugging-Face-Client mit 6-h-Zwischenspeicher in `data/models/cache/`), `catalog.py` (Zusammenführung), `__main__.py` (Kommandozeile).
- API: `GET /api/hardware`, `GET /api/models/catalog` (`api/routes_models.py`, `api/models_llm.py`); Typen wurden mit `scripts/gen_types.sh` erzeugt.
- **Eine Wahrheit für die Passung:** `install.sh` rechnet die Modellwahl nicht mehr selbst, sondern ruft `python -m simulacra.models recommend --shell` mit den erkannten Werten auf (Kern nur Standardbibliothek, läuft auch mit dem System-Python 3.9 des Macs; geprüft). Die Erkennung selbst steht für die Wahl der Laufzeit weiter in der Shell; ein Test vergleicht den nutzbaren Speicher beider Rechnungen. `models.json` hat dafür kein `min_gb` mehr, sondern `params_b`, und die Herausgeber-Positivliste.
- Entscheidung zur CLI (optional im Auftrag): **gebaut**, weil sie klein war (107 Zeilen) und sonst zwei Rechnungen auseinanderlaufen. Die Live-Liste im Skript (`catalog`) ist bewusst **nicht** angeschlossen: das Skript empfiehlt weiter aus der kuratierten Liste (geprüft), das Tool zeigt zusätzlich die Live-Liste.

## Entscheidungen im Detail
- **Zahlen aus dem Mockup** (`modelle.html`): Stufen 70/90/100 %, Schätzung Token/s = Bandbreite ÷ aktive Größe × Wirkungsgrad, 90 Token + 1,2 s. Abweichungen: Der Kontext-Speicher kommt aus den Parametern (statt pauschal 0,9 GB), der Wirkungsgrad ist **0,7** statt 0,55 (zwei Messpunkte: M1 mit Qwen3-4B 20 Token/s gegen 29 rechnerisch = 0,69; RTX 3060 mit 9B-Q8 35 gegen 38 = 0,9; mit 0,55 wäre die Schätzung auf beiden zu pessimistisch). Die Bandbreiten der Tabelle (Apple M1 bis M4, gängige GeForce-Karten) sind Herstellerangaben aus dem Gedächtnis eingetragen, **nicht gemessen und nicht gegen eine Quelle geprüft**; unbekannte Karten bekommen einen Richtwert, `bandwidth_known` ist dann `false`.
- **KV-Cache** ≈ 120 + 4,5 × Milliarden Parameter KB je Token: an den Dichtemodellen von Qwen3 (4B/8B 144 KB, 14B 160 KB, 32B 256 KB) abgelesen, überschätzt Mischmodelle mit wenigen KV-Köpfen (sicher statt knapp). Nicht gegen reale Messungen des Speicherbedarfs geprüft.
- **Filter:** Die Trendliste vom 18.10.2026 enthielt unter 40 Einträgen Bildmodelle (Qwen-Image), Embedding-, Vision-Modelle (MiniCPM-V, Nemotron-VL), Merges und LoRA-Adapter. Wichtig: `pipeline_tag` allein reicht nicht. Die aktuellen allgemeinen Modelle (Qwen3.8, Gemma 4, Nemotron) tragen `image-text-to-text` oder gar keinen Tag, sind aber Textmodelle mit optionalem Bildteil (`mmproj`). Sie bleiben deshalb drin, mit Kennzeichnung `multimodal`; nur Namen/Architekturen von reinen Vision-Modellen (`-VL-`, `qwen3vl`, `MiniCPM-V` …) fliegen raus. Geladen würde nur die Textdatei. **Frage 44** in `offene-fragen.md`.
- **Gesperrte Modelle** (`gated` ≠ `false`) erscheinen gekennzeichnet (`downloadable: false`), zuletzt in der Liste und nie unter „Empfohlen“. Bei ihnen maskiert Hugging Face die Prüfsumme (`********`); sie bleibt `null`.
- **Herausgeber** (Standard `publishers=trusted`): Qwen, unsloth, bartowski, ggml-org, lmstudio-community, google, mistralai, meta-llama, microsoft, nvidia, LiquidAI, JetBrains, HuggingFaceTB, ibm-granite, allenai, deepseek-ai, zai-org (Liste in `models.json`). Mit `publishers=all` erscheint alles Passende (Frage 39), „unzensiert“ ist nur ein Hinweis (`uncensored`), keine Vorauswahl.
- **Rangfolge:** ladbar vor gesperrt, bessere Passungsstufe, kuratierte vor Live-Modellen, größeres vor kleinerem, dann Downloads. „Empfohlen“ sind bis zu drei Modelle der besten Stufe, die es gibt. Die Standarddatei eines Repositories ist die erste in der Reihenfolge Q4_K_M, Q4_K_S, Q4_K_XL, IQ4_XS, Q4_0 … Q8, die noch passt.
- **Zwischenspeicher:** je Adresse 6 Stunden, unabhängig vom Rechner. Bei Netzfehler gilt ein älterer Eintrag (`source: "stale"`), ohne alles die kuratierte Liste (`curated`). 404, 401 und 403 werden ebenfalls gespeichert (sonst fragt jeder Abruf erneut nach gelöschten oder gesperrten Repositories). Nicht rekursiv gelesen werden Unterordner der Dateiliste (geteilte Modelle, MTP); geteilte Dateien (`-00001-of-0000N`) fallen raus.
- **Abfragen je Abruf:** 1 Trendliste, je 1 pro Herausgeber, bei `q` eine Suche, dazu höchstens 80 Dateilisten (Obergrenze `MAX_TREES`; überzählige stehen unter `hidden`). Mit `only_fit=true` entfallen Dateilisten für Modelle, die schon nach der Parameterzahl nicht passen.
- Der Test `test_k14` verbot bisher jede Erwähnung von `huggingface.co` im Code; jetzt verboten bleiben nur dessen Inferenz-Endpunkte (`api-inference`, `router`, `inference`). Die Seite ist ab AP17c Quelle für Modelllisten und -dateien, kein Endpunkt, der Anfragen beantwortet.

## Geprüft
- **Tests:** `backend/tests/models/` (81): Parser mit den aufgezeichneten Ausgaben von `nvidia-smi` (thirdtux, belegte RTX 3060: 749 von 12288 MB frei) und `sysctl` (M1, 16 GB), mehrere Karten, kaputte Zeilen, fehlendes `nvidia-smi`, AMD über sysfs, Vulkan, Windows; Passung an den Grenzen (genau 70/90/100 %); Filter gegen die aufgezeichnete Trendliste; Katalog-Zusammenführung, Zwischenspeicher (frisch, abgelaufen, `refresh`, kaputt, rechnerunabhängig), Netzfehler (kein Netz, 429/500/503, älterer Zwischenspeicher), gesperrte Modelle, Obergrenze, Suche; API (Form, Parameter, 422, Netzausfall, Zugangsschutz); CLI und Gleichheit mit der Shell-Rechnung. Fixtures: echte Antworten von Hugging Face (18.10.2026) unter `tests/fixtures/models/`, `tests/fixtures/hardware/`. Kein Test braucht das Netz.
- **Probelauf gegen das echte Hugging Face** (Mac, Apple M1, 16 GB, 18.10.2026, laufender Server): `GET /api/hardware` → Metal, 16 GB, 10 922 MB nutzbar, 168 GB frei. `GET /api/models/catalog` → `source: live`, nach 2,5 s (kalter Zwischenspeicher), Empfohlen: **Qwen3-8B Q4_K_M** (passt gut, ≈ 10 s je Entscheidung), Qwen3-4B, MiMo-V2.6-Distill-Qwen-9B; ausgeblendet: 58 Herausgeber nicht auf der Liste, 42 kein Textmodell, 18 Vision, 2 Adapter, 13 ohne Q4–Q8-Datei. `./install.sh --dry-run --yes` auf demselben Mac empfiehlt **dieselbe Datei**: Qwen3-8B Q4_K_M, passt gut.
- **Nicht geprüft:** NVIDIA-Karte mit mehreren GPUs und AMD-Karten nur mit Beispielzeilen aus dem Test (kein echter Rechner); die Schätzung der Zeit je Entscheidung nicht gegen eine Messung auf diesem Rechner (nur gegen die beiden oben genannten Messpunkte); die Antwortzeit bei kaltem Zwischenspeicher unter schlechtem Netz; die Obergrenze von Hugging Face für Anfragen ohne Anmeldung (bei 80 Dateilisten + 18 Listen je Aktualisierung bisher nie erreicht, nicht gezielt geprüft). Keine Änderung auf thirdtux und maintux.

## Einschränkungen
- Der erste Abruf nach 6 Stunden braucht ein paar Sekunden (gemessen: 2,5 s); er blockiert die Anfrage. Ein Hintergrundabruf kommt bei Bedarf mit der Oberfläche (17c-4).
- Modelle, die nur aus geteilten Dateien bestehen (große Q8-Modelle), fehlen in der Liste.
- `models.json` führt kein Siegel „geprüft“ mit Messwerten; das kommt mit dem Probelauf (17c-3).


# AP17c-3 und -4 – Modellverwaltung im Tool

Stand 19.10.2026, Branch `ap/17c-modelle` (von `ap/17b-simulation-definieren`, nicht committet bis zur Abnahme). Plan: [AP17c-plan.md](../arbeitspakete/AP17c-plan.md). Mockup: [modelle.html](../mockups/modelle.html) (am 19.10. abgenommen). Schnittstelle: [schnittstellen.md](../schnittstellen.md#modellverwaltung-ap17c-3--4).

## Gebaut
- **Download** (`models/transfer.py`, `download.py`): nur nach Bestätigung (`confirm: true`), nur HTTPS von `huggingface.co`/`hf.co` (Weiterleitungen werden von Hand verfolgt und jeder Schritt gegen die Liste geprüft), Dateiname, Größe und SHA-256 holt das Backend selbst aus der Dateiliste, fortsetzbar (`Range`, `.part`), Verbindungsabbruch setzt bis zu dreimal fort, Platzprüfung Größe + 10 %, ein Auftrag zugleich, Prüfsumme vor dem Umbenennen, Abbruch räumt die Teildatei weg.
- **Laufzeit** (`models/runtime.py`, `service.py`): `llama-server` als Kindprozess auf freiem Port an 127.0.0.1, Kommandozeile wie im Install-Skript, `/health`-Prüfung, Absturzmeldung mit Protokollzeilen, Stopp beim Beenden. Zwei Betriebsarten, gespeichert in `data/llm.json`; `SIM_LLM_BASE_URL` gewinnt (dann fest „Externer Server“). Die Laufzeit folgt der Simulation (Start, Zurücksetzen, neue Simulation, Laden).
- **Laufzeit installieren** (`models/llamacpp.py`): Python-Fassung der Dateiwahl aus `scripts/install/runtime.sh`, Prüfsumme aus dem `digest`, sicheres Entpacken, Programmprüfung, nächster Kandidat bei Fehler, ältere Versionen werden entfernt.
- **Probelauf** (`models/probe.py`, `probe_data.py`): zehn Entscheidungen mit dem Messprompt aus AP00 (`scripts/probe_llm.py` liest die Daten jetzt von dort), Siegel geprüft / mit Einschränkung / ungeeignet, Ergebnis in `data/models/probes.json`.
- **API/WebSocket:** `GET/PUT /api/llm`, `POST /api/llm/{test,runtime/install,start,stop}`, `PUT /api/llm/default`, Downloads, Löschen, Probelauf; WebSocket-Nachricht `models`. Typen neu erzeugt.
- **Oberfläche** (`frontend/src/models/`): Einstellungen → **Modelle** (Hardware, Betriebsart mit Laufzeit und externer Adresse, Fortschritt, Probelauf, Installiert mit Siegel, Empfohlen, Suche mit „nur passende“ / „alle Herausgeber“ / „Liste aktualisieren“, Bestätigungsfenster mit Datei, Quelle, Größe, Platz). Automatischer Probelauf nach dem Laden (Frage 42), wenn der Browser das Ende miterlebt. Das **Zurücksetzen-Fenster** und der Schritt **Modell** im Assistenten bieten im eingebauten Betrieb die installierten Modelle mit Siegel an und wählen das „Standard für neue Simulationen“ vor; „Modelle verwalten …“ führt zur Seite.

## Geprüft
- **Backend:** 93 neue Tests in `backend/tests/models/` (Übertragung: Host-Liste, Weiterleitung auf fremden Host, Fortsetzen, Server ohne `Range`, Verbindungsabbruch; Download: Prüfsumme, Abbruch, Platz, gesperrt, ungültige Namen; Laufzeit mit einem **echten Kindprozess** (falscher `llama-server` auf einem Port: Start, langsames Laden, Wechsel, Absturz, Zeitüberschreitung, Abbruch beim Start); llama.cpp-Auswahl je Rechner und Einrichten inklusive Archiv mit Pfad nach draußen; Probelauf-Grenzen; API: Bestätigungspflicht, Idempotenz, Betriebsart, feste Adresse, Folgen für Zurücksetzen, Autostart, WebSocket-Fortschritt). **Gesamtlauf 19.10.2026:** pytest 1349 bestanden (1 übersprungen, 3 abgewählt), Vitest 175, Playwright 104 (davon 10 neu), Typen aktuell.
- **Oberfläche:** Vitest (Store, automatischer Probelauf, WebSocket-Nachricht, Anzeigehilfen), Playwright `modelle.spec.ts` (10 Tests gegen das echte Backend mit kleinen Dateien, falschem `llama-server` und fester Hardware aus `scripts/e2e_models.py`; kein Netz).
- Beim Bauen gefunden und behoben: ein Spielstand-Laden mit unbekannter Kennung scheiterte an meinem neuen Aufruf (jetzt nur, wenn die Metadaten lesbar sind); `aiter_bytes` verwarf bei einem Abbruch bis zu 1 MB Gepuffertes (jetzt `aiter_raw`, Fortsetzen verliert nichts); die bestehende Browser-Prüfung nach dem Reiter „Modell“ traf auch „Modelle“ (jetzt `exact`).

## Nicht geprüft
- **Kein Probelauf mit einem echten Modell und keine echten Downloads** (alles gegen Attrappen): weder auf diesem Mac noch auf thirdtux (Grafikkarte durch einen anderen Dienst belegt) noch auf maintux (offline). Das Siegel und die 20-Sekunden-Grenze sind damit nur mit dem falschen Server geprüft.
- „Laufzeit installieren“ gegen die echten GitHub-Releases (Dateinamen und `digest` kommen aus dem Skript, dort an der echten API geprüft, hier nur mit nachgebauten Antworten).
- Der Fall „Eingebaut“ auf einem Rechner, den `install.sh` mit Modelldienst und `SIM_LLM_BASE_URL` eingerichtet hat: dort bleibt die Betriebsart fest „Externer Server“ (Fragen 50, 51).
- Mehrere Browser gleichzeitig; sehr lange Downloads über Stunden; Rechte von `llm.json` auf anderen Systemen als macOS.

## Einschränkungen
- Gesperrte Modelle (Anmeldung) sind gekennzeichnet, nicht ladbar (Frage 43). Modelle aus geteilten Dateien fehlen (wie in 17c-2).
- Nach dem Absturz eines Modells startet das Tool es nicht neu; die Oberfläche zeigt Fehler und Protokollzeilen, „Starten“ versucht es erneut.
- Die Wahl des Modells wirkt auf die Simulation erst beim Zurücksetzen/neuen Anlegen; wer von Hand ein anderes Modell startet, während die Simulation ein anderes gespeichert hat, sieht in der Kopfzeile „Modell nicht verfügbar“ (Frage 10 bleibt: das Modell gehört zur Simulation).

