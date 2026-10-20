import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, setView, state } from "./helpers";

/**
 * Welteditor (AP12c): „Welt gestalten“ öffnet die Werkzeugleiste (Infoleiste aus), die Vorschau zeigt das neue Dorf unter einem Schleier, ändert aber nichts;
 * Übernehmen sichert, legt das Dorf an und die Ansicht bleibt dort; „Neue Simulation“ ersetzt die Welt nach ausdrücklicher Bestätigung.
 */
test.beforeEach(async ({ request }) => { await freshWorld(request); });

type Welt = { kam: { x: number; y: number }; look: { regions: unknown[] } };
const regions = (req: Parameters<typeof state>[0]) => state(req).then((s) => (s.look.regions as unknown[]).length as number);
const camera = (page: Page) => page.evaluate(() => { const v = (window as unknown as { __welt: Welt }).__welt; return { x: v.kam.x, y: v.kam.y }; });

async function openEditor(page: Page) {
  await page.goto("/?messen");
  await openApp(page);
  await page.getByTestId("open-editor").click();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
  await expect(page.getByTestId("hud")).toHaveCount(0);                                              // im Editor kein HUD
}

async function preview(page: Page, seed: number) {
  await page.getByTestId("seed").fill(String(seed));
  await page.getByTestId("preview").click();
  await expect(page.getByTestId("preview-result")).toBeVisible();
}

test("Vorschau: das neue Dorf liegt unter einem Schleier, die Kamera fährt hin, die laufende Welt bleibt unverändert", async ({ page, request }) => {
  await openEditor(page);
  const before = await camera(page), seq = (await state(request)).seq;
  await preview(page, 5);
  await expect(page.getByTestId("report")).toContainText("bestanden");
  await expect(page.getByTestId("preview-result")).toContainText("Orte");
  await expect(page.getByTestId("ghost")).toBeVisible();                                              // Schleier mit Rahmen
  await expect.poll(async () => (await camera(page)).y, { timeout: 15_000 }).toBeGreaterThan(before.y + 150);   // die Kamera ist nach Süden gefahren
  expect(await regions(request)).toBe(1);                                                              // nichts angewendet
  expect((await state(request)).seq).toBe(seq);
  expect(await page.evaluate(() => (window as unknown as { __welt: Welt }).__welt.look.regions.length)).toBe(2);   // die Ansicht kennt das Dorf der Vorschau
  await page.screenshot({ path: "test-results/editor-vorschau.png" });
  await page.getByTestId("discard").click();                                                           // Vorschau verwerfen: wieder die laufende Welt
  await expect(page.getByTestId("ghost")).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __welt: Welt }).__welt.look.regions.length)).toBe(1);
});

test("Ändert sich der Wunsch, ist die Vorschau veraltet und lässt sich nicht übernehmen", async ({ page }) => {
  await openEditor(page);
  await preview(page, 5);
  await page.getByTestId("lake").selectOption("south");
  await expect(page.getByTestId("stale")).toBeVisible();
  await expect(page.getByTestId("apply")).toBeDisabled();
  await page.getByTestId("preview").click();
  await expect(page.getByTestId("stale")).toHaveCount(0);
  await expect(page.getByTestId("apply")).toBeEnabled();
});

test("Übernehmen: Bestätigung, Sicherung, das Dorf ist in der Welt, im Protokoll und nach dem Neuladen noch da", async ({ page, request }) => {
  await openEditor(page);
  await preview(page, 7);
  const village = (await page.getByTestId("preview-result").locator("h3").innerText()).split(" (")[0];
  await page.getByTestId("apply").click();
  await expect(page.getByTestId("confirm")).toContainText("Vor dem Erweitern");
  await page.getByTestId("apply-confirm").click();
  await expect(page.getByTestId("editor-done")).toContainText(village);
  await expect(page.getByTestId("editor-done")).toContainText("Vor dem Erweitern");
  expect(await regions(request)).toBe(2);
  await expect(page.getByTestId("ghost")).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __welt: Welt }).__welt.look.regions.length)).toBe(2);
  const saves = await (await request.get("/api/saves")).json();
  expect(saves.some((s: { name: string }) => s.name.startsWith("Vor dem Erweitern"))).toBeTruthy();
  const ev = await (await request.get("/api/events?type=world.generated")).json();
  expect(ev.items[0].data.village).toBe(village);
  await page.getByTestId("editor-close").click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("world-pixels")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __welt: Welt }).__welt.look.regions.length)).toBe(2);
});

test("Gebäudemix und Seeufer gehen in den Wunsch ein, Flach zeigt denselben Schleier", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("mix-default").uncheck();
  await expect(page.getByTestId("mix-house")).toHaveText("3");
  for (const r of ["shop", "workshop"]) await page.getByTestId(`mix-${r}`).locator("xpath=following-sibling::button").click();
  await page.getByRole("button", { name: "Wohnhäuser weniger" }).click();
  await expect(page.getByTestId("mix-house")).toHaveText("2");
  await page.getByTestId("lake").selectOption("south");
  await preview(page, 3);
  await expect(page.getByTestId("ghost")).toBeVisible();
  await setView(page, "Flach");
  await expect(page.getByTestId("ghost")).toBeVisible();
  await expect(page.getByTestId("apply")).toBeEnabled();
});

test("Ein ungültiger Gebäudemix lässt sich nicht erst abschicken", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("mix-default").uncheck();
  for (const r of ["house", "shop", "workshop", "barn", "stable"]) for (let i = 0; i < 6; i++) { const b = page.getByTestId(`mix-${r}`).locator("xpath=following-sibling::button"); if (await b.isEnabled()) await b.click(); }
  await expect(page.getByTestId("preview")).toBeEnabled();                                             // höchstens zehn Gebäude insgesamt: die Knöpfe sperren sich selbst
  const sum = await Promise.all(["house", "shop", "workshop", "barn", "stable"].map(async (r) => Number(await page.getByTestId(`mix-${r}`).innerText())));
  expect(sum.reduce((a, b) => a + b, 0)).toBe(10);
});
