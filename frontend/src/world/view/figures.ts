// Figuren: weiche Bewegung zwischen Kacheln nach dem Fahrplan, Blickrichtung, vier Laufbilder, Sitzen, Schlafen, Werkzeug bei Arbeit.
// Bewegungslogik wie bisher (agentViews), nur ohne Phaser; Bilder aus art/people.
import { routeBetween } from "../../store/reducers/walks";
import type { AgentInfo, Walk, World } from "../../store/types";
import { figure, lying, sleeper, tool, TOOL_FOR_ACTION, type Dir, type Frame } from "../art/people";
import { T } from "./groundData";

const FOOT = 14;                                       // Fußpunkt innerhalb der Kachel
const DIRS: Dir[] = ["up", "down", "left", "right"];
export const tileFoot = (x: number, y: number) => ({ x: x * T + T / 2, y: y * T + FOOT });

interface View {
  px: number;
  py: number;
  queue: { x: number; y: number }[];
  tile: [number, number] | null;
  dir: Dir;
  walked: number;
  moving: boolean;
  route?: Walk;                                        // zuletzt gesehener Fahrplan; überdauert die Ankunft im selben Bild
}

export interface Pose {
  id: string;
  x: number;
  y: number;
  /** Hauptbild (Stehen, Laufen, Sitzen, Liegen). */
  spr: HTMLCanvasElement;
  /** Bild liegt über einem Bett (Schlafen im Bett): an dessen Fußpunkt, eine Kachel höher gestapelt. */
  inBed: boolean;
  lift: number;
  toolSpr: HTMLCanvasElement | null;
  toolAngle: number;
  sleeping: boolean;
}

const BED_KINDS = new Set(["bed"]), SEAT_KINDS = new Set(["sofa", "bench"]);

export class Figures {
  private views = new Map<string, View>();

  position(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.px, y: v.py } : null;
  }

  update(w: World, dt: number): void {
    for (const id of [...this.views.keys()]) if (!w.agents[id]) this.views.delete(id);
    const delay = w.simulation.tick_delay_s, base = delay > 0 ? 1 / delay : 12;
    for (const a of Object.values(w.agents)) {
      let v = this.views.get(a.id);
      if (!v) { const f = tileFoot(a.x, a.y); v = { px: f.x, py: f.y, queue: [], tile: null, dir: "down", walked: 0, moving: false }; this.views.set(a.id, v); }
      if (w.walks[a.id]) v.route = w.walks[a.id];
      if (!v.tile || v.tile[0] !== a.x || v.tile[1] !== a.y) {
        const between = v.tile ? routeBetween(v.route, v.tile, [a.x, a.y]) : null;
        const far = !v.tile || (!between && Math.abs(v.tile[0] - a.x) + Math.abs(v.tile[1] - a.y) > 2);
        const f = tileFoot(a.x, a.y);
        if (far) { v.px = f.x; v.py = f.y; v.queue = []; }
        else v.queue.push(...(between ?? [[a.x, a.y]]).map(([x, y]) => tileFoot(x, y)));
        v.tile = [a.x, a.y];
      }
      this.step(v, dt, Math.min(12, Math.max(1.5, base)) * T * (1 + v.queue.length * 0.6));
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

  /** Bild und Lage einer Figur für dieses Bild; `kindAt` liefert die Objektarten auf einer Kachel. */
  pose(a: AgentInfo, t: number, kindAt: (x: number, y: number) => string[]): Pose | null {
    const v = this.views.get(a.id);
    if (!v) return null;
    const sleeping = a.status === "sleeping" || a.action?.type === "sleep";
    const kinds = v.moving ? [] : kindAt(a.x, a.y);
    const dir: Dir = v.moving ? v.dir : DIRS.includes(a.facing as Dir) ? (a.facing as Dir) : v.dir;
    const frame: Frame = v.moving ? ((Math.floor(v.walked / 4) % 4) as Frame) : "stand";
    const base = { id: a.id, x: v.px, y: v.py, inBed: false, lift: 0, toolSpr: null, toolAngle: 0, sleeping };
    if (sleeping) {
      if (kinds.some((k) => BED_KINDS.has(k))) return { ...base, y: (a.y + 1) * T - 1, spr: sleeper(a.id), inBed: true, lift: 3 };
      return { ...base, spr: lying(a.id) };
    }
    const sit = !v.moving && (a.action?.type === "rest" || a.action?.params?.mode === "sit") && kinds.some((k) => SEAT_KINDS.has(k));
    const working = !v.moving && a.action != null && a.action.type in TOOL_FOR_ACTION;
    const tl = working ? TOOL_FOR_ACTION[a.action!.type] : null;
    return { ...base, spr: figure(a.id, sit ? "down" : dir, frame, sit ? "sit" : ""), lift: working ? Math.abs(Math.sin(t * 9)) : 0, toolSpr: tl ? tool(tl) : null, toolAngle: tl === "can" ? Math.sin(t * 3) * 0.3 : Math.sin(t * 9) * 0.6 };
  }
}
