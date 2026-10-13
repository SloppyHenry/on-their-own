// Ein Bild: Himmel, Boden, alle aufrechten Dinge nach Tiefe sortiert, Figuren, Rauch; dazu Lichter, Schildpositionen und
// die Trefferliste für Klicks. Alles im kleinen Puffer, ohne Glättung – wie frame() in Mockup A.
import type { AgentInfo, World } from "../../store/types";
import { house } from "../art/village";
import { moodAt, weatherMood, type Mood } from "../art/palette";
import { accentOf } from "../art/people";
import { contains } from "./buildings";
import { Figures, type Pose } from "./figures";
import type { Ground } from "./ground";
import type { GroundData } from "./groundData";
import { GroundPass } from "./groundPass";
import { drawPose, drawSmoke, silhouette, wallPiece, type WallPiece } from "./pieces";
import { project, visibleWorld, type Camera, type Viewport } from "./projection";
import type { Item, Target } from "./scene";
import { Sky } from "./sky";
import { drawGhost, drawPreviewGround, type PreviewIn } from "./previewDraw";

export interface Drawn { x: number; y: number; w: number; h: number; spr: HTMLCanvasElement; target?: Target }
export interface AgentSpot { id: string; x: number; y: number; sc: number; visible: boolean; house: number }
export interface FrameOut {
  drawn: Drawn[];
  lights: { x: number; y: number; r: number }[];
  agents: AgentSpot[];
  houses: { i: number; x: number; y: number; cy: number; occupants: string[] }[];
  rooms: { id: string; x: number; y: number }[];
  /** Ziel der Wegvorschau im Bild (für die Dauer-Anzeige). */
  goal: { x: number; y: number } | null;
  mood: Mood;
}
export interface FrameIn {
  w: World;
  cam: Camera;
  vp: Viewport;
  t: number;
  interior: number;
  selected: string | null;
  follow: string | null;
  hover: Target | null;
  budgetMs: number;
  /** Mitspieler-Vorschau (nur wenn der Schalter an ist). */
  preview: PreviewIn | null;
}

const HOUSE = [house(false), house(true)];
const HOUSE_LIGHTS = [[-17, 32, 1], [17, 32, 1], [0, 59, 0.8], [9, 31, 0.7]];
const same = (a?: Target | null, b?: Target | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;

export class Renderer {
  private sky = new Sky();
  private pass = new GroundPass();
  private statics: Item[] = [];
  private walls: WallPiece[] = [];

  constructor(private data: GroundData, private ground: Ground, readonly figures: Figures, readonly low: HTMLCanvasElement) {}

  setStatics(items: Item[]) { this.statics = items; }
  setWalls(walls: WallPiece[]) { this.walls = walls; }
  houseSprite = (lit: boolean) => HOUSE[lit ? 1 : 0];

  render(f: FrameIn): FrameOut {
    const { w, cam, vp, interior } = f;
    if (this.low.width !== vp.w || this.low.height !== vp.h) { this.low.width = vp.w; this.low.height = vp.h; }
    const g = this.low.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, vp.w, vp.h);
    const mood = weatherMood(moodAt(w.clock.minute % 1440), w.weather.kind), lampsOn = mood.lights > 0.5;
    if (cam.mode === "tiefe") {
      this.sky.draw(g, cam, vp, mood, w.weather.kind, f.t, Math.floor((w.clock.minute % 1440) / 10));
      if (interior >= 0) { g.fillStyle = "rgba(14,10,22,0.8)"; g.fillRect(0, 0, vp.w, vp.h * 0.4); }
    } else { g.fillStyle = "#1c2a1a"; g.fillRect(0, 0, vp.w, vp.h); }
    g.drawImage(this.pass.render(this.ground, this.data, cam, vp, mood, f.t, interior, f.budgetMs), 0, 0);

    if (f.preview) drawPreviewGround(g, (x, y) => project(cam, vp, x, y), f.preview, f.t);

    // Wer ist in welchem Gebäude?
    const bs = this.data.buildings, inB = new Map<string, number>(), occupants: string[][] = bs.map(() => []);
    for (const a of Object.values(w.agents)) { const i = bs.findIndex((b) => contains(b, a.x, a.y)); inB.set(a.id, i); if (i >= 0) occupants[i].push(a.id); }

    const vis = visibleWorld(cam, vp, 120), m = 48;
    const list: { y: number; item?: Item; pose?: Pose; wall?: WallPiece; ghost?: [number, number] }[] = [];
    for (const it of this.statics) {
      if (interior >= 0 ? it.inside !== interior : it.inside !== -1) continue;
      if (it.x < vis.x0 - m || it.x > vis.x1 + m || it.y < vis.y0 - 8 || it.y > vis.y1) continue;
      list.push({ y: it.y, item: it });
    }
    if (interior >= 0) for (const wp of this.walls) list.push({ y: wp.y, wall: wp });
    const kindAt = (x: number, y: number) => Object.values(w.objects).filter((o) => o.x === x && o.y === y && !o.holder).map((o) => o.kind);
    const agents: AgentSpot[] = [];
    for (const a of Object.values(w.agents) as AgentInfo[]) {
      const p = this.figures.pose(a, f.t, kindAt), hb = inB.get(a.id) ?? -1, shown = interior >= 0 ? hb === interior : hb < 0;
      if (!p) continue;
      const sp = project(cam, vp, p.x, p.y);
      agents.push({ id: a.id, x: sp.x, y: sp.y, sc: sp.sc, visible: shown && sp.x > -20 && sp.x < vp.w + 20 && sp.y > 0 && sp.y < vp.h + 30, house: shown ? -1 : hb });
      if (shown) list.push({ y: p.y + (p.inBed ? 0.3 : 0), pose: p });
    }
    const gh = f.preview?.ghost, ghIn = gh ? bs.findIndex((b) => contains(b, gh[0], gh[1])) : -1;
    if (gh && ghIn === interior) list.push({ y: gh[1] * 16 + 14, ghost: gh });
    list.sort((a, b) => a.y - b.y);

    // Halb durchsichtig, was vor der gewählten oder verfolgten Figur steht
    const focusId = f.follow ?? f.selected, focus = agents.find((a) => a.id === focusId && a.visible);
    const fr = focus ? { x0: focus.x - 9 * focus.sc, x1: focus.x + 9 * focus.sc, y0: focus.y - 26 * focus.sc, y1: focus.y } : null;
    const focusY = focusId ? this.figures.position(focusId)?.y ?? Infinity : Infinity;
    const drawn: Drawn[] = [], lights: FrameOut["lights"] = [];
    for (const e of list) {
      if (e.wall) { wallPiece(g, cam, vp, e.wall); continue; }
      if (e.ghost) { drawGhost(g, (x, y) => project(cam, vp, x, y), e.ghost); continue; }
      if (e.pose) { drawPose(g, cam, vp, e.pose, f.t, e.pose.id === f.selected, drawn); continue; }
      const it = e.item!, lit = it.lit === "house" ? occupants[Number(it.target?.id)]?.length > 0 : it.lit === "lamp" ? lampsOn : false;
      const spr = it.lit === "house" ? HOUSE[lit ? 1 : 0] : it.spr(lit), p = project(cam, vp, it.x, it.y);
      if (p.t > 1.02) continue;                                                  // hinter dem Horizont
      const sw = spr.width * p.sc, sh = spr.height * p.sc, dx = Math.round(p.x - sw / 2), dy = Math.round(p.y - sh);
      if (dx > vp.w || dx + sw < 0 || dy > vp.h || dy + sh < 0) continue;
      let alpha = 1;
      if (fr && it.y > focusY && dx < fr.x1 && dx + sw > fr.x0 && dy < fr.y1 && dy + sh > fr.y0 && sh > 14 * p.sc) alpha = 0.35;
      if (same(it.target, f.hover)) { const sil = silhouette(spr); g.globalAlpha = 0.9; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sil, dx + ox, dy + oy, Math.round(sw), Math.round(sh)); }
      g.globalAlpha = alpha;
      g.drawImage(spr, dx, dy, Math.round(sw), Math.round(sh));
      g.globalAlpha = 1;
      drawn.push({ x: dx, y: dy, w: Math.round(sw), h: Math.round(sh), spr, target: it.target });
      if (it.lit === "house") {
        const b = Number(it.target!.id);
        if (lit) for (const [ox, h, r] of HOUSE_LIGHTS) { const q = project(cam, vp, it.x + ox, it.y, h); lights.push({ x: q.x, y: q.y, r: 14.5 * q.sc * r }); }
        if (this.smoky(w, b)) drawSmoke(g, cam, vp, it.x + 19, it.y, f.t, mood.stars > 0.5);
      } else if (it.light && (it.lit !== "lamp" || lampsOn)) { const q = project(cam, vp, it.x, it.y, it.light.h); lights.push({ x: q.x, y: q.y, r: 14.5 * q.sc * it.light.r }); }
    }
    this.marks(g, f, agents, drawn);
    const rooms = interior >= 0 ? bs[interior].rooms.map((id) => { const l = w.locations[id], [rx, ry, rw, rh] = l.rect, p = project(cam, vp, (rx + rw / 2) * 16, (ry + rh) * 16 - 2); return { id, x: p.x, y: p.y }; }) : [];
    const houses = bs.map((b, i) => { const p = project(cam, vp, b.door.x * 16 + 8, (b.door.y + 1) * 16, 84), c = project(cam, vp, b.door.x * 16 + 8, (b.door.y + 1) * 16, 40); return { i, x: p.x, y: p.y, cy: c.y, occupants: occupants[i] }; });
    const gl = f.preview?.goal ? project(cam, vp, f.preview.goal[0] * 16 + 8, f.preview.goal[1] * 16 + 8) : null;
    return { drawn, lights, agents, houses, rooms, goal: gl ? { x: gl.x, y: gl.y } : null, mood };
  }

  /** Rauch, wenn im Gebäude ein Kamin brennt. */
  private smoky(w: World, b: number) {
    const bld = this.data.buildings[b];
    return Object.values(w.objects).some((o) => o.kind === "fireplace" && o.state.lit && o.x != null && o.y != null && contains(bld, o.x, o.y));
  }

  /** Gespräch als Punktlinie zwischen den Köpfen, benutztes Objekt mit Rahmen in der Farbe der Figur. */
  private marks(g: CanvasRenderingContext2D, f: FrameIn, agents: AgentSpot[], drawn: Drawn[]) {
    const vis = agents.filter((a) => a.visible), talking = vis.filter((a) => f.w.agents[a.id]?.status === "talking");
    g.fillStyle = "rgba(240,200,130,0.9)";
    for (let i = 0; i < talking.length - 1; i++) {
      const a = talking[i], b = talking[i + 1], ay = a.y - 26 * a.sc, by = b.y - 26 * b.sc, d = Math.hypot(a.x - b.x, ay - by);
      if (d > 9 * 16 * Math.max(a.sc, b.sc)) continue;
      const n = Math.ceil(d / 3);
      for (let k = 0; k < n; k += 2) { const u = (k + ((f.t * 6) % 2)) / n; g.fillRect(Math.round(a.x + (b.x - a.x) * u), Math.round(ay + (by - ay) * u), 1, 1); }
    }
    for (const a of vis) {
      const act = f.w.agents[a.id]?.action;
      if (!act) continue;
      for (const k of ["object_id", "seedbed_id", "target", "site", "node", "plant"]) {
        const id = act.params[k], d = typeof id === "string" ? drawn.find((x) => x.target?.id === id) : null;
        if (!d) continue;
        g.globalAlpha = 0.6 + Math.sin(f.t * 5) * 0.3;
        g.strokeStyle = accentOf(a.id);
        g.lineWidth = 1;
        g.strokeRect(d.x - 0.5, d.y - 0.5, d.w + 1, d.h + 1);
        g.globalAlpha = 1;
      }
    }
  }
}
