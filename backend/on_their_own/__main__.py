"""Start im Container und von Hand: `python -m on_their_own` (Host, Port und Verzeichnisse aus SIM_*)."""

import uvicorn

from .config import get_settings


def main() -> None:
    s = get_settings()
    # Ein Prozess, ein Worker: Die Simulation lebt im Speicher dieses Prozesses und schreibt allein in die Datenbank.
    uvicorn.run("on_their_own.app:app", host=s.host, port=s.port, workers=1, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
