import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_parameter_doc_is_current():
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "gen_config_doc.py"), "--check"], capture_output=True, text=True, cwd=ROOT / "backend")
    assert r.returncode == 0, r.stderr
