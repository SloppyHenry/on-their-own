import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { freshWorld, openApp, settled } from "./helpers";

/** Leistungsmessung (nur mit SIM_MESSEN=1): Bildrate und Rechenzeit je Bild. Startwelt nach Mockup A (Dorfansicht, AP14) und große
 *  Testwelt ohne eigene Gestaltung (256 × 256, 20 Figuren, 500 Objekte, Ansicht aus AP13). */
test.skip(!process.env.SIM_MESSEN, "nur mit SIM_MESSEN=1");
// SIM_MESSEN=gpu: vollständiges Chromium im neuen Headless-Modus mit Grafikkarte (Metal), sonst Software-Rendering
if (process.env.SIM_MESSEN === "gpu") test.use({ channel: "chromium", launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] } });
test.setTimeout(240_000);

/** Erzeugte Testwelt (kein Spielstand): Wiese mit Wegenetz, Waldstücken, See, 12 Häusern, Platz, Garten. */
function bigSnapshot(base: Record<string, unknown>) {
  const N = 256, g: string[][] = Array.from({ length: N }, () => Array(N).fill("."));
  const h = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2 || (Math.hypot(x - 60, y - 190) < 26 && h(x, y) < 0.7)) g[y][x] = "T";
    if (x % 32 === 16 || y % 32 === 16) g[y][x] = ",";
    const d = Math.hypot((x - 180) / 1.3, y - 70);
    if (d < 20) g[y][x] = "~"; else if (d < 22) g[y][x] = "s";
  }
  const locations: object[] = [{ id: "paths", name: "Wege", rect: [0, 0, N, N], entrances: [], props: { fallback: true }, discovered_by: [] }];
  for (let i = 0; i < 12; i++) {
    const x0 = 20 + (i % 4) * 56, y0 = 100 + Math.floor(i / 4) * 40;
    for (let y = y0; y < y0 + 7; y++) for (let x = x0; x < x0 + 10; x++) g[y][x] = y === y0 || y === y0 + 6 || x === x0 || x === x0 + 9 ? "#" : "_";
    g[y0 + 6][x0 + 5] = "+"; g[y0 + 7][x0 + 5] = ",";
    locations.push({ id: `haus${i}`, name: `Haus ${i}`, rect: [x0 + 1, y0 + 1, 8, 5], entrances: [], props: { style: { floor: "planks" } }, discovered_by: [] });
  }
  locations.push({ id: "platz", name: "Platz", rect: [120, 20, 16, 10], entrances: [], props: { style: { surface: "cobble" } }, discovered_by: [] });
  locations.push({ id: "garten", name: "Garten", rect: [40, 30, 20, 12], entrances: [], props: { style: { fence: true } }, discovered_by: [] });
  for (let y = 20; y < 30; y++) for (let x = 120; x < 136; x++) g[y][x] = ",";
  const kinds = ["bench", "well", "board", "plant", "seedbed", "chest", "bed", "firepit", "table"], objects: object[] = [];
  for (let i = 0; objects.length < 500; i++) {
    const x = 3 + Math.floor(h(i, 1) * (N - 6)), y = 3 + Math.floor(h(i, 2) * (N - 6));
    if (g[y][x] !== ".") continue;
    const kind = kinds[i % kinds.length];
    objects.push({ id: `o${i}`, kind, name: kind, x, y, location_id: "paths", holder: null, state: kind === "plant" ? { stage: i % 5, crop: "carrot" } : kind === "firepit" ? { lit: i % 2 === 0 } : {}, portable: false, owner: null, hidden: false, known_by: [] });
  }
  const proto = (base.agents as Record<string, unknown>[])[0], agents = Array.from({ length: 20 }, (_, i) => ({ ...proto, id: i < 2 ? ["alex", "mira"][i] : `npc${i}`, name: `Figur ${i}`, x: 16 + (i % 8) * 32, y: 16, walk: null, action: null, status: "idle" }));
  return { ...base, look: null, links: [], seq: (base.seq as number) + 1, map: { width: N, height: N, rows: g.map((r) => r.join("")), legend: (base.map as { legend: object }).legend }, locations, objects, resources: [], agents };
}

/** Misst `ms` Millisekunden: Ausschnitt fährt (Dorf: Gerätepixel je Bild bei 2×, sonst Weltpixel je Bild), Ergebnis Bildrate und Rechenzeit (Median, 95 %). */
async function measure(page: Page, ms: number, pan: number) {
  return page.evaluate(async ([ms, pan]) => {
    const v = (window as unknown as { __welt: { cam?: { fx: number }; o?: { x: number }; perf: number[] } }).__welt;
    v.perf.length = 0;
    const t0 = performance.now(), gaps: number[] = [];
    let last = t0, dir = 1;
    const step = () => {
      if (v.cam) { v.cam.fx += pan * dir; if (Math.abs(pan) > 0 && (v.cam.fx > 3500 || v.cam.fx < 300)) dir = -dir; return; }
      if (!v.o || !pan) return;
      const x = v.o.x + pan * dir; v.o = { ...v.o, x: Math.max(0, x) }; if (x > 2000 || x < 0) dir = -dir;
    };
    await new Promise<void>((done) => { const f = (t: number) => { gaps.push(t - last); last = t; step(); if (t - t0 < ms) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 10) / 10; };
    return { fps: Math.round((gaps.length / (performance.now() - t0)) * 1000 * 10) / 10, bild_ms_median: q(gaps, 0.5), bild_ms_95: q(gaps, 0.95), rechen_ms_median: q(v.perf, 0.5), rechen_ms_95: q(v.perf, 0.95) };
  }, [ms, pan] as const);
}

test("Leistung: Startwelt und große Welt", async ({ page, request }) => {
  await freshWorld(request);
  await page.goto("/?messen");
  await openApp(page);
  await settled(page, '[data-house="0"]');
  const out: Record<string, unknown> = { fenster: "1440 × 900", browser: process.env.SIM_MESSEN === "gpu" ? "Chromium (headless, GPU/Metal)" : "Chromium (headless, Software)" };
  out.gpu = await page.evaluate(() => { const c = document.createElement("canvas").getContext("webgl"); const d = c?.getExtension("WEBGL_debug_renderer_info"); return d ? c!.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unbekannt"; });
  out.dorf_tiefe_1x = await measure(page, 4000, 0);
  const box = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -100);
  out.dorf_tiefe_2x_verschieben = await measure(page, 4000, 6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  out.dorf_tiefe_2x_ohne_tiltshift = await measure(page, 4000, 6);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.keyboard.press("0");
  await page.getByTestId("view-menu").getByRole("button", { name: "Flach", exact: true }).click();
  out.dorf_flach_1x = await measure(page, 4000, 0);
  await page.getByTestId("view-menu").getByRole("button", { name: "Tiefe", exact: true }).click();
  await settled(page, '[data-house="0"]');
  await page.mouse.click((await settled(page, '[data-house="0"]')).x, (await settled(page, '[data-house="0"]')).y);
  out.dorf_haus_innen = await measure(page, 3000, 0);
  await page.keyboard.press("Escape");
  const snap = await (await request.get("/api/state")).json();
  await page.evaluate((s) => { (window as unknown as { __sim: { getState(): { setSnapshot(x: unknown): void } } }).__sim.getState().setSnapshot(s); }, bigSnapshot(snap));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const v = (window as unknown as { __welt: { cam: object } }).__welt; v.cam = { fx: 900, fy: 700, zoom: 1, mode: "tiefe" }; });
  out.gross_tiefe_zoom1_kamerafahrt = await measure(page, 6000, 4);
  await page.keyboard.press("0");
  await page.waitForTimeout(1500);
  out.gross_tiefe_gesamt = await measure(page, 4000, 0);
  out.gross_tiefe_gesamt_kamerafahrt = await measure(page, 4000, 6);
  console.log(JSON.stringify(out, null, 1));
  writeFileSync("test-results/leistung.json", JSON.stringify(out, null, 1));
});
