# Fixtures

- `models/` (AP17c-2): aufgezeichnete Antworten von `huggingface.co/api/models` (Listen, 18.10.2026) und `…/tree/main` (Dateilisten). Aus den Listen ist nur das Feld `gguf.chat_template` entfernt (mehrere hundert KB). Die Listen enthalten bewusst auch das Rauschen der Trendliste (Bild-, Vision-, Merge-Modelle).
- `hardware/`: echte Ausgaben von `nvidia-smi` (thirdtux, RTX 3060 mit belegtem Speicher) und `sysctl` (Apple M1, 16 GB).
- `install/`: Attrappen für `test_install_script.py`.
