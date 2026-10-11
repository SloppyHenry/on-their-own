"""Stichwörter: aus Text und strukturierten Angaben (Orte, Objekte, Personen). Deutsche Grobstammbildung, keine Fremdbibliothek."""

import re
from collections.abc import Iterable

STOP = set("""
aber alle allem allen aller alles als also am an andere anderen auch auf aus bei bin bis bist da dann das dass dein deine dem den der des die dies diese
diesem diesen dieser dieses doch dort du durch ein eine einem einen einer eines einmal er es etwas für gegen gewesen hab habe haben hast hat hatte hier
ich ihm ihn ihr ihre im in indem ist ja jetzt kann kein keine man mehr mein meine mich mir mit nach nicht noch nun nur ob oder ohne sehr sein seine sich
sie sind so soll sollte über um und uns unter vom von vor war waren was weil wenn wer wie wieder will wir wird wirst wo wollte zu zum zur
""".split())
_WORD = re.compile(r"[a-zäöüßA-ZÄÖÜ]{3,}")
_SUFFIXES = ("ungen", "ung", "ern", "en", "er", "es", "em", "e", "n", "s")


def stem(word: str) -> str:
    w = word.lower()
    for suf in _SUFFIXES:
        if len(w) - len(suf) >= 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def tokens(text: str) -> list[str]:
    return [stem(w) for w in _WORD.findall(text) if w.lower() not in STOP]


def build(text: str, extra: Iterable[str] = ()) -> list[str]:
    """Stichwörter einer Erinnerung: Wörter des Textes plus Kennungen und Namen (an `.`, `_` und Leerzeichen getrennt). Reihenfolge stabil, ohne Doppelte."""
    out: list[str] = []
    for part in extra:
        out += [stem(p) for p in re.split(r"[\s._:-]+", str(part)) if len(p) >= 3 and p.lower() not in STOP]
    out += tokens(text)
    seen: set[str] = set()
    return [w for w in out if not (w in seen or seen.add(w))]


def fts_query(words: Iterable[str], limit: int = 24) -> str | None:
    """OR-Anfrage auf die Stichwortspalte. Leere Eingabe: None."""
    ws = [w for w in dict.fromkeys(words) if re.fullmatch(r"[\wäöüß]+", w)][:limit]
    return "keywords : (" + " OR ".join(f'"{w}"' for w in ws) + ")" if ws else None


def estimate_tokens(text: str) -> int:
    """Grobe Schätzung für deutschen Text (Qwen-Tokenizer: etwa 3,2 Zeichen je Token)."""
    return int(len(text) / 3.2) + 2
