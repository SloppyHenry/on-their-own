// Vier schnelle Pläne anderer Seeds (AP18f, Mockup Bild 9): kleine Karten aus den Kacheln, die das Backend liefert. Ein Klick übernimmt den Seed.
import { useEffect, useRef } from "react";
import type { World } from "../store/types";

/** Das Dorf im Freien aus dem Kachelraster der Welt: Breite und Höhe folgen den Grenzen des Gebiets (die Innenräume liegen rechts daneben). */
function draussen(w: World): { w: number; h: number } {
  const b = (w.look as { regions?: { bounds: { left: number; right: number; bottom: number } }[] } | null)?.regions?.[0]?.bounds;
  if (!b) return { w: w.map.width, h: w.map.height };
  return { w: Math.min(w.map.width, Math.round((b.right - b.left + 128) / 16)), h: Math.min(w.map.height, Math.round((b.bottom + 104) / 16)) };
}

export function Plan({ world, label, aktiv, onClick, tid }: { world: World | null; label: string; aktiv: boolean; onClick: () => void; tid: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !world) return;
    const { w, h } = draussen(world), ctx = c.getContext("2d");
    if (!ctx) return;
    const px = 3;
    c.width = w * px; c.height = h * px;
    const color: Record<string, string> = {};
    for (const [ch, name] of Object.entries(world.map.legend)) color[ch] = world.tileTypes[name]?.color ?? "#000";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { ctx.fillStyle = color[world.map.rows[y]?.[x] ?? "."] ?? "#2f5d34"; ctx.fillRect(x * px, y * px, px, px); }
  }, [world]);
  return (
    <button type="button" onClick={onClick} aria-pressed={aktiv} data-testid={tid} title={`Seed ${label}`}
      className={`cursor-pointer rounded-lg border p-1 text-left ${aktiv ? "border-alex bg-alex/10" : "border-line bg-black/20 hover:border-alex"}`}>
      {world ? <canvas ref={ref} className="block h-auto max-w-full [image-rendering:pixelated]" style={{ width: "100%" }} /> : <div className="grid h-16 place-items-center text-[11px] text-dim">…</div>}
      <small className="block px-1 pt-0.5 text-[11px] text-dim">Seed {label}</small>
    </button>
  );
}
