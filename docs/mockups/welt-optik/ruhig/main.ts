// Mockup „Ruhige Ansicht“: Startwelt mit den Sprites der App. Zoom immer in ganzen Pixelstufen, Bild auf ganze Pixel gerundet.
// Zwei Ansichten: „Eben“ (schräg von oben wie ein klassisches Point-and-Click) und „Tiefe“ (Wölbung wie Mockup A, untere Hälfte
// exakt eben, siehe tiefe.ts). Effekte aus Mockup A: Dunst, Himmel, Tilt-Shift, Teilchen, Vignette, Tageszeit, Lichtschein.
// Kein Produktionscode; gebaut mit bau.config.mjs zu ../ruhig.js.
import { TIMES, css, type Mood } from "../../../../frontend/src/world/art/palette";
import { accentOf, figure } from "../../../../frontend/src/world/art/people";
import { canvas } from "../../../../frontend/src/world/art/pen";
import { GH, GW, floorTexture, groundTexture } from "./boden";
import { HOUSE_LIGHTS, drawWall, indoorItems, outdoorItems, walls, type Item } from "./dinge";
import { Himmel, teilchen, tiltMask, vignette } from "./effekte";
import { doing, frameOf, makeFig, sendTo, stepFig, type Fig } from "./figuren";
import { Kamera, type Rect } from "./kamera";
import { BLD, DOOR, M, MH, MW, ROOMS, T, inBld, walkable } from "./karte";
import { Tiefe, type Proj } from "./tiefe";

type Zeit = keyof typeof TIMES;
const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
const cv = document.getElementById("welt") as HTMLCanvasElement, g = cv.getContext("2d")!, tiltEl = document.getElementById("tilt")!;
const sc = document.getElementById("schilder") as HTMLCanvasElement, lg = sc.getContext("2d")!;   // Schilder über dem Tilt-Shift, immer scharf
const OUT: Rect = { x0: -96, y0: -96, x1: MW * T + 96, y1: MH * T + 96 };
const HOUSE: Rect = { x0: BLD.x0 * T - 40, y0: BLD.y0 * T - 56, x1: BLD.x1 * T + 40, y1: BLD.y1 * T + 40 };

const items = outdoorItems(), indoor = indoorItems(), wallList = walls();
const ground = groundTexture(items.filter((i) => i.shadow).map((i) => ({ x: i.x, y: i.y, w: i.spr(false).width })));
const floor = floorTexture(), tiefe = new Tiefe(ground), himmel = new Himmel();
const figs: Fig[] = [makeFig("alex", "Alex", 33, 9, false, 4), makeFig("mira", "Mira", 14, 7, true, 9)];
const shadowSpr = (() => { const c = canvas(11, 4), s = c.getContext("2d")!; s.fillStyle = "rgba(40,30,60,0.3)"; s.beginPath(); s.ellipse(5.5, 2, 5.5, 2, 0, 0, 7); s.fill(); return c; })();

let zeit: Zeit = "Mittag", interior = false, selected = "alex", saved: { x: number; y: number; z: number } | null = null;
let ansicht: "eben" | "tiefe" = "tiefe", effekte = true;
let mark: { x: number; y: number; t: number } | null = null, hoverAt: [number, number] | null = null;
const keys = new Set<string>();
const cam = new Kamera(1, 1, dpr, dpr * 7, OUT);
const deep = () => ansicht === "tiefe" && !interior;          // im Haus immer eben (ohne Wölbung)

function resize() {
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`;
  sc.width = cv.width; sc.height = cv.height; sc.style.width = cv.style.width; sc.style.height = cv.style.height;
  cam.W = cv.width; cam.H = cv.height;
  cam.zMin = Math.max(1, Math.min(dpr, cam.fitZoom(OUT)));
  cam.clamp();
}

// —— Abbildung ————————————————————————————————————————————————————————————————————
/** Welt → Bild vor dem seitlichen Absinken (zum Zeichnen). */
function place(wx: number, wy: number): Proj | null {
  const z = cam.z, { ox, oy } = cam.offset();
  if (!deep()) return { x: ox + wx * z, y: oy + wy * z, s: 1 };
  tiefe.setup(cv.width, cv.height, z);
  return tiefe.project(wx, wy, ox, oy, z, cv.width);
}
/** Welt → Bild, fertig (für Schilder, Marken). */
function screen(wx: number, wy: number) {
  const p = place(wx, wy);
  return p && { x: p.x, y: p.y + (deep() ? tiefe.droop(p.x) : 0), s: p.s };
}
/** Bild → Welt (Klick, Zoom-Anker). */
function worldAt(sx: number, sy: number) {
  if (!deep()) return cam.toWorld(sx, sy);
  const { ox, oy } = cam.offset();
  tiefe.setup(cv.width, cv.height, cam.z);
  return tiefe.unproject(sx, sy, ox, oy, cam.z, cv.width);
}

// —— Zeichnen ————————————————————————————————————————————————————————————————————
interface Pick { kind: "fig" | "house"; id: string; x: number; y: number; w: number; h: number; spr: HTMLCanvasElement }
let picks: Pick[] = [];

/** Sprite mit Fußpunkt (wx, wy). Im ebenen Teil ganzzahlig und pixelgenau, in der Ferne gleichmäßig verkleinert und gefiltert. */
function blit(spr: HTMLCanvasElement, wx: number, wy: number, round = true): [number, number, number] | null {
  const ox = cam.offset().ox, oy = cam.offset().oy, z = cam.z;
  if (!deep() || oy + wy * z >= tiefe.yF) {
    const lx = round ? Math.round(wx - spr.width / 2) : wx - spr.width / 2, ty = round ? Math.round(wy - spr.height) : wy - spr.height;
    const x = Math.round(ox + lx * z), y = Math.round(oy + ty * z);
    if (x > cv.width || y > cv.height || x + spr.width * z < 0) return null;
    g.drawImage(spr, x, y, spr.width * z, spr.height * z);
    return [x, y, z];
  }
  const p = place(wx, wy);
  if (!p) return null;
  const k = z * p.s, x = p.x - (spr.width / 2) * k, y = p.y - spr.height * k;
  if (x > cv.width || x + spr.width * k < 0) return null;
  g.imageSmoothingEnabled = true; g.drawImage(spr, x, y, spr.width * k, spr.height * k); g.imageSmoothingEnabled = false;
  return [x, y, k];
}

function pick(kind: Pick["kind"], id: string, spr: HTMLCanvasElement, r: [number, number, number] | null) {
  if (!r) return;
  const [x, y, k] = r, w = spr.width * k;
  picks.push({ kind, id, x, y: y + (deep() ? tiefe.droop(x + w / 2) : 0), w, h: spr.height * k, spr });
}

function drawFig(f: Fig) {
  blit(shadowSpr, f.x + 1, f.y + 2, false);
  const p = place(f.x, f.y + 0.5);
  if (f.id === selected && p) {
    const k = cam.z * p.s;
    g.strokeStyle = accentOf(f.id); g.lineWidth = Math.max(2, k * 0.75);
    g.beginPath(); g.ellipse(Math.round(p.x), Math.round(p.y), 7 * k, 2.6 * k, 0, 0, 7); g.stroke();
  }
  const spr = figure(f.id, f.dir, frameOf(f));
  pick("fig", f.id, spr, blit(spr, f.x, f.y, false));
}

function tag(text: string, accent: string, cx: number, y: number, up: boolean, strong = false) {
  lg.font = `600 ${11 * dpr}px ui-rounded, system-ui, sans-serif`;
  const w = lg.measureText(text).width + 12 * dpr, h = 16 * dpr, x = Math.round(cx - w / 2), top = Math.round(up ? y - h : y);
  lg.fillStyle = strong ? "rgba(43,34,51,0.95)" : "rgba(43,34,51,0.78)"; lg.strokeStyle = accent; lg.lineWidth = dpr;
  lg.beginPath(); lg.roundRect(x, top, w, h, 5 * dpr); lg.fill(); lg.stroke();
  lg.fillStyle = "#fff8ec"; lg.textBaseline = "middle"; lg.fillText(text, x + 6 * dpr, top + h / 2 + 0.5);
}

function lights(m: Mood) {
  if (m.glowA <= 0) return;
  const L: [number, number, number, number][] = [];
  if (!interior) {
    for (const [dx, h, s] of HOUSE_LIGHTS) L.push([DOOR.x + dx, DOOR.y, h, s]);
    for (const it of items) for (const [h, s] of it.light ?? []) if (it.kind === "lamp") L.push([it.x, it.y, h, s]);
  } else for (const it of indoor) for (const [h, s] of it.light ?? []) L.push([it.x, it.y, h, s]);
  g.globalCompositeOperation = "lighter";
  for (const [x, y, h, s] of L) {
    const p = place(x, y);
    if (!p) continue;
    const k = cam.z * p.s, gx = p.x, gy = p.y - h * k, r = 16 * k * s, rg = g.createRadialGradient(gx, gy, 0, gx, gy, r);
    rg.addColorStop(0, `rgba(255,205,120,${m.glowA})`); rg.addColorStop(0.35, `rgba(255,170,90,${m.glowA * 0.4})`); rg.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = rg; g.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = "source-over";
}

function drawGround(m: Mood, t: number) {
  const z = cam.z, { ox, oy } = cam.offset(), W = cv.width, H = cv.height, top = deep() ? tiefe.yF : 0;
  g.fillStyle = "#437c40"; g.fillRect(0, 0, W, H);
  if (deep()) { himmel.draw(g, W, H, tiefe.yH, m, zeit, t, -ox); tiefe.drawFar(g, ox, oy, z, W, m.haze); }
  const sx = Math.max(0, Math.floor(-ox / z + M)), sy = Math.max(0, Math.floor((top - oy) / z + M) - 1);   // nur der sichtbare Teil
  const sw = Math.min(GW - sx, Math.ceil(W / z) + 2), sh = Math.min(GH - sy, Math.ceil((H - top) / z) + 2);
  if (sw <= 0 || sh <= 0) return;
  g.save(); g.beginPath(); g.rect(0, top, W, H - top); g.clip();
  g.drawImage(ground, sx, sy, sw, sh, ox + (sx - M) * z, oy + (sy - M) * z, sw * z, sh * z);
  g.restore();
}

function render(t: number) {
  const m = TIMES[zeit], lit = m.lights > 0.5, z = cam.z, { ox, oy } = cam.offset(), W = cv.width, H = cv.height;
  picks = [];
  lg.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  if (deep()) tiefe.setup(W, H, z);
  drawGround(m, t);
  const inHouse = figs.filter((f) => f.inside), vy0 = deep() ? -Infinity : -oy / z - 16, vy1 = (H - oy) / z + 64;
  const list: (Item | Fig)[] = [...items.filter((i) => i.y > vy0 && i.y < vy1), ...figs.filter((f) => !f.inside)];
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if ("name" in it) { drawFig(it); continue; }
    const spr = it.spr(lit || (it.kind === "house" && inHouse.length > 0)), r = blit(spr, it.x, it.y);
    if (it.kind === "house") pick("house", "house", spr, r);
  }
  if (interior) {
    const bx = ox + BLD.x0 * T * z, by = oy + BLD.y0 * T * z, bw = (BLD.x1 - BLD.x0) * T * z, bh = (BLD.y1 - BLD.y0) * T * z;
    g.fillStyle = "rgba(24,16,34,0.62)"; g.beginPath(); g.rect(0, 0, W, H); g.rect(bx, by - 22 * z, bw, bh + 22 * z); g.fill("evenodd");
    g.drawImage(floor, bx, by, bw, bh);
    const inner: ({ y: number; draw: () => void })[] = [
      ...wallList.map((w) => ({ y: w.y, draw: () => drawWall(g, w, z, ox, oy) })),
      ...indoor.map((it) => ({ y: it.y, draw: () => { blit(it.spr(lit), it.x, it.y); } })),
      ...inHouse.map((f) => ({ y: f.y, draw: () => drawFig(f) })),
    ];
    inner.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
  }
  const grade = interior ? m.grade.map((c, i) => c + ([255, 236, 210][i] - c) * 0.55 * m.lights) : m.grade;   // drinnen brennt Licht
  if (grade.some((c) => c < 255)) { g.globalCompositeOperation = "multiply"; g.fillStyle = css(grade as typeof m.grade); g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; }
  lights(m);
  if (deep()) tiefe.bend(g, W, H, css(m.skyTop));
  if (effekte) {
    if (!interior) teilchen(g, W, H, deep() ? tiefe.yH : 0, m, zeit, t, -ox, -oy, z, dpr);
    vignette(g, W, H, m);
  }
  if (mark) {                                                      // Zielmarke: kurz sichtbar, steht still
    const a = Math.max(0, 1 - (performance.now() - mark.t) / 1600), p = screen(mark.x, mark.y);
    if (p) { const k = z * p.s; g.strokeStyle = `rgba(255,248,236,${a})`; g.lineWidth = Math.max(2, k * 0.6); g.beginPath(); g.ellipse(p.x, p.y, 6 * k, 2.5 * k, 0, 0, 7); g.stroke(); }
    if (a <= 0) mark = null;
  }
  for (const f of figs) {                                          // Namensschilder: scharf in Bildschirmauflösung
    if (f.inside !== interior) continue;
    const p = screen(f.x, f.y + 3);
    if (p) tag(`${f.name} · ${doing(f)}`, accentOf(f.id), p.x, p.y, false, f.id === selected);
  }
  const roof = screen(DOOR.x, DOOR.y);
  if (!interior && roof) inHouse.forEach((f, i) => tag(`${f.name} · im Haus`, accentOf(f.id), roof.x, roof.y - 82 * z * roof.s - i * 20 * dpr, true, f.id === selected));
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
  const w = worldAt(sx, sy);
  if (!w) return;
  const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T), f = figs.find((x) => x.id === selected)!;
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
document.querySelectorAll<HTMLButtonElement>("[data-ansicht]").forEach((b) => b.addEventListener("click", () => { ansicht = b.dataset.ansicht as typeof ansicht; ui(); b.blur(); }));
const fxEl = document.getElementById("effekte") as HTMLButtonElement;
fxEl.addEventListener("click", () => { effekte = !effekte; ui(); fxEl.blur(); });
leaveEl.addEventListener("click", () => { leave(); leaveEl.blur(); });
function ui() {
  document.querySelectorAll<HTMLButtonElement>("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeit)));
  document.querySelectorAll<HTMLButtonElement>("[data-ansicht]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ansicht === ansicht)));
  fxEl.setAttribute("aria-pressed", String(effekte));
  tiltMask(tiltEl, !effekte || interior ? "aus" : deep() ? "tiefe" : "eben");
  leaveEl.hidden = !interior;
  document.body.dataset.innen = interior ? "1" : "";
}

// —— Takt ——————————————————————————————————————————————————————————————————————
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update(dt, keys, worldAt);
  for (const f of figs) stepFig(f, dt);
  render(now / 1000);
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
  setAnsicht: (a: typeof ansicht) => { ansicht = a; ui(); }, setEffekte: (on: boolean) => { effekte = on; ui(); },
};
