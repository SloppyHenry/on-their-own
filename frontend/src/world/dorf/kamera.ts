// Kamera der Dorfansicht (AP12a, Entscheidung Henry 14.10.2026): Sie fährt durch die Welt, 1× ist immer der Standard. Zoomstufen in
// ganzen Schritten: ¼×, ½× (herausgezoomt: der Puffer zeigt 4- bzw. 2-mal so viel Welt), 1×, 2×, 3× (der fertige Ausschnitt wird vergrößert).
// Beim Fahren wird der Boden weich gelesen und der Horizont gerade („Variante d“); im Stillstand ist das Bild genau Bild A.
import { FOCUS, TH } from "./abbild";

export const LEVELS = [0.25, 0.5, 1, 2, 3];
const RAMP_UP = 14, RAMP_DOWN = 9;                       // wie schnell „fährt“ und „steht“ ein- und ausgeblendet werden (je Sekunde)

export class Kamera {
  /** Boden am unteren Bildrand in der Mitte, Texelkoordinaten. */
  x: number;
  y: number;
  /** Herauszoomen (1, 2, 4) und Hineinzoomen (1, 2, 3). */
  zo = 1;
  zoom = 1;
  /** 0 im Stillstand, 1 bei Fahrt (weich eingeblendet). */
  moving = 0;
  /** Erlaubter Bereich für den Boden in Bildmitte, Texelkoordinaten [x0, y0, x1, y1]. */
  bounds: [number, number, number, number] = [-1e9, -1e9, 1e9, 1e9];
  private px: number;
  private py: number;

  constructor(readonly home: [number, number]) { this.x = this.px = home[0]; this.y = this.py = home[1]; }

  get level() { return this.zo > 1 ? 1 / this.zo : this.zoom; }
  /** Boden in Bildmitte (Texel). */
  get focus(): [number, number] { return [this.x, this.y - TH * this.zo * FOCUS]; }

  setLevel(l: number) { this.zo = l < 1 ? Math.round(1 / l) : 1; this.zoom = l > 1 ? l : 1; }
  /** Nächste Stufe (+1 hinein, −1 hinaus); null am Ende. */
  next(d: number): number | null { const i = LEVELS.indexOf(this.level) + d; return i < 0 || i >= LEVELS.length ? null : LEVELS[i]; }

  /** Kamera so, dass der Boden in Bildmitte bei (fx, fy) liegt. */
  focusAt(fx: number, fy: number) { this.x = fx; this.y = fy + TH * this.zo * FOCUS; this.clamp(); }
  /** Kamera setzen (Texel) und im erlaubten Bereich halten. */
  set(x: number, y: number) { this.x = x; this.y = y; this.clamp(); }
  clamp() {
    const [fx, fy] = this.focus, [x0, y0, x1, y1] = this.bounds;
    const cx = Math.max(x0, Math.min(x1, fx)), cy = Math.max(y0, Math.min(y1, fy));
    if (cx !== fx || cy !== fy) { this.x += cx - fx; this.y += cy - fy; }
  }
  /** Zurück auf Bild A (Startlage, 1×). */
  reset() { this.zo = 1; this.zoom = 1; this.x = this.home[0]; this.y = this.home[1]; this.clamp(); }

  /** Einmal je Bild: wie schnell fährt die Kamera? Liefert `soft` (Boden weich, Sprites in Bruchteilen) und die Wölbung des Horizonts. */
  tick(dt: number) {
    const speed = Math.hypot(this.x - this.px, this.y - this.py) / Math.max(dt, 1e-3) / this.zo;
    this.px = this.x; this.py = this.y;
    const on = speed > 2;
    this.moving += ((on ? 1 : 0) - this.moving) * (1 - Math.exp(-dt * (on ? RAMP_UP : RAMP_DOWN)));
    const soft = this.moving < 0.02 ? 0 : this.moving, curve = Math.round((1 - this.moving) * 50) / 50;
    return { soft, curve: soft === 0 ? 1 : curve };
  }
}
