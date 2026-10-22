# AP18h-a2 Handeln (22.10.2026)

**Branch:** `claude/ap18h-a2-handeln` (aus `main` nach a1), nicht gemergt, nicht ausgerollt. Keine Oberfläche, kein Takt (a3).

## Endpunkte (`api/routes_player.py`, neu)
Alle nur in der Spielart „leben“ mit gewählter Figur (`meta.player`), sonst **409** mit Text. Verändernde Aufrufe laufen über den Idempotency-Key wie `/api/sim/*`.
- `POST /api/player/act` `{action, params}`: `engine.propose` auf dem DB-Thread. Antwort `{ok, ends_at, minutes}` oder `{ok:false, code, text}` mit **dem Ablehnungstext der Engine**. Erlaubt sind die Handlungen aus `ALLOWED_OTHER` ohne `speak`; andere: 422.
- `POST /api/player/say` `{to, text}` (1–500 Zeichen): `convs.note_intent` wie im Runner, dann `speak`.
- `POST /api/player/cancel`: `engine.interrupt`; für die anderen ein Abbruch wie jeder andere (`agent.action_interrupted`), ohne Vermerk. Läuft nichts, `ok:false`.
- `GET /api/player/choices`: alles, was `options.generate` der Figur anbietet, jeweils mit `ok` oder `reason` (Text der Engine), `eta`. Ändert nichts: kein Abruf im Gedächtnis, kein Ereignis, keine Entscheidungszeile.

Für Handlungen des Menschen entsteht **kein** `agent.decision` und kein Eintrag in `decisions`. Die Ereignisse der Handlung gehen über das neue `Runner.note_events` durch dieselbe Beobachtungskette wie alles andere.

## Prüfung (`tests/player/test_handeln.py`, 6 Tests; gesamt pytest 1422 grün)
409 (alter Stand, Leben ohne Figur, nach Wechsel auf Gott), 422; Ablehnungen über die Schnittstelle sind Wort für Wort die der Engine (8 Fälle, Codes `busy`, `invalid_target`, `not_here`); kein `agent.decision`, Abbrechen; `choices` ohne Nebenwirkung; Alex spricht Mira an, Mira erfährt genau den Satz, schweigt Alex, endet das Gespräch (`expire`), und in **keinem Prompt des Laufs** kommen „Spieler“, „Mensch“, „gesteuert“, „player“, „Autopilot“, „Leitstelle“ vor.

## Hinweise
- Eine abgelehnte Handlung setzt die Figur in der Engine kurz auf `recover` (gilt für alle Bewohner); danach sind weitere Vorschläge `busy`, bis es vorbei ist oder `cancel` kommt. Für die Handlungsleiste (b1/b2) wichtig: nach einer Ablehnung Abbrechen anbieten oder warten.
- Nicht in a2: Anhalten, Autopilot-Frist, Gesprächsfrist in echter Zeit (a3), Antwort-/Ende-/Vorschlagsabsichten beim Sagen (der Mensch sagt nur Text).
