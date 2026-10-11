"""Projektregel: keine Code-Datei über 400 Zeilen."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 400
SUFFIXES = {".py", ".ts", ".tsx", ".sh", ".sql", ".css", ".html"}
SKIP = {"node_modules", ".venv", "dist", "data", ".git", "__pycache__"}
GENERATED = {"generated.ts"}          # von scripts/gen_types.sh erzeugt, nicht von Hand geschrieben


def test_no_code_file_exceeds_limit():
    too_long = []
    for p in ROOT.rglob("*"):
        if p.suffix in SUFFIXES and p.is_file() and p.name not in GENERATED and not SKIP & set(p.relative_to(ROOT).parts):
            n = len(p.read_text().splitlines())
            if n > LIMIT:
                too_long.append(f"{p.relative_to(ROOT)}: {n} Zeilen")
    assert not too_long, too_long
