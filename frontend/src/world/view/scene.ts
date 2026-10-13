// Szene: aus dem Weltzustand die aufrechten Dinge mit Fußpunkt (Weltpixel). Gezeichnet wird, was der Zustand sagt;
// dazu Deko wie in Mockup A (Laternen, Schilf, Steine, Boot, Vogelscheuche, Sonnenblumen), bis AP14 sie zu echten Objekten macht.
import type { LocationInfo, ObjectInfo, World } from "../../store/types";
import { bush, pine, reed, rock, sunflower, tree } from "../art/nature";
import { hash } from "../art/pen";
import { objectKey, objectSprite, resourceKey, resourceSprite } from "../art/things";
import { barrel, boat, fence, lamp, mailbox, post, scarecrow } from "../art/village";
import { WP } from "../art/palette";
import type { Building } from "./buildings";
import { K, T, type GroundData } from "./groundData";
import type { Caster } from "./ground";

export type Target = { kind: "agent" | "object" | "house" | "resource"; id: string };

export interface Item {
  key: string;
  x: number;
  y: number;
  /** Sprite für den aktuellen Zustand (Laternen und Häuser hängen am Licht). */
  spr: (lit: boolean) => HTMLCanvasElement;
  /** Nur in der Innenansicht dieses Gebäudes (Index) oder nur draußen (-1). */
  inside: number;
  target?: Target;
  light?: { h: number; r: number };
  casts?: boolean;
  /** Woran das Licht hängt: Haus (jemand drin) oder Laterne (Abend und Nacht). */
  lit?: "house" | "lamp";
}

const memo1 = (c: HTMLCanvasElement) => () => c;
const treeSpr = new Map<string, HTMLCanvasElement>();
function treeOf(kind: string, seed: number) {
  const k = `${kind}:${seed % 7}`;
  if (!treeSpr.has(k)) treeSpr.set(k, kind === "pine" ? pine(seed % 7) : tree(kind === "treeF" ? 1 : kind === "treeB" ? 2 : 0, (seed % 7) + 1));
  return treeSpr.get(k)!;
}
const lampSpr = [lamp(false), lamp(true)];
const lampItem = (key: string, x: number, y: number): Item => ({ key, x, y, spr: (lit) => lampSpr[lit ? 1 : 0], inside: -1, light: { h: 24, r: 1 }, casts: true, lit: "lamp" });

/** Bäume auf Baumkacheln und Wald rings um die Karte (ohne Weltdaten, deterministisch). */
export function treeItems(g: GroundData, margin = 18): Item[] {
  const out: Item[] = [];
  for (let y = -margin; y < g.h + margin; y++) for (let x = -margin - 4; x < g.w + margin + 4; x++) {
    if (g.k(x, y) !== K.Tree) continue;
    const hh = hash(x, y, 5), out_ = !g.inside(x, y);
    if (out_ && hh < 0.25) continue;
    const kind = hh < 0.45 ? "pine" : hh > 0.94 && !out_ ? "treeF" : hh > 0.9 && !out_ ? "treeB" : "tree", seed = Math.abs(x * 7 + y);
    const spr = treeOf(kind, seed);
    out.push({ key: `t:${x},${y}`, x: x * T + 8 + (hash(x, y, 6) - 0.5) * 8, y: (y + 1) * T - 2 + (hash(x, y, 7) - 0.5) * 6, spr: () => spr, inside: -1, casts: true });
  }
  return out;
}

/** Zäune aus `props.style.fence`: Latten an Nord- und Südkante, Pfosten an den Seiten, Lücken, wo ein Weg durchführt. */
export function fenceItems(g: GroundData, locations: LocationInfo[]): Item[] {
  const out: Item[] = [], f = fence(), p = post();
  const open = (x: number, y: number) => { const k = g.k(x, y); return k === K.Path || k === K.Door || k === K.Sand; };
  for (const l of locations) {
    if (!(l.props.style as { fence?: boolean } | undefined)?.fence || l.props.fallback) continue;
    const [rx, ry, rw, rh] = l.rect, x0 = rx * T, x1 = (rx + rw) * T, y0 = ry * T, y1 = (ry + rh) * T;
    for (let x = x0; x < x1 - 4; x += 12) {
      const tx = Math.floor((x + 7) / T);
      if (!open(tx, ry - 1) && !open(tx, ry)) out.push({ key: `f:${l.id}:n${x}`, x: x + 7, y: y0, spr: memo1(f), inside: -1 });
      if (!open(tx, ry + rh) && !open(tx, ry + rh - 1)) out.push({ key: `f:${l.id}:s${x}`, x: x + 7, y: y1, spr: memo1(f), inside: -1 });
    }
    for (let y = y0 + 8; y < y1; y += 8) {
      const ty = Math.floor((y - 1) / T);
      if (!open(rx - 1, ty) && !open(rx, ty)) out.push({ key: `f:${l.id}:w${y}`, x: x0, y, spr: memo1(p), inside: -1 });
      if (!open(rx + rw, ty) && !open(rx + rw - 1, ty)) out.push({ key: `f:${l.id}:e${y}`, x: x1, y, spr: memo1(p), inside: -1 });
    }
  }
  return out;
}

/** Häuser draußen: Haus aus Mockup A an der Haustür, davor Briefkasten, Fässer und Büsche wie im Mockup. */
export function houseItems(bs: Building[], house: (lit: boolean) => HTMLCanvasElement): Item[] {
  const out: Item[] = [];
  bs.forEach((b, i) => {
    const x = b.door.x * T + 8, y = (b.door.y + 1) * T;
    out.push({ key: `h:${b.id}`, x, y, spr: house, inside: -1, target: { kind: "house", id: String(i) }, casts: true, lit: "house" });
    const deco: [string, number, number, () => HTMLCanvasElement][] = [
      ["mailbox", 26, 6, mailbox], ["barrel", -34, 2, barrel], ["barrel2", -27, 4, barrel], ["bushP", -16, 8, () => bush(5, WP.fP)], ["bushY", 16, 8, () => bush(6, WP.fY)], ["bush", 38, -2, () => bush(3, null)],
    ];
    for (const [k, dx, dy, make] of deco) { const c = make(); out.push({ key: `hd:${b.id}:${k}`, x: x + dx, y: y + dy, spr: () => c, inside: -1, casts: true }); }
    out.push(lampItem(`hl:${b.id}`, x + 43, y + 26));
  });
  return out;
}

/** Deko wie im Mockup aus den Kacheln: Schilf am Ufer, Steine im Gras, Laternen am Pflaster, Boot am Steg, Vogelscheuche und Sonnenblumen im Garten. */
export function decoItems(g: GroundData, locations: LocationInfo[]): Item[] {
  const out: Item[] = [], rd = reed(), rk = rock(0), sf = sunflower(), sc = scarecrow(), bt = boat();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const k = g.k(x, y), i = y * g.w + x;
    if (g.bld[i] >= 0) continue;
    if ((k === K.Grass || k === K.Sand) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g.k(x + a, y + b) === K.Water) && hash(x, y, 8) < 0.3) out.push({ key: `d:r${x},${y}`, x: x * T + 8, y: y * T + 10, spr: () => rd, inside: -1 });
    else if (k === K.Grass && !g.style[i] && hash(x, y, 9) < 0.012) out.push({ key: `d:s${x},${y}`, x: x * T + 8, y: y * T + 12, spr: () => rk, inside: -1, casts: true });
    if (k === K.Floor && g.bld[i] < 0 && g.k(x + 1, y) === K.Water && g.k(x - 1, y) !== K.Water) out.push({ key: `d:b${x},${y}`, x: (x + 3) * T, y: y * T + 20, spr: () => bt, inside: -1 });
  }
  for (const l of locations) {
    const st = (l.props.style as { surface?: string; fence?: boolean } | undefined) ?? {}, [rx, ry, rw, rh] = l.rect;
    if (l.props.fallback) continue;
    if (st.surface === "cobble") for (const [cx, cy] of [[rx, ry], [rx + rw, ry], [rx + rw + 5, ry + rh - 3]]) out.push(lampItem(`d:l${l.id}${cx},${cy}`, cx * T, cy * T));
    if (st.fence) {
      out.push({ key: `d:sc${l.id}`, x: (rx + rw - 3) * T, y: (ry + rh - 3) * T, spr: () => sc, inside: -1, casts: true });
      for (let k = 0; k < 3; k++) out.push({ key: `d:sf${l.id}${k}`, x: (rx + 1) * T + 4 + k * 8, y: (ry + 2) * T + (k % 2) * 2, spr: () => sf, inside: -1, casts: true });
    }
  }
  return out;
}

/** Objekte und Vorräte aus dem Zustand; im Gebäude nur in der Innenansicht. */
export function stateItems(w: World, bldAt: (x: number, y: number) => number): Item[] {
  const out: Item[] = [], minute = w.clock.minute;
  for (const o of Object.values(w.objects) as ObjectInfo[]) {
    if (o.holder || o.x == null || o.y == null || o.kind === "seedbed") continue;
    const inside = bldAt(o.x, o.y);
    if (o.kind === "door" && (inside < 0 || !o.state.locked)) continue;      // offene Türen sind Durchgänge, die Haustür gehört zum Haus
    const key = objectKey(o, minute), spr = objectSprite(key);
    out.push({ key: `o:${o.id}`, x: o.x * T + 8, y: (o.y + 1) * T - 1 + (o.kind === "plant" ? 0.2 : 0), spr: () => spr, inside, target: { kind: "object", id: o.id }, casts: o.kind !== "door" && o.kind !== "plant",
      light: o.kind === "fireplace" && o.state.lit ? { h: 10, r: 1.2 } : o.kind === "firepit" && o.state.lit ? { h: 6, r: 1.1 } : undefined });
  }
  for (const n of Object.values(w.resources)) {
    if (n.resource === "water" || n.amount < 1 || n.x == null || n.y == null) continue;
    const spr = resourceSprite(resourceKey(n));
    out.push({ key: `r:${n.id}`, x: n.x * T + 8, y: (n.y + 1) * T - 1.1, spr: () => spr, inside: bldAt(n.x, n.y), target: { kind: "resource", id: n.id }, casts: true });
  }
  return out;
}

/** Schattenwerfer für den Boden (nur draußen sichtbares, festes). */
export const castersOf = (items: Item[]): Caster[] => items.filter((i) => i.casts && i.inside < 0).map((i) => ({ x: Math.round(i.x), y: Math.round(i.y), w: i.spr(false).width }));
