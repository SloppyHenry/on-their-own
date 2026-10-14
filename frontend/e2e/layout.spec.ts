import { expect, test } from "@playwright/test";
import { freshWorld, openApp } from "./helpers";

/** Die Infoleiste rechts (Bewohner, Protokoll, Details) lässt sich ein- und ausklappen; im Editor und im Startmenü ist sie aus. */
type Ui = { getState(): { appMode: string; setAppMode(m: string): void; sidebarCollapsed: boolean } };
test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Infoleiste ein- und ausklappen, die Weltfläche wird breiter, der Zustand bleibt nach dem Neuladen", async ({ page }) => {
  await openApp(page);
  const side = page.getByTestId("sidebar"), canvas = page.getByTestId("world-canvas"), btn = page.getByTestId("toggle-sidebar");
  await expect(side).toBeVisible();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  const narrow = (await canvas.boundingBox())!.width;
  await btn.click();
  await expect(side).toBeHidden();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(narrow + 300);
  await page.reload();
  await expect(page.getByTestId("world-pixels")).toBeVisible();
  await expect(page.getByTestId("sidebar")).toBeHidden();                 // bleibt zu
  await page.getByTestId("toggle-sidebar").click();
  await expect(page.getByTestId("sidebar")).toBeVisible();
});

test("Im Editor-Modus und im Startmenü ist die Infoleiste aus, auch ohne Knopf; zurück im Spiel kommt sie wieder", async ({ page }) => {
  await page.goto("/?messen");
  await openApp(page);
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("editor"); });
  await expect(page.getByTestId("sidebar")).toBeHidden();
  await expect(page.getByTestId("toggle-sidebar")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("menu"); });
  await expect(page.getByTestId("sidebar")).toBeHidden();
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("game"); });
  await expect(page.getByTestId("sidebar")).toBeVisible();
});
