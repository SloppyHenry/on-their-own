# AP17c – Schritt 0: Plan und Mockup Modelle, Install-Skript

Plan: [AP17c-plan.md](../arbeitspakete/AP17c-plan.md). Auftrag (17.10.2026): Install-Skript für Linux und macOS, Modellwahl im Tool mit Vorschlägen nach Hardware und immer aktuell; läuft auf maintux (offline) und thirdtux, Downloads freigegeben. Gebaut ist noch nichts, nur Plan und Mockup.

**Ansehen:** `docs/mockups/modelle.html` im Browser öffnen. Oben rechts wechselt „Rechner“ zwischen Apple M1 (dieser Mac), RTX 3080 (wie maintux) und nur Prozessor; die Empfehlungen und die Schätzungen ändern sich. Reiter „Install-Skript“ spielt den Ablauf ab (interaktiv, `--yes`, `--dry-run`). `?hw=rtx&view=install` springt direkt dorthin.

## Was das Mockup zeigt
- **Menü → Einstellungen → Modelle:** erkannte Hardware mit nutzbarem Speicher, Betriebsart (Eingebaut oder Externer Server mit Verbindungstest), **Empfohlen für diesen Rechner**, **Installiert** (Siegel, Standard für neue Simulationen, Testen, Löschen), **Suche** über alle Modelle.
- **Laden:** Bestätigung mit Datei, Quelle, Größe, Prüfung und Platz; Fortschritt mit Geschwindigkeit und Restzeit; Prüfsumme; Probelauf; Siegel.
- **Install-Skript:** sieben Schritte (Rechner prüfen, Voraussetzungen, Projekt, Laufzeit, Modell, Dienst, Fertig) je Rechner.
- Alle Modelle, Größen und Zeiten im Mockup sind **Beispieldaten**; echte Werte liefern Live-Liste und Messung.

## Offen zur Entscheidung
Fragen 39 bis 43 in [offene-fragen.md](../offene-fragen.md).
