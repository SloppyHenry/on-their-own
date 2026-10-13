// Mockup „Ruhige Ansicht“, Schalter „Tiefe“: Wölbung wie Mockup A, aber mit festen Zoomstufen und ohne Flimmern.
// Untere Bildhälfte: exakt die ebene Ansicht (ganzzahliger Zoom, ganze Pixel) – dort wird geklickt. Darüber rollt der Boden zum
// Horizont weg: je Bildzeile ein fester Maßstab s ≤ 1, gleich in x und y (Figuren schrumpfen gleichmäßig, nichts wird gequetscht).
// Der Boden kommt dort aus vorab verkleinerten Stufen (½, ¼) und wird gefiltert statt punktweise gelesen, darum flimmert er nicht.
// Zur Seite sinkt das ganze Bild sanft ab (ganze Pixel je Spalte) – zusammen ergibt das eine Kugel, keine Rolle. Kein Produktionscode.
import { canvas } from "../../../../frontend/src/world/art/pen";
import { GH, GW } from "./boden";
import { M } from "./karte";

const A = 29;                 // Stärke des Wegrollens nach hinten
const HOR = 0.13;             // Horizont (Anteil der Bildhöhe)
const DROOP = 0.035;          // Absinken an den Seiten (Anteil der Bildhöhe)

export interface Proj { x: number; y: number; s: number }

export class Tiefe {
  yF = 0;                     // Bildzeile, ab der es eben ist (Bildmitte)
  yH = 0;                     // Horizont
  private dW = new Float64Array(0);     // je Zeile: Weltabstand zur Zeile yF (negativ nach oben)
  private sc = new Float64Array(0);     // je Zeile: Maßstab 0 … 1
  private drop = new Int16Array(0);     // je Spalte: Absinken in Pixeln
  private key = "";
  private levels: HTMLCanvasElement[] = [];
  private tmp = canvas(1, 1);

  constructor(private ground: HTMLCanvasElement) {
    let src = ground;                                       // verkleinerte Stufen, einmal gefiltert
    this.levels = [ground];
    for (let i = 0; i < 3; i++) {
      const c = canvas(Math.ceil(src.width / 2), Math.ceil(src.height / 2)), g = c.getContext("2d")!;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(src, 0, 0, c.width, c.height);
      this.levels.push(c); src = c;
    }
  }

  setup(W: number, H: number, z: number) {
    const key = `${W}x${H}x${z}`;
    if (key === this.key) return;
    this.key = key;
    this.yF = Math.round(H / 2); this.yH = Math.round(H * HOR);
    this.dW = new Float64Array(this.yF + 1); this.sc = new Float64Array(this.yF + 1);
    this.sc[this.yF] = 1;
    for (let y = this.yF - 1; y >= 0; y--) {
      const d = (this.yF - y - 0.5) / H, s = 1 / (1 + A * d * d);
      this.sc[y] = s; this.dW[y] = this.dW[y + 1] - 1 / (z * s);
    }
    this.drop = new Int16Array(W);
    for (let x = 0; x < W; x++) { const u = (x + 0.5 - W / 2) / (W / 2); this.drop[x] = Math.round(DROOP * H * u * u); }
    this.tmp.width = W; this.tmp.height = H;
  }

  droop = (x: number) => this.drop[Math.max(0, Math.min(this.drop.length - 1, Math.round(x)))] ?? 0;

  /** Welt → Bild (ohne seitliches Absinken). ox/oy wie in der ebenen Ansicht, z ganzzahlig. */
  project(wx: number, wy: number, ox: number, oy: number, z: number, W: number): Proj | null {
    const sy = oy + wy * z;
    if (sy >= this.yF) return { x: ox + wx * z, y: sy, s: 1 };
    const d = wy - (this.yF - oy) / z;                     // < 0: hinter der Zeile yF
    if (d < this.dW[this.yH]) return null;
    let lo = this.yH, hi = this.yF;                        // dW fällt nach oben: suche Zeile mit dW[y] ≤ d < dW[y+1]
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.dW[m] <= d) lo = m; else hi = m; }
    const f = (d - this.dW[lo]) / (this.dW[lo + 1] - this.dW[lo]), s = this.sc[lo], cx = (W / 2 - ox) / z;
    return { x: W / 2 + (wx - cx) * z * s, y: lo + f, s };
  }

  /** Bild → Welt (mit seitlichem Absinken); im Himmel null. */
  unproject(sx: number, sy: number, ox: number, oy: number, z: number, W: number): { x: number; y: number } | null {
    const y = sy - this.droop(sx);
    if (y >= this.yF) return { x: (sx - ox) / z, y: (y - oy) / z };
    if (y < this.yH) return null;
    const r = Math.floor(y), f = y - r, s = this.sc[r], cx = (W / 2 - ox) / z;
    return { x: cx + (sx - W / 2) / (z * s), y: (this.yF - oy) / z + this.dW[r] + f * (this.dW[r + 1] - this.dW[r]) };
  }

  /** Ferner Boden: je Zeile ein gefilterter Streifen aus der passenden Stufe, darüber Dunst. */
  drawFar(g: CanvasRenderingContext2D, ox: number, oy: number, z: number, W: number, haze: number[]) {
    const cx = (W / 2 - ox) / z, wyF = (this.yF - oy) / z, far = this.dW[this.yH];
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "low";
    for (let y = this.yH; y < this.yF; y++) {
      const s = this.sc[y], k = z * s, L = k >= 1 ? 0 : k >= 0.5 ? 1 : k >= 0.25 ? 2 : 3, img = this.levels[L], f = 1 / (1 << L);
      const w0 = cx - W / 2 / k, sy = (wyF + this.dW[y] + M) * f, sh = (this.dW[y + 1] - this.dW[y]) * f;
      let sx = (w0 + M) * f, sw = (W / k) * f, dx = 0, dw = W;
      if (sx < 0) { const cut = -sx; dx += (cut / sw) * W; dw -= (cut / sw) * W; sw -= cut; sx = 0; }
      const maxW = (GW * f) - sx;
      if (sw > maxW) { dw *= maxW / sw; sw = maxW; }
      if (sw > 0 && dw > 0 && sy >= 0 && sy + sh <= GH * f) g.drawImage(img, sx, sy, sw, sh, dx, y, dw, 1);
      const t = this.dW[y] / far, fog = Math.pow(t, 2.2) * 0.55;
      if (fog > 0.01) { g.fillStyle = `rgba(${haze[0] | 0},${haze[1] | 0},${haze[2] | 0},${fog})`; g.fillRect(0, y, W, 1); }
    }
    g.imageSmoothingEnabled = false;
  }

  /** Seitliches Absinken: das fertige Bild spaltenweise um ganze Pixel nach unten schieben; oben scheint der Himmel nach. */
  bend(g: CanvasRenderingContext2D, W: number, H: number, skyTop: string) {
    const t = this.tmp.getContext("2d")!;
    t.clearRect(0, 0, W, H); t.drawImage(g.canvas, 0, 0);
    g.fillStyle = skyTop; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W;) {
      const d = this.drop[x];
      let e = x + 1;
      while (e < W && this.drop[e] === d) e++;
      g.drawImage(this.tmp, x, 0, e - x, H - d, x, d, e - x, H - d);
      x = e;
    }
  }
}
