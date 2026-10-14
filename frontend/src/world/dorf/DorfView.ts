// Weltansicht für Welten nach Mockup A: Bild A in ganzzahliger Vergrößerung, Zoom 1× / 2× / 3× als Vergrößerung des fertigen
// Bildes (nichts wird neu abgetastet, darum flimmert nichts), Verschieben mit WASD, Pfeilen und Ziehen, Klick aufs Haus zeigt
// es von innen. Bildaufbau im Takt von A (alle 40 ms), Anzeige in jedem Bild.
import type { World } from "../../store/types";
import { moodAt, weatherMood, type Mood } from "../art/palette";
import type { PlayerHooks } from "../view/WorldView";
import { Figures } from "../view/figures";
import { hitTest, locationAt } from "../view/picking";
import { weather } from "../view/post";
import { nameOf } from "../player/actions";
import { drawGhost, drawPreviewGround } from "../view/previewDraw";
import type { Target } from "../view/scene";
import type { WorldBridge } from "../worldBridge";
import { unproject, type Mode } from "./abbild";
import { Dorfbild, type Drawn } from "./bild";
import { Hausbild, type HausOut, type Tageszeit } from "./haus/bild";
import { makePlan } from "./haus/plan";
import { T, isInside, lookOf, type Look } from "./look";
import { boatSpot, glowing } from "./dinge";
import { casters, indoor, occupants, outdoor } from "./szene";

const ZMAX = 3;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const daytime = (m: Mood) => (m.stars > 0.5 ? "Nacht" : m.glowA > 0.2 ? "Abend" : "Tag");

const TIP_MS = 400;                                   // Namensblase erscheint nach kurzem Verweilen über einem Ding

export class DorfView {
  interior = -1;
  player: PlayerHooks | null = null;
  readonly perf: number[] = [];
  private bild: Dorfbild;
  private figures = new Figures();
  private world: World | null = null;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private S = 1;
  /** Anzeige: Bildschirm = Bildpunkt × Z − o (ganze Gerätepixel). */
  Z = 1;
  private o = { x: 0, y: 0 };
  private drawn: Drawn[] = [];
  private hover: Target | null = null;
  /** Namensblase: seit wann der Zeiger auf demselben Ding steht, und wo (CSS-Pixel). */
  private hoverSince = 0;
  private mouse = { x: 0, y: 0 };
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private keys = new Set<string>();
  private wheel = 0;
  private lastClick = { id: "", t: 0 };
  private lastCompose = 0;
  private lastT = 0;
  private raf = 0;
  private haus: Hausbild | null = null;
  private hausKey = "";
  private innen: HausOut | null = null;
  /** Innenansicht: ganzes Haus (null) oder ein Raum groß (Ort). */
  room: string | null = null;
  private off: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private bridge: WorldBridge, look: Look) {
    this.bild = new Dorfbild(look);
    const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => { el.addEventListener(ev, fn as EventListener, opt); this.off.push(() => el.removeEventListener(ev, fn as EventListener, opt)); };
    on(host, "wheel", (e) => { e.preventDefault(); this.wheelBy(e.deltaY * (e.deltaMode === 1 ? 30 : 1), e); }, { passive: false });
    on(host, "pointerdown", (e) => { this.hoverSince = Infinity; if (e.button === 0) this.drag = { x: e.clientX, y: e.clientY, moved: false }; });   // nach dem Klick keine Namensblase, bis der Zeiger weiterzieht
    on(host, "pointermove", (e) => this.move(e));
    on(host, "pointerup", (e) => this.up(e));
    on(host, "pointerleave", () => { this.drag = null; this.hover = null; this.hoverSince = 0; this.player?.hover(null); });
    on(host, "contextmenu", (e) => { e.preventDefault(); this.click(e, true); });
    on(window, "keydown", (e) => { if (!(e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) this.keys.add(e.code); });
    on(window, "keyup", (e) => this.keys.delete(e.code));
    on(window, "blur", () => this.keys.clear());
    bridge.commands.fit = () => { this.leaveInterior(true); this.Z = 1; this.o = this.base(); };
    bridge.commands.focusTile = (x, y) => this.focusTile(x, y);
    bridge.commands.leaveInterior = () => { bridge.setFollow(null); this.leaveInterior(); };
    bridge.commands.toggleFollow = () => { const sel = bridge.selection(), f = bridge.follow(), id = sel?.kind === "agent" ? sel.id : bridge.lastAgent(); if (f) bridge.setFollow(null); else if (id) bridge.setFollow(id); };
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() { cancelAnimationFrame(this.raf); this.off.forEach((f) => f()); this.bridge.commands = {}; }

  get look() { return this.bild.look; }

  // ---- Größe und Anzeige ---------------------------------------------------------
  private resize(): boolean {
    const dpr = window.devicePixelRatio || 1, W = Math.round(this.host.clientWidth * dpr), H = Math.round(this.host.clientHeight * dpr);
    if (!W || !H) return false;
    if (W === this.W && H === this.H && dpr === this.dpr) return true;
    this.dpr = dpr; this.W = W; this.H = H;
    this.S = Math.max(1, Math.floor(H / 200));                     // ganzzahlige Vergrößerung des Puffers, Bild A füllt die Höhe
    const c = this.canvas;
    c.width = W; c.height = H; c.style.width = `${W / dpr}px`; c.style.height = `${H / dpr}px`;
    this.o = this.clamp(this.Z === 1 ? this.base() : this.o);
    return true;
  }

  private bufferSize() { return { lw: Math.ceil(this.W / this.S), lh: Math.ceil(this.H / this.S) }; }
  /** Versatz bei 1×: überstehende Pufferpixel gleich verteilt links/rechts, oben (Himmel). */
  private base() { const { lw, lh } = this.bufferSize(); return { x: Math.floor((lw * this.S - this.W) / 2), y: lh * this.S - this.H }; }
  private clamp(o: { x: number; y: number }) {
    const { lw, lh } = this.bufferSize(), mx = lw * this.S * this.Z - this.W, my = lh * this.S * this.Z - this.H;
    return { x: Math.round(Math.max(0, Math.min(mx, o.x))), y: Math.round(Math.max(0, Math.min(my, o.y))) };
  }

  private zoomTo(z: number, ax = this.W / 2, ay = this.H / 2) {
    z = Math.max(1, Math.min(ZMAX, z));
    if (z === this.Z || this.interior >= 0) return;
    const px = (ax + this.o.x) / this.Z, py = (ay + this.o.y) / this.Z;
    this.Z = z;
    this.o = z === 1 ? this.base() : this.clamp({ x: px * z - ax, y: py * z - ay });
  }

  /** Mausrad: eine Raste (großer Schritt) = eine Stufe; Trackpad-Schübe werden gesammelt. */
  private wheelBy(dy: number, e: MouseEvent) {
    const r = this.host.getBoundingClientRect(), ax = (e.clientX - r.left) * this.dpr, ay = (e.clientY - r.top) * this.dpr;
    if (Math.abs(dy) >= 50) { this.wheel = 0; this.zoomTo(this.Z + (dy > 0 ? -1 : 1), ax, ay); return; }
    this.wheel += dy;
    if (Math.abs(this.wheel) >= 60) { const s = this.wheel > 0 ? -1 : 1; this.wheel = 0; this.zoomTo(this.Z + s, ax, ay); }
  }

  /** Bildschirmpunkt (Gerätepixel) → Pufferpixel. */
  private toBuffer(sx: number, sy: number) { return { x: (sx + this.o.x) / this.Z / this.S, y: (sy + this.o.y) / this.Z / this.S }; }
  private point(e: MouseEvent) { const r = this.host.getBoundingClientRect(); return { x: (e.clientX - r.left) * this.dpr, y: (e.clientY - r.top) * this.dpr }; }

  // ---- Zeiger ----------------------------------------------------------------------
  private targetAt(sx: number, sy: number): Target | null {
    if (this.interior >= 0) return hitTest(this.drawn, sx, sy);
    const b = this.toBuffer(sx, sy);
    return hitTest(this.drawn, b.x, b.y);
  }

  private tileAt(sx: number, sy: number): { x: number; y: number } | null {
    const L = this.look;
    if (this.interior >= 0) {
      const h = this.innen, P = this.haus?.plan;
      if (!h || !P) return null;
      const bx = h.box.x + (sx - h.ox) / h.z, by = h.box.y + (sy - h.oy) / h.z;
      if (bx < h.box.x || by < h.box.y || bx >= h.box.x + h.box.w || by >= h.box.y + h.box.h) return { x: -1, y: -1 };   // neben dem Bild
      return { x: Math.floor((bx + P.rect[0] * T) / T), y: Math.floor(P.Yinv(by) / T) };
    }
    const b = this.toBuffer(sx, sy), v = unproject(this.bild.frame, b.x, b.y);
    return v ? { x: Math.floor((v.x + L.origin[0]) / T), y: Math.floor((v.y + L.origin[1]) / T) } : null;
  }

  private move(e: PointerEvent) {
    const p = this.point(e);
    if (this.drag && e.buttons & 1) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!this.drag.moved) this.bridge.setFollow(null);
      this.drag.moved = true;
      if (this.interior < 0) this.o = this.clamp({ x: this.o.x - dx * this.dpr, y: this.o.y - dy * this.dpr });
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.host.style.cursor = "grabbing";
      return;
    }
    const hit = this.targetAt(p.x, p.y);
    if (hit?.kind !== this.hover?.kind || hit?.id !== this.hover?.id) this.hoverSince = performance.now();
    this.hover = hit;
    this.mouse = { x: p.x / this.dpr, y: p.y / this.dpr };
    const tile = this.tileAt(p.x, p.y);
    this.player?.hover(this.bridge.playerPreview() ? tile : null);
    this.host.style.cursor = this.hover ? "pointer" : this.bridge.playerPreview() && tile ? "crosshair" : "default";
  }

  private up(e: PointerEvent) {
    const dragged = this.drag?.moved;
    this.drag = null;
    this.host.style.cursor = "default";
    if (e.button !== 0 || dragged || !this.world) return;
    this.click(e, e.shiftKey);
  }

  private click(e: MouseEvent, selectOnly: boolean) {
    const w = this.world, L = this.look;
    if (!w) return;
    const p = this.point(e), hit = this.targetAt(p.x, p.y), tile = this.tileAt(p.x, p.y);
    if (!selectOnly && this.bridge.playerPreview() && this.player?.click(hit, tile, p.x / this.dpr, p.y / this.dpr)) return;
    if (hit?.kind === "agent") {
      const now = performance.now();
      this.bridge.select({ kind: "agent", id: hit.id });
      if (this.lastClick.id === hit.id && now - this.lastClick.t < 350) this.bridge.setFollow(hit.id);
      this.lastClick = { id: hit.id, t: now };
      return;
    }
    if (hit?.kind === "house") { this.enterInterior(0); return; }
    const t = hit && (hit.kind === "object" || hit.kind === "resource") ? this.tileOf(hit) ?? tile : tile;
    if (!t) return;
    if (this.interior >= 0 && !isInside(L, t.x, t.y)) { this.bridge.select(null); this.bridge.setFollow(null); this.leaveInterior(); return; }
    const loc = locationAt(w, t.x, t.y);
    if (this.interior >= 0 && loc && isInside(L, loc.rect[0], loc.rect[1])) this.room = loc.id;      // Klick auf einen Raum: Raum groß
    this.bridge.select(loc ? { kind: "location", id: loc.id } : null);
  }

  private tileOf(t: Target) {
    const o = t.kind === "object" ? this.world!.objects[t.id] : this.world!.resources[t.id];
    return o && o.x != null && o.y != null ? { x: o.x, y: o.y } : null;
  }

  // ---- Haus ------------------------------------------------------------------------
  enterInterior(i: number) {
    if (i !== 0 || this.interior === 0 || !this.world) return;
    this.interior = 0;
    this.room = null;
  }

  /** Schritt zurück: aus dem Raum ins ganze Haus, aus dem Haus ins Dorf (`all`: gleich ins Dorf). */
  leaveInterior(all = false) {
    if (this.room && !all) { this.room = null; return; }
    this.interior = -1; this.room = null;
  }

  /** Kachel vor der Haustür (Ziel für „hingehen“). */
  doorOf(i: number): { x: number; y: number } | null { return i === 0 ? { x: this.look.door.outside[0], y: this.look.door.outside[1] } : null; }

  private focusTile(x: number, y: number) {
    if (isInside(this.look, x, y)) { this.enterInterior(0); const l = this.world && locationAt(this.world, x, y); this.room = l && isInside(this.look, l.rect[0], l.rect[1]) ? l.id : null; return; }
    this.leaveInterior(true);
    if (this.Z === 1) this.zoomTo(2);
    this.centerOn((x * T + 8 - this.look.origin[0]), (y * T + 8 - this.look.origin[1]));
  }

  private centerOn(vx: number, vy: number) {
    const p = this.bild.p(vx, vy);
    this.o = this.clamp({ x: p.x * this.S * this.Z - this.W / 2, y: p.y * this.S * this.Z - this.H / 2 });
  }

  // ---- Bild für Bild -----------------------------------------------------------------
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const w = this.bridge.world();
    if (!w || !lookOf(w) || !this.resize()) return;
    const dt = Math.min(0.1, this.lastT ? (now - this.lastT) / 1000 : 0.016), t = now / 1000, t0 = performance.now();
    this.lastT = now;
    if (w !== this.world) this.world = w;
    this.figures.update(w, dt);
    this.keysPan(dt);
    this.follow(w);
    const m = weatherMood(moodAt(w.clock.minute % 1440), w.weather.kind), sel = this.bridge.selection();
    const ctx = { w, L: this.look, figures: this.figures, t, lit: m.lights > 0.5, selected: sel?.kind === "agent" ? sel.id : null, hover: this.hover };
    const g = this.canvas.getContext("2d")!;
    if (this.interior >= 0) {
      const key = `${w.map.rows.join("")}|${Object.keys(w.locations).length}`;
      if (!this.haus || key !== this.hausKey) { this.haus = new Hausbild(makePlan(w, this.look), this.look.interior.rugs ?? []); this.hausKey = key; }
      const zeit: Tageszeit = m.stars > 0.5 ? "Nacht" : m.glowA > 0.2 ? "Abend" : w.clock.minute % 1440 < 600 ? "Morgen" : "Mittag";
      this.innen = this.haus.render(g, this.W, this.H, { things: indoor(ctx), wall: this.look.interior.wall ?? [], zeit, lit: m.lights > 0.5, mood: m, room: this.room, top: Math.round(76 * this.dpr) });
      this.drawn = this.innen.drawn;
    } else {
      const mode: Mode = this.bridge.mode() === "flach" ? "flach" : "tiefe", { lw, lh } = this.bufferSize();
      this.bild.layout(mode, lw, lh, this.S);
      if (now - this.lastCompose >= 40 || !this.lastCompose) {      // Takt von A: 25 Bilder je Sekunde
        this.lastCompose = now;
        this.bild.setCasters(casters(w, this.look));
        const skyKey = `${Math.floor((w.clock.minute % 1440) / 10)}|${w.weather.kind}|${lw}x${lh}`;
        this.drawn = this.bild.drawLow(outdoor(ctx), m, t, skyKey, true);
        this.preview(t);
        const lights = glowing(w, this.look);
        this.bild.post(m, t, this.S, lights, { tilt: !reducedMotion(), particles: !reducedMotion() && !["rain", "storm"].includes(w.weather.kind), daytime: daytime(m) });
        const out = this.bild.out, oc = out.getContext("2d")!;
        weather(oc, { w: out.width, h: out.height, mood: m, weather: w.weather.kind, t, dt: 0.04, particles: false, pf: this.S });
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#0e1115"; g.fillRect(0, 0, this.W, this.H);
      g.setTransform(this.Z, 0, 0, this.Z, -this.o.x, -this.o.y);
      g.drawImage(this.bild.out, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.emit(w);
    this.perf.push(performance.now() - t0);
    if (this.perf.length > 600) this.perf.shift();
  };

  private keysPan(dt: number) {
    const k = (a: string, b: string) => (this.keys.has(a) || this.keys.has(b) ? 1 : 0);
    const kx = k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"), ky = k("KeyS", "ArrowDown") - k("KeyW", "ArrowUp");
    if ((!kx && !ky) || this.interior >= 0 || this.Z === 1) return;
    const sp = 900 * this.dpr * dt * (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 2 : 1), n = Math.hypot(kx, ky);
    this.bridge.setFollow(null);
    this.o = this.clamp({ x: this.o.x + (kx / n) * sp, y: this.o.y + (ky / n) * sp });
  }

  private follow(w: World) {
    const f = this.bridge.follow(), p = f ? this.figures.position(f) : null;
    if (!f || !p || !w.agents[f]) return;
    const inside = isInside(this.look, Math.floor(p.x / T), Math.floor(p.y / T));
    if (inside && this.interior < 0) this.enterInterior(0);
    else if (!inside && this.interior >= 0) this.leaveInterior(true);
    if (inside && this.world) { const l = locationAt(this.world, Math.floor(p.x / T), Math.floor(p.y / T)); if (l && isInside(this.look, l.rect[0], l.rect[1])) this.room = l.id; }
    if (!inside && this.Z > 1) this.centerOn(p.x - this.look.origin[0], p.y - 8 - this.look.origin[1]);
  }

  /** Mitspieler-Vorschau: Weg, Ziel, Kachel unter dem Zeiger und die Vorschau-Figur „Du“ (nur hinter dem Schalter, nur draußen). */
  private preview(t: number) {
    if (!this.bridge.playerPreview() || !this.player) return;
    const pv = this.player.preview(), L = this.look, lg = this.bild.low.getContext("2d")!, out = (q: [number, number] | null) => (q && isInside(L, q[0], q[1]) ? null : q);
    const proj = (x: number, y: number) => this.bild.p(x - L.origin[0], y - L.origin[1]);
    drawPreviewGround(lg, proj, { ghost: out(pv.ghost), path: pv.path?.filter((q) => !isInside(L, q[0], q[1])) ?? null, goal: out(pv.goal), hover: out(pv.hover) }, t);
    if (out(pv.ghost)) drawGhost(lg, proj, pv.ghost!);
  }

  private emit(w: World) {
    const L = this.look, k = this.S * this.Z, d = this.dpr, inHouse = occupants(w, L, this.figures);
    const toCss = (b: { x: number; y: number }) => ({ x: (b.x * k - this.o.x) / d, y: (b.y * k - this.o.y) / d });
    const H = L.shapes.house, roof = this.bild.p(H.x, H.y), top = toCss({ x: roof.x, y: roof.y - 84 * roof.sc }), mid = toCss({ x: roof.x, y: roof.y - 40 * roof.sc });
    const agents = Object.values(w.agents).map((a) => {
      const pos = this.figures.position(a.id), inside = !!pos && isInside(L, Math.floor(pos.x / T), Math.floor(pos.y / T));
      if (!pos) return { id: a.id, x: 0, y: 0, scale: 1, visible: false, house: -1 };
      if (this.interior >= 0) {
        const h = this.innen, P = this.haus?.plan;
        if (!h || !P) return { id: a.id, x: 0, y: 0, scale: 1, visible: false, house: -1 };
        const x = h.ox + (P.X(pos.x) - h.box.x) * h.z, y = h.oy + (P.Y(pos.y) - h.box.y) * h.z;
        const shown = inside && x >= h.ox && x <= h.ox + h.box.w * h.z && y >= h.oy && y <= h.oy + h.box.h * h.z;
        return { id: a.id, x: x / d, y: y / d, scale: h.z / d, visible: shown, house: inside ? -1 : 0 };
      }
      const boat = boatSpot(w, L, a), p = boat ? this.bild.p(boat[0], boat[1] + 2.5) : this.bild.p(pos.x - L.origin[0], pos.y - L.origin[1]), c = toCss(p);
      return { id: a.id, x: c.x, y: c.y, scale: (p.sc * k) / d, visible: !inside && c.x > -20 && c.x < this.W / d + 20 && c.y > 0 && c.y < this.H / d + 30, house: inside ? 0 : -1 };
    });
    const rooms = this.interior >= 0 && this.innen ? this.innen.labels.map((r) => ({ id: r.id, x: r.x / d, y: r.y / d - 6 })) : [];
    const goal = this.player && this.bridge.playerPreview() ? this.player.preview().goal : null, gp = goal && !isInside(L, goal[0], goal[1]) ? toCss(this.bild.p(goal[0] * T + 8 - L.origin[0], goal[1] * T + 8 - L.origin[1])) : null;
    const h = this.hover, tip = h && h.kind !== "agent" && !this.drag && performance.now() - this.hoverSince >= TIP_MS ? { text: nameOf(h, w), x: this.mouse.x, y: this.mouse.y } : null;
    this.bridge.emitFrame({ tip, agents, houses: [{ i: 0, x: top.x, y: top.y, cy: mid.y, occupants: inHouse }], rooms, interior: this.interior, interiorRooms: this.haus?.plan.rooms.map((r) => r.id) ?? [], room: this.interior >= 0 ? this.room : null, goal: gp });
  }
}
