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
  ox: number;                                          // Versatz, damit Figuren auf derselben Kachel nicht aufeinander liegen
  oy: number;
  speed: number;                                       // Pixel je Sekunde für den laufenden Schub (gleichmäßig statt stoßweise)
  pushedAt: number;                                    // Uhrzeit (s) des letzten Schubs, für den Abstand zum nächsten
  gap: number;                                         // geglätteter Abstand zwischen zwei Schüben (s)
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
  /** Sitzt auf Sofa oder Bank (Innenansicht hebt die Figur an und sortiert sie vor das Möbel). */
  sitting?: boolean;
}

/** Restlicher Weg der Warteschlange in Pixeln (Sprünge durch Türen zählen nicht). */
function ahead(v: View): number {
  let d = 0, x = v.px, y = v.py;
  for (const q of v.queue) { const s = Math.hypot(q.x - x, q.y - y); if (s <= T * 1.6) d += s; x = q.x; y = q.y; }
  return d;
}

const BED_KINDS = new Set(["bed"]), SEAT_KINDS = new Set(["sofa", "bench"]);

export class Figures {
  private views = new Map<string, View>();
  private clock = 0;

  position(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.px + v.ox, y: v.py + v.oy } : null;
  }

  update(w: World, dt: number): void {
    for (const id of [...this.views.keys()]) if (!w.agents[id]) this.views.delete(id);
    this.clock += dt;
    const tick = w.simulation.tick_delay_s > 0 ? w.simulation.tick_delay_s : 1;   // erwarteter Abstand zweier Schritte, bis gemessen
    for (const a of Object.values(w.agents)) {
      let v = this.views.get(a.id);
      if (!v) { const f = tileFoot(a.x, a.y); v = { px: f.x, py: f.y, queue: [], tile: null, dir: "down", walked: 0, moving: false, ox: 0, oy: 0, speed: T / tick, pushedAt: -Infinity, gap: tick }; this.views.set(a.id, v); }
      if (w.walks[a.id]) v.route = w.walks[a.id];
      if (!v.tile || v.tile[0] !== a.x || v.tile[1] !== a.y) {
        const between = v.tile ? routeBetween(v.route, v.tile, [a.x, a.y]) : null;
        const far = !v.tile || (!between && Math.abs(v.tile[0] - a.x) + Math.abs(v.tile[1] - a.y) > 2);
        const f = tileFoot(a.x, a.y);
        if (far) { v.px = f.x; v.py = f.y; v.queue = []; }
        else {
          v.queue.push(...(between ?? [[a.x, a.y]]).map(([x, y]) => tileFoot(x, y)));
          // Der nächste Schub kommt etwa nach dem bisherigen Abstand: so schnell gehen, dass die Warteschlange bis dahin leer ist, ohne Stehen dazwischen.
          const since = this.clock - v.pushedAt;
          v.gap = since > 4 * v.gap + 1 ? tick : Math.min(4, Math.max(0.05, v.gap * 0.6 + since * 0.4));   // nach langer Pause (Stehen, Handeln) neu ansetzen
          v.pushedAt = this.clock;
          v.speed = Math.min(14 * T, Math.max(0.3 * T, ahead(v) / (v.gap * 1.15)));   // etwas Nachlauf: lieber knapp hinterher als stehen
        }
        v.tile = [a.x, a.y];
      }
      this.step(v, dt, v.speed * (1 + Math.max(0, v.queue.length - 8) * 0.25));
    }
    this.spread(w);
  }

  /** Wer ruhig auf derselben Kachel steht, rückt auseinander, damit jede Figur zu sehen ist. */
  private spread(w: World) {
    const groups = new Map<string, View[]>();
    for (const a of Object.values(w.agents)) {
      const v = this.views.get(a.id);
      if (!v) continue;
      const key = `${a.x},${a.y}`, g = groups.get(key);
      if (g && !v.moving && !(a.status === "sleeping" || a.action?.type === "sleep")) g.push(v);
      else if (!g) groups.set(key, !v.moving && !(a.status === "sleeping" || a.action?.type === "sleep") ? [v] : []);
    }
    for (const g of groups.values()) {
      g.forEach((v, i) => {
        const n = g.length, tx = n < 2 ? 0 : (i - (n - 1) / 2) * Math.min(10, 12 / (n - 1)), ty = n < 3 ? 0 : (i % 2 ? 2 : -2);
        v.ox += (tx - v.ox) * 0.25; v.oy += (ty - v.oy) * 0.25;
      });
    }
    for (const v of this.views.values()) if (v.moving) { v.ox *= 0.7; v.oy *= 0.7; }
  }

  private step(v: View, dt: number, speed: number) {
    v.moving = v.queue.length > 0;
    let left = speed * dt;
    while (left > 0 && v.queue.length) {
      const q = v.queue[0], dx = q.x - v.px, dy = q.y - v.py, d = Math.hypot(dx, dy);
      if (d > T * 1.6) { v.px = q.x; v.py = q.y; v.queue.shift(); continue; }   // durch einen Übergang (Haustür): springen, nicht gleiten
      if (d > 0.01) v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      if (d <= left) { v.px = q.x; v.py = q.y; v.queue.shift(); left -= d; v.walked += d; } else { v.px += (dx / d) * left; v.py += (dy / d) * left; v.walked += left; left = 0; }
    }
  }

  /** Bild und Lage einer Figur für dieses Bild; `kindAt` liefert die Objektarten auf einer Kachel. */
  /** `seated`: sitzt auf einem Ding neben der eigenen Kachel (Boot, Sessel, AP15). */
  pose(a: AgentInfo, t: number, kindAt: (x: number, y: number) => string[], seated = false): Pose | null {
    const v = this.views.get(a.id);
    if (!v) return null;
    const sleeping = a.status === "sleeping" || a.action?.type === "sleep";
    const kinds = v.moving ? [] : kindAt(a.x, a.y);
    const dir: Dir = v.moving ? v.dir : DIRS.includes(a.facing as Dir) ? (a.facing as Dir) : v.dir;
    const frame: Frame = v.moving ? ((Math.floor(v.walked / 4) % 4) as Frame) : "stand";
    const base = { id: a.id, x: v.px + v.ox, y: v.py + v.oy, inBed: false, lift: 0, toolSpr: null, toolAngle: 0, sleeping };
    if (sleeping) {
      if (kinds.some((k) => BED_KINDS.has(k))) return { ...base, y: (a.y + 1) * T - 1, spr: sleeper(a.id), inBed: true, lift: 3 };
      return { ...base, spr: lying(a.id) };
    }
    const sit = !v.moving && (seated || ((a.action?.type === "rest" || a.action?.params?.mode === "sit") && kinds.some((k) => SEAT_KINDS.has(k))));
    const working = !v.moving && a.action != null && a.action.type in TOOL_FOR_ACTION;
    const tl = working ? TOOL_FOR_ACTION[a.action!.type] : null;
    return { ...base, sitting: sit, spr: figure(a.id, sit ? "down" : dir, frame, sit ? "sit" : ""), lift: working ? Math.abs(Math.sin(t * 9)) : 0, toolSpr: tl ? tool(tl) : null, toolAngle: tl === "can" ? Math.sin(t * 3) * 0.3 : Math.sin(t * 9) * 0.6 };
  }
}
