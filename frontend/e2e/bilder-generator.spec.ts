import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { freshWorld } from "./helpers";
import erweitert from "./fixtures/generiert/erweitert.json" with { type: "json" };
import s7 from "./fixtures/generiert/seed-7.json" with { type: "json" };
import s12 from "./fixtures/generiert/seed-12.json" with { type: "json" };
import s31 from "./fixtures/generiert/seed-31.json" with { type: "json" };
import s58 from "./fixtures/generiert/seed-58.json" with { type: "json" };

/** Bilder erzeugter Dörfer für docs/status/AP12b.md (nur mit SIM_BILDER=1): die Gestaltung kommt vom Generator, der Rest der Welt ist die Testwelt. */
test.skip(!process.env.SIM_BILDER, "nur mit SIM_BILDER=1");
test.use({ viewport: { width: 1660, height: 800 } });
test.setTimeout(120_000);
const OUT = "../docs/status/img";

type Sim = { getState(): { world: { weather: object; clock: object } }; setState(x: object): void };
async function show(page: Page, look: unknown, minute: number, level: number, at?: [number, number]) {
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await page.goto("/?messen");
  await page.waitForSelector('[data-testid="world-pixels"]');
  await page.evaluate(({ look, m }) => {
    const s = (window as unknown as { __sim: Sim }).__sim, w = s.getState().world;
    s.setState({ world: { ...w, look, weather: { ...w.weather, kind: "clear" }, clock: { ...w.clock, minute: m } } });
  }, { look, m: minute });
  await page.waitForTimeout(1500);
  await page.evaluate(({ level, at }) => {
    const v = (window as unknown as { __welt: { kam: { reset(): void; focusAt(x: number, y: number): void }; zoomLevel(l: number): void } }).__welt;
    v.kam.reset();
    if (level !== 1) v.zoomLevel(level);
    if (at) v.kam.focusAt(at[0], at[1]);
  }, { level, at });
  await page.waitForTimeout(1200);
}
/** Nur die Pixel der Zeichenfläche (ohne Menüs und Schilder). */
const shot = async (page: Page, name: string) => {
  const url = await page.getByTestId("world-pixels").evaluate((c: HTMLCanvasElement) => c.toDataURL("image/png"));
  writeFileSync(`${OUT}/ap12b-${name}.png`, Buffer.from(url.split(",")[1], "base64"));
};

test.beforeEach(async ({ request }) => { await freshWorld(request); });

for (const [n, f, m] of [[7, s7, 12 * 60], [12, s12, 19 * 60 + 40], [31, s31, 12 * 60], [58, s58, 23 * 60]] as const) {
  test(`Neue Startwelt Seed ${n}`, async ({ page }) => {
    await show(page, f.look, m, 1);
    await shot(page, `seed-${n}`);
  });
}

test("Erweiterte Welt: Übersicht und zweites Dorf", async ({ page }) => {
  const r2 = (erweitert.look as unknown as { regions: { frame: [number, number] }[] }).regions[1];
  await show(page, erweitert.look, 12 * 60, 0.25, [r2.frame[0] / 2, r2.frame[1] + 120]);
  await shot(page, "erweitert-uebersicht");
  await show(page, erweitert.look, 12 * 60, 1, [r2.frame[0] + 90, r2.frame[1] + 110]);
  await shot(page, "erweitert-dorf2");
});
