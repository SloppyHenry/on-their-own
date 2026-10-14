import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/look-zwei-doerfer.json" with { type: "json" };
import { freshWorld } from "./helpers";

/**
 * Beide Ansichten bleiben immer wählbar: dieselbe Welt mit zwei Dörfern in der Ansicht „Flach“ (Draufsicht, Mockup B). Welt mit zwei Dörfern (AP12a): die Startwelt und ein aus einem Seed erzeugtes zweites Dorf (Fixture aus dem Mockup-Generator, Look Version 2),
 * durch eine Landstraße verbunden. Prüft Gebiete, Boden in Blöcken, neue Bausteine, Kamerafahrt und Herauszoomen und hält sie als Goldbilder fest.
 * Neu erzeugen: `npx playwright test flach --update-snapshots`.
 */
test.use({ viewport: { width: 1660, height: 930 } });

type Sim = { getState(): { world: { weather: object; clock: object; look: unknown } }; setState(x: object): void };
type Welt = { kam: { x: number; y: number; zo: number; zoom: number; focusAt(x: number, y: number): void; level: number }; interior: number };

async function prepare(page: Page, minute: number) {
  await page.addInitScript(() => { try { localStorage.setItem("simulacra.ansicht", JSON.stringify("flach")); } catch { /* ohne Speicher bleibt der Standard */ } });
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await page.goto("/?messen");
  await expect(page.getByTestId("world-pixels")).toBeVisible();
  await page.evaluate(async ({ f, m }) => {
    const path = "/src/world/dorf/look.ts";                                       // im Browser (Vite-Dev) geladen
    const { normalizeLook } = (await import(/* @vite-ignore */ path)) as { normalizeLook(x: object): Record<string, unknown> & { legacy: object | null; regions: unknown[] } };
    const l = normalizeLook(f.start as object);
    const look = { ...l, legacy: l.legacy && { ...l.legacy, plainOutside: false }, regions: [...l.regions, f.dorf2], roads: f.roads };
    const s = (window as unknown as { __sim: Sim }).__sim, w = s.getState().world;
    s.setState({ world: { ...w, look, weather: { ...w.weather, kind: "clear" }, clock: { ...w.clock, minute: m } } });
  }, { f: fixture, m: minute });
  await page.waitForTimeout(1500);
}
const welt = (page: Page) => page.evaluate(() => { const v = (window as unknown as { __welt: Welt }).__welt; return { x: v.kam.x, y: v.kam.y, zo: v.kam.zo, zoom: v.kam.zoom }; });
const raw = async (page: Page) => Buffer.from((await page.getByTestId("world-pixels").evaluate((c: HTMLCanvasElement) => c.toDataURL("image/png"))).split(",")[1], "base64");
/** Wartet, bis zwei Bilder hintereinander gleich sind (Boden und Kamera ruhen), und liefert das zweite: so hängt der Test nicht an festen Wartezeiten. */
const grab = async (page: Page) => {
  let prev = await raw(page);
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(250); const cur = await raw(page); if (cur.equals(prev)) return cur; prev = cur; }
  return prev;
};
/** Kamera auf den Boden (Texel) in Bildmitte setzen und ruhen lassen. */
async function lookAt(page: Page, tx: number, ty: number, level?: number) {
  await page.evaluate(({ tx, ty, level }) => {
    const v = (window as unknown as { __welt: Welt & { zoomLevel(l: number): void } }).__welt;
    if (level) v.zoomLevel(level);
    v.kam.focusAt(tx, ty);
  }, { tx, ty, level });
  await page.waitForTimeout(900);
}
const OPT = { maxDiffPixels: 0, threshold: 0 };

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Flach: Startdorf, zweites Dorf, Landstraße, ½× und ¼×; der Umschalter wechselt zwischen Tiefe und Flach", async ({ page }) => {
  await prepare(page, 12 * 60);
  await expect(page.getByTestId("view-menu").getByRole("button", { name: "Flach", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await welt(page)).toMatchObject({ x: 192, y: 288, zo: 1, zoom: 1 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  expect(await grab(page)).toMatchSnapshot("flach-start.png", OPT);
  await lookAt(page, 600 + 160, 150);
  expect(await grab(page)).toMatchSnapshot("flach-dorf2.png", OPT);
  await lookAt(page, 420, 330);
  expect(await grab(page)).toMatchSnapshot("flach-strasse.png", OPT);
  await lookAt(page, 400, 200, 0.5);
  expect(await grab(page)).toMatchSnapshot("flach-halb.png", OPT);
  await lookAt(page, 400, 200, 0.25);
  expect(await grab(page)).toMatchSnapshot("flach-viertel.png", OPT);
  await page.keyboard.press("0");
  await page.getByTestId("view-menu").getByRole("button", { name: "Tiefe", exact: true }).click();     // jederzeit zurück auf 3D, die Kamera bleibt
  expect(await welt(page)).toMatchObject({ x: 192, y: 288 });
  expect(await grab(page)).toMatchSnapshot("tiefe-start.png", OPT);
  expect(errors).toEqual([]);
});
