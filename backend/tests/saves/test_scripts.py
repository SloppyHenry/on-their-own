"""AP10: Ablauf von backup.sh, restore.sh und deploy_maintux.sh – mit einem Docker-Ersatz, der die Befehle protokolliert und
den echten Backup-Befehl im Datenverzeichnis ausführt (kein Docker nötig)."""

import os
import re
import stat
import subprocess
import sys
import tarfile
from pathlib import Path

import pytest
from saves.conftest import dump, file_sim

ROOT = Path(__file__).resolve().parents[3]
STUB = f"""#!{sys.executable}
import os, subprocess, sys
a = sys.argv[1:]
log = open(os.environ["STUB_LOG"], "a"); log.write("docker " + " ".join(a) + "\\n"); log.close()
state = os.environ["STUB_STATE"]
def st(): return open(state).read().strip() if os.path.exists(state) else "none"
a = a[a.index("compose") + 1:] if "compose" in a else a
i = 0
while i < len(a) and a[i] in ("-f", "--project-directory"): i += 2
a = a[i:]
cmd = a[0]
if cmd == "ps":
    if ("--status" in a and st() == "running") or ("-a" in a and st() != "none"): print("abc123")
elif cmd in ("exec", "run"):
    if cmd == "run" and os.environ.get("STUB_RUN_FAILS"): sys.exit(1)
    rest = a[a.index("python") + 1:]
    sys.exit(subprocess.call([sys.executable, *rest, "--data-dir", os.environ["STUB_DATA"]]))
elif cmd == "stop": open(state, "w").write("stopped")
elif cmd == "start": open(state, "w").write("running")
"""


@pytest.fixture
def env(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name, body in {"docker": STUB, "ssh": "#!/bin/sh\necho ssh \"$@\" >> \"$STUB_LOG\"\n", "rsync": "#!/bin/sh\necho rsync \"$@\" >> \"$STUB_LOG\"\n"}.items():
        p = bin_dir / name
        p.write_text(body)
        p.chmod(p.stat().st_mode | stat.S_IEXEC)
    data = tmp_path / "data"
    data.mkdir()
    sim = file_sim(data / "live.db")
    sim.engine.advance(30)
    sim.saves.create("Mein Stand", "", kind="manual")
    sim.close()
    own = {k: v for k, v in os.environ.items() if not k.startswith("SIM_")}        # Umgebung des Aufrufers (z. B. ein Deploy auf einen anderen Rechner) darf die Tests nicht beeinflussen
    e = {**own, "PATH": f"{bin_dir}:{os.environ['PATH']}", "STUB_LOG": str(tmp_path / "calls.log"), "STUB_STATE": str(tmp_path / "state"),
         "STUB_DATA": str(data), "SIM_BACKUP_DIR": str(tmp_path / "backups"), "HOME": str(tmp_path), "PYTHONPATH": str(ROOT / "backend")}
    (tmp_path / "state").write_text("running")
    return e, data, tmp_path


def sh(env, *args, input=None):
    return subprocess.run(["bash", *map(str, args)], env=env, capture_output=True, text=True, input=input)


def calls(tmp_path) -> list[str]:
    p = tmp_path / "calls.log"
    return p.read_text().splitlines() if p.exists() else []


def test_backup_script_writes_a_checked_archive_and_keeps_only_the_newest(env):
    e, data, tmp = env
    made = []
    for _ in range(4):                                                    # schnell hintereinander: auch in derselben Sekunde verschiedene Namen
        r = sh({**e, "SIM_BACKUP_KEEP": "3"}, ROOT / "scripts/backup.sh")
        assert r.returncode == 0, r.stderr
        made.append(r.stdout.strip())
        assert Path(made[-1]).is_file() and tarfile.is_tarfile(made[-1])
    assert len(set(made)) == 4
    kept = sorted(str(p) for p in (tmp / "backups").glob("on-their-own-*.tar.gz"))
    assert kept == sorted(made)[1:] and not list((tmp / "backups").glob("*.part"))          # die älteste ist weg
    assert any(" exec -T on-their-own " in c for c in calls(tmp))                                # läuft: im laufenden Container gesichert
    assert oct((tmp / "backups").stat().st_mode & 0o777) == "0o700"


def test_backup_script_works_with_a_stopped_container_through_a_one_off_run(env):
    e, data, tmp = env
    (tmp / "state").write_text("stopped")
    assert sh(e, ROOT / "scripts/backup.sh").returncode == 0
    assert any(" run --rm -T --no-deps on-their-own " in c for c in calls(tmp))


def test_backup_script_leaves_nothing_behind_when_the_command_fails(env):
    e, data, tmp = env
    (tmp / "state").write_text("stopped")
    r = sh({**e, "STUB_RUN_FAILS": "1"}, ROOT / "scripts/backup.sh")
    assert r.returncode != 0 and not list((tmp / "backups").glob("on-their-own-*"))


def test_restore_script_needs_the_confirmation_word_and_changes_nothing_otherwise(env):
    e, data, tmp = env
    archive = sh(e, ROOT / "scripts/backup.sh").stdout.strip()
    before = dump(data / "live.db")
    r = sh(e, ROOT / "scripts/restore.sh", archive, input="nein\n")
    assert r.returncode != 0 and "Abgebrochen" in r.stderr and dump(data / "live.db") == before
    assert not any(" stop " in c for c in calls(tmp))


def test_restore_script_backs_up_stops_restores_and_starts_again(env):
    e, data, tmp = env
    archive = sh(e, ROOT / "scripts/backup.sh").stdout.strip()
    want = dump(data / "live.db")
    sim = file_sim(data / "live.db")
    sim.engine.advance(90)                                            # der Stand ändert sich nach dem Backup
    sim.close()
    assert dump(data / "live.db") != want
    r = sh(e, ROOT / "scripts/restore.sh", archive, input="wiederherstellen\n")
    assert r.returncode == 0, r.stderr
    assert dump(data / "live.db") == want
    log = calls(tmp)
    order = [next(i for i, c in enumerate(log) if k in c) for k in (" exec ", " stop ", " run --rm", " start ")]
    assert order == sorted(order)                                     # erst sichern, dann stoppen, einspielen, starten
    assert len(list((tmp / "backups").glob("on-their-own-*.tar.gz"))) == 2 and (tmp / "state").read_text() == "running"      # Backup + Sicherung vor dem Einspielen


def test_restore_script_restarts_the_app_even_when_the_restore_fails(env):
    e, data, tmp = env
    archive = sh(e, ROOT / "scripts/backup.sh").stdout.strip()
    before = dump(data / "live.db")
    r = sh({**e, "STUB_RUN_FAILS": "1"}, ROOT / "scripts/restore.sh", archive, "--yes")
    assert r.returncode != 0 and (tmp / "state").read_text() == "running" and dump(data / "live.db") == before


def test_restore_script_refuses_files_that_are_no_backup(env):
    e, data, tmp = env
    junk = tmp / "junk.tar.gz"
    with tarfile.open(junk, "w:gz") as t:
        t.add(__file__, "irgendwas.py")
    r = sh(e, ROOT / "scripts/restore.sh", junk, "--yes")
    assert r.returncode != 0 and "kein Backup von On Their Own" in r.stderr and not any(" stop " in c for c in calls(tmp))


def test_deploy_dry_run_touches_neither_tests_nor_ssh_nor_rsync(env):
    e, data, tmp = env
    r = sh(e, ROOT / "scripts/deploy_maintux.sh", "--dry-run")
    assert r.returncode == 0 and "[dry-run] rsync" in r.stdout and "[dry-run] ssh maintux" in r.stdout and "_remote_up.sh" in r.stdout
    assert "--exclude-from=" in r.stdout and "rsync-excludes.txt" in r.stdout
    assert not [c for c in calls(tmp) if c.startswith(("ssh", "rsync"))]


def test_deploy_rejects_unknown_options(env):
    e, data, tmp = env
    assert sh(e, ROOT / "scripts/deploy_maintux.sh", "--schnell").returncode == 2


def test_key_file_default_lies_in_a_private_folder_of_the_user(env):
    e, data, tmp = env
    r = subprocess.run(["bash", "-c", f"source {ROOT}/scripts/_compose.sh; echo $SIM_KEY_FILE"], env=e, capture_output=True, text=True)
    assert r.stdout.strip() == f"{tmp}/on-their-own-secrets/llm_api_key"


def test_rsync_to_maintux_copies_every_tracked_file_and_no_data(tmp_path):
    """Gegen den Fehler vom ersten Ausrollen: ein zu grober Ausschluss (`data`) ließ backend/on_their_own/data/ mit den Weltdaten weg."""
    target = tmp_path / "ziel"
    (tmp_path / "quelle").mkdir()
    subprocess.run(["rsync", "-a", "--exclude-from", str(ROOT / "scripts/rsync-excludes.txt"), f"{ROOT}/", f"{target}/"], check=True)
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    missing = [f for f in tracked if (ROOT / f).exists() and not (target / f).exists()]
    assert not missing, missing
    assert (target / "backend/on_their_own/data/blueprints.json").is_file()
    assert not (target / "data").exists() and not (target / ".git").exists() and not list(target.rglob("node_modules"))


def test_every_file_the_app_needs_at_runtime_survives_the_docker_context_rules():
    """Die Muster aus .dockerignore dürfen nichts unter backend/on_their_own oder backend/requirements.lock treffen."""
    patterns = [l.strip() for l in (ROOT / ".dockerignore").read_text().splitlines() if l.strip() and not l.startswith(("#", "!"))]
    needed = [str(p.relative_to(ROOT)) for p in (ROOT / "backend/on_their_own").rglob("*") if p.is_file() and "__pycache__" not in p.parts] + ["backend/requirements.lock"]
    import fnmatch
    hit = [f for f in needed for pat in patterns
           if (pat.startswith("**/") and any(fnmatch.fnmatch(part, pat[3:]) for part in f.split("/")))
           or (not pat.startswith("**/") and (fnmatch.fnmatch(f, pat.lstrip("/")) or f.startswith(pat.lstrip("/").rstrip("/") + "/")))]
    assert not hit, hit


def test_no_script_pipes_into_grep_q_under_pipefail():
    """`tar -t | grep -q` bricht mit pipefail durch SIGPIPE ab, sobald das Archiv größer als der Pipe-Puffer ist (so auf maintux aufgefallen)."""
    bad = [f"{p.name}: {l.strip()}" for p in (ROOT / "scripts").glob("*.sh") for l in p.read_text().splitlines() if re.search(r"(?<!\|)\|(?!\|)\s*grep\s+-q", l.split("#")[0])]
    assert not bad, bad


def test_backup_accepts_an_archive_far_larger_than_the_pipe_buffer(env):
    e, data, tmp = env
    (data / "saves").mkdir(exist_ok=True)
    for i in range(300):                                                  # viele Dateien: lange Auflistung
        sqlite = __import__("sqlite3").connect(data / "saves" / f"x{i:04d}.db")
        sqlite.execute("CREATE TABLE t(a)")
        sqlite.close()
    r = sh(e, ROOT / "scripts/backup.sh")
    assert r.returncode == 0, r.stderr
