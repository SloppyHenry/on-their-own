"""Kommandozeile: dieselbe Rechnung wie die API, für install.sh und von Hand.

    python -m simulacra.models hardware [--json]
    python -m simulacra.models list --shell        (alle kuratierten Modelle, Zeile wie bei recommend, vorn "*" bei der Empfehlung)
    python -m simulacra.models recommend [--model SCHLÜSSEL] [--shell | --json] [Rechner: --kind K --name N --ram-mb R --vram-mb V --vram-free-mb F]
    python -m simulacra.models catalog [--q TEXT] [--only-fit] [--all-publishers] [--refresh] [--limit N]

`recommend` nimmt die kuratierte Liste (ohne Netz); `catalog` fragt Hugging Face. Ohne Angaben zum Rechner wird er erkannt."""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import sys
from pathlib import Path

from . import curated
from .hardware import Hardware, detect
from .rank import Item


def hardware_dict(hw: Hardware) -> dict:
    bw, known = hw.bandwidth_gbs
    return {**dataclasses.asdict(hw), "usable_mb": hw.usable_mb, "bandwidth_gbs": bw, "bandwidth_known": known, "summary": hw.summary()}


def item_dict(i: Item) -> dict:
    v = i.variant
    return {"repo": i.repo, "name": i.name, "publisher": i.publisher, "license": i.license, "source": i.source, "file": v.file, "quant": v.quant, "size_mb": round(v.size_mb),
            "fit": v.fit.level, "fit_label": v.fit.label, "need_mb": v.fit.need_mb, "seconds_per_decision": v.estimate.seconds_per_decision, "key": i.curated_key}


def hardware_from_args(a: argparse.Namespace) -> Hardware:
    if a.kind:
        return Hardware(a.kind, a.name or a.kind, a.vram_mb, a.vram_free_mb if a.vram_free_mb is not None else a.vram_mb, a.ram_mb, 0, a.os, a.arch, gpu_names=[a.name] if a.name else [])
    return detect(a.data_dir)


def shell_line(i: Item) -> str:
    v = i.variant
    return "|".join([i.curated_key or "", i.name, i.repo, v.file, f"{v.size_mb * 1048576 / 1e9:.1f}", v.fit.label, f"{v.estimate.seconds_per_decision:.1f}", v.quant, v.fit.level])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m simulacra.models", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["hardware", "recommend", "list", "catalog"])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--shell", action="store_true", help="recommend: eine Zeile für Skripte (Schlüssel|Name|Repo|Datei|GB|Passung|Sekunden|Quantisierung|Stufe)")
    ap.add_argument("--model", default="", help="recommend: Schlüssel eines kuratierten Modells statt der Empfehlung")
    ap.add_argument("--kind", choices=["nvidia", "metal", "amd", "vulkan", "cpu"], help="Rechner vorgeben statt erkennen")
    ap.add_argument("--name", default="")
    ap.add_argument("--ram-mb", type=int, default=0)
    ap.add_argument("--vram-mb", type=int, default=0)
    ap.add_argument("--vram-free-mb", type=int, default=None)
    ap.add_argument("--os", default="linux")
    ap.add_argument("--arch", default="x64")
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--q", default="")
    ap.add_argument("--only-fit", action="store_true")
    ap.add_argument("--all-publishers", action="store_true")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--limit", type=int, default=20)
    a = ap.parse_args(argv)
    hw = hardware_from_args(a)

    if a.command == "hardware":
        d = hardware_dict(hw)
        print(json.dumps(d, ensure_ascii=False, indent=1) if a.json else f"{d['summary']} (nutzbar für Modelle: {d['usable_mb']} MB)")
        return 0

    cur = curated.load()
    if a.command == "list":
        its = sorted(curated.items(cur, hw, extras=True), key=lambda i: -i.variant.size_mb)
        best = curated.best(cur, hw)
        for i in its:
            m = next(m for m in cur.models if m["key"] == i.curated_key)
            print(("*" if best is not None and i.curated_key == best.curated_key else "-") + "|" + shell_line(i) + "|" + m.get("style", "") + "|" + m.get("desc", ""))
        return 0
    if a.command == "recommend":
        if a.model:
            sel = next((i for i in curated.items(cur, hw, extras=True) if i.curated_key == a.model), None)
            if sel is None:
                print("FEHLER|unbekanntes Modell " + a.model + " (bekannt: " + ", ".join(m["key"] for m in cur.models) + ")")
                return 0
        else:
            sel = curated.best(cur, hw)
        if sel is None:
            return 1
        print(shell_line(sel) if a.shell else json.dumps(item_dict(sel), ensure_ascii=False, indent=1) if a.json else f"{sel.name} {sel.variant.quant} ({sel.variant.size_mb * 1048576 / 1e9:.1f} GB, {sel.variant.fit.label})")
        return 0

    from .catalog import Catalog                   # holt httpx; nur für die Live-Liste nötig
    async def run():
        c = Catalog(Path(a.data_dir))
        try:
            return await c.load(hw, q=a.q, only_fit=a.only_fit, trusted_only=not a.all_publishers, refresh=a.refresh, limit=a.limit)
        finally:
            await c.aclose()
    res = asyncio.run(run())
    if a.json:
        print(json.dumps({"hardware": hardware_dict(hw), "source": res.source, "note": res.note, "hidden": res.hidden, "recommended": [item_dict(i) for i in res.recommended], "items": [item_dict(i) for i in res.items]}, ensure_ascii=False, indent=1))
    else:
        print(f"{hw.summary()} · Quelle: {res.source}" + (f" · {res.note}" if res.note else ""))
        print("Empfohlen: " + (", ".join(f"{i.name} {i.variant.quant}" for i in res.recommended) or "—"))
        for i in res.items:
            print(f"  {i.variant.fit.label:9} {i.variant.size_mb / 1024:5.1f} GB  ≈{i.variant.estimate.seconds_per_decision:4.1f} s  {i.repo}  {i.variant.file}  [{i.license or '?'}{', gesperrt' if i.gated else ''}]")
        if res.hidden:
            print("Ausgeblendet: " + ", ".join(f"{k} {v}" for k, v in sorted(res.hidden.items(), key=lambda kv: -kv[1])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
