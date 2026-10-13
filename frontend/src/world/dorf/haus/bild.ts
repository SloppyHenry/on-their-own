// Innenansicht wie das Mockup innen2 (Frage 23): Rückwände mit Tapete und Wanddeko, Böden je Raum, Teppiche, dünne Wände, Türen,
// Möbel, Vorräte und Figuren nach Tiefe, Sonnenlicht durch die Fenster, abends Lampen- und Kaminschein. Ganzes Haus oder ein Raum,
// ganzzahlig vergrößert.
import { css, type Mood } from "../../art/palette";
import { canvas, type RGB } from "../../art/pen";
import * as D from "../../art/rooms";
import { objectSprite } from "../../art/things";
import type { Target } from "../../view/scene";
import type { Drawn } from "../bild";
import { T } from "../look";
import { BW, LEDGE, floorColor, paperColor, type Plan, type Room } from "./plan";

export type Tageszeit = "Morgen" | "Mittag" | "Abend" | "Nacht";
const SKY: Record<Tageszeit, [string, string]> = { Morgen: ["#a9cff2", "#ffe2cb"], Mittag: ["#6cb7f3", "#cfefff"], Abend: ["#5d5ba8", "#ffab79"], Nacht: ["#0f1534", "#353b70"] };

export interface HausThing {
  x: number;                     // Weltpixel, Fußpunkt
  y: number;
  spr: HTMLCanvasElement;
  target?: Target;
  hoch?: number;                 // angehoben (Sitzen, Arbeiten)
  tool?: HTMLCanvasElement | null;
  toolAngle?: number;
  ring?: string | null;
  hover?: HTMLCanvasElement | null;
  licht?: number;
}

/** Sprite einer Einrichtungsart aus `look.interior` („pflanze:gross“, „bild:see“, „objekt:table“ …). */
export function decorSprite(kind: string, lit: boolean, sky: [string, string], curtain: string): HTMLCanvasElement | null {
  const [k, arg] = kind.split(/:(.*)/s);
  switch (k) {
    case "fenster": return D.fenster(sky[0], sky[1], curtain, lit);
    case "bild": return D.bild(arg ?? "see");
    case "wandregal": return D.wandregal(arg ?? "deko");
    case "uhr": return D.uhr;
    case "spiegel": return D.spiegel;
    case "toepfe": return D.toepfe;
    case "werkzeugwand": return D.werkzeugwand;
    case "pflanze": return D.pflanze(arg === "gross");
    case "stehlampe": return D.stehlampe(lit);
    case "nachttisch": return D.nachttisch(lit);
    case "schrank": return D.schrank;
    case "sessel": return D.sessel(arg ?? "#5d8fb0");
    case "kuechenzeile": return D.kuechenzeile;
    case "korb": return D.korb;
    case "saegebock": return D.saegebock;
    case "kiste": return D.kiste;
    case "kerze": return D.kerze;
    case "katze": return D.katze;
    case "objekt": return objectSprite(arg ?? "table");
    default: return null;
  }
}
const LIGHT: Record<string, number> = { stehlampe: 1, nachttisch: 0.7, kerze: 0.5 };
export const decorLight = (kind: string) => LIGHT[kind.split(":")[0]];

export interface HausOut { drawn: Drawn[]; z: number; ox: number; oy: number; box: { x: number; y: number; w: number; h: number }; labels: { id: string; x: number; y: number }[] }

export class Hausbild {
  private base: HTMLCanvasElement | null = null;
  private low = canvas(1, 1);

  constructor(public plan: Plan, private rugs: (string | number)[][]) {}

  private room = (id: string) => this.plan.rooms.find((r) => r.id === id);

  private makeBase(): HTMLCanvasElement {
    const P = this.plan, c = canvas(P.width, P.height), b = c.getContext("2d")!, img = b.createImageData(P.width, P.height), d = img.data;
    for (let i = 0; i < P.width * P.height; i++) { d[i * 4] = 26; d[i * 4 + 1] = 19; d[i * 4 + 2] = 34; d[i * 4 + 3] = 255; }
    for (const R of P.rooms) {                                                   // Rückwände
      const band = P.bands[R.band], top = band.top, h = band.floor - top, x0 = P.X(R.r[0] * T) - 8, x1 = P.X((R.r[0] + R.r[2]) * T) + 8;
      for (let y = 0; y < h; y++) for (let x = Math.max(0, x0); x < Math.min(P.width, x1); x++) {
        const col = paperColor(R.paper, x - x0, y, h), o = ((top + y) * P.width + x) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    const [ix, , iw] = P.rect;
    for (const band of P.bands) for (let wy = band.y * T; wy < (band.y + band.h) * T; wy++) {     // Böden (Wandspalten: halb links, halb rechts)
      const ty = Math.floor(wy / T);
      for (let wx = (ix + 1) * T - 8; wx < (ix + iw - 1) * T + 8; wx++) {
        const tx = Math.floor(wx / T), k = P.kind(tx, ty);
        let R: Room | undefined = P.roomAt(tx, ty);
        if (!R && (k === "#" || k === "+")) R = P.roomAt(Math.floor((wx + (wx % T < 8 ? -8 : 8)) / T), ty);
        if (!R) continue;
        let col: RGB = floorColor(R.floor, wx, wy);
        const yy = P.Y(wy), fy = yy - band.floor;
        if (fy < 4) col = col.map((v) => v * (0.72 + fy * 0.07)) as RGB;          // Schatten unter der Rückwand
        const o = (Math.round(yy) * P.width + P.X(wx)) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    b.putImageData(img, 0, 0);
    this.drawRugs(b);
    return c;
  }

  private drawRugs(b: CanvasRenderingContext2D) {
    const P = this.plan, at = (tx: number, ty: number) => [P.X(tx * T), P.Y(ty * T)];
    for (const r of this.rugs) {
      if (r[0] === "oval") {
        const [, tx, ty, rx, ry, c1, c2, c3] = r as [string, number, number, number, number, string, string, string], [x, y] = at(tx, ty);
        b.fillStyle = c3; b.beginPath(); b.ellipse(x, y, rx + 2, ry + 2, 0, 0, 7); b.fill();
        b.fillStyle = c1; b.beginPath(); b.ellipse(x, y, rx, ry, 0, 0, 7); b.fill();
        b.fillStyle = c2; b.beginPath(); b.ellipse(x, y, rx * 0.6, ry * 0.6, 0, 0, 7); b.fill();
        b.fillStyle = c1; b.beginPath(); b.ellipse(x, y, rx * 0.3, ry * 0.3, 0, 0, 7); b.fill();
      } else if (r[0] === "teppich") {
        const [, x0, y0, x1, y1] = r as number[], [lx, ly] = at(x0, y0), [lx2, ly2] = at(x1, y1);
        b.fillStyle = "#e8c46a"; b.fillRect(lx, ly, lx2 - lx, ly2 - ly);
        b.fillStyle = "#a83a42"; b.fillRect(lx + 2, ly + 2, lx2 - lx - 4, ly2 - ly - 4);
        b.fillStyle = "#c4505a"; for (let x = lx + 6; x < lx2 - 6; x += 8) for (let y = ly + 6; y < ly2 - 6; y += 8) b.fillRect(x, y, 3, 3);
      } else if (r[0] === "laeufer") {
        const [, x0, y0, x1] = r as number[], [kx, ky] = at(x0, y0), [kx2] = at(x1, y0);
        b.fillStyle = "#7a5a3a"; b.fillRect(kx, ky, kx2 - kx, 12);
        for (let x = kx + 1; x < kx2 - 1; x += 3) { b.fillStyle = (x / 3) % 2 < 1 ? "#d8b07a" : "#5c8de0"; b.fillRect(x, ky + 1, 2, 10); }
      }
    }
  }

  /** Dünne Zwischenwände, aufgeschnittene Vorderwände mit Türlücken, Türen in den Rückwänden. */
  private walls(b: CanvasRenderingContext2D) {
    const P = this.plan, [ix, , iw] = P.rect, wood = "#7c4e30", top = "#b58a62", face = "#e8d6b4";
    P.bands.forEach((band) => {
      for (let tx = ix; tx < ix + iw; tx++) {
        if (P.kind(tx, band.y) !== "#") continue;
        const x = P.X(tx * T) + (tx === ix ? 11 : tx === ix + iw - 1 ? 0 : 6), w = tx === ix || tx === ix + iw - 1 ? 5 : 4;
        b.fillStyle = wood; b.fillRect(x, band.top, w, band.floor - band.top);
        for (let ty = band.y; ty < band.y + band.h; ty++) {
          const y = P.Y(ty * T);
          if (P.kind(tx, ty) === "+") { b.fillStyle = "#c8a777"; b.fillRect(x - 2, y, w + 4, T); continue; }
          b.fillStyle = face; b.fillRect(x, y, w, T); b.fillStyle = top; b.fillRect(x, y, w, 2); b.fillStyle = wood; b.fillRect(x, y, 1, T); b.fillRect(x + w - 1, y, 1, T);
        }
      }
      const ty = band.y + band.h, y = P.Y(ty * T), last = band === P.bands[P.bands.length - 1];
      for (let tx = ix; tx < ix + iw; tx++) {
        const x = P.X(tx * T);
        if (P.kind(tx, ty) === "+") { if (last) b.drawImage(D.fussmatte, x, y + 2); continue; }
        b.fillStyle = "#5e3f28"; b.fillRect(x, y, T, 2); b.fillStyle = face; b.fillRect(x, y + 2, T, LEDGE - 3); b.fillStyle = wood; b.fillRect(x, y + LEDGE - 1, T, 1);
      }
    });
    P.bands.forEach((band, i) => {
      if (i === 0) return;
      for (let tx = ix; tx < ix + iw; tx++) if (P.kind(tx, band.y - 1) === "+") {
        const x = P.X(tx * T) + 2, y0 = band.top + 4, y1 = band.floor;
        b.fillStyle = "#5e3f28"; b.fillRect(x - 1, y0 - 1, 14, y1 - y0 + 1);
        b.fillStyle = "#3a2a24"; b.fillRect(x + 1, y0 + 1, 10, y1 - y0 - 1);
        b.fillStyle = "#c8a777"; b.fillRect(x + 1, y1 - 2, 10, 2);
      }
    });
  }

  /** Zeichnet in `g` (Gerätepixel W × H); `room` = ein Raum groß, sonst das ganze Haus. */
  render(g: CanvasRenderingContext2D, W: number, H: number, o: { things: HausThing[]; wall: [string, number, string, number][]; zeit: Tageszeit; lit: boolean; mood: Mood; room: string | null; top: number }): HausOut {
    const P = this.plan;
    if (!this.base) this.base = this.makeBase();
    if (this.low.width !== P.width || this.low.height !== P.height) { this.low.width = P.width; this.low.height = P.height; }
    const b = this.low.getContext("2d")!, sky = SKY[o.zeit];
    b.imageSmoothingEnabled = false;
    b.drawImage(this.base, 0, 0);
    const wins: number[][] = [];
    for (const [kind, tx, rid, hoch] of o.wall) {
      const R = this.room(rid), spr = R && decorSprite(kind, o.lit, sky, R.curtain);
      if (!R || !spr) continue;
      const x = Math.round(P.X(tx * T)), y = P.bands[R.band].top + hoch;
      b.drawImage(spr, x, Math.round(y));
      if (kind === "fenster") wins.push([x, P.bands[R.band].floor]);
    }
    if (!o.lit) for (const [x, y] of wins) {                                           // Sonnenlicht durchs Fenster auf dem Boden
      b.globalCompositeOperation = "lighter"; b.fillStyle = o.zeit === "Morgen" ? "rgba(255,210,150,0.14)" : "rgba(255,240,200,0.12)";
      b.beginPath(); b.moveTo(x + 3, y); b.lineTo(x + 19, y); b.lineTo(x + 30, y + 40); b.lineTo(x + 8, y + 40); b.fill(); b.globalCompositeOperation = "source-over";
    }
    this.walls(b);
    const placed: { t: HausThing; x: number; y: number }[] = [];
    for (const it of [...o.things].sort((a, c) => a.y - c.y)) {
      const x = Math.round(P.X(it.x) - it.spr.width / 2), y = Math.round(P.Y(it.y) - it.spr.height - (it.hoch ?? 0));
      b.fillStyle = "rgba(40,24,30,0.22)"; b.beginPath(); b.ellipse(P.X(it.x) + 1, P.Y(it.y), it.spr.width * 0.42, Math.max(1.5, it.spr.width * 0.12), 0, 0, 7); b.fill();
      if (it.ring) { b.strokeStyle = it.ring; b.lineWidth = 1; b.beginPath(); b.ellipse(Math.round(P.X(it.x)) + 0.5, Math.round(P.Y(it.y)) + 0.5, 9, 3.5, 0, 0, 7); b.stroke(); }
      if (it.hover) { b.globalAlpha = 0.9; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.drawImage(it.hover, x + dx, y + dy); b.globalAlpha = 1; }
      b.drawImage(it.spr, x, y);
      if (it.tool) { b.save(); b.translate(x + 14, y + 13); b.rotate(it.toolAngle ?? 0); b.drawImage(it.tool, -4, -4); b.restore(); }
      placed.push({ t: it, x, y });
    }
    // Ausschnitt, ganzzahlig vergrößert
    const R = o.room ? this.room(o.room) : null;
    const box = R ? { x: P.X(R.r[0] * T) - 10, y: P.bands[R.band].top, w: R.r[2] * T + 20, h: P.Y((R.r[1] + R.r[3]) * T) + LEDGE + 2 - P.bands[R.band].top } : { x: 0, y: 0, w: P.width, h: P.height };
    const avail = H - o.top, z = Math.max(1, Math.floor(Math.min(W / box.w, avail / box.h))), ox = Math.round((W - box.w * z) / 2), oy = Math.round(o.top + (avail - box.h * z) / 2);
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = "#1a1322"; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.rect(ox, oy, box.w * z, box.h * z); g.clip();
    g.drawImage(this.low, ox - box.x * z, oy - box.y * z, P.width * z, P.height * z);
    const grade: RGB = o.lit ? (o.mood.grade.map((c, i) => c + ([255, 226, 190][i] - c) * 0.45) as RGB) : o.mood.grade;      // drinnen brennt Licht
    if (grade.some((c) => c < 254.5)) { g.globalCompositeOperation = "multiply"; g.fillStyle = css(grade); g.fillRect(ox, oy, box.w * z, box.h * z); }
    g.globalCompositeOperation = "lighter";
    for (const { t, y } of placed) if (t.licht) {
      const x = ox + (P.X(t.x) - box.x) * z, yy = oy + (y + t.spr.height * 0.3 - box.y) * z, r = 30 * z * t.licht;
      const rg = g.createRadialGradient(x, yy, 0, x, yy, r); rg.addColorStop(0, "rgba(255,200,120,0.55)"); rg.addColorStop(0.4, "rgba(255,170,90,0.2)"); rg.addColorStop(1, "rgba(255,150,80,0)");
      g.fillStyle = rg; g.fillRect(x - r, yy - r, 2 * r, 2 * r);
    }
    g.globalCompositeOperation = "source-over";
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.9);
    vg.addColorStop(0, "rgba(30,20,40,0)"); vg.addColorStop(1, o.zeit === "Nacht" ? "rgba(5,8,25,0.5)" : "rgba(40,25,40,0.3)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
    const drawn: Drawn[] = placed.map(({ t, x, y }) => ({ x: ox + (x - box.x) * z, y: oy + (y - box.y) * z, w: t.spr.width * z, h: t.spr.height * z, spr: t.spr, target: t.target }));
    const labels = P.rooms.filter((r) => !o.room || r.id === o.room).map((r) => ({ id: r.id, x: ox + (P.X((r.r[0] + r.r[2] / 2) * T) - box.x) * z, y: oy + (P.Y((r.r[1] + r.r[3]) * T) - box.y) * z }));
    return { drawn, z, ox, oy, box, labels };
  }
}

void BW;
