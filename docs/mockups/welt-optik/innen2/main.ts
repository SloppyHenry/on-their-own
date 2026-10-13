// Mockup Innenräume (nach Henrys Rückmeldung „eintönig und unschön“): das Haus der Startwelt als Puppenhaus oder Raum für Raum,
// mit Tapeten, Fenstern, Bildern, Teppichen, mehr Einrichtung und Licht nach Tageszeit. Kein Produktionscode; gebaut zu ../innen2.js.
import { TIMES, WP, css } from "../../../../frontend/src/world/art/palette";
import { accentOf, figure, sleeper, tool } from "../../../../frontend/src/world/art/people";
import { canvas, type RGB } from "../../../../frontend/src/world/art/pen";
import { objectSprite, resourceSprite } from "../../../../frontend/src/world/art/things";
import * as D from "./deko";
import { BW, HEIGHT, IX, LEDGE, OUTSIDE, ROOMS, T, WIDTH, Y, bandTop, floorColor, floorTop, kind, objects, paperColor, resources, roomAt, type Room } from "./haus";

type Zeit = keyof typeof TIMES;
let zeit: Zeit = "Mittag", variante: "haus" | "raum" = "haus", raum = "house.living";
const cv = document.getElementById("bild") as HTMLCanvasElement, g = cv.getContext("2d")!, dpr = Math.max(1, Math.round(devicePixelRatio || 1));
const X = (wx: number) => wx - IX * T;                                     // Weltpixel → Bildspalte
const lit = () => TIMES[zeit].lights > 0.5;
const SKY: Record<Zeit, [string, string]> = { Morgen: ["#a9cff2", "#ffe2cb"], Mittag: ["#6cb7f3", "#cfefff"], Abend: ["#5d5ba8", "#ffab79"], Nacht: ["#0f1534", "#353b70"] };
const CURTAIN: Record<string, string> = { "house.bedroom_a": "#5d7fb0", "house.bedroom_b": "#d97a92", "house.workshop": "#a9884e", "house.kitchen": "#e0a458", "house.living": "#b04a4a" };

// —— Boden, Wände, Teppiche (einmal je Tageszeit) ———————————————————————————————————————
function backWall(img: ImageData, R: Room) {
  const top = bandTop(R.band), h = floorTop(R.band) - top, x0 = X(R.r[0] * T) - 8, x1 = X((R.r[0] + R.r[2]) * T) + 8, d = img.data;
  for (let y = 0; y < h; y++) for (let x = Math.max(0, x0); x < Math.min(WIDTH, x1); x++) {
    const c = paperColor(R.paper, x - x0, y, h), o = ((top + y) * WIDTH + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
}

function base(): HTMLCanvasElement {
  const c = canvas(WIDTH, HEIGHT), b = c.getContext("2d")!, img = b.createImageData(WIDTH, HEIGHT), d = img.data;
  for (let i = 0; i < WIDTH * HEIGHT; i++) { d[i * 4] = 26; d[i * 4 + 1] = 19; d[i * 4 + 2] = 34; d[i * 4 + 3] = 255; }
  for (const R of ROOMS) backWall(img, R);
  for (let wy = 4 * T; wy < 15 * T; wy++) {                                 // Böden (Wandspalten: halb links, halb rechts)
    const ty = Math.floor(wy / T);
    if (ty === 9) continue;
    for (let wx = (IX + 1) * T - 8; wx < (IX + 23) * T + 8; wx++) {
      const tx = Math.floor(wx / T), k = kind(tx, ty);
      let R = roomAt(tx, ty);
      if (!R && (k === "#" || k === "+")) R = roomAt(Math.floor((wx + (wx % T < 8 ? -8 : 8)) / T), ty);
      if (!R) continue;
      let col: RGB = floorColor(R.floor, wx, wy);
      const yy = Y(wy), fy = yy - floorTop(R.band);
      if (fy < 4) col = col.map((v) => v * (0.72 + fy * 0.07)) as RGB;      // Schatten unter der Rückwand
      const o = (Math.round(yy) * WIDTH + X(wx)) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  b.putImageData(img, 0, 0);
  rugs(b);
  return c;
}

function rugs(b: CanvasRenderingContext2D) {
  const at = (tx: number, ty: number) => [X(tx * T), Y(ty * T)];
  const oval = (tx: number, ty: number, rx: number, ry: number, c1: string, c2: string, c3: string) => {
    const [x, y] = at(tx, ty);
    b.fillStyle = c3; b.beginPath(); b.ellipse(x, y, rx + 2, ry + 2, 0, 0, 7); b.fill();
    b.fillStyle = c1; b.beginPath(); b.ellipse(x, y, rx, ry, 0, 0, 7); b.fill();
    b.fillStyle = c2; b.beginPath(); b.ellipse(x, y, rx * 0.6, ry * 0.6, 0, 0, 7); b.fill();
    b.fillStyle = c1; b.beginPath(); b.ellipse(x, y, rx * 0.3, ry * 0.3, 0, 0, 7); b.fill();
  };
  oval(30, 7.3, 26, 11, "#5d7fb0", "#86a6d0", "#3f5f8c");
  oval(37, 7.3, 22, 11, "#d97a92", "#f2b0c0", "#b05a72");
  const [lx, ly] = at(40, 11), [lx2, ly2] = at(46, 14);                       // Wohnzimmer: großer Teppich mit Bordüre
  b.fillStyle = "#e8c46a"; b.fillRect(lx, ly, lx2 - lx, ly2 - ly);
  b.fillStyle = "#a83a42"; b.fillRect(lx + 2, ly + 2, lx2 - lx - 4, ly2 - ly - 4);
  b.fillStyle = "#c4505a"; for (let x = lx + 6; x < lx2 - 6; x += 8) for (let y = ly + 6; y < ly2 - 6; y += 8) b.fillRect(x, y, 3, 3);
  const [kx, ky] = at(29, 12.4), [kx2] = at(34, 12);                         // Küche: Läufer
  b.fillStyle = "#7a5a3a"; b.fillRect(kx, ky, kx2 - kx, 12);
  for (let x = kx + 1; x < kx2 - 1; x += 3) { b.fillStyle = (x / 3) % 2 < 1 ? "#d8b07a" : "#5c8de0"; b.fillRect(x, ky + 1, 2, 10); }
}

// —— Wände vorn und dazwischen, Türen ——————————————————————————————————————————————————
function walls(b: CanvasRenderingContext2D) {
  const wood = "#7c4e30", top = "#b58a62", face = "#e8d6b4";
  for (const band of [0, 1] as const) {                                      // senkrechte, dünne Wände
    const ty0 = band === 0 ? 4 : 10;
    for (let tx = IX; tx < IX + 24; tx++) {
      if (kind(tx, ty0) !== "#") continue;
      const x = X(tx * T) + (tx === IX ? 11 : tx === IX + 23 ? 0 : 6), w = tx === IX || tx === IX + 23 ? 5 : 4;
      b.fillStyle = wood; b.fillRect(x, bandTop(band), w, floorTop(band) - bandTop(band));       // Pfosten in der Rückwand
      for (let ty = ty0; ty < ty0 + 5; ty++) {
        if (kind(tx, ty) === "+") { b.fillStyle = "#c8a777"; b.fillRect(x - 2, Y(ty * T), w + 4, T); continue; }   // Durchgang
        const y = Y(ty * T);
        b.fillStyle = face; b.fillRect(x, y, w, T); b.fillStyle = top; b.fillRect(x, y, w, 2); b.fillStyle = wood; b.fillRect(x, y, 1, T); b.fillRect(x + w - 1, y, 1, T);
      }
    }
  }
  for (const [ty, band] of [[9, 0], [15, 1]] as const) {                   // vordere Schnittkanten mit Türlücken
    const y = Y(ty * T) + (band === 0 ? 0 : 0);
    for (let tx = IX; tx < IX + 24; tx++) {
      const x = X(tx * T), door = kind(tx, ty) === "+";
      if (door) { if (band === 1) b.drawImage(D.fussmatte, x, y + 2); continue; }
      b.fillStyle = "#5e3f28"; b.fillRect(x, y, T, 2); b.fillStyle = face; b.fillRect(x, y + 2, T, LEDGE - 3); b.fillStyle = wood; b.fillRect(x, y + LEDGE - 1, T, 1);
    }
  }
  for (let tx = IX; tx < IX + 24; tx++) if (kind(tx, 9) === "+") {           // Türen in der Rückwand der unteren Reihe
    const x = X(tx * T) + 2, y0 = bandTop(1) + 4, y1 = floorTop(1);
    b.fillStyle = "#5e3f28"; b.fillRect(x - 1, y0 - 1, 14, y1 - y0 + 1);
    b.fillStyle = "#3a2a24"; b.fillRect(x + 1, y0 + 1, 10, y1 - y0 - 1);
    b.fillStyle = "#c8a777"; b.fillRect(x + 1, y1 - 2, 10, 2);
  }
}

// —— Dinge ————————————————————————————————————————————————————————————————————————————
interface Ding { x: number; y: number; spr: HTMLCanvasElement; wand?: boolean; licht?: number; tool?: HTMLCanvasElement; hoch?: number }
const foot = (tx: number, ty: number): [number, number] => [tx * T + 8, (ty + 1) * T - 1];
const wand = (tx: number, band: 0 | 1, spr: HTMLCanvasElement, hoch = 8, licht?: number): Ding => ({ x: tx * T, y: bandTop(band) + hoch + spr.height, spr, wand: true, licht });

function dinge(): Ding[] {
  const L = lit(), [st, sb] = SKY[zeit], out: Ding[] = [];
  const add = (tx: number, ty: number, spr: HTMLCanvasElement, licht?: number) => { const [x, y] = foot(tx, ty); out.push({ x, y, spr, licht }); };
  for (const o of objects) {
    if (o.kind === "door") continue;
    const key = o.kind === "bed" ? `bed|${accentOf(o.owner ?? "alex")}` : o.kind === "desk" ? "desk|0" : o.kind === "fireplace" || o.kind === "stove" ? `${o.kind}|${L ? 1 : 0}` : o.kind;
    add(o.tile[0], o.tile[1], objectSprite(key), o.kind === "fireplace" && L ? 1.3 : undefined);
  }
  for (const n of resources) {
    if (n.resource === "water") continue;
    add(n.tile[0], n.tile[1], n.resource === "food" ? D.korb : resourceSprite(`res|${n.resource}||5`));
  }
  const win = (r: string) => D.fenster(st, sb, CURTAIN[r], L);
  out.push(wand(29.4, 0, win("house.bedroom_a"), 6), wand(27.3, 0, D.bild("see"), 12), wand(36.4, 0, win("house.bedroom_b"), 6), wand(34.4, 0, D.bild("blume"), 11),
    wand(38.3, 0, D.wandregal("buecher"), 12), wand(44.3, 0, win("house.workshop"), 6), wand(41.4, 0, D.werkzeugwand, 9), wand(46.6, 0, win("house.workshop"), 6),
    wand(27.4, 1, D.toepfe, 8), wand(32.6, 1, D.wandregal("glaeser"), 10), wand(34.9, 1, D.uhr, 9), wand(38.6, 1, D.bild("portrait"), 10), wand(41.2, 1, D.spiegel, 9), wand(45.4, 1, D.wandregal("deko"), 12));
  add(29, 5, D.nachttisch(L), L ? 0.7 : undefined); add(32, 4, D.schrank); add(27, 8, D.pflanze(false));
  add(39, 4, D.stehlampe(L), L ? 1 : undefined); add(34, 8, D.katze); add(39, 8, D.pflanze(true));
  add(44, 7, D.saegebock); add(41, 8, D.kiste); add(42, 8, D.kiste);
  add(33, 10, D.kuechenzeile); add(30, 12, objectSprite("table"));
  add(37, 11, D.stehlampe(L), L ? 1 : undefined); add(45, 13, D.sessel("#5d8fb0")); add(37, 14, D.pflanze(true)); add(44, 12, D.kerze, L ? 0.5 : undefined);
  return out;
}

function figuren(): Ding[] {
  const f = (id: string, tx: number, ty: number, dir: "up" | "down" | "left" | "right", pose: "" | "sit" = "", werk?: string): Ding =>
    ({ x: tx * T + 8, y: (ty + 1) * T - (pose ? 0.5 : 2), hoch: pose ? 5 : 0, spr: figure(id, dir, "stand", pose), tool: werk ? tool(werk) : undefined });   // sitzt: vor dem Sofa einsortiert, angehoben
  if (zeit === "Morgen") return [f("alex", 28, 12, "up"), f("mira", 38, 6, "up", "", "book")];
  if (zeit === "Mittag") return [f("alex", 43, 6, "up", "", "hammer"), f("mira", 31, 13, "left")];
  if (zeit === "Abend") return [f("mira", 39, 12, "down", "sit"), f("alex", 46, 13, "left")];
  return [{ x: 28 * T + 8, y: 6 * T - 1 + 0.5, spr: sleeper("alex") }, { x: 35 * T + 8, y: 6 * T - 1 + 0.5, spr: sleeper("mira") }];
}

// —— Bild ————————————————————————————————————————————————————————————————————————————
let baseC: HTMLCanvasElement | null = null, baseKey = "";
const low = canvas(WIDTH, HEIGHT);

function render() {
  if (baseKey !== zeit) { baseC = base(); baseKey = zeit; }
  const b = low.getContext("2d")!, m = TIMES[zeit], items = [...dinge(), ...figuren()];
  b.imageSmoothingEnabled = false;
  b.drawImage(baseC!, 0, 0);
  for (const it of items.filter((i) => i.wand)) b.drawImage(it.spr, Math.round(X(it.x)), Math.round(it.y - it.spr.height));
  if (!lit()) for (const it of items.filter((i) => i.wand && i.spr.width === 22)) {          // Sonnenlicht durchs Fenster auf dem Boden
    const x = X(it.x), y = floorTop(it.y < floorTop(1) ? 0 : 1);
    b.globalCompositeOperation = "lighter"; b.fillStyle = zeit === "Morgen" ? "rgba(255,210,150,0.14)" : "rgba(255,240,200,0.12)";
    b.beginPath(); b.moveTo(x + 3, y); b.lineTo(x + 19, y); b.lineTo(x + 30, y + 40); b.lineTo(x + 8, y + 40); b.fill(); b.globalCompositeOperation = "source-over";
  }
  walls(b);
  for (const it of items.filter((i) => !i.wand).sort((a, c) => a.y - c.y)) {
    const x = Math.round(X(it.x) - it.spr.width / 2), y = Math.round(Y(it.y) - it.spr.height - (it.hoch ?? 0));
    b.fillStyle = "rgba(40,24,30,0.22)"; b.beginPath(); b.ellipse(X(it.x) + 1, Y(it.y), it.spr.width * 0.42, Math.max(1.5, it.spr.width * 0.12), 0, 0, 7); b.fill();
    b.drawImage(it.spr, x, y);
    if (it.tool) b.drawImage(it.tool, x + 10, y + 9);
  }
  // auf den Bildschirm: ganzzahlig vergrößert, Ausschnitt je Variante
  const W = cv.width, H = cv.height, R = ROOMS.find((r) => r.id === raum)!;
  const box = variante === "haus" ? { x: 0, y: 0, w: WIDTH, h: HEIGHT } : { x: X(R.r[0] * T) - 10, y: bandTop(R.band), w: R.r[2] * T + 20, h: Y((R.r[1] + R.r[3]) * T) + LEDGE + 2 - bandTop(R.band) };
  const z = Math.max(1, Math.floor(Math.min(W / box.w, (H - 70 * dpr) / box.h))), ox = Math.round((W - box.w * z) / 2), oy = Math.round((H - box.h * z) / 2 + 20 * dpr);
  g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.fillStyle = "#1a1322"; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(ox, oy, box.w * z, box.h * z); g.clip();
  g.drawImage(low, ox - box.x * z, oy - box.y * z, WIDTH * z, HEIGHT * z);
  const grade: RGB = lit() ? (m.grade.map((c, i) => c + ([255, 226, 190][i] - c) * 0.45) as RGB) : m.grade;      // drinnen brennt Licht
  if (grade.some((c) => c < 255)) { g.globalCompositeOperation = "multiply"; g.fillStyle = css(grade); g.fillRect(ox, oy, box.w * z, box.h * z); }
  g.globalCompositeOperation = "lighter";
  for (const it of items) if (it.licht) {
    const x = ox + (X(it.x) - box.x) * z, y = oy + ((it.wand ? it.y : Y(it.y)) - box.y - it.spr.height * 0.7) * z, r = 30 * z * it.licht;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, "rgba(255,200,120,0.55)"); rg.addColorStop(0.4, "rgba(255,170,90,0.2)"); rg.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalCompositeOperation = "source-over";
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.9);
  vg.addColorStop(0, "rgba(30,20,40,0)"); vg.addColorStop(1, zeit === "Nacht" ? "rgba(5,8,25,0.5)" : "rgba(40,25,40,0.3)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.restore();
  g.font = `600 ${11 * dpr}px ui-rounded, system-ui, sans-serif`; g.textBaseline = "middle";      // Raumnamen
  for (const r of ROOMS) {
    if (variante === "raum" && r.id !== raum) continue;
    const t = r.name, w = g.measureText(t).width + 12 * dpr, x = ox + (X((r.r[0] + r.r[2] / 2) * T) - box.x) * z - w / 2, y = oy + (Y((r.r[1] + r.r[3]) * T) - box.y) * z - 22 * dpr;
    g.fillStyle = "rgba(43,34,51,0.72)"; g.beginPath(); g.roundRect(x, y, w, 16 * dpr, 5 * dpr); g.fill();
    g.fillStyle = "#fff8ec"; g.fillText(t, x + 6 * dpr, y + 8 * dpr);
  }
}

// —— Bedienung —————————————————————————————————————————————————————————————————————————
function resize() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`; render(); }
function ui() {
  document.querySelectorAll<HTMLButtonElement>("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeit)));
  document.querySelectorAll<HTMLButtonElement>("[data-variante]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.variante === variante)));
  document.querySelectorAll<HTMLButtonElement>("[data-raum]").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.raum === raum)); b.hidden = variante !== "raum"; });
  render();
}
const tabs = document.getElementById("raeume")!;
for (const r of ROOMS) { const b = document.createElement("button"); b.dataset.raum = r.id; b.textContent = r.name; tabs.appendChild(b); }
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  if (b.dataset.zeit) zeit = b.dataset.zeit as Zeit;
  if (b.dataset.variante) variante = b.dataset.variante as typeof variante;
  if (b.dataset.raum) raum = b.dataset.raum;
  ui();
});
addEventListener("resize", resize);
resize(); ui();
document.body.dataset.ready = "1";
(window as unknown as { __innen: unknown }).__innen = { set: (z: Zeit, v: typeof variante, r?: string) => { zeit = z; variante = v; if (r) raum = r; ui(); } };
void BW; void OUTSIDE; void WP;
