import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, viewMenu } from "./helpers";

/** Bilder des Welteditors für docs/status/AP12c.md (nur mit SIM_BILDER=1): ganze Oberfläche, Vorschau unter dem Schleier. */
test.skip(!process.env.SIM_BILDER, "nur mit SIM_BILDER=1");
test.use({ viewport: { width: 1660, height: 930 } });
test.setTimeout(120_000);
const OUT = "../docs/status/img";

type Welt = { kam: { x: number; y: number }; zoomLevel(l: number): void };
test.beforeEach(async ({ request }) => { await freshWorld(request); });

async function openEditor(page: Page) {
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await page.goto("/?messen");
  await openApp(page);
  await page.getByTestId("open-editor").click();
}
/** Wartet, bis die Kamera ruht (zwei gleiche Stände hintereinander). */
async function still(page: Page) {
  let last = "";
  await expect.poll(async () => { const c = await page.evaluate(() => { const v = (window as unknown as { __welt: Welt }).__welt; return `${v.kam.x.toFixed(2)},${v.kam.y.toFixed(2)}`; }); const same = c === last; last = c; return same; }, { intervals: [400], timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
}
async function preview(page: Page, seed: number) {
  await page.getByTestId("seed").fill(String(seed));
  await page.getByTestId("preview").click();
  await expect(page.getByTestId("preview-result")).toBeVisible();
  await still(page);
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/ap12c-${name}.png` });

test("Leitstelle: Werkzeugleiste, Vorschau, Übernehmen", async ({ page }) => {
  await openEditor(page);
  await shot(page, "leer");
  await preview(page, 5);
  await shot(page, "vorschau-5");
  await page.getByTestId("report").locator("summary").click();
  await shot(page, "pruefbericht");
  await page.getByTestId("apply").click();
  await shot(page, "bestaetigung");
  await page.getByTestId("apply-confirm").click();
  await expect(page.getByTestId("editor-done")).toBeVisible();
  await still(page);
  await shot(page, "uebernommen");
});

test("Andere Seeds, Übersicht und flache Ansicht", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("lake").selectOption("south");
  await preview(page, 12);
  await shot(page, "vorschau-12-sueden");
  await (await viewMenu(page)).getByRole("button", { name: "Flach", exact: true }).click();
  await page.waitForTimeout(1200);
  await shot(page, "vorschau-12-flach");
  await (await viewMenu(page)).getByRole("button", { name: "Tiefe", exact: true }).click();
  await page.evaluate(() => (window as unknown as { __welt: Welt }).__welt.zoomLevel(0.25));
  await page.waitForTimeout(1500);
  await shot(page, "vorschau-12-uebersicht");
});

test("Neue Simulation", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("tab-new").click();
  await preview(page, 31);
  await shot(page, "neue-simulation-31");
  await page.getByTestId("apply").click();
  await shot(page, "neue-simulation-bestaetigung");
});
