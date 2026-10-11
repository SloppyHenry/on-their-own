// Weltszene: Boden, Bäume, Objekte, Quellen, Figuren, Licht. Liest den Zustand nur über die Brücke und erfindet nichts.
import Phaser from "phaser";
import type { LocationInfo, ObjectInfo, World } from "../../store/types";
import { accentOf } from "../draw/characters";
import { drawEffects, type Light, type Rect } from "../draw/effects";
import { fenceCanvas, fencePieces } from "../draw/fences";
import { findBuildings, isOccupied, roofCanvas, ROOF_PAD, type Building } from "../draw/roof";
import { objectCanvas, resourceCanvas, resourceKey, visualKey, type ObjectEnv } from "../draw/objects";
import { TILE as T } from "../draw/pen";
import { buildTerrain, type Terrain } from "../draw/terrain";
import { TREE_H, TREE_W, treeTexture, treeVariantAt } from "../draw/vegetation";
import type { WorldBridge } from "../worldBridge";
import { AgentViews, tileFoot } from "./agentViews";
import { CameraRig } from "./cameraRig";

const hex = (c: string) => parseInt(c.slice(1), 16);
const OBJECT_PARAMS = ["object_id", "seedbed_id", "target", "site", "node", "plant"];

export class WorldScene extends Phaser.Scene {
  private world: World | null = null;
  private terrain: Terrain | null = null;
  private statics = new Map<string, Phaser.GameObjects.Image>();
  private ground?: Phaser.GameObjects.Image;
  private water!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private views!: AgentViews;
  private rig!: CameraRig;
  private lastClick = { id: "", t: 0 };
  private buildings: Building[] = [];
  private roofs = new Map<string, { img: Phaser.GameObjects.Image; alpha: number }>();
  private smoke!: Phaser.GameObjects.Graphics;
  private terrainVersion = 0;
  private minuteBucket = -1;
  private started = false;
  private off: (() => void) | null = null;

  constructor(private bridge: WorldBridge) {
    super({ key: "world" });
  }

  create() {
    this.cameras.main.setBackgroundColor("#0e1115");
    this.water = this.add.graphics().setDepth(1);
    this.marks = this.add.graphics().setDepth(8000);
    this.smoke = this.add.graphics().setDepth(7001);
    this.views = new AgentViews(this);
    this.rig = new CameraRig(this, 64 * T, 40 * T, () => this.bridge.setFollow(null));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.click(p));
    this.bridge.commands.fit = () => this.rig.fit();
    this.bridge.commands.toggleFollow = () => {
      const sel = this.bridge.selection(), f = this.bridge.follow(), target = sel?.kind === "agent" ? sel.id : this.bridge.lastAgent();
      if (f) this.bridge.setFollow(null);
      else if (target) this.bridge.setFollow(target);
    };
    this.off = this.bridge.subscribe(() => undefined);
    this.events.once("shutdown", () => { this.off?.(); this.bridge.commands = {}; });
  }

  // ---- Klicks -------------------------------------------------------------
  private click(p: Phaser.Input.Pointer) {
    if (this.rig.wasDrag() || !this.world) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y), id = this.views.spriteAt(wp.x, wp.y), now = performance.now();
    if (id) {
      this.bridge.select({ kind: "agent", id });
      if (this.lastClick.id === id && now - this.lastClick.t < 350) this.bridge.setFollow(id);
      this.lastClick = { id, t: now };
      return;
    }
    const loc = this.locationAt(Math.floor(wp.x / T), Math.floor(wp.y / T));
    this.bridge.select(loc ? { kind: "location", id: loc.id } : null);
  }

  private locationAt(x: number, y: number): LocationInfo | null {
    let best: LocationInfo | null = null, area = Infinity;
    for (const l of Object.values(this.world!.locations)) {
      const [rx, ry, rw, rh] = l.rect;
      if (l.props.fallback || x < rx || y < ry || x >= rx + rw || y >= ry + rh || rw * rh >= area) continue;
      best = l;
      area = rw * rh;
    }
    return best;
  }

  // ---- Aufbau aus dem Zustand ---------------------------------------------
  private env(): ObjectEnv {
    const w = this.world!, type = (x: number, y: number) => w.map.legend[w.map.rows[y]?.[x] ?? ""] ?? "";
    return { minute: w.clock.minute, doorHorizontal: (x, y) => type(x - 1, y) === "wall" && type(x + 1, y) === "wall" };
  }

  private rebuildTerrain(w: World) {
    if (this.textures.exists("ground")) this.textures.remove("ground");
    this.terrain = buildTerrain({ rows: w.map.rows, legend: w.map.legend, tileTypes: w.tileTypes, locations: Object.values(w.locations) });
    this.textures.addCanvas("ground", this.terrain.canvas);
    this.ground?.destroy();
    this.ground = this.add.image(0, 0, "ground").setOrigin(0).setDepth(0);
    for (const [k, s] of this.statics) if (k.startsWith("t:") || k.startsWith("f:")) { s.destroy(); this.statics.delete(k); }
    for (const t of this.terrain.trees) {
      const v = treeVariantAt(t.x, t.y), key = `tree:${v}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, treeTexture(v));
      const jx = ((t.x * 7 + t.y * 3) % 5) - 2;
      this.statics.set(`t:${t.x},${t.y}`, this.add.image(t.x * T + T / 2 + jx, (t.y + 1) * T - 1, key).setOrigin(16 / TREE_W, (TREE_H - 2) / TREE_H).setDepth((t.y + 1) * T));
    }
    for (const f of fencePieces(Object.values(w.locations))) {
      const key = `fence:${f.kind}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, fenceCanvas(f.kind));
      this.statics.set(`f:${f.x},${f.y}`, this.add.image(f.x * T, (f.y + 1) * T, key).setOrigin(0, 1).setDepth((f.y + 1) * T));
    }
    this.rig.setMap(w.map.width * T, w.map.height * T);
    this.rebuildRoofs(w);
  }

  private rebuildRoofs(w: World) {
    this.roofs.forEach((r) => r.img.destroy());
    this.roofs.clear();
    this.terrainVersion += 1;
    this.buildings = findBuildings(w.map.rows, w.map.legend, Object.values(w.locations));
    for (const b of this.buildings) {
      const key = `roof:${b.id}:${this.terrainVersion}`;
      this.textures.addCanvas(key, roofCanvas(b));
      const img = this.add.image(b.bbox.x0 * T - ROOF_PAD, b.bbox.y0 * T - ROOF_PAD, key).setOrigin(0).setDepth(7000);
      this.roofs.set(b.id, { img, alpha: 1 });
    }
  }

  /** Dach schließt sich, wenn niemand im Gebäude ist, und blendet sich weich aus, sobald jemand hineingeht. */
  private updateRoofs(w: World, dt: number, t: number) {
    const sel = this.bridge.selection(), selLoc = sel?.kind === "location" ? sel.id : null, agents = Object.values(w.agents);
    this.smoke.clear();
    for (const b of this.buildings) {
      const r = this.roofs.get(b.id);
      if (!r) continue;
      const target = isOccupied(b, agents, selLoc) ? 0 : 1;
      r.alpha += (target - r.alpha) * (1 - Math.exp(-dt * 7));
      r.img.setAlpha(r.alpha).setVisible(r.alpha > 0.01);
      if (r.alpha < 0.1) continue;
      const sx = b.chimney.x * T + 8, sy = b.chimney.y * T - 2;
      for (let i = 0; i < 6; i++) {
        const a = (t * 0.35 + i / 6) % 1, size = 2 + a * 4;
        this.smoke.fillStyle(0xebebf0, (1 - a) * 0.65 * r.alpha).fillRect(Math.round(sx + Math.sin(a * 7 + i) * 3 + a * 9 - size / 2), Math.round(sy - a * 30), size, size);
      }
    }
  }

  private place(key: string, tex: string, x: number, y: number, depth: number, alpha = 1) {
    let s = this.statics.get(key);
    if (!s) { s = this.add.image(x, y, tex).setOrigin(0, 1); this.statics.set(key, s); }
    s.setTexture(tex).setPosition(x, y).setDepth(depth).setAlpha(alpha);
  }

  private syncObjects(w: World) {
    const env = this.env(), live = new Set<string>();
    const ensure = (key: string, make: () => HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); return key; };
    for (const o of Object.values(w.objects) as ObjectInfo[]) {
      if (o.holder || o.x == null || o.y == null) continue;
      const key = `o:${o.id}`;
      live.add(key);
      const tex = ensure(`ot:${visualKey(o, env)}`, () => objectCanvas(o, env));
      this.place(key, tex, o.x * T, (o.y + 1) * T, (o.y + 1) * T + (o.kind === "plant" ? 0.2 : 0), o.hidden ? 0.55 : 1);
    }
    for (const n of Object.values(w.resources)) {
      if (n.resource === "water") continue;
      const key = `r:${n.id}`, rk = resourceKey(n);
      if (n.amount < 1) continue;
      live.add(key);
      this.place(key, ensure(`rt:${rk}`, () => resourceCanvas(n)), n.x * T, (n.y + 1) * T, (n.y + 1) * T - 0.1);
    }
    for (const [k, s] of this.statics) if ((k.startsWith("o:") || k.startsWith("r:")) && !live.has(k)) { s.destroy(); this.statics.delete(k); }
  }

  private sync(w: World) {
    const prev = this.world, structural = !prev || w.map !== prev.map || w.locations !== prev.locations || w.tileTypes !== prev.tileTypes;
    this.world = w;
    if (structural) this.rebuildTerrain(w);
    const bucket = Math.floor(w.clock.minute / 30);
    if (structural || !prev || w.objects !== prev.objects || w.resources !== prev.resources || bucket !== this.minuteBucket) { this.minuteBucket = bucket; this.syncObjects(w); }
    if (!this.started) {
      this.started = true;
      const ags = Object.values(w.agents), cx = ags.reduce((s, a) => s + a.x, 0) / Math.max(1, ags.length), cy = ags.reduce((s, a) => s + a.y, 0) / Math.max(1, ags.length);
      this.rig.focus(cx * T + T / 2, cy * T + T / 2, 2.5);
    }
  }

  // ---- Bild für Bild ---------------------------------------------------------
  update(time: number, delta: number) {
    const w = this.bridge.world();
    if (!w) return;
    if (w !== this.world) this.sync(w);
    const t = time / 1000, dt = Math.min(0.1, delta / 1000), sel = this.bridge.selection(), selected = sel?.kind === "agent" ? sel.id : null;
    this.views.update(w, dt, t, selected);
    const follow = this.bridge.follow(), fp = follow ? this.views.position(follow) : null;
    if (fp) this.rig.follow(fp.x, fp.y - 8, dt);
    this.updateRoofs(w, dt, t);
    this.drawWater(t);
    this.drawMarks(w, t, selected);
    this.drawLight(w, t, dt);
    this.emitFrame(w);
  }

  private drawWater(t: number) {
    const g = this.water.clear();
    for (const [x, y] of this.terrain?.water ?? []) {
      const ph = ((x * 53 + y * 17) % 100) / 100 * 6.28, s = Math.sin(t * 1.6 + ph);
      if (s > 0.82) g.fillStyle(0xe8f6ff, 1).fillRect(x * T + 3 + ((x * 7 + y * 3) % 8), y * T + 3 + ((x + y * 5) % 9), 3, 1);
      else if (s < -0.88) g.fillStyle(0x2f78b8, 1).fillRect(x * T + 2 + ((x * 5) % 9), y * T + 5 + ((y * 3) % 7), 4, 1);
    }
  }

  private drawMarks(w: World, t: number, selected: string | null) {
    const g = this.marks.clear();
    if (selected) this.views.ring(g, selected, hex(accentOf(selected)), t);
    for (const a of Object.values(w.agents)) {                                       // benutztes Objekt
      if (!a.action) continue;
      for (const k of OBJECT_PARAMS) {
        const id = a.action.params[k], o = typeof id === "string" ? w.objects[id] ?? w.resources[id] : null;
        if (o && o.x != null && o.y != null) g.lineStyle(1, hex(accentOf(a.id)), 0.6 + Math.sin(t * 5) * 0.3).strokeRect(o.x * T - 0.5, o.y * T - 0.5, T + 1, T + 1);
      }
    }
    const talking = Object.values(w.agents).filter((a) => a.status === "talking");
    for (let i = 0; i < talking.length - 1; i++) {                                    // laufendes Gespräch
      const a = this.views.position(talking[i].id), b = this.views.position(talking[i + 1].id);
      if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) > 9 * T) continue;
      const n = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 5);
      g.fillStyle(0xf0c882, 0.85);
      for (let k = 0; k < n; k += 2) { const u = (k + ((t * 6) % 2)) / n; g.fillRect(a.x + (b.x - a.x) * u, a.y - 18 + (b.y - a.y) * u, 2, 1); }
    }
  }

  private drawLight(w: World, t: number, dt: number) {
    const fx = this.bridge.fx, ctx = fx?.getContext("2d");
    if (!fx || !ctx) return;
    if (fx.width !== fx.clientWidth || fx.height !== fx.clientHeight) { fx.width = fx.clientWidth; fx.height = fx.clientHeight; }
    const cam = this.cameras.main, z = cam.zoom, lights: Light[] = [], rooms: Rect[] = [];
    const sc = (wx: number, wy: number) => this.rig.toScreen(wx, wy);
    for (const a of Object.values(w.agents)) { const p = this.views.position(a.id); if (p) { const s = sc(p.x, p.y - 8); lights.push({ x: s.x, y: s.y, r: 34 * z, strength: 0.6 }); } }
    for (const o of Object.values(w.objects)) if ((o.kind === "fireplace" || o.kind === "firepit") && o.state.lit && o.x != null && o.y != null) { const s = sc(o.x * T + 8, o.y * T + 6); lights.push({ x: s.x, y: s.y, r: 70 * z, strength: 1 }); }
    for (const f of this.terrain?.windows ?? []) { const s = sc(f.x + f.w / 2, f.y + f.h / 2); lights.push({ x: s.x, y: s.y, r: 30 * z, strength: 0.9 }); }
    const closed = new Set<string>();
    for (const b of this.buildings) if ((this.roofs.get(b.id)?.alpha ?? 0) > 0.5) b.rooms.forEach((r) => closed.add(r));
    for (const l of Object.values(w.locations)) {
      if (!(l.props.style as { floor?: string } | undefined)?.floor || closed.has(l.id)) continue;
      const a = sc(l.rect[0] * T, l.rect[1] * T), b = sc((l.rect[0] + l.rect[2]) * T, (l.rect[1] + l.rect[3]) * T);
      rooms.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
    }
    drawEffects({ ctx, w: fx.width, h: fx.height, dark: 1 - w.clock.daylight, lights, rooms, weather: w.weather.kind, t, dt });
  }

  private emitFrame(w: World) {
    const cam = this.cameras.main;
    this.bridge.emitFrame({
      zoom: cam.zoom,
      roofs: this.buildings.map((b) => ({ id: b.id, closed: (this.roofs.get(b.id)?.alpha ?? 0) > 0.5 })),
      agents: Object.keys(w.agents).map((id) => {
        const p = this.views.position(id) ?? tileFoot(w.agents[id].x, w.agents[id].y), s = this.rig.toScreen(p.x, p.y);
        return { id, x: s.x, y: s.y, visible: s.x > -40 && s.y > -40 && s.x < cam.width + 40 && s.y < cam.height + 40 };
      }),
    });
  }
}
