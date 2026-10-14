// Was im Dorf und im Haus steht: Deko aus `look` (wie wObjects), Dinge und Vorräte aus dem Zustand an ihren Stellen im Bild,
// Figuren aus dem Fahrplan. Draußen und drinnen in Weltpixeln; was `look` in Dorfkoordinaten eines Gebiets führt, wird um dessen `frame` verschoben.
import type { AgentInfo, ObjectInfo, ResourceInfo, World } from "../../store/types";
import { accentOf } from "../art/people";
import { objectKey, objectSprite, resourceKey, resourceSprite } from "../art/things";
import type { Figures } from "../view/figures";
import { silhouette } from "../view/pieces";
import type { Target } from "../view/scene";
import type { Caster } from "./grund";
import type { Thing } from "./bild";
import * as D from "../art/rooms";
import { decorLight, decorSprite as hausDecor, type HausThing } from "./haus/bild";
import { boatSpot, seatOf } from "./dinge";
import { T, houseAt, housesOf, inRect, isInside, placeOf, type HouseLook, type Look } from "./look";
import { decorSprite } from "./sprites";

/** Dinge im Haus (AP15), gezeichnet mit der Einrichtung aus Mockup innen2. */
const HAUS_DINGE: Record<string, string> = { cat: "katze", floor_lamp: "stehlampe", candle: "kerze", armchair: "sessel:#5d8fb0", wardrobe: "schrank", crate: "kiste", basket: "korb" };
const SKY: [string, string] = ["#6cb7f3", "#cfefff"];
const same = (a?: Target | null, b?: Target | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const BOARD = "board";

/** Lage eines Dings im Bild (Weltpixel): aus `place`, auf einem Beet dessen Stelle, sonst die Kachel. */
function spot(w: World, L: Look, id: string, x: number, y: number): { at: [number, number]; sprite?: string } {
  const h = placeOf(L, id);
  if (h) return { ...h.p, at: [h.p.at[0] + h.region.frame[0], h.p.at[1] + h.region.frame[1]] };
  const bed = Object.values(w.objects).find((o) => o.kind === "seedbed" && o.x === x && o.y === y), hb = bed && placeOf(L, bed.id);
  if (hb) return { at: [hb.p.at[0] + hb.region.frame[0], hb.p.at[1] + hb.region.frame[1]] };
  return { at: [x * T + 8, (y + 1) * T - 2] };
}

/** Sprite eines Dings draußen: Mockup-Sprite aus `place` (Zustand: Laterne brennt, Vogelscheuche liegt), sonst das Objekt-Sprite. */
function thingSprite(w: World, L: Look, o: ObjectInfo, lit: boolean): HTMLCanvasElement {
  const p = placeOf(L, o.id)?.p;
  if (p?.sprite && p.sprite !== "none") {
    const kind = o.kind === "scarecrow" && o.state.upright === false ? "scareDown" : p.sprite;
    const s = decorSprite(kind, p.e ?? 0, o.kind === "lantern" ? !!o.state.lit : lit);
    if (s) return s;
  }
  return o.kind === "board" ? decorSprite(BOARD, 0, false)! : objectSprite(objectKey(o, w.clock.minute));
}

/** Sprites einer Quelle mit Bildstelle (Weltpixel): das erste an `at`, weitere aus `more` (z. B. drei Tomatenstauden). */
function sourceSprites(L: Look, n: ResourceInfo): { vx: number; vy: number; spr: HTMLCanvasElement }[] {
  const h = placeOf(L, n.id), p = h?.p;
  if (!h || !p?.sprite || p.sprite === "none") return [];
  const [fx, fy] = h.region.frame;
  return [[p.at[0], p.at[1], p.e ?? 0], ...(p.more ?? [])].flatMap(([vx, vy, e]) => { const spr = decorSprite(p.sprite!, e, false); return spr ? [{ vx: vx + fx, vy: vy + fy, spr }] : []; });
}

/** Feste Dinge für die Schatten in der Bodentextur (wie A: alle Objekte außer Boot und Figuren). */
export function casters(w: World, L: Look): Caster[] {
  const out: Caster[] = [];
  for (const R of L.regions) {
    for (const hs of R.houses) { const s = decorSprite(hs.sprite, 0, false); if (s) out.push({ x: hs.at[0] + R.frame[0], y: hs.at[1] + R.frame[1], w: s.width }); }
    for (const [k, x, y, e] of R.decor) { if (k === "boat") continue; const s = decorSprite(k, e, false); if (s) out.push({ x: x + R.frame[0], y: y + R.frame[1], w: s.width }); }
  }
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || isInside(L, o.x, o.y) || o.kind === "plant" || o.kind === "door" || o.kind === "boat") continue;
    const p = spot(w, L, o.id, o.x, o.y);
    if (p.sprite === "none") continue;
    out.push({ x: p.at[0], y: p.at[1], w: thingSprite(w, L, o, false).width });
  }
  for (const n of Object.values(w.resources)) for (const s of sourceSprites(L, n)) out.push({ x: s.vx, y: s.vy, w: s.spr.width });
  return out;
}

export interface Ctx { w: World; L: Look; figures: Figures; t: number; lit: boolean; selected: string | null; hover: Target | null }

const kindAt = (w: World) => (x: number, y: number) => Object.values(w.objects).filter((o) => o.x === x && o.y === y && !o.holder).map((o) => o.kind);

/** Draußen: Deko, Dinge, Vorräte, Figuren (Dorfkoordinaten). */
export function outdoor(c: Ctx): Thing[] {
  const { w, L } = c, out: Thing[] = [];
  const hov = (spr: HTMLCanvasElement, t: Target) => (same(t, c.hover) ? silhouette(spr) : null);
  for (const { n, region: R, house: H } of housesOf(L)) {                                   // Häuser zuerst (wie das Haus als erstes Stück der Deko in A)
    const spr = decorSprite(H.sprite, 0, c.lit);
    if (!spr) continue;
    const target: Target = { kind: "house", id: String(n) };
    out.push({ vx: H.at[0] + R.frame[0], vy: H.at[1] + R.frame[1], spr, target, hover: hov(spr, target) });
  }
  for (const R of L.regions) for (const [k, x, y, e] of R.decor) {
    const spr = decorSprite(k, e, c.lit);
    if (!spr) continue;
    out.push({ vx: x + R.frame[0], vy: y + R.frame[1], spr, bob: k === "boat" });
  }
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || isInside(L, o.x, o.y) || o.kind === "door" || o.kind === "seedbed") continue;
    const p = spot(w, L, o.id, o.x, o.y);
    if (p.sprite === "none") continue;
    const spr = thingSprite(w, L, o, c.lit), target: Target = { kind: "object", id: o.id };
    out.push({ vx: p.at[0], vy: p.at[1] + (o.kind === "plant" ? 0.2 : 0), spr, target, hover: hov(spr, target), bob: o.kind === "boat" });
  }
  for (const n of Object.values(w.resources)) {
    if (n.x == null || n.y == null || isInside(L, n.x, n.y)) continue;
    const many = sourceSprites(L, n), target: Target = { kind: "resource", id: n.id };
    if (many.length) { for (const s of many) out.push({ ...s, target, hover: hov(s.spr, target) }); continue; }   // Quelle mit Bild aus A (auch leer sichtbar)
    if (n.amount < 1) continue;
    const p = spot(w, L, n.id, n.x, n.y);
    if (p.sprite === "none" || n.resource === "water") continue;
    const spr = resourceSprite(resourceKey(n));
    out.push({ vx: p.at[0], vy: p.at[1], spr, target, hover: hov(spr, target) });
  }
  for (const a of Object.values(w.agents) as AgentInfo[]) {
    const pos = c.figures.position(a.id);
    if (!pos || isInside(L, Math.floor(pos.x / T), Math.floor(pos.y / T))) continue;
    const boat = boatSpot(w, L, a), p = c.figures.pose(a, c.t, kindAt(w), !!boat);
    if (!p) continue;
    const target: Target = { kind: "agent", id: a.id };
    out.push({ vx: boat ? boat[0] : p.x, vy: boat ? boat[1] + 2.5 : p.y, spr: p.spr, target, hover: hov(p.spr, target), bob: !!boat,   // im Boot: hinter dem Rumpf
      figure: { lift: boat ? 6 : p.lift, tool: p.toolSpr, toolAngle: p.toolAngle, ring: a.id === c.selected ? accentOf(a.id) : null, zzz: p.sleeping } });
  }
  return out;
}

/** Drinnen: Möbel, Vorräte, Einrichtung aus `look.interior`, Figuren (Weltpixel), wie im Mockup innen2. */
export function indoor(c: Ctx, H: HouseLook): HausThing[] {
  const { w } = c, out: HausThing[] = [], minute = w.clock.minute, rect = H.interior.rect, here = (x: number, y: number) => inRect(rect, x, y);
  const hov = (spr: HTMLCanvasElement, t: Target) => (same(t, c.hover) ? silhouette(spr) : null);
  const foot = (x: number, y: number) => ({ x: x * T + 8, y: (y + 1) * T - 1 });
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null || !here(o.x, o.y) || (o.kind === "door" && !o.state.locked)) continue;
    const deko = HAUS_DINGE[o.kind], lit = !!o.state.lit, target: Target = { kind: "object", id: o.id };
    const spr = (deko && hausDecor(deko, lit, SKY, "#b04a4a")) || objectSprite(objectKey(o, minute));
    const licht = deko ? (lit ? decorLight(deko) : 0) : (o.kind === "fireplace" || o.kind === "stove") && lit ? (o.kind === "fireplace" ? 1.3 : 0.6) : 0;
    out.push({ ...foot(o.x, o.y), spr, target, hover: hov(spr, target), licht: licht || undefined });
  }
  for (const n of Object.values(w.resources)) {
    if (n.amount < 1 || n.x == null || n.y == null || !here(n.x, n.y) || n.resource === "water") continue;
    const spr = n.resource === "food" ? D.korb : resourceSprite(resourceKey(n)), target: Target = { kind: "resource", id: n.id };
    out.push({ ...foot(n.x, n.y), spr, target, hover: hov(spr, target) });
  }
  for (const [kind, x, y] of H.interior.decor ?? []) {
    const spr = hausDecor(kind, c.lit, SKY, "#b04a4a"), light = decorLight(kind);
    if (spr) out.push({ ...foot(x, y), spr, licht: c.lit && light ? light : undefined });
  }
  for (const a of Object.values(w.agents) as AgentInfo[]) {
    const pos = c.figures.position(a.id);
    if (!pos || !here(Math.floor(pos.x / T), Math.floor(pos.y / T))) continue;
    const p = c.figures.pose(a, c.t, kindAt(w));
    if (!p) continue;
    const target: Target = { kind: "agent", id: a.id }, ring = a.id === c.selected ? accentOf(a.id) : null, seat = seatOf(w, a);
    if (seat?.kind === "armchair") { const f = foot(seat.x!, seat.y!); const q = c.figures.pose(a, c.t, kindAt(w), true)!; out.push({ x: f.x, y: f.y + 0.5, hoch: 4, spr: q.spr, target, hover: hov(q.spr, target), ring }); continue; }
    if (p.inBed) out.push({ x: p.x, y: p.y + 0.5, spr: p.spr, target, hover: hov(p.spr, target), ring });
    else if (p.sitting) out.push({ x: p.x, y: (a.y + 1) * T - 0.5, hoch: 5, spr: p.spr, target, hover: hov(p.spr, target), ring });   // vor dem Sofa einsortiert, angehoben
    else out.push({ x: p.x, y: p.y, hoch: p.lift, spr: p.spr, target, hover: hov(p.spr, target), ring, tool: p.toolSpr, toolAngle: p.toolAngle });
  }
  return out;
}

/** Wer ist gerade in welchem Haus (nach der Lage der Figur)? Index = Hausnummer, siehe `housesOf`. */
export function occupants(w: World, L: Look, figures: Figures): string[][] {
  const out: string[][] = housesOf(L).map(() => []);
  const nOf = new Map<HouseLook, number>(housesOf(L).map((h) => [h.house, h.n]));
  for (const id of Object.keys(w.agents)) {
    const p = figures.position(id), h = p && houseAt(L, Math.floor(p.x / T), Math.floor(p.y / T));
    if (h) out[nOf.get(h.region.houses[h.i])!].push(id);
  }
  return out;
}
