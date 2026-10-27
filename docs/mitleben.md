# Mitleben mit eigener Figur (AP18h)

Du spielst einen Bewohner unter Bewohnern. Für die anderen bist du einer von ihnen: gleicher Körper, gleiche Regeln, nirgends ein Vermerk. Wer gesteuert wird, steht nur im Spielstand (`meta.player`) und nie in einem Prompt, einer Erinnerung oder einem Ereignis mit Agenten.

## Einrichten
- **Neue Simulation:** Schritt Spielart › „Leben mit eigener Figur“, Schritt Bewohner › „Das bist du“ (höchstens eine Figur).
- **Später:** Menü › Einstellungen › Spielart › Eigene Figur › „Eigene Figur wechseln“ (mit Bestätigung). Die bisherige Figur wird ein normaler Bewohner, für den das Modell entscheidet.

## Bedienen
| Taste / Klick | Wirkung |
|---|---|
| Klick auf den Boden | deine Figur geht dorthin (Weg und Dauer als Vorschau, Ablehnung der Welt als rote Blase) |
| `T` | Sagen (Empfänger aus der Nähe, `Tab` wechselt); spricht dich jemand an, steht die Antwortzeile von selbst da |
| `U` | Benutzen: dieselbe Liste, die ein Bewohner bekäme, mit Dauer und Grund bei Unmöglichem |
| `B` / `I` | Bauen (Bauvorlagen mit Kosten) / Gepäck (Ablegen, Geben, Essen) |
| `F` | Kamera folgt deiner Figur (auch ins Haus) |
| Knopf „Abbrechen“ | unterbricht die laufende Handlung (für andere ein Abbruch wie jeder) |

`Esc` nimmt Ebenen zurück (Raum, Haus, Dorf, Menü); folgt die Kamera deiner Figur, beendet das Verlassen des Hauses das Folgen, bis du `F` drückst. Das Tagebuch öffnest du mit der Schaltfläche, `T` ist „Sagen“.

## Takt (Einstellungen › Spielart)
- Standard: die Welt läuft weiter, deine Figur wartet (Plakette „wartet · frei seit …“).
- **Anhalten, wenn ich dran bin:** ist die Figur frei und spricht jemand sie an (oder ihre Handlung endet), steht die Zeit („Die Zeit steht: Kim ist dran“), bis du etwas tust.
- **Autopilot, wenn ich nichts tue:** nach den eingestellten **echten** Minuten ohne Eingabe (Standard 5) entscheidet das Modell für die Figur; „Übernehmen“ oder jede Eingabe holt dich zurück.
- **Antwortfrist:** ein Gespräch mit dir endet durch Stille erst, wenn mindestens 60 echte Sekunden seit der letzten Äußerung vergangen sind (zusätzlich zu den 30 Spielminuten).
- Gedächtnis: deine Figur sammelt Beobachtungen und Erinnerungen wie alle; Reflexion und Tagesplanung mit dem Modell nur bei laufendem Autopilot.

## Hinweis zu Worten
Was du sagst, geht wörtlich in die Erinnerung der anderen. Schreibst du „ich bin der Spieler“, erfährt Mira genau diesen Satz, mehr nicht. Es gibt keinen Filter (die Wortprüfung im Profil warnt nur beim Schreiben der Maske).

## Noch nicht
Mehrere Menschen, Netzspiel, „nur sehen, was meine Figur sieht“, Autopilot bei fehlendem Browser (die Figur bleibt dann einfach stehen).
