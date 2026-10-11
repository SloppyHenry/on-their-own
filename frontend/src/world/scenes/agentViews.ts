// Figuren in der Szene: weiche Bewegung zwischen Kacheln, Blickrichtung, Laufbild, Schlafen, Werkzeug bei Arbeit.
import Phaser from "phaser";
import type { AgentInfo, World } from "../../store/types";
import { charCanvas, type Dir } from "../draw/characters";
import { TILE as T } from "../draw/pen";
import { shadowCanvas, TOOL_FOR_ACTION, toolCanvas, zzzCanvas } from "../draw/tools";

const FOOT = 14;                                       // Fußpunkt innerhalb der Kachel
const DIRS: Dir[] = ["up", "down", "left", "right"];

interface View {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  tool: Phaser.GameObjects.Image;
  zzz: Phaser.GameObjects.Image;
  px: number;
  py: number;
  queue: { x: number; y: number }[];
  tile: [number, number] | null;
  dir: Dir;
  walked: number;
  moving: boolean;
}

export const tileFoot = (x: number, y: number) => ({ x: x * T + T / 2, y: y * T + FOOT });

export class AgentViews {
  private views = new Map<string, View>();

  constructor(private scene: Phaser.Scene) {
    scene.textures.addCanvas("shadow", shadowCanvas());
    scene.textures.addCanvas("zzz", zzzCanvas());
    for (const t of Object.keys(TOOL_FOR_ACTION)) { const c = toolCanvas(TOOL_FOR_ACTION[t]); if (c && !scene.textures.exists(`tool:${TOOL_FOR_ACTION[t]}`)) scene.textures.addCanvas(`tool:${TOOL_FOR_ACTION[t]}`, c); }
  }

  private tex(id: string, dir: Dir, frame: 0 | 1): string {
    const key = `ch:${id}:${dir}:${frame}`;
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, charCanvas(id, dir, frame));
    return key;
  }

  private make(a: AgentInfo): View {
    const s = this.scene, f = tileFoot(a.x, a.y);
    const v: View = {
      shadow: s.add.image(f.x, f.y, "shadow").setOrigin(0.5, 0.5),
      sprite: s.add.image(f.x, f.y, this.tex(a.id, "down", 0)).setOrigin(0.5, 1),
      tool: s.add.image(0, 0, "zzz").setVisible(false).setOrigin(0, 1),
      zzz: s.add.image(0, 0, "zzz").setVisible(false).setOrigin(0.5, 1),
      px: f.x, py: f.y, queue: [], tile: null, dir: "down", walked: 0, moving: false,
    };
    return v;
  }

  position(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.px, y: v.py } : null;
  }

  spriteAt(wx: number, wy: number): string | null {
    for (const [id, v] of this.views) if (Math.abs(wx - v.px) <= 8 && wy <= v.py + 2 && wy >= v.py - 19) return id;
    return null;
  }

  update(w: World, dt: number, t: number, selected: string | null): void {
    for (const id of [...this.views.keys()]) if (!w.agents[id]) { const v = this.views.get(id)!; [v.sprite, v.shadow, v.tool, v.zzz].forEach((o) => o.destroy()); this.views.delete(id); }
    const delay = w.simulation.tick_delay_s, base = delay > 0 ? 1 / delay : 12;
    for (const a of Object.values(w.agents)) {
      const v = this.views.get(a.id) ?? this.views.set(a.id, this.make(a)).get(a.id)!;
      if (!v.tile || v.tile[0] !== a.x || v.tile[1] !== a.y) {
        const far = !v.tile || Math.abs(v.tile[0] - a.x) + Math.abs(v.tile[1] - a.y) > 2;
        const f = tileFoot(a.x, a.y);
        if (far) { v.px = f.x; v.py = f.y; v.queue = []; } else v.queue.push(f);
        v.tile = [a.x, a.y];
      }
      this.step(v, dt, Phaser.Math.Clamp(base, 1.5, 12) * T * (1 + v.queue.length * 0.6));
      this.draw(a, v, t, selected === a.id);
    }
  }

  private step(v: View, dt: number, speed: number) {
    v.moving = v.queue.length > 0;
    let left = speed * dt;
    while (left > 0 && v.queue.length) {
      const q = v.queue[0], dx = q.x - v.px, dy = q.y - v.py, d = Math.hypot(dx, dy);
      if (d > 0.01) v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      if (d <= left) { v.px = q.x; v.py = q.y; v.queue.shift(); left -= d; v.walked += d; } else { v.px += (dx / d) * left; v.py += (dy / d) * left; v.walked += left; left = 0; }
    }
  }

  private draw(a: AgentInfo, v: View, t: number, selected: boolean) {
    const sleeping = a.status === "sleeping" || a.action?.type === "sleep";
    const dir: Dir = v.moving ? v.dir : (DIRS.includes(a.facing as Dir) ? (a.facing as Dir) : v.dir);
    const frame: 0 | 1 = v.moving ? ((Math.floor(v.walked / 5) % 2) as 0 | 1) : 0;
    const working = !v.moving && !sleeping && a.action != null && a.action.type in TOOL_FOR_ACTION;
    const bob = working ? Math.abs(Math.sin(t * 9)) * -1 : v.moving ? (frame ? -1 : 0) : 0;
    v.sprite.setTexture(this.tex(a.id, dir, frame));
    if (sleeping) { v.sprite.setOrigin(0.5, 0.5).setAngle(90).setPosition(v.px, v.py - 7); v.shadow.setVisible(false); }
    else { v.sprite.setOrigin(0.5, 1).setAngle(0).setPosition(Math.round(v.px), Math.round(v.py + bob)); v.shadow.setVisible(true).setPosition(v.px, v.py); }
    v.sprite.setDepth(v.py + 0.5).setTint(selected ? 0xffffff : 0xffffff);
    v.shadow.setDepth(v.py - 0.4);
    const tool = working && a.action ? TOOL_FOR_ACTION[a.action.type] : null;
    if (tool) v.tool.setVisible(true).setTexture(`tool:${tool}`).setPosition(v.px + 3, v.py - 10).setAngle(Math.sin(t * 9) * 35).setDepth(v.py + 0.6);
    else v.tool.setVisible(false);
    if (sleeping) v.zzz.setVisible(true).setPosition(v.px + 7, v.py - 15 - ((t * 4) % 3)).setAlpha(0.5 + 0.5 * Math.abs(Math.sin(t * 2))).setDepth(9000);
    else v.zzz.setVisible(false);
  }

  /** Auswahlring unter dem Agenten. */
  ring(g: Phaser.GameObjects.Graphics, id: string, color: number, t: number): void {
    const v = this.views.get(id);
    if (!v) return;
    g.lineStyle(1, color, 0.55 + Math.sin(t * 3) * 0.25);
    g.strokeEllipse(v.px, v.py, 20, 8);
  }
}
