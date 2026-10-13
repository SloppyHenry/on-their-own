// Mockup „Ruhige Ansicht“: Kamera ohne Wölbung, ohne Perspektive. Zoom nur in ganzen Gerätepixeln je Weltpixel, Verschiebung auf
// ganze Gerätepixel gerundet – jeder Weltpixel ist immer gleich groß, darum flimmert beim Wandern und Zoomen nichts. Kein Produktionscode.

export interface Rect { x0: number; y0: number; x1: number; y1: number }

export class Kamera {
  x = 0;                    // Bildmitte in Weltpixeln
  y = 0;
  z = 4;                    // Gerätepixel je Weltpixel (ganzzahlig)
  zt = 4;                   // Zielzoom; wird stufenweise erreicht
  private anchor: [number, number] | null = null;
  private goal: [number, number] | null = null;
  private stepWait = 0;
  private wheel = 0;

  constructor(public W: number, public H: number, public zMin: number, public zMax: number, public bounds: Rect) {}

  /** Ganzzahliger Versatz der Welt im Bild (Gerätepixel): für Boden, Dinge und Figuren derselbe. */
  offset(): { ox: number; oy: number } {
    return { ox: Math.round(this.W / 2 - this.x * this.z), oy: Math.round(this.H / 2 - this.y * this.z) };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    const { ox, oy } = this.offset();
    return { x: (sx - ox) / this.z, y: (sy - oy) / this.z };
  }

  /** Größter Zoom, bei dem `r` ganz ins Bild passt (mindestens zMin). */
  fitZoom(r: Rect, share = 1): number {
    return Math.max(this.zMin, Math.min(this.zMax, Math.floor(Math.min((this.W * share) / (r.x1 - r.x0), (this.H * share) / (r.y1 - r.y0)))));
  }

  /** Mausrad: gesammelt, eine Stufe je Raste, Anker unter dem Mauszeiger. */
  wheelBy(dy: number, ax: number, ay: number) {
    this.wheel += dy;
    while (Math.abs(this.wheel) >= 40) {
      const s = this.wheel > 0 ? -1 : 1;
      this.wheel -= -s * 40;
      this.zoomTo(this.zt + s, ax, ay);
    }
  }

  zoomTo(z: number, ax = this.W / 2, ay = this.H / 2) {
    this.zt = Math.max(this.zMin, Math.min(this.zMax, z));
    this.anchor = [ax, ay];
  }

  /** Sanft zu einem Punkt gleiten (Taste 0, Haus betreten). */
  glideTo(x: number, y: number, z?: number) {
    this.goal = [x, y];
    if (z !== undefined) this.zoomTo(z);
    this.anchor = null;
  }

  dragBy(dx: number, dy: number) {
    this.x -= dx / this.z;
    this.y -= dy / this.z;
    this.goal = null;
    this.clamp();
  }

  /** Je Bild: Tasten (WASD, Pfeile), Gleiten, Zoomstufen. `dt` in Sekunden. */
  update(dt: number, keys: Set<string>, unproj: (sx: number, sy: number) => { x: number; y: number } | null = (sx, sy) => this.toWorldF(sx, sy)) {
    const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
    const kx = k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"), ky = k("KeyS", "ArrowDown") - k("KeyW", "ArrowUp");
    if (kx || ky) {
      const fast = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2 : 1, n = Math.hypot(kx, ky), sp = (fast * 520 * (this.W / 1400 + 0.4)) / this.z;
      this.x += (kx / n) * sp * dt;
      this.y += (ky / n) * sp * dt;
      this.goal = null;
    }
    if (this.goal) {
      const a = Math.min(1, dt * 7);
      this.x += (this.goal[0] - this.x) * a;
      this.y += (this.goal[1] - this.y) * a;
      if (Math.hypot(this.goal[0] - this.x, this.goal[1] - this.y) < 0.3) { [this.x, this.y] = this.goal; this.goal = null; }
    }
    this.stepWait -= dt;
    if (this.z !== this.zt && this.stepWait <= 0) {
      const [ax, ay] = this.anchor ?? [this.W / 2, this.H / 2], w0 = unproj(ax, ay) ?? this.toWorldF(ax, ay);
      this.z += Math.sign(this.zt - this.z);
      if (this.anchor) { const w1 = unproj(ax, ay) ?? this.toWorldF(ax, ay); this.x += w0.x - w1.x; this.y += w0.y - w1.y; }   // Punkt unter der Maus bleibt stehen
      this.stepWait = 0.035;
    }
    this.clamp();
  }

  private toWorldF(sx: number, sy: number) {
    return { x: this.x + (sx - this.W / 2) / this.z, y: this.y + (sy - this.H / 2) / this.z };
  }

  clamp() {
    const b = this.bounds, hw = this.W / 2 / this.z, hh = this.H / 2 / this.z;
    this.x = b.x1 - b.x0 <= 2 * hw ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hw, Math.min(b.x1 - hw, this.x));
    this.y = b.y1 - b.y0 <= 2 * hh ? (b.y0 + b.y1) / 2 : Math.max(b.y0 + hh, Math.min(b.y1 - hh, this.y));
  }
}
