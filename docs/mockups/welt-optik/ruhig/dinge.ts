// Mockup „Ruhige Ansicht“: was auf der Karte steht – Bäume, Haus, Dorfdinge (wie echt.js) und die Einrichtung im Haus (wie
// world_default.json). Alle Sprites kommen unverändert aus frontend/src/world/art. Kein Produktionscode.
import { bush, pine, reed, rock, sunflower, tomato, tree } from "../../../../frontend/src/world/art/nature";
import { WP } from "../../../../frontend/src/world/art/palette";
import { hash, rng } from "../../../../frontend/src/world/art/pen";
import { accentOf } from "../../../../frontend/src/world/art/people";
import { objectSprite } from "../../../../frontend/src/world/art/things";
import { barrel, bench, board, boat, fence, house, lamp, mailbox, post, scarecrow, sign, well } from "../../../../frontend/src/world/art/village";
import { BLD, DOOR, GARDEN, MH, MW, T, outside, raw } from "./karte";

export interface Item {
  x: number;                       // Fußpunkt in Weltpixeln
  y: number;
  spr: (lit: boolean) => HTMLCanvasElement;
  kind: string;
  /** Lichtquelle: Höhe über dem Fuß und Stärke (Abend, Nacht). */
  light?: [number, number][];
  shadow?: boolean;
}

const memo1 = (f: () => HTMLCanvasElement) => { let c: HTMLCanvasElement | null = null; return () => (c ??= f()); };
const both = (f: (lit: boolean) => HTMLCanvasElement) => { const a = memo1(() => f(false)), b = memo1(() => f(true)); return (lit: boolean) => (lit ? b() : a()); };
const trees = new Map<string, HTMLCanvasElement>();
function treeOf(kind: string, seed: number) {
  const k = `${kind}|${seed % 7}`;
  if (!trees.has(k)) trees.set(k, kind === "pine" ? pine(seed % 7) : tree(kind === "treeF" ? 1 : kind === "treeB" ? 2 : 0, (seed % 7) + 1));
  return trees.get(k)!;
}

const HOUSE = both(house), LAMP = both(lamp);
const S: Record<string, (extra: number) => () => HTMLCanvasElement> = {
  well: () => memo1(well), bench: () => memo1(bench), board: () => memo1(() => board(2)), fence: () => memo1(fence), post: () => memo1(post),
  mailbox: () => memo1(mailbox), barrel: () => memo1(barrel), bushP: () => memo1(() => bush(5, WP.fP)), bushY: () => memo1(() => bush(6, WP.fY)),
  sign: () => memo1(sign), boat: () => memo1(boat), scare: () => memo1(scarecrow), sun: () => memo1(sunflower), reed: () => memo1(reed),
  tomato: (e) => memo1(() => tomato(e)), rock: (e) => memo1(() => rock(e)),
};
const cache = new Map<string, () => HTMLCanvasElement>();
const spriteOf = (kind: string, extra: number) => { const k = `${kind}|${extra}`; if (!cache.has(k)) cache.set(k, S[kind](extra)); return cache.get(k)!; };

/** Draußen: Bäume auf Waldkacheln und jenseits der Karte, Haus, Brunnen, Bänke, Zaun, Deko wie in echt.js. */
export function outdoorItems(): Item[] {
  const o: Item[] = [], R = rng(11);
  const add = (kind: string, x: number, y: number, extra = 0) => o.push({ kind, x: Math.round(x), y: Math.round(y), spr: spriteOf(kind, extra), shadow: kind !== "boat" });
  for (let y = -16; y < MH + 16; y++) for (let x = -20; x < MW + 20; x++) {
    if (outside(x, y) !== "T") continue;
    const hh = hash(x, y, 5), out = x < 0 || y < 0 || x >= MW || y >= MH;
    if (out && hh < 0.25) continue;
    const kind = hh < 0.45 ? "pine" : hh > 0.94 && !out ? "treeF" : hh > 0.9 && !out ? "treeB" : "tree", spr = treeOf(kind, Math.abs(x * 7 + y));
    o.push({ kind: "tree", x: Math.round(x * T + 8 + (hash(x, y, 6) - 0.5) * 8), y: Math.round((y + 1) * T - 2 + (hash(x, y, 7) - 0.5) * 6), spr: () => spr, shadow: true });
  }
  o.push({ kind: "house", x: DOOR.x, y: DOOR.y, spr: HOUSE, shadow: true, light: [[0, 0.8]] });
  add("well", 40 * T + 8, 10 * T - 1); add("bench", 40 * T + 8, 13 * T - 1); add("well", 33 * T + 8, 26 * T - 1); add("bench", 30 * T + 8, 24 * T - 1); add("board", 38 * T + 8, 23 * T - 1);
  const [gx, gy, gw, gh] = GARDEN, gx0 = gx * T, gx1 = (gx + gw) * T, gy0 = gy * T, gy1 = (gy + gh) * T;
  for (let x = gx0; x < gx1 - 4; x += 12) { if (Math.abs(x + 7 - (36 * T + 8)) > 9) add("fence", x + 7, gy1); add("fence", x + 7, gy0); }
  for (let y = gy0 + 8; y < gy1; y += 8) { if (y < 7 * T || y > 8 * T + 4) add("post", gx0, y); add("post", gx1, y); }
  const deco: [string, number, number, number?][] = [
    ["mailbox", DOOR.x + 30, DOOR.y + 6], ["barrel", DOOR.x - 52, DOOR.y - 4], ["barrel", DOOR.x - 45, DOOR.y - 2], ["bushP", DOOR.x - 24, DOOR.y + 6], ["bushY", DOOR.x + 18, DOOR.y + 6],
    ["sign", 37 * T + 4, 20 * T + 8], ["boat", 55 * T, 29 * T + 4], ["scare", 44 * T, 13 * T], ["sun", 31 * T + 4, 6 * T], ["sun", 31 * T + 12, 6 * T + 2], ["sun", 31 * T + 20, 6 * T],
    ["tomato", 39 * T, 8 * T, 1], ["tomato", 39 * T + 14, 8 * T + 2, 2],
  ];
  for (const [k, x, y, e] of deco) add(k, x, y, e ?? 0);
  for (const [x, y] of [[DOOR.x + 22, DOOR.y + 40], [26 * T, 21 * T], [41 * T, 21 * T], [46 * T, 27 * T]]) o.push({ kind: "lamp", x, y, spr: LAMP, shadow: true, light: [[24, 1]] });
  for (let y = 18; y < 38; y++) for (let x = 44; x < 63; x++) {
    if (raw(x, y) === "~" || raw(x, y) === "T") continue;
    const nearW = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => raw(x + a, y + b) === "~");
    if (nearW && hash(x, y, 8) < 0.3) add("reed", x * T + 8, y * T + 10);
  }
  for (let i = 0; i < 40; i++) { const x = Math.floor(R() * MW), y = Math.floor(R() * MH); if (outside(x, y) === "." && R() < 0.5) add("rock", x * T + 8, y * T + 12, i); }
  return o;
}

/** Lichter am Haus (Fenster, Laterne an der Tür) relativ zur Tür wie E_HOUSE_LIGHTS: [dx, Höhe, Stärke]. */
export const HOUSE_LIGHTS = [[-17, 32, 1], [17, 32, 1], [0, 59, 0.8], [9, 31, 0.7]];

/** Drinnen: Einrichtung aus world_default.json, Sprites aus things.ts; `lit` zündet den Kamin an. */
export function indoorItems(): Item[] {
  const at = (kind: string, key: string | ((lit: boolean) => string), tx: number, ty: number): Item => {
    const k = typeof key === "string" ? () => key : key;
    return { kind, x: tx * T + 8, y: (ty + 1) * T - 1, spr: (lit) => objectSprite(k(lit)) };
  };
  return [
    at("bed", `bed|${accentOf("alex")}`, 6, 6), at("chest", "chest", 10, 6), at("bed", `bed|${accentOf("mira")}`, 13, 6), at("desk", "desk|0", 16, 6),
    at("workbench", "workbench", 20, 6), at("axe", "axe", 22, 6), at("pickaxe", "pickaxe", 23, 6),
    at("stove", "stove|0", 6, 12), at("tap", "tap", 10, 15), at("sofa", "sofa", 17, 13), at("table", "table", 21, 13), at("bookshelf", "bookshelf", 25, 11),
    { ...at("fireplace", (lit) => `fireplace|${lit ? 1 : 0}`, 26, 13), light: [[8, 0.9]] },
  ];
}

export interface Wall { x: number; y: number; back: boolean }

/** Mauern drinnen „heruntergeklappt“: hinten (nach Norden) halbhoch, sonst nur ein Sockel, wie in der Innenansicht der App. */
export function walls(): Wall[] {
  const out: Wall[] = [];
  for (let ty = BLD.y0; ty < BLD.y1; ty++) for (let tx = BLD.x0; tx < BLD.x1; tx++) {
    if (raw(tx, ty) !== "#") continue;
    out.push({ x: tx * T, y: (ty + 1) * T, back: ty === BLD.y0 || raw(tx, ty - 1) === "." });
  }
  return out;
}

/** Mauerstück zeichnen (Gerät-Pixel, Zoom z, Ursprung ox/oy); Stil wie wallPiece in der App. */
export function drawWall(g: CanvasRenderingContext2D, w: Wall, z: number, ox: number, oy: number) {
  const h = w.back ? 22 : 5, x = ox + w.x * z, base = oy + w.y * z, top = base - h * z, cap = T * z;
  g.fillStyle = w.back ? "#f0e2c4" : WP.wall1; g.fillRect(x, top, T * z, h * z);
  if (w.back) { g.fillStyle = "#e8d6b4"; g.fillRect(x, top, T * z, 5 * z); }
  g.fillStyle = w.back ? "#9a8a78" : WP.stone2; g.fillRect(x, base - 2 * z, T * z, 2 * z);
  g.fillStyle = WP.wood2; g.fillRect(x, top, T * z, z);
  g.fillStyle = "#b58a62"; g.fillRect(x, top - cap, T * z, cap);
  g.fillStyle = WP.wood3; g.fillRect(x, top - cap, z, cap); g.fillRect(x, top - cap, T * z, z);
}
