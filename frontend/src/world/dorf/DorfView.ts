// Weltansicht für Welten nach Mockup A (AP12a): Die Kamera fährt durch die Welt (WASD, Pfeile, Ziehen, Folgen, „hingehen“), 1× ist immer der
// Standard und zeigt in der Startlage genau Bild A. Zoomstufen ¼×, ½× (mehr Welt, gröberer Boden), 2×, 3× (fertiges Bild vergrößert); beim
// Fahren fließt der Boden weich, die Wölbung bleibt wie in A, im Stillstand ist alles scharf (siehe kamera.ts). Klick aufs Haus zeigt es von innen.
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
import { camFor, frameFor, unproject, type Mode } from "./abbild";
import { Dorfbild, type Drawn } from "./bild";
import { Hausbild, type HausOut, type Tageszeit } from "./haus/bild";
import { makePlan } from "./haus/plan";
import { Kamera } from "./kamera";
import { T, houseAt, housesOf, inRect, lookOf, type Look } from "./look";
import { boatSpot, glowing } from "./dinge";
import { casters, indoor, occupants, outdoor } from "./szene";
import { umriss } from "./umriss";

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const daytime = (m: Mood) => (m.stars > 0.5 ? "Nacht" : m.glowA > 0.2 ? "Abend" : "Tag");

const TIP_MS = 400;                                   // Namensblase erscheint nach kurzem Verweilen über einem Ding
const WHEEL_PAUSE = 350;                              // nach einer Zoomstufe zählt das Nachlaufen eines Trackpad-Wischs nicht noch einmal
const PAN = 90;                                       // Fahrt mit den Tasten in Texeln je Sekunde (bei 1×)

export class DorfView {
  /** Innenansicht: Nummer des Hauses (siehe `housesOf`) oder -1. */
  interior = -1;
  player: PlayerHooks | null = null;
  readonly perf: number[] = [];
  readonly kam: Kamera;
  private bild: Dorfbild;
  private figures = new Figures();
  private world: World | null = null;
  private dpr = 1;
  private W = 0; private H = 0; private S = 1;                           // Puffergröße in Gerätepixeln und ganzzahlige Vergrößerung
  private drawn: Drawn[] = [];
  private hover: Target | null = null;
  /** Namensblase: seit wann der Zeiger auf demselben Ding steht, und wo (CSS-Pixel). */
  private hoverSince = 0;
  private mouse = { x: 0, y: 0 };
  private drag: { x: number; y: number; moved: boolean; g: { x: number; y: number } | null } | null = null;
  private keys = new Set<string>(); private wheelAt = -1e9;
  private lastClick = { id: "", t: 0 };
  private lastCompose = 0; private composedCam = "";
  private lastT = 0; private raf = 0;
  private haus: Hausbild | null = null;
  private hausKey = "";
  private innen: HausOut | null = null;
  /** Innenansicht: ganzes Haus (null) oder ein Raum groß (Ort). */
  room: string | null = null;
  private off: (() => void)[] = [];
  /** Kamerafahrt: Ziel (Boden in Bildmitte, Texel); jede Eingabe der Hand bricht sie ab. */
  private flying: [number, number] | null = null;

  /** Zoomstufe setzen (¼, ½, 1, 2, 3), Bildmitte bleibt (Prüf- und Messzugang, siehe WorldCanvas). */
  zoomLevel(level: number) { this.zoomTo(level); }
  /** Die Mitte des ganzen Gebiets ins Bild (Vorschau): der Platz liegt bei großen oder schiefen Dörfern nicht in der Mitte. */
  centerWorld() { const [a, b, c, d] = this.kam.bounds, wv = c - a - 320, vis = this.host.clientWidth * 1.45; this.zoomTo(wv <= vis * 0.95 ? 1 : wv <= vis * 1.9 ? 0.5 : 0.25); this.kam.focusAt((a + c) / 2, (b + d) / 2 + 34); }   // Stufe nach Breite des Dorfs (es füllt das Fenster), etwas weiter südlich: die Schräge schiebt es sonst nach unten

  /** Hineinzoomen (1, 2, 3) für Tests und Hilfen. */
  get Z() { return this.kam.zoom; }

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private bridge: WorldBridge, look: Look, private opt: { zoom?: boolean; keys?: boolean } = {}) {
    this.bild = new Dorfbild(look);
    const [sx, sy] = look.texShift;
    this.kam = new Kamera([look.home[0] - sx, look.home[1] - sy]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;                       // erlaubter Bereich: alle Gebiete mit Rand
    for (const r of look.regions) { x0 = Math.min(x0, r.frame[0] + r.bounds.left); y0 = Math.min(y0, r.frame[1] + r.bounds.top); x1 = Math.max(x1, r.frame[0] + r.bounds.right); y1 = Math.max(y1, r.frame[1] + (r.bounds.bottom ?? r.bounds.top + 200)); }
    this.kam.bounds = [x0 - sx - 160, y0 - sy - 160, x1 - sx + 160, y1 - sy + 160];
    const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => { el.addEventListener(ev, fn as EventListener, opt); this.off.push(() => el.removeEventListener(ev, fn as EventListener, opt)); };
    on(host, "wheel", (e) => { e.preventDefault(); if (this.opt.zoom === false) return; this.wheelBy(e.deltaY * (e.deltaMode === 1 ? 30 : 1), e); }, { passive: false });
    on(host, "pointerdown", (e) => { this.hoverSince = Infinity; if (e.button === 0) this.drag = { x: e.clientX, y: e.clientY, moved: false, g: null }; });   // nach dem Klick keine Namensblase, bis der Zeiger weiterzieht
    on(host, "pointermove", (e) => this.move(e));
    on(host, "pointerup", (e) => this.up(e));
    on(host, "pointerleave", () => { this.drag = null; this.hover = null; this.hoverSince = 0; this.player?.hover(null); this.bridge.zeiger?.(null); });
    on(host, "contextmenu", (e) => { e.preventDefault(); this.click(e, true); });
    on(window, "keydown", (e) => {
      if (this.opt.keys === false || document.querySelector("[data-testid=start-menu]")) return;                     // die Vorschau und die Welt hinter dem Menü reagieren nicht auf Tasten
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return;
      this.keys.add(e.code);
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd" || e.code === "BracketRight") this.zoomTo(this.kam.next(1));         // + und − auch auf der deutschen Tastatur
      else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract" || e.code === "Slash") this.zoomTo(this.kam.next(-1));
    });
    on(window, "keyup", (e) => this.keys.delete(e.code));
    on(window, "blur", () => this.keys.clear());
    bridge.commands.flyTile = (x, y) => this.flyTile(x, y);
    bridge.commands.fit = () => { this.leaveInterior(true); this.kam.reset(); };
    bridge.commands.focusTile = (x, y) => this.focusTile(x, y);
    bridge.commands.punktCss = (wx, wy) => this.punktCss(wx, wy);
    bridge.commands.leaveInterior = () => { bridge.setFollow(null); this.leaveInterior(); };
    bridge.commands.toggleFollow = () => { const sel = bridge.selection(), f = bridge.follow(), id = sel?.kind === "agent" ? sel.id : bridge.lastAgent(); if (f) bridge.setFollow(null); else if (id) bridge.setFollow(id); };
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() { cancelAnimationFrame(this.raf); this.off.forEach((f) => f()); this.bridge.commands = {}; }

  get look() { return this.bild.look; }
  private get shift() { return this.look.texShift; }

  // ---- Größe und Anzeige ---------------------------------------------------------
  private resize(): boolean {
    const dpr = window.devicePixelRatio || 1, W = Math.round(this.host.clientWidth * dpr), H = Math.round(this.host.clientHeight * dpr);
    if (!W || !H) return false;
    if (W === this.W && H === this.H && dpr === this.dpr) return true;
    this.dpr = dpr; this.W = W; this.H = H;
    this.S = Math.max(1, Math.floor(H / 200));                     // ganzzahlige Vergrößerung des Puffers, Bild A füllt die Höhe
    const c = this.canvas;
    c.width = W; c.height = H; c.style.width = `${W / dpr}px`; c.style.height = `${H / dpr}px`;
    return true;
  }

  private bufferSize() { return { lw: Math.ceil(this.W / this.S), lh: Math.ceil(this.H / this.S) }; }
  /** Versatz bei 1×: überstehende Pufferpixel gleich verteilt links/rechts, oben (Himmel). */
  private base() { const { lw, lh } = this.bufferSize(); return { x: Math.floor((lw * this.S - this.W) / 2), y: lh * this.S - this.H }; }
  /** Versatz der Anzeige bei Hineinzoomen Z: Die Bildmitte bleibt am Ort (Z = 1 ist `base`). */
  private offset() { const o = this.base(), Z = this.kam.zoom; return { x: Math.round(Z * (this.W / 2 + o.x) - this.W / 2), y: Math.round(Z * (this.H / 2 + o.y) - this.H / 2) }; }

  /** Bildschirmpunkt (Gerätepixel) → Pufferpixel. */
  private toBuffer(sx: number, sy: number, Z = this.kam.zoom) {
    const o = this.base(), ox = Math.round(Z * (this.W / 2 + o.x) - this.W / 2), oy = Math.round(Z * (this.H / 2 + o.y) - this.H / 2);
    return { x: (sx + ox) / Z / this.S, y: (sy + oy) / Z / this.S };
  }
  private point(e: MouseEvent) { const r = this.host.getBoundingClientRect(); return { x: (e.clientX - r.left) * this.dpr, y: (e.clientY - r.top) * this.dpr }; }

  /** Zoomstufe setzen; der Boden unter dem Zeiger bleibt unter dem Zeiger. */
  private zoomTo(level: number | null, ax = this.W / 2, ay = this.H / 2) {
    const k = this.kam, f = this.bild.frame;
    if (level == null || level === k.level || this.interior >= 0 || !f) return;
    const b0 = this.toBuffer(ax, ay), g = unproject(f, b0.x, b0.y) ?? { x: k.focus[0] + this.shift[0], y: k.focus[1] + this.shift[1] };
    k.setLevel(level);
    const f2 = frameFor(f.mode, f.lw, f.lh, this.shift, [k.x, k.y], k.zo, 1), b1 = this.toBuffer(ax, ay), c = camFor(f2, g.x, g.y, b1.x, b1.y);
    k.set(c[0], c[1]);
  }

  /** Mausrad: eine Stufe je Raste oder Wisch (das Nachlaufen eines Trackpad-Wischs zählt nicht noch einmal). */
  private wheelBy(dy: number, e: MouseEvent) {
    const r = this.host.getBoundingClientRect(), ax = (e.clientX - r.left) * this.dpr, ay = (e.clientY - r.top) * this.dpr, now = performance.now();
    if (Math.abs(dy) < 4) return;
    const pause = now - this.wheelAt < WHEEL_PAUSE;
    this.wheelAt = now;
    if (!pause) this.zoomTo(this.kam.next(dy > 0 ? -1 : 1), ax, ay);
  }

  // ---- Zeiger ----------------------------------------------------------------------
  private targetAt(sx: number, sy: number): Target | null {
    if (this.interior >= 0) return hitTest(this.drawn, sx, sy);
    const b = this.toBuffer(sx, sy);
    return hitTest(this.drawn, b.x, b.y);
  }

  private tileAt(sx: number, sy: number): { x: number; y: number } | null {
    if (this.interior >= 0) {
      const h = this.innen, P = this.haus?.plan;
      if (!h || !P) return null;
      const bx = h.box.x + (sx - h.ox) / h.z, by = h.box.y + (sy - h.oy) / h.z;
      if (bx < h.box.x || by < h.box.y || bx >= h.box.x + h.box.w || by >= h.box.y + h.box.h) return { x: -1, y: -1 };   // neben dem Bild
      return { x: Math.floor((bx + P.rect[0] * T) / T), y: Math.floor(P.Yinv(by) / T) };
    }
    const b = this.toBuffer(sx, sy), v = this.bild.frame && unproject(this.bild.frame, b.x, b.y);
    return v ? { x: Math.floor(v.x / T), y: Math.floor(v.y / T) } : null;
  }

  private move(e: PointerEvent) {
    const p = this.point(e);
    if (this.drag && e.buttons & 1) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!this.drag.moved) {
        this.bridge.setFollow(null);
        this.flying = null;
        const b = this.toBuffer(p.x - dx * this.dpr, p.y - dy * this.dpr), f = this.bild.frame;
        this.drag.g = this.interior < 0 && f ? unproject(f, b.x, b.y) : null;                // der Boden, der unter dem Zeiger liegt, bleibt dort
      }
      this.drag.moved = true;
      if (this.interior < 0 && this.drag.g) {
        const b = this.toBuffer(p.x, p.y), c = camFor(this.bild.frame, this.drag.g.x, this.drag.g.y, b.x, b.y);
        this.kam.set(c[0], c[1]);
      }
      this.host.style.cursor = "grabbing";
      return;
    }
    const hit = this.targetAt(p.x, p.y);
    if (hit?.kind !== this.hover?.kind || hit?.id !== this.hover?.id) this.hoverSince = performance.now();
    this.hover = hit;
    this.mouse = { x: p.x / this.dpr, y: p.y / this.dpr };
    const tile = this.tileAt(p.x, p.y);
    this.bridge.zeiger?.(this.interior < 0 ? tile : null);                           // Raster-Cursor des Gestaltens (AP16b)
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
    if (!selectOnly && tile && this.bridge.tileClick?.(tile)) return;
    if (!selectOnly && this.bridge.playerPreview() && this.player?.click(hit, tile, p.x / this.dpr, p.y / this.dpr)) return;
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
    const cur = housesOf(L)[this.interior];
    if (cur && !inRect(cur.house.interior.rect, t.x, t.y)) { this.bridge.select(null); this.bridge.setFollow(null); this.leaveInterior(); return; }
    const loc = locationAt(w, t.x, t.y);
    if (cur && loc && inRect(cur.house.interior.rect, loc.rect[0], loc.rect[1])) this.room = loc.id;      // Klick auf einen Raum: Raum groß
    this.bridge.select(loc ? { kind: "location", id: loc.id } : null);
  }

  private tileOf(t: Target) {
    const o = t.kind === "object" ? this.world!.objects[t.id] : this.world!.resources[t.id];
    return o && o.x != null && o.y != null ? { x: o.x, y: o.y } : null;
  }

  // ---- Haus ------------------------------------------------------------------------
  enterInterior(n: number) {
    if (n < 0 || n >= housesOf(this.look).length || this.interior === n || !this.world) return;
    this.interior = n;
    this.room = null;
  }

  /** Schritt zurück: aus dem Raum ins ganze Haus, aus dem Haus ins Dorf (`all`: gleich ins Dorf). */
  leaveInterior(all = false) {
    if (this.room && !all) { this.room = null; return; }
    this.interior = -1; this.room = null;
  }

  /** Kachel vor der Haustür (Ziel für „hingehen“). */
  doorOf(n: number): { x: number; y: number } | null { const h = housesOf(this.look)[n]; return h ? { x: h.house.door.outside[0], y: h.house.door.outside[1] } : null; }

  private focusTile(x: number, y: number) {
    const L = this.look, h = houseAt(L, x, y);
    if (h) {
      this.enterInterior(housesOf(L).find((q) => q.house === h.region.houses[h.i])!.n);
      const l = this.world && locationAt(this.world, x, y);
      this.room = l && inRect(h.region.houses[h.i].interior.rect, l.rect[0], l.rect[1]) ? l.id : null;
      return;
    }
    this.leaveInterior(true);
    if (this.kam.level === 1) this.zoomTo(2);
    this.centerOn(x * T + 8, y * T + 8);
  }

  /** Kamera fährt zur Kachel (gleitend, ohne Zoomwechsel); mit reduzierter Bewegung springt sie. */
  flyTile(x: number, y: number) {
    this.leaveInterior(true);
    this.bridge.setFollow(null);
    const tx = x * T + 8 - this.shift[0], ty = y * T + 8 - this.shift[1];
    if (reducedMotion()) { this.flying = null; this.kam.focusAt(tx, ty); } else this.flying = [tx, ty];
  }

  private flyStep(dt: number) {
    if (!this.flying) return;
    const [fx, fy] = this.kam.focus, [tx, ty] = this.flying, d = Math.hypot(tx - fx, ty - fy), v = Math.max(d * 2.5, 90 * this.kam.zo) * dt;
    if (v >= d) { this.kam.focusAt(tx, ty); this.flying = null; return; }
    this.kam.focusAt(fx + ((tx - fx) / d) * v, fy + ((ty - fy) / d) * v);
  }

  /** Weltpixel → CSS-Pixel in der Weltfläche (Cursor-Schicht des Gestaltens); null in der Innenansicht. */
  private punktCss(wx: number, wy: number) { if (this.interior >= 0 || !this.bild.frame) return null; const p = this.bild.p(wx, wy), k = this.S * this.kam.zoom, o = this.offset(); return { x: (p.x * k - o.x) / this.dpr, y: (p.y * k - o.y) / this.dpr }; }

  /** Kamera so, dass der Weltpunkt in Bildmitte liegt. */
  private centerOn(wx: number, wy: number) { this.kam.focusAt(wx - this.shift[0], wy - this.shift[1]); }

  // ---- Bild für Bild -----------------------------------------------------------------
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const w = this.bridge.world();
    if (!w || !lookOf(w) || !this.resize()) return;
    const dt = Math.max(0, Math.min(0.1, this.lastT ? (now - this.lastT) / 1000 : 0.016)), t = (window as unknown as { __freezeT?: number }).__freezeT ?? now / 1000, t0 = performance.now();   // __freezeT: eingefrorene Zeit für die Goldbild-Tests
    this.lastT = now;
    if (w !== this.world) this.world = w;
    this.figures.update(w, dt);
    this.keysPan(dt);
    this.follow(w, dt);
    this.flyStep(dt);
    const { soft } = this.kam.tick(dt);
    const m = weatherMood(moodAt(w.clock.minute % 1440), w.weather.kind), sel = this.bridge.selection();
    const ctx = { w, L: this.look, figures: this.figures, t, lit: m.lights > 0.5, selected: sel?.kind === "agent" ? sel.id : null, hover: this.hover };
    const g = this.canvas.getContext("2d")!;
    if (this.interior >= 0) {
      const H = housesOf(this.look)[this.interior]?.house;
      if (!H) { this.interior = -1; return; }
      const key = `${this.interior}|${w.map.rows.join("")}|${Object.keys(w.locations).length}`;
      if (!this.haus || key !== this.hausKey) { this.haus = new Hausbild(makePlan(w, H.interior), H.interior.rugs ?? []); this.hausKey = key; }
      const zeit: Tageszeit = m.stars > 0.5 ? "Nacht" : m.glowA > 0.2 ? "Abend" : w.clock.minute % 1440 < 600 ? "Morgen" : "Mittag";
      this.innen = this.haus.render(g, this.W, this.H, { things: indoor(ctx, H), wall: H.interior.wall ?? [], zeit, lit: m.lights > 0.5, mood: m, room: this.room, top: Math.round(76 * this.dpr) });
      this.drawn = this.innen.drawn;
    } else {
      const mode: Mode = this.bridge.mode() === "flach" ? "flach" : "tiefe", { lw, lh } = this.bufferSize(), k = this.kam;
      this.bild.setCamera(k.x, k.y);
      this.bild.layout(mode, lw, lh, this.S, k.zo);
      const camKey = `${k.x.toFixed(3)},${k.y.toFixed(3)}|${k.zo}|${mode}`;
      if (now - this.lastCompose >= 40 || !this.lastCompose || camKey !== this.composedCam) {      // Takt von A: 25 Bilder je Sekunde; fährt die Kamera, jedes Bild
        this.lastCompose = now; this.composedCam = camKey;
        this.bild.setCasters(casters(w, this.look));
        const skyKey = `${Math.floor((w.clock.minute % 1440) / 10)}|${w.weather.kind}|${lw}x${lh}|${k.zo}`;
        const smokes = housesOf(this.look).filter((h) => h.house.smoke != null).map((h) => [h.region.frame[0] + h.house.at[0] + h.house.smoke!, h.region.frame[1] + h.house.at[1]] as [number, number]);
        this.drawn = this.bild.drawLow(outdoor(ctx), m, t, skyKey, smokes, soft, this.S, (lg) => this.preview(lg, t));
        const lights = glowing(w, this.look);
        this.bild.post(m, t, this.S, lights, { tilt: !reducedMotion(), particles: !reducedMotion() && !["rain", "storm"].includes(w.weather.kind), daytime: daytime(m) });
        const out = this.bild.out, oc = out.getContext("2d")!;
        weather(oc, { w: out.width, h: out.height, mood: m, weather: w.weather.kind, t, dt: 0.04, particles: false, pf: this.S });
      }
      const o = this.offset();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#0e1115"; g.fillRect(0, 0, this.W, this.H);
      g.setTransform(k.zoom, 0, 0, k.zoom, -o.x, -o.y);
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
    if ((!kx && !ky) || this.interior >= 0) return;
    const v = PAN * this.kam.zo / this.kam.zoom * (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 2 : 1) * dt, n = Math.hypot(kx, ky);
    this.bridge.setFollow(null);
    this.flying = null;
    this.kam.set(this.kam.x + (kx / n) * v, this.kam.y + (ky / n) * v);
  }

  private follow(w: World, dt: number) {
    const f = this.bridge.follow(), p = f ? this.figures.position(f) : null;
    if (!f || !p || !w.agents[f]) return;
    const L = this.look, h = houseAt(L, Math.floor(p.x / T), Math.floor(p.y / T)), inside = !!h;
    if (h) {
      const n = housesOf(L).find((q) => q.house === h.region.houses[h.i])!.n;
      if (this.interior !== n) this.enterInterior(n);
      const l = locationAt(w, Math.floor(p.x / T), Math.floor(p.y / T));
      if (l && inRect(h.region.houses[h.i].interior.rect, l.rect[0], l.rect[1])) this.room = l.id;
    } else if (this.interior >= 0) this.leaveInterior(true);
    if (!inside) {                                                   // die Kamera gleitet zur Figur
      const [fx, fy] = this.kam.focus, tx = p.x - this.shift[0], ty = p.y - 8 - this.shift[1], a = 1 - Math.exp(-dt * 7);
      this.kam.focusAt(fx + (tx - fx) * a, fy + (ty - fy) * a);
    }
  }

  /** Mitspieler-Vorschau: Weg, Ziel, Kachel unter dem Zeiger und die Vorschau-Figur „Du“ (nur hinter dem Schalter, nur draußen). */
  private preview(lg: CanvasRenderingContext2D, t: number) {
    if (!this.bridge.playerPreview() || !this.player) return;
    const pv = this.player.preview(), L = this.look, out = (q: [number, number] | null) => (q && houseAt(L, q[0], q[1]) ? null : q);
    const proj = (x: number, y: number) => this.bild.p(x, y);
    drawPreviewGround(lg, proj, { ghost: out(pv.ghost), path: pv.path?.filter((q) => !houseAt(L, q[0], q[1])) ?? null, goal: out(pv.goal), hover: out(pv.hover) }, t);
    if (out(pv.ghost)) drawGhost(lg, proj, pv.ghost!);
  }

  private emit(w: World) {
    const L = this.look, Z = this.kam.zoom, k = this.S * Z, d = this.dpr, inHouse = occupants(w, L, this.figures), o = this.offset();
    const toCss = (b: { x: number; y: number }) => ({ x: (b.x * k - o.x) / d, y: (b.y * k - o.y) / d });
    const houses = housesOf(L), houseNo = new Map(houses.map((q) => [q.house, q.n]));
    const agents = Object.values(w.agents).map((a) => {
      const pos = this.figures.position(a.id), hh = pos ? houseAt(L, Math.floor(pos.x / T), Math.floor(pos.y / T)) : null, inside = !!hh, num = hh ? houseNo.get(hh.region.houses[hh.i])! : -1;
      if (!pos) return { id: a.id, x: 0, y: 0, scale: 1, visible: false, house: -1 };
      const at = { pos: [pos.x, pos.y] as [number, number], home: num };
      if (this.interior >= 0) {
        const h = this.innen, P = this.haus?.plan;
        if (!h || !P) return { id: a.id, x: 0, y: 0, scale: 1, visible: false, house: -1, ...at };
        const x = h.ox + (P.X(pos.x) - h.box.x) * h.z, y = h.oy + (P.Y(pos.y) - h.box.y) * h.z;
        const shown = num === this.interior && x >= h.ox && x <= h.ox + h.box.w * h.z && y >= h.oy && y <= h.oy + h.box.h * h.z;
        return { id: a.id, x: x / d, y: y / d, scale: h.z / d, visible: shown, house: inside ? -1 : num, ...at };
      }
      const boat = boatSpot(w, L, a), p = boat ? this.bild.p(boat[0], boat[1] + 2.5) : this.bild.p(pos.x, pos.y), c = toCss(p);
      return { id: a.id, x: c.x, y: c.y, scale: (p.sc * k) / d, visible: !inside && p.t <= 1 && c.x > -20 && c.x < this.W / d + 20 && c.y > 0 && c.y < this.H / d + 30, house: num, ...at };
    });
    const rooms = this.interior >= 0 && this.innen ? this.innen.labels.map((r) => ({ id: r.id, x: r.x / d, y: r.y / d - 6 })) : [];
    const goal = this.player && this.bridge.playerPreview() ? this.player.preview().goal : this.bridge.markierung?.() ?? null, gp = goal && !houseAt(L, goal[0], goal[1]) ? toCss(this.bild.p(goal[0] * T + 8, goal[1] * T + 8)) : null;
    const h = this.hover, tip = h && h.kind !== "agent" && !this.drag && performance.now() - this.hoverSince >= TIP_MS ? { text: nameOf(h, w), x: this.mouse.x, y: this.mouse.y } : null;
    const hf = houses.map(({ n, region, house }) => {
      const roof = this.bild.p(region.frame[0] + house.at[0], region.frame[1] + house.at[1]);
      return { i: n, x: toCss({ x: roof.x, y: roof.y - 84 * roof.sc }).x, y: toCss({ x: roof.x, y: roof.y - 84 * roof.sc }).y, cy: toCss({ x: roof.x, y: roof.y - 40 * roof.sc }).y, occupants: inHouse[n] };
    });
    this.bridge.emitFrame({ tip, agents, houses: hf, rooms, interior: this.interior, interiorRooms: this.interior >= 0 ? this.haus?.plan.rooms.map((r) => r.id) ?? [] : [], room: this.interior >= 0 ? this.room : null, goal: gp, ghost: (() => { const g = this.bridge.ghostRegion(); return g && this.interior < 0 ? umriss(this.look, g, (x, y) => this.bild.p(x, y), toCss) : null; })() });
  }
}
