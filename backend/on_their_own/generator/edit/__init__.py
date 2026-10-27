"""Werkzeuge zum Gestalten (AP16a): Aktionen auf einer Weltdatei, Ableiten der Kacheln aus den Formen, Prüfung und Entwurf.

Eine Aktion ist ein kleines Datum (`{"art": "weg", "punkte": [...]}`); `entwurf.anwenden` führt eine Liste davon der Reihe nach auf einer Kopie der Weltdatei aus und liefert die neue Weltdatei,
den Prüfbericht und den Patch, mit dem die laufende Welt dasselbe Ergebnis bekommt.
"""
