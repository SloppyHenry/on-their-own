// Weltansicht ohne Phaser: Bildschleife, eigene Kamera (Zoom, Ziehen, Folgen, Gesamtansicht, Fahrten), Innenansicht der Häuser,
// Zeigen und Klicken. Liest den Zustand nur über die Brücke und erfindet nichts.
import type { World } from "../../store/types";
import type { WorldBridge } from "../worldBridge";
import { css } from "../art/palette";
import { buildingAt, type Building } from "./buildings";
import { clampToMap, dragBy, fit, focusOn, followTo, switchMode, zoomAt } from "./camera";
import { Figures } from "./figures";
import { Ground } from "./ground";
import { GroundData, T } from "./groundData";
import { wallPieces } from "./pieces";
import { hitTest, locationAt } from "./picking";
import { drawAtmo, drawGlow } from "./post";
import { unproject, type Camera, type Viewport } from "./projection";
import type { PreviewIn } from "./previewDraw";
import { Renderer, type FrameOut } from "./renderer";
import { castersOf, decoItems, fenceItems, houseItems, stateItems, treeItems, type Item, type Target } from "./scene";

export interface PlayerHooks {
  /** true: der Klick war eine Absicht (gehen, Menü), nicht Auswahl. `sx`, `sy` in Bildschirmpixeln. */
  click(t: Target | null, tile: { x: number; y: number } | null, sx: number, sy: number): boolean;
  hover(tile: { x: number; y: number } | null): void;
  preview(): PreviewIn;
}

export interface ViewElements { host: HTMLElement; canvas: HTMLCanvasElement; glow: HTMLCanvasElement; atmo: HTMLCanvasElement; grade: HTMLElement; tilt: HTMLElement }

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class WorldView {
  cam: Camera = { fx: 512, fy: 320, zoom: 1, mode: "tiefe" };
  vp: Viewport = { w: 320, h: 200 };
  pf = 4;
  private world: World | null = null;
  private data: GroundData | null = null;
  private ground: Ground | null = null;
  private renderer: Renderer | null = null;
  private figures = new Figures();
  private statics: Record<"trees" | "fences" | "houses" | "deco" | "state", Item[]> = { trees: [], fences: [], houses: [], deco: [], state: [] };
  interior = -1;
  private outdoorCam: Camera | null = null;
  private anim: { from: Camera; to: Camera; k: number } | null = null;
  last: FrameOut | null = null;
  private hover: Target | null = null;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private lastClick = { id: "", t: 0 };
  private raf = 0;
  private lastT = 0;
  private frames = 0;
  private bucket = -1;
  private started = false;
  private selKey = "";
  private off: (() => void)[] = [];
  /** Mitspieler-Vorschau hängt sich hier ein (Klick und Zeiger, wenn der Schalter an ist). */
  player: PlayerHooks | null = null;

  constructor(private els: ViewElements, private bridge: WorldBridge) {
    const h = els.host, on = <K extends keyof HTMLElementEventMap>(ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => { h.addEventListener(ev, fn as EventListener, opt); this.off.push(() => h.removeEventListener(ev, fn as EventListener, opt)); };
    on("wheel", (e) => { e.preventDefault(); const p = this.point(e); this.cam = zoomAt(this.cam, this.vp, p.x, p.y, Math.exp(-e.deltaY * 0.0015)); this.anim = null; }, { passive: false });
    on("pointerdown", (e) => { if (e.button === 0) this.drag = { ...this.point(e), moved: false }; });
    on("pointermove", (e) => this.move(e));
    on("pointerup", (e) => this.up(e));
    on("pointerleave", () => { this.drag = null; this.hover = null; this.player?.hover(null); });
    on("contextmenu", (e) => { e.preventDefault(); this.click(this.point(e), true); });
    bridge.commands.fit = () => { this.leaveInterior(); this.animateTo(fit(this.cam, this.vp, (this.data?.w ?? 64) * T, (this.data?.h ?? 40) * T)); };
    bridge.commands.focusTile = (x, y) => this.focusTile(x, y);
    bridge.commands.leaveInterior = () => { this.bridge.setFollow(null); this.leaveInterior(); };
    bridge.commands.toggleFollow = () => {
      const sel = bridge.selection(), f = bridge.follow(), target = sel?.kind === "agent" ? sel.id : bridge.lastAgent();
      if (f) bridge.setFollow(null); else if (target) bridge.setFollow(target);
    };
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() { cancelAnimationFrame(this.raf); this.off.forEach((f) => f()); this.bridge.commands = {}; }

  private point(e: MouseEvent) { const r = this.els.host.getBoundingClientRect(); return { x: (e.clientX - r.left) / this.pf, y: (e.clientY - r.top) / this.pf }; }

  private resize() {
    const W = this.els.host.clientWidth, H = this.els.host.clientHeight;
    if (!W || !H) return false;
    const pf = H >= 560 ? 4 : H >= 380 ? 3 : 2, vp = { w: Math.ceil(W / pf), h: Math.ceil(H / pf) }, c = this.els.canvas;
    if (vp.w !== this.vp.w || vp.h !== this.vp.h || pf !== this.pf || c.width !== vp.w) {
      this.pf = pf; this.vp = vp; c.width = vp.w; c.height = vp.h; c.style.width = `${vp.w * pf}px`; c.style.height = `${vp.h * pf}px`;
    }
    for (const x of [this.els.glow, this.els.atmo]) if (x.width !== W || x.height !== H) { x.width = W; x.height = H; }
    return true;
  }

  // ---- Zustand → Szene ------------------------------------------------------
  private sync(w: World) {
    const prev = this.world, structural = !prev || w.map !== prev.map || w.locations !== prev.locations || w.tileTypes !== prev.tileTypes;
    this.world = w;
    const locs = Object.values(w.locations);
    if (structural) {
      const data = new GroundData({ rows: w.map.rows, legend: w.map.legend, tileTypes: w.tileTypes, locations: locs, objects: Object.values(w.objects) });
      this.data = data;
      this.ground = new Ground(data, data.buildings.map((b) => ({ x: b.door.x * T + 8, y: (b.door.y + 1) * T })));
      this.renderer = new Renderer(data, this.ground, this.figures, this.els.canvas);
      this.statics.trees = treeItems(data); this.statics.fences = fenceItems(data, locs); this.statics.deco = decoItems(data, locs);
      this.statics.houses = houseItems(data.buildings, this.renderer.houseSprite);
      if (this.interior >= data.buildings.length) this.interior = -1;
      this.ground.setInterior(this.interior);
      this.renderer.setWalls(this.interior >= 0 ? wallPieces(data.buildings[this.interior], data) : []);
    }
    const bucket = Math.floor(w.clock.minute / 30);
    if (structural || w.objects !== prev?.objects || w.resources !== prev?.resources || bucket !== this.bucket) {
      this.bucket = bucket;
      const data = this.data!;
      this.statics.state = stateItems(w, (x, y) => { const i = data.idx(x, y); return i >= 0 ? data.bld[i] : -1; });
      const all = [...this.statics.trees, ...this.statics.fences, ...this.statics.houses, ...this.statics.deco, ...this.statics.state];
      this.renderer!.setStatics(all);
      this.ground!.setCasters(castersOf(all));
    }
    if (!this.started) this.firstView(w);
  }

  private firstView(w: World) {
    this.started = true;
    this.cam = { ...this.cam, mode: this.bridge.mode(), zoom: this.bridge.mode() === "flach" ? 0.6 : 0.8 };
    const bs = this.data!.buildings, ags = Object.values(w.agents);
    const inside = bs.findIndex((b) => ags.length > 0 && ags.every((a) => buildingAt([b], a.x, a.y)));
    if (inside >= 0) { const d = bs[inside].door; this.cam = focusOn(this.cam, d.x * T + 8, (d.y + 1) * T - 40); return; }
    const cx = ags.reduce((s, a) => s + a.x, 0) / Math.max(1, ags.length), cy = ags.reduce((s, a) => s + a.y, 0) / Math.max(1, ags.length);
    this.cam = focusOn(this.cam, cx * T + 8, cy * T + 8);
  }

  // ---- Innenansicht ---------------------------------------------------------
  private interiorCam(b: Building): Camera {
    const bw = (b.bbox.x1 - b.bbox.x0 + 1) * T, bh = (b.bbox.y1 - b.bbox.y0 + 1) * T, cx = (b.bbox.x0 * T + (b.bbox.x1 + 1) * T) / 2, cy = (b.bbox.y0 * T + (b.bbox.y1 + 1) * T) / 2;
    if (this.cam.mode === "flach") return focusOn(this.cam, cx, cy, Math.min(this.vp.w / (bw * 1.1), this.vp.h / (bh * 1.3)));
    return focusOn(this.cam, cx, cy + bh * 0.08, Math.min((this.vp.w * 1.12) / bw, (this.vp.h * 1.44) / (bh * 1.55)));
  }

  enterInterior(i: number) {
    if (!this.data || i < 0 || i === this.interior) return;
    if (this.interior < 0) this.outdoorCam = this.cam;
    this.interior = i;
    this.ground!.setInterior(i);
    this.renderer!.setWalls(wallPieces(this.data.buildings[i], this.data));
    this.animateTo(this.interiorCam(this.data.buildings[i]));
  }

  leaveInterior() {
    if (this.interior < 0) return;
    const b = this.data!.buildings[this.interior];
    this.interior = -1;
    this.ground!.setInterior(-1);
    this.renderer!.setWalls([]);
    this.animateTo(this.outdoorCam ?? focusOn(this.cam, b.door.x * T + 8, (b.door.y + 1) * T - 40, 1));
    this.outdoorCam = null;
  }

  /** Kachel vor der Haustür eines Gebäudes (Ziel für „hingehen“). */
  doorOf(i: number): { x: number; y: number } | null {
    const b = this.data?.buildings[i];
    return b ? { x: b.door.x, y: b.door.y + 1 } : null;
  }

  private animateTo(to: Camera) { this.anim = { from: this.cam, to: { ...to, mode: this.cam.mode }, k: 0 }; }

  private focusTile(x: number, y: number) {
    const b = this.data ? buildingAt(this.data.buildings, x, y) : null;
    if (b) this.enterInterior(this.data!.buildings.indexOf(b));
    else { this.leaveInterior(); this.animateTo(focusOn(this.cam, x * T + 8, y * T + 8, Math.max(this.cam.zoom, 1.2))); }
  }

  // ---- Zeiger ----------------------------------------------------------------
  private tileAt(sx: number, sy: number) { const g = unproject(this.cam, this.vp, sx, sy); return g ? { x: Math.floor(g.x / T), y: Math.floor(g.y / T) } : null; }

  private move(e: PointerEvent) {
    const p = this.point(e);
    if (this.drag && e.buttons & 1) {
      if (!this.drag.moved && Math.hypot(p.x - this.drag.x, p.y - this.drag.y) * this.pf < 4) return;
      if (!this.drag.moved) this.bridge.setFollow(null);
      this.drag.moved = true;
      this.cam = dragBy(this.cam, this.vp, this.drag, p); this.anim = null;
      this.drag.x = p.x; this.drag.y = p.y;
      this.els.host.style.cursor = "grabbing";
      return;
    }
    this.hover = this.last ? hitTest(this.last.drawn, p.x, p.y) : null;
    const tile = this.tileAt(p.x, p.y), yard = !this.hover && this.interior < 0 && tile && this.data ? buildingAt(this.data.buildings, tile.x, tile.y) : null;
    if (yard) this.hover = { kind: "house", id: String(this.data!.buildings.indexOf(yard)) };
    this.player?.hover(this.bridge.playerPreview() ? tile : null);
    this.els.host.style.cursor = this.hover ? "pointer" : this.bridge.playerPreview() && tile ? "crosshair" : "default";
  }

  private up(e: PointerEvent) {
    const dragged = this.drag?.moved;
    this.drag = null;
    this.els.host.style.cursor = "default";
    if (e.button !== 0 || dragged || !this.world) return;
    this.click(this.point(e), e.shiftKey);
  }

  /** Klick: Figur wählen (doppelt: folgen), Haus öffnen, Raum oder Ort wählen; mit Mitspieler-Vorschau gehen/handeln (Umschalt/rechts: wählen). */
  private click(p: { x: number; y: number }, selectOnly: boolean) {
    const w = this.world, data = this.data;
    if (!w || !data) return;
    const hit = this.last ? hitTest(this.last.drawn, p.x, p.y) : null, tile = this.tileAt(p.x, p.y);
    if (!selectOnly && this.bridge.playerPreview() && this.player?.click(hit, tile, p.x * this.pf, p.y * this.pf)) return;
    if (hit?.kind === "agent") {
      const now = performance.now();
      this.bridge.select({ kind: "agent", id: hit.id });
      if (this.lastClick.id === hit.id && now - this.lastClick.t < 350) this.bridge.setFollow(hit.id);
      this.lastClick = { id: hit.id, t: now };
      return;
    }
    if (hit?.kind === "house") { this.enterInterior(Number(hit.id)); return; }
    const t = hit && (hit.kind === "object" || hit.kind === "resource") ? this.tileOf(hit) ?? tile : tile;
    if (!t) return;
    const b = buildingAt(data.buildings, t.x, t.y), bi = b ? data.buildings.indexOf(b) : -1;
    if (this.interior < 0 && bi >= 0) { this.enterInterior(bi); return; }
    if (this.interior >= 0 && bi !== this.interior) { this.bridge.select(null); this.bridge.setFollow(null); this.leaveInterior(); return; }
    const loc = locationAt(w, t.x, t.y);
    this.bridge.select(loc ? { kind: "location", id: loc.id } : null);
  }

  private tileOf(t: Target) {
    const o = t.kind === "object" ? this.world!.objects[t.id] : this.world!.resources[t.id];
    return o && o.x != null && o.y != null ? { x: o.x, y: o.y } : null;
  }

  // ---- Bild für Bild ---------------------------------------------------------
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const w = this.bridge.world();
    if (!w || !this.resize()) return;
    const dt = Math.min(0.1, this.lastT ? (now - this.lastT) / 1000 : 0.016), t = now / 1000;
    this.lastT = now;
    if (w !== this.world) this.sync(w);
    const data = this.data!;
    if (this.bridge.mode() !== this.cam.mode) { this.cam = switchMode(this.cam, this.bridge.mode()); this.anim = null; if (this.interior >= 0) this.cam = this.interiorCam(data.buildings[this.interior]); }
    this.figures.update(w, dt);
    this.followAndSelect(w, dt);
    if (this.anim) {
      const a = this.anim; a.k = Math.min(1, a.k + dt / 0.6);
      const e = a.k * a.k * (3 - 2 * a.k);
      this.cam = { ...this.cam, fx: lerp(a.from.fx, a.to.fx, e), fy: lerp(a.from.fy, a.to.fy, e), zoom: Math.exp(lerp(Math.log(a.from.zoom), Math.log(a.to.zoom), e)) };
      if (a.k >= 1) this.anim = null;
    }
    this.cam = clampToMap(this.cam, data.w * T, data.h * T);
    const sel = this.bridge.selection(), budget = this.frames++ < 3 ? 400 : 10, t0 = performance.now();
    this.last = this.renderer!.render({ w, cam: this.cam, vp: this.vp, t, interior: this.interior, selected: sel?.kind === "agent" ? sel.id : null, follow: this.bridge.follow(), hover: this.hover, budgetMs: budget, preview: this.bridge.playerPreview() && this.player ? this.player.preview() : null });
    this.post(w, t, dt);
    this.emit();
    this.perf.push(performance.now() - t0);
    if (this.perf.length > 600) this.perf.shift();
  };

  /** Rechenzeit der letzten Bilder in ms (Bildaufbau, Effekte, Schilder) – für die Leistungsmessung. */
  readonly perf: number[] = [];

  private followAndSelect(w: World, dt: number) {
    const data = this.data!, f = this.bridge.follow();
    if (f && w.agents[f]) {
      const a = w.agents[f], b = buildingAt(data.buildings, a.x, a.y), bi = b ? data.buildings.indexOf(b) : -1;
      if (bi >= 0 && bi !== this.interior) this.enterInterior(bi);
      else if (bi < 0 && this.interior >= 0) this.leaveInterior();
      const p = this.figures.position(f);
      if (p && !this.anim) this.cam = followTo(this.cam, p.x, p.y - 8, dt);
    }
    const sel = this.bridge.selection(), key = sel ? `${sel.kind}:${sel.id}` : "";
    if (key !== this.selKey) {
      this.selKey = key;
      if (sel?.kind === "location") { const i = data.buildings.findIndex((b) => b.rooms.includes(sel.id)); if (i >= 0) this.enterInterior(i); }
    }
  }

  private post(w: World, t: number, dt: number) {
    const out = this.last!, mood = out.mood, reduced = reducedMotion();
    drawGlow(this.els.glow.getContext("2d")!, this.els.glow.width, this.els.glow.height, out.lights, this.pf, this.cam.mode === "flach" ? { ...mood, glowA: mood.glowA * 0.9 } : mood);
    drawAtmo(this.els.atmo.getContext("2d")!, { w: this.els.atmo.width, h: this.els.atmo.height, mood, weather: w.weather.kind, t, dt, particles: !reduced, pf: this.pf });
    const grade = css(mood.grade);
    if (this.els.grade.style.backgroundColor !== grade) this.els.grade.style.backgroundColor = grade;
    const tilt = this.cam.mode === "tiefe" && !reduced ? "" : "none";
    if (this.els.tilt.style.display !== tilt) this.els.tilt.style.display = tilt;
  }

  private emit() {
    const out = this.last!, pf = this.pf;
    this.bridge.emitFrame({
      agents: out.agents.map((a) => ({ id: a.id, x: a.x * pf, y: a.y * pf, scale: a.sc * pf, visible: a.visible, house: a.house })),
      houses: out.houses.map((h) => ({ ...h, x: h.x * pf, y: h.y * pf, cy: h.cy * pf })),
      rooms: out.rooms.map((r) => ({ ...r, x: r.x * pf, y: r.y * pf })),
      interior: this.interior,
      interiorRooms: this.interior >= 0 ? this.data!.buildings[this.interior].rooms : [],
      goal: out.goal ? { x: out.goal.x * pf, y: out.goal.y * pf } : null,
    });
  }
}
