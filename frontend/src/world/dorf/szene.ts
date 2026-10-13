// Was im Dorf und im Haus steht: Deko aus `look` (wie wObjects), Dinge und Vorräte aus dem Zustand an ihren Stellen im Bild,
// Figuren aus dem Fahrplan. Draußen in Dorfkoordinaten (für Bild A), drinnen in Weltpixeln (für die Innenansicht).
import type { AgentInfo, World } from "../../store/types";
import { accentOf } from "../art/people";
import { objectKey, objectSprite, resourceKey, resourceSprite } from "../art/things";
import type { Figures } from "../view/figures";
import { silhouette } from "../view/pieces";
import type { Target } from "../view/scene";
import type { Caster } from "./boden";
import type { Thing } from "./bild";
import * as D from "../art/rooms";
import { decorLight, decorSprite as hausDecor, type HausThing } from "./haus/bild";
import { T, isInside, type Look } from "./look";
import { decorSprite } from "./sprites";

const same = (a?: Target | null, b?: Target | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const BOARD = "board";

/** Lage eines Dings im Bild: aus `place`, auf einem Beet dessen Stelle, sonst die Kachel. */
function spot(w: World, L: Look, id: string, x: number, y: number): { at: [number, number]; sprite?: string } {
  const p = L.place[id];
  if (p) return p;
  const bed = Object.values(w.objects).find((o) => o.kind === "seedbed" && o.x === x && o.y === y);
  if (bed && L.place[bed.id]) return { at: L.place[bed.id].at };
  return { at: [x * T + 8 - L.origin[0], (y + 1) * T - 2 - L.origin[1]] };
}

/** Feste Dinge für die Schatten in der Bodentextur (wie A: alle Objekte außer Boot und Figuren). */
export function casters(w: World, L: Look): Caster[] {
  const out: Caster[] = [];
  for (const [k, x, y, e] of L.decor) { if (k === "boat") continue; const s = decorSprite(k, e, false); if (s) out.push({ x, y, w: s.width }); }
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || isInside(L, o.x, o.y) || o.kind === "plant" || o.kind === "door") continue;
    const p = spot(w, L, o.id, o.x, o.y);
    if (p.sprite === "none") continue;
    out.push({ x: p.at[0], y: p.at[1], w: (o.kind === "board" ? decorSprite(BOARD, 0, false)! : objectSprite(objectKey(o, w.clock.minute))).width });
  }
  return out;
}

export interface Ctx { w: World; L: Look; figures: Figures; t: number; lit: boolean; selected: string | null; hover: Target | null }

const kindAt = (w: World) => (x: number, y: number) => Object.values(w.objects).filter((o) => o.x === x && o.y === y && !o.holder).map((o) => o.kind);

/** Draußen: Deko, Dinge, Vorräte, Figuren (Dorfkoordinaten). */
export function outdoor(c: Ctx): Thing[] {
  const { w, L } = c, out: Thing[] = [], minute = w.clock.minute;
  const hov = (spr: HTMLCanvasElement, t: Target) => (same(t, c.hover) ? silhouette(spr) : null);
  for (const [k, x, y, e] of L.decor) {
    const spr = decorSprite(k, e, c.lit);
    if (!spr) continue;
    const target: Target | undefined = k === "house" ? { kind: "house", id: "0" } : undefined;
    out.push({ vx: x, vy: y, spr, target, bob: k === "boat", hover: target ? hov(spr, target) : null });
  }
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || isInside(L, o.x, o.y) || o.kind === "door" || o.kind === "seedbed") continue;
    const p = spot(w, L, o.id, o.x, o.y);
    if (p.sprite === "none") continue;
    const spr = o.kind === "board" ? decorSprite(BOARD, 0, false)! : objectSprite(objectKey(o, minute)), target: Target = { kind: "object", id: o.id };
    out.push({ vx: p.at[0], vy: p.at[1] + (o.kind === "plant" ? 0.2 : 0), spr, target, hover: hov(spr, target) });
  }
  for (const n of Object.values(w.resources)) {
    if (n.amount < 1 || n.x == null || n.y == null || isInside(L, n.x, n.y)) continue;
    const p = spot(w, L, n.id, n.x, n.y);
    if (p.sprite === "none" || (!p.sprite && n.resource === "water")) continue;
    const spr = p.sprite ? decorSprite(p.sprite, 0, false)! : resourceSprite(resourceKey(n)), target: Target = { kind: "resource", id: n.id };
    out.push({ vx: p.at[0], vy: p.at[1], spr, target, hover: hov(spr, target) });
  }
  for (const a of Object.values(w.agents) as AgentInfo[]) {
    const pos = c.figures.position(a.id);
    if (!pos || isInside(L, Math.floor(pos.x / T), Math.floor(pos.y / T))) continue;
    const p = c.figures.pose(a, c.t, kindAt(w));
    if (!p) continue;
    const target: Target = { kind: "agent", id: a.id };
    out.push({ vx: p.x - L.origin[0], vy: p.y - L.origin[1], spr: p.spr, target, hover: hov(p.spr, target),
      figure: { lift: p.lift, tool: p.toolSpr, toolAngle: p.toolAngle, ring: a.id === c.selected ? accentOf(a.id) : null, zzz: p.sleeping } });
  }
  return out;
}

/** Drinnen: Möbel, Vorräte, Einrichtung aus `look.interior`, Figuren (Weltpixel), wie im Mockup innen2. */
export function indoor(c: Ctx): HausThing[] {
  const { w, L } = c, out: HausThing[] = [], minute = w.clock.minute;
  const hov = (spr: HTMLCanvasElement, t: Target) => (same(t, c.hover) ? silhouette(spr) : null);
  const foot = (x: number, y: number) => ({ x: x * T + 8, y: (y + 1) * T - 1 });
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || !isInside(L, o.x, o.y) || (o.kind === "door" && !o.state.locked)) continue;
    const spr = objectSprite(objectKey(o, minute)), target: Target = { kind: "object", id: o.id };
    out.push({ ...foot(o.x, o.y), spr, target, hover: hov(spr, target), licht: (o.kind === "fireplace" || o.kind === "stove") && o.state.lit ? (o.kind === "fireplace" ? 1.3 : 0.6) : undefined });
  }
  for (const n of Object.values(w.resources)) {
    if (n.amount < 1 || n.x == null || n.y == null || !isInside(L, n.x, n.y) || n.resource === "water") continue;
    const spr = n.resource === "food" ? D.korb : resourceSprite(resourceKey(n)), target: Target = { kind: "resource", id: n.id };
    out.push({ ...foot(n.x, n.y), spr, target, hover: hov(spr, target) });
  }
  for (const [kind, x, y] of L.interior.decor ?? []) {
    const spr = hausDecor(kind, c.lit, ["#6cb7f3", "#cfefff"], "#b04a4a"), light = decorLight(kind);
    if (spr) out.push({ ...foot(x, y), spr, licht: c.lit && light ? light : undefined });
  }
  for (const a of Object.values(w.agents) as AgentInfo[]) {
    const pos = c.figures.position(a.id);
    if (!pos || !isInside(L, Math.floor(pos.x / T), Math.floor(pos.y / T))) continue;
    const p = c.figures.pose(a, c.t, kindAt(w));
    if (!p) continue;
    const target: Target = { kind: "agent", id: a.id }, ring = a.id === c.selected ? accentOf(a.id) : null;
    if (p.inBed) out.push({ x: p.x, y: p.y + 0.5, spr: p.spr, target, hover: hov(p.spr, target), ring });
    else if (p.sitting) out.push({ x: p.x, y: (a.y + 1) * T - 0.5, hoch: 5, spr: p.spr, target, hover: hov(p.spr, target), ring });   // vor dem Sofa einsortiert, angehoben
    else out.push({ x: p.x, y: p.y, hoch: p.lift, spr: p.spr, target, hover: hov(p.spr, target), ring, tool: p.toolSpr, toolAngle: p.toolAngle });
  }
  return out;
}

/** Wer ist gerade im Haus (nach der Lage der Figur)? */
export const occupants = (w: World, L: Look, figures: Figures) =>
  Object.keys(w.agents).filter((id) => { const p = figures.position(id); return !!p && isInside(L, Math.floor(p.x / T), Math.floor(p.y / T)); });
