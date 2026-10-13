// Innenansicht des Hauses (Klick aufs Haus): der Innenbereich der Karte eben von schräg oben, ganzzahlig vergrößert, Wände
// unten wie im Mockup „ruhig“ – Böden je Raumstil, Teppich, Möbel und Figuren aus dem Zustand, Rest dunkel.
import type { World } from "../../store/types";
import { WP, WPA } from "../art/palette";
import { canvas, hash, type RGB } from "../art/pen";
import type { Target } from "../view/scene";
import type { Drawn } from "./bild";
import { T, type Look } from "./look";

const C = (r: number, g: number, b: number): RGB => [r, g, b];
const FLOOR = { tileA: C(233, 226, 211), tileB: C(207, 199, 184), ws1: C(110, 80, 56), ws2: C(140, 106, 76), ws3: C(128, 96, 74), plank2: C(195, 134, 79), wallTop: C(139, 109, 85), rugA: C(196, 80, 90), rugB: C(168, 64, 76), rugEdge: C(242, 210, 138) };

export interface Piece { y: number; draw: (g: CanvasRenderingContext2D, z: number, ox: number, oy: number) => void }
export interface InnenThing { x: number; y: number; spr: HTMLCanvasElement; target?: Target; ring?: string | null; hover?: HTMLCanvasElement | null; lift?: number; tool?: HTMLCanvasElement | null; toolAngle?: number }

/** Boden des Innenbereichs (1 Texel = 1 Weltpixel), nach Raumstil aus den Orten. */
export function floorTexture(w: World, L: Look): HTMLCanvasElement {
  const [rx, ry, rw, rh] = L.interior.rect, W = rw * T, H = rh * T, cv = canvas(W, H), g = cv.getContext("2d")!, img = g.createImageData(W, H), d = img.data;
  const rows = w.map.rows, legend = w.map.legend, locs = Object.values(w.locations).filter((l) => !l.props.fallback);
  const kind = (x: number, y: number) => legend[rows[y]?.[x] ?? ""] ?? "";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + rx * T, wy = y + ry * T, tx = Math.floor(wx / T), ty = Math.floor(wy / T), k = kind(tx, ty), lx = wx % T, ly = wy % T;
    const loc = locs.find((l) => tx >= l.rect[0] && ty >= l.rect[1] && tx < l.rect[0] + l.rect[2] && ty < l.rect[1] + l.rect[3]);
    const style = (loc?.props.style ?? {}) as { floor?: string; rug?: boolean };
    let col: RGB;
    if (k === "wall") col = FLOOR.wallTop;
    else if (k === "door") col = ly % 4 === 0 ? WPA.wood3 : WPA.wood1;
    else if (style.rug && loc && tx > loc.rect[0] + 2 && tx < loc.rect[0] + loc.rect[2] - 3 && ty > loc.rect[1] && ty < loc.rect[1] + loc.rect[3] - 1) {
      const r = loc.rect, edge = (tx === r[0] + 3 && lx < 2) || (tx === r[0] + r[2] - 4 && lx > 13) || (ty === r[1] + 1 && ly < 2) || (ty === r[1] + r[3] - 2 && ly > 13);
      col = edge ? FLOOR.rugEdge : (wx + wy + tx + ty) % 6 < 3 ? FLOOR.rugA : FLOOR.rugB;
    } else if (style.floor === "tile") col = (Math.floor(wx / 8) + Math.floor(wy / 8)) & 1 ? FLOOR.tileA : FLOOR.tileB;
    else if (style.floor === "workshop") col = wy % 5 === 0 ? FLOOR.ws1 : hash(wx, wy, 2) < 0.5 ? FLOOR.ws2 : FLOOR.ws3;
    else col = wy % 4 === 0 ? WPA.wood3 : Math.floor(wx / 12 + Math.floor(wy / 4) * 0.5) & 1 ? WPA.wood1 : FLOOR.plank2;
    const o = (y * W + x) * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** Mauern „heruntergeklappt“: hinten halbhoch, sonst nur ein Sockel. */
export function wallPieces(w: World, L: Look): Piece[] {
  const [rx, ry, rw, rh] = L.interior.rect, rows = w.map.rows, legend = w.map.legend, out: Piece[] = [];
  const kind = (x: number, y: number) => legend[rows[y]?.[x] ?? ""] ?? "";
  for (let ty = ry; ty < ry + rh; ty++) for (let tx = rx; tx < rx + rw; tx++) {
    if (kind(tx, ty) !== "wall") continue;
    const back = ty === ry || !["floor", "door", "wall"].includes(kind(tx, ty - 1)), wx = tx * T, base = (ty + 1) * T;
    out.push({ y: base, draw: (g, z, ox, oy) => {
      const h = back ? 22 : 5, x = ox + wx * z, b = oy + base * z, top = b - h * z, cap = T * z;
      g.fillStyle = back ? "#f0e2c4" : WP.wall1; g.fillRect(x, top, T * z, h * z);
      if (back) { g.fillStyle = "#e8d6b4"; g.fillRect(x, top, T * z, 5 * z); }
      g.fillStyle = back ? "#9a8a78" : WP.stone2; g.fillRect(x, b - 2 * z, T * z, 2 * z);
      g.fillStyle = WP.wood2; g.fillRect(x, top, T * z, z);
      g.fillStyle = "#b58a62"; g.fillRect(x, top - cap, T * z, cap);
      g.fillStyle = WP.wood3; g.fillRect(x, top - cap, z, cap); g.fillRect(x, top - cap, T * z, z);
    } });
  }
  return out;
}

/** Zeichnet die Innenansicht in `ctx` (Gerätepixel W × H) mit ganzzahligem Zoom z; liefert getroffene Flächen und den Versatz. */
export function drawInnen(ctx: CanvasRenderingContext2D, W: number, H: number, z: number, L: Look, floor: HTMLCanvasElement, walls: Piece[], things: InnenThing[], grade: string | null, t: number) {
  const [rx, ry, rw, rh] = L.interior.rect, bw = rw * T * z, bh = rh * T * z;
  const ox = Math.round((W - bw) / 2 - rx * T * z), oy = Math.round((H - bh) / 2 + 11 * z - ry * T * z), drawn: Drawn[] = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#1a1322"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(floor, ox + rx * T * z, oy + ry * T * z, bw, bh);
  const pieces: Piece[] = [...walls];
  for (const it of things) pieces.push({ y: it.y, draw: (g) => {
    const w = it.spr.width * z, h = it.spr.height * z, x = Math.round(ox + it.x * z - w / 2), y = Math.round(oy + (it.y - (it.lift ?? 0)) * z - h);
    if (it.ring) { g.strokeStyle = it.ring; g.lineWidth = Math.max(2, z * 0.75); g.globalAlpha = 0.55 + Math.sin(t * 3) * 0.25; g.beginPath(); g.ellipse(ox + it.x * z, oy + (it.y + 0.5) * z, 9 * z, 3.5 * z, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (it.hover) { g.globalAlpha = 0.9; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(it.hover, x + a * z, y + b * z, w, h); g.globalAlpha = 1; }
    g.drawImage(it.spr, x, y, w, h);
    if (it.tool) { g.save(); g.translate(Math.round(ox + (it.x + 6) * z), Math.round(oy + (it.y - 9 - (it.lift ?? 0)) * z)); g.rotate(it.toolAngle ?? 0); g.drawImage(it.tool, -2 * z, -6 * z, 8 * z, 8 * z); g.restore(); }
    drawn.push({ x, y, w, h, spr: it.spr, target: it.target });
  } });
  pieces.sort((a, b) => a.y - b.y).forEach((p) => p.draw(ctx, z, ox, oy));
  if (grade) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
  return { drawn, ox, oy };
}
