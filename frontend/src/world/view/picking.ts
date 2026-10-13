// Zeigen und Treffen: oberstes Sprite unter dem Zeiger (Pixelmaske, rückwärts in Zeichenreihenfolge), sonst Boden per Rückprojektion.
import type { LocationInfo, World } from "../../store/types";
import type { Drawn } from "./renderer";
import type { Target } from "./scene";

const masks = new WeakMap<HTMLCanvasElement, Uint8Array>();

/** Deckkraft eines Sprite-Pixels (0 … 255); Maske einmal je Sprite gelesen. */
export function canvasAlpha(spr: HTMLCanvasElement, u: number, v: number): number {
  let m = masks.get(spr);
  if (!m) {
    const d = spr.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, spr.width, spr.height).data;
    m = new Uint8Array(spr.width * spr.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
    masks.set(spr, m);
  }
  return m[v * spr.width + u] ?? 0;
}

/** Oberstes getroffenes Ziel an Bildpunkt (x, y); `pad` erlaubt Figuren ein, zwei Pixel Spielraum. */
export function hitTest(drawn: Drawn[], x: number, y: number, alpha: (spr: HTMLCanvasElement, u: number, v: number) => number = canvasAlpha): Target | null {
  for (let i = drawn.length - 1; i >= 0; i--) {
    const d = drawn[i];
    if (!d.target) continue;
    const pad = d.target.kind === "agent" ? 1 : 0;
    if (x < d.x - pad || y < d.y - pad || x >= d.x + d.w + pad || y >= d.y + d.h + pad) continue;
    const u = Math.min(d.spr.width - 1, Math.max(0, Math.floor(((x - d.x) / d.w) * d.spr.width)));
    const v = Math.min(d.spr.height - 1, Math.max(0, Math.floor(((y - d.y) / d.h) * d.spr.height)));
    if (pad || alpha(d.spr, u, v) > 40) return d.target;
  }
  return null;
}

/** Kleinster Ort (ohne Rückfallort) auf einer Kachel. */
export function locationAt(w: World, x: number, y: number): LocationInfo | null {
  let best: LocationInfo | null = null, area = Infinity;
  for (const l of Object.values(w.locations)) {
    const [rx, ry, rw, rh] = l.rect;
    if (l.props.fallback || x < rx || y < ry || x >= rx + rw || y >= ry + rh || rw * rh >= area) continue;
    best = l;
    area = rw * rh;
  }
  return best;
}
