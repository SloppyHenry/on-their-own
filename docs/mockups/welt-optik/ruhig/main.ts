// Mockup „Ruhige Ansicht“: Startwelt mit den Sprites der App, aber eben und von schräg oben wie ein klassisches Point-and-Click –
// ohne Wölbung, Dunst, Tilt-Shift, Teilchen und Vignette. Geblieben sind Tageszeit-Farbe und Lichtschein (beides steht still).
// Kein Produktionscode; gebaut mit `bau.sh` zu ../ruhig.js.
import { TIMES, css, type Mood } from "../../../../frontend/src/world/art/palette";
import { accentOf, figure } from "../../../../frontend/src/world/art/people";
import { canvas } from "../../../../frontend/src/world/art/pen";
import { GH, GW, floorTexture, groundTexture } from "./boden";
import { HOUSE_LIGHTS, drawWall, indoorItems, outdoorItems, walls, type Item } from "./dinge";
import { doing, frameOf, makeFig, sendTo, stepFig, type Fig } from "./figuren";
import { Kamera, type Rect } from "./kamera";
import { BLD, DOOR, M, MH, MW, ROOMS, T, inBld, walkable } from "./karte";

type Zeit = keyof typeof TIMES;
const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
const cv = document.getElementById("welt") as HTMLCanvasElement, g = cv.getContext("2d")!;
const OUT: Rect = { x0: -96, y0: -96, x1: MW * T + 96, y1: MH * T + 96 };
const HOUSE: Rect = { x0: BLD.x0 * T - 40, y0: BLD.y0 * T - 56, x1: BLD.x1 * T + 40, y1: BLD.y1 * T + 40 };

const items = outdoorItems(), indoor = indoorItems(), wallList = walls();
const ground = groundTexture(items.filter((i) => i.shadow).map((i) => ({ x: i.x, y: i.y, w: i.spr(false).width })));
const floor = floorTexture();
const figs: Fig[] = [makeFig("alex", "Alex", 33, 9, false, 4), makeFig("mira", "Mira", 14, 7, true, 9)];
const shadowSpr = (() => { const c = canvas(11, 4), s = c.getContext("2d")!; s.fillStyle = "rgba(40,30,60,0.3)"; s.beginPath(); s.ellipse(5.5, 2, 5.5, 2, 0, 0, 7); s.fill(); return c; })();

let zeit: Zeit = "Mittag", interior = false, selected = "alex", saved: { x: number; y: number; z: number } | null = null;
let mark: { x: number; y: number; t: number } | null = null, hoverAt: [number, number] | null = null;
const keys = new Set<string>();
const cam = new Kamera(1, 1, dpr, dpr * 7, OUT);

function resize() {
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`;
  cam.W = cv.width; cam.H = cv.height;
  cam.zMin = Math.max(1, Math.min(dpr, cam.fitZoom(OUT)));
  cam.clamp();
}

// —— Zeichnen ————————————————————————————————————————————————————————————————————
interface Pick { kind: "fig" | "house"; id: string; x: number; y: number; w: number; h: number; spr: HTMLCanvasElement }
let picks: Pick[] = [];

function blit(spr: HTMLCanvasElement, wx: number, wy: number, ox: number, oy: number, z: number, round = true): [number, number] {
  const lx = round ? Math.round(wx - spr.width / 2) : wx - spr.width / 2, ty = round ? Math.round(wy - spr.height) : wy - spr.height;
  const x = Math.round(ox + lx * z), y = Math.round(oy + ty * z);
  g.drawImage(spr, x, y, spr.width * z, spr.height * z);
  return [x, y];
}

function drawFig(f: Fig, ox: number, oy: number, z: number) {
  blit(shadowSpr, f.x + 1, f.y + 2, ox, oy, z, false);
  if (f.id === selected) {
    g.strokeStyle = accentOf(f.id); g.lineWidth = Math.max(2, z * 0.75);
    g.beginPath(); g.ellipse(Math.round(ox + f.x * z), Math.round(oy + (f.y + 0.5) * z), 7 * z, 2.6 * z, 0, 0, 7); g.stroke();
  }
  const spr = figure(f.id, f.dir, frameOf(f)), [x, y] = blit(spr, f.x, f.y, ox, oy, z, false);
  picks.push({ kind: "fig", id: f.id, x, y, w: spr.width * z, h: spr.height * z, spr });
}

function tag(text: string, accent: string, cx: number, y: number, up: boolean, strong = false) {
  g.font = `600 ${11 * dpr}px ui-rounded, system-ui, sans-serif`;
  const w = g.measureText(text).width + 12 * dpr, h = 16 * dpr, x = Math.round(cx - w / 2), top = Math.round(up ? y - h : y);
  g.fillStyle = strong ? "rgba(43,34,51,0.95)" : "rgba(43,34,51,0.78)"; g.strokeStyle = accent; g.lineWidth = dpr;
  g.beginPath(); g.roundRect(x, top, w, h, 5 * dpr); g.fill(); g.stroke();
  g.fillStyle = "#fff8ec"; g.textBaseline = "middle"; g.fillText(text, x + 6 * dpr, top + h / 2 + 0.5);
}

function lights(m: Mood, ox: number, oy: number, z: number) {
  if (m.glowA <= 0) return;
  const L: [number, number, number, number][] = [];
  if (!interior) {
    for (const [dx, h, s] of HOUSE_LIGHTS) L.push([DOOR.x + dx, DOOR.y, h, s]);
    for (const it of items) for (const [h, s] of it.light ?? []) if (it.kind === "lamp") L.push([it.x, it.y, h, s]);
  } else for (const it of indoor) for (const [h, s] of it.light ?? []) L.push([it.x, it.y, h, s]);
  g.globalCompositeOperation = "lighter";
  for (const [x, y, h, s] of L) {
    const gx = ox + x * z, gy = oy + (y - h) * z, r = 16 * z * s, rg = g.createRadialGradient(gx, gy, 0, gx, gy, r);
    rg.addColorStop(0, `rgba(255,205,120,${m.glowA})`); rg.addColorStop(0.35, `rgba(255,170,90,${m.glowA * 0.4})`); rg.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = rg; g.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = "source-over";
}

function render() {
  const m = TIMES[zeit], lit = m.lights > 0.5, z = cam.z, { ox, oy } = cam.offset(), W = cv.width, H = cv.height;
  picks = [];
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#437c40"; g.fillRect(0, 0, W, H);
  const sx = Math.max(0, Math.floor(-ox / z + M)), sy = Math.max(0, Math.floor(-oy / z + M));     // nur der sichtbare Teil des Bodens
  const sw = Math.min(GW - sx, Math.ceil(W / z) + 2), sh = Math.min(GH - sy, Math.ceil(H / z) + 2);
  if (sw > 0 && sh > 0) g.drawImage(ground, sx, sy, sw, sh, ox + (sx - M) * z, oy + (sy - M) * z, sw * z, sh * z);
  const inHouse = figs.filter((f) => f.inside), vw = { x0: -ox / z - 48, x1: (W - ox) / z + 48, y0: -oy / z - 16, y1: (H - oy) / z + 64 };
  const list: (Item | Fig)[] = [...items.filter((i) => i.x > vw.x0 && i.x < vw.x1 && i.y > vw.y0 && i.y < vw.y1), ...figs.filter((f) => !f.inside)];
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if ("name" in it) { drawFig(it, ox, oy, z); continue; }
    const spr = it.spr(lit || (it.kind === "house" && inHouse.length > 0)), [x, y] = blit(spr, it.x, it.y, ox, oy, z);
    if (it.kind === "house") picks.push({ kind: "house", id: "house", x, y, w: spr.width * z, h: spr.height * z, spr });
  }
  if (interior) {
    const bx = ox + BLD.x0 * T * z, by = oy + BLD.y0 * T * z, bw = (BLD.x1 - BLD.x0) * T * z, bh = (BLD.y1 - BLD.y0) * T * z;
    g.fillStyle = "rgba(24,16,34,0.62)"; g.beginPath(); g.rect(0, 0, W, H); g.rect(bx, by - 22 * z, bw, bh + 22 * z); g.fill("evenodd");
    g.drawImage(floor, bx, by, bw, bh);
    const inner: ({ y: number; draw: () => void })[] = [
      ...wallList.map((w) => ({ y: w.y, draw: () => drawWall(g, w, z, ox, oy) })),
      ...indoor.map((it) => ({ y: it.y, draw: () => { blit(it.spr(lit), it.x, it.y, ox, oy, z); } })),
      ...inHouse.map((f) => ({ y: f.y, draw: () => drawFig(f, ox, oy, z) })),
    ];
    inner.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
  }
  const grade = interior ? m.grade.map((c, i) => c + ([255, 236, 210][i] - c) * 0.55 * m.lights) : m.grade;   // drinnen brennt Licht
  if (grade.some((c) => c < 255)) { g.globalCompositeOperation = "multiply"; g.fillStyle = css(grade as typeof m.grade); g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; }
  lights(m, ox, oy, z);
  if (mark) {                                                      // Zielmarke: kurz sichtbar, steht still
    const a = Math.max(0, 1 - (performance.now() - mark.t) / 1600), cx = ox + mark.x * z, cy = oy + mark.y * z;
    g.strokeStyle = `rgba(255,248,236,${a})`; g.lineWidth = Math.max(2, z * 0.6);
    g.beginPath(); g.ellipse(cx, cy, 6 * z, 2.5 * z, 0, 0, 7); g.stroke();
    if (a <= 0) mark = null;
  }
  for (const f of figs) {                                          // Namensschilder: scharf in Bildschirmauflösung
    if (f.inside !== interior) continue;
    tag(`${f.name} · ${doing(f)}`, accentOf(f.id), ox + f.x * z, oy + (f.y + 3) * z, false, f.id === selected);
  }
  if (!interior) inHouse.forEach((f, i) => tag(`${f.name} · im Haus`, accentOf(f.id), ox + DOOR.x * z, oy + (DOOR.y - 82) * z - i * 20 * dpr, true, f.id === selected));
  if (interior) for (const r of ROOMS) tag(r.name, "#fff8ec", ox + (r.r[0] + r.r[2] / 2) * T * z, oy + (r.r[1] + 0.3) * T * z, true);
  if (hoverAt && !interior && hit(hoverAt[0], hoverAt[1])?.kind === "house")
    tag(inHouse.length ? `Haus · ${inHouse.map((f) => f.name).join(", ")} drin – Klick: hineinsehen` : "Haus · leer – Klick: hineinsehen", "#fff8ec", hoverAt[0], hoverAt[1] - 14 * dpr, true, true);
}

// —— Auswahl und Klicks ———————————————————————————————————————————————————————————
const alphaOf = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
function hit(sx: number, sy: number): Pick | null {
  for (let i = picks.length - 1; i >= 0; i--) {
    const p = picks[i];
    if (sx < p.x || sy < p.y || sx >= p.x + p.w || sy >= p.y + p.h) continue;
    let a = alphaOf.get(p.spr);
    if (!a) { a = p.spr.getContext("2d")!.getImageData(0, 0, p.spr.width, p.spr.height).data; alphaOf.set(p.spr, a); }
    const px = Math.floor(((sx - p.x) / p.w) * p.spr.width), py = Math.floor(((sy - p.y) / p.h) * p.spr.height);
    if (a[(py * p.spr.width + px) * 4 + 3] > 40) return p;
  }
  return null;
}

function enter() {
  if (interior) return;
  saved = { x: cam.x, y: cam.y, z: cam.zt };
  interior = true;
  cam.bounds = HOUSE;
  cam.glideTo((HOUSE.x0 + HOUSE.x1) / 2, (HOUSE.y0 + HOUSE.y1) / 2, cam.fitZoom(HOUSE, 0.96));
  ui();
}
function leave() {
  if (!interior) return;
  interior = false;
  cam.bounds = OUT;
  if (saved) cam.glideTo(saved.x, saved.y, saved.z);
  ui();
}

function click(sx: number, sy: number) {
  const p = hit(sx, sy);
  if (p?.kind === "fig") { selected = p.id; return; }
  if (p?.kind === "house") { enter(); return; }
  const w = cam.toWorld(sx, sy), tx = Math.floor(w.x / T), ty = Math.floor(w.y / T), f = figs.find((x) => x.id === selected)!;
  if (interior && !inBld(tx, ty)) { leave(); return; }
  for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]]) {
    if (!walkable(tx + dx, ty + dy, interior)) continue;
    if (sendTo(f, tx + dx, ty + dy, interior, true)) { mark = { x: (tx + dx) * T + 8, y: (ty + dy) * T + 12, t: performance.now() }; return; }
  }
}

let down: { x: number; y: number; moved: boolean } | null = null;
cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener("pointermove", (e) => {
  hoverAt = [e.clientX * dpr, e.clientY * dpr];
  cv.style.cursor = hit(hoverAt[0], hoverAt[1]) ? "pointer" : down?.moved ? "grabbing" : "default";
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) < 5) return;
  down.moved = true;
  cam.dragBy(dx * dpr, dy * dpr);
  down.x = e.clientX; down.y = e.clientY;
});
cv.addEventListener("pointerup", (e) => { if (down && !down.moved) click(e.clientX * dpr, e.clientY * dpr); down = null; });
cv.addEventListener("pointerleave", () => { hoverAt = null; });
cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.wheelBy(e.deltaY * (e.deltaMode === 1 ? 30 : 1), e.clientX * dpr, e.clientY * dpr); }, { passive: false });
addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "BUTTON" && (e.code === "Space" || e.code === "Enter")) return;
  keys.add(e.code);
  if (e.code.startsWith("Arrow")) e.preventDefault();
  if (e.code === "Escape") leave();
  if (e.code === "Digit0" || e.code === "Numpad0") { if (interior) leave(); else cam.glideTo(MW * T / 2, MH * T / 2, cam.fitZoom(OUT)); }
  if (e.code === "Equal" || e.code === "BracketRight" || e.code === "NumpadAdd") cam.zoomTo(cam.zt + 1);
  if (e.code === "Minus" || e.code === "Slash" || e.code === "NumpadSubtract") cam.zoomTo(cam.zt - 1);
  if (e.code === "Tab") { e.preventDefault(); selected = selected === "alex" ? "mira" : "alex"; }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
addEventListener("resize", resize);

// —— Bedienleiste ———————————————————————————————————————————————————————————————
const zoomEl = document.getElementById("zoom")!, leaveEl = document.getElementById("raus") as HTMLButtonElement;
document.querySelectorAll<HTMLButtonElement>("[data-zeit]").forEach((b) => b.addEventListener("click", () => { zeit = b.dataset.zeit as Zeit; ui(); b.blur(); }));
leaveEl.addEventListener("click", () => { leave(); leaveEl.blur(); });
function ui() {
  document.querySelectorAll<HTMLButtonElement>("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeit)));
  leaveEl.hidden = !interior;
  document.body.dataset.innen = interior ? "1" : "";
}

// —— Takt ——————————————————————————————————————————————————————————————————————
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update(dt, keys);
  for (const f of figs) stepFig(f, dt);
  render();
  zoomEl.textContent = `Zoom ${cam.z / dpr}× · ${interior ? "im Haus" : "Dorf"}`;
  requestAnimationFrame(frame);
}
resize();
cam.x = 30 * T; cam.y = 16 * T; cam.z = cam.zt = Math.min(cam.zMax, dpr * 3);
cam.clamp();
ui();
requestAnimationFrame(frame);
document.body.dataset.ready = "1";

// Für Bildschirmfotos im Statusbericht
(window as unknown as { __ruhig: unknown }).__ruhig = {
  cam, figs, enter, leave, setZeit: (z: Zeit) => { zeit = z; ui(); }, select: (id: string) => { selected = id; },
};
