import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, settledTag } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Klick auf die Figur im Canvas öffnet das Agentendetail", async ({ page }) => {
  await openApp(page);
  const tag = await settledTag(page, "alex");
  await page.mouse.click(tag.x + tag.width / 2, tag.y - 28);
  await expect(page.getByTestId("drawer")).toContainText("Alex");
  await expect(page.getByTestId("drawer")).toContainText("Bedürfnisse");
});

test("Klick auf einen Raum im Canvas zeigt den Ort mit Objekten", async ({ page }) => {
  await openApp(page);
  const tag = await settledTag(page, "alex");
  await page.mouse.click(tag.x + tag.width / 2 + 90, tag.y + 20);
  const drawer = page.getByTestId("drawer");
  await expect(drawer).toContainText("Objekte");
  await expect(drawer).toContainText("Zimmer Alex");
  await expect(drawer).toContainText("Bett (Alex)");
});

test("Taste F folgt dem gewählten Agenten, Taste 0 zeigt die ganze Welt", async ({ page, request }) => {
  await openApp(page);
  await page.getByTestId("agent-card-mira").click();
  await page.getByRole("button", { name: "Schließen" }).first().click();
  const before = await settledTag(page, "mira");
  await page.keyboard.press("0");
  await expect.poll(async () => Math.round((await page.locator('[data-tag="mira"]').boundingBox())!.x)).not.toBe(Math.round(before.x));
  await page.keyboard.press("f");
  await post(request, "/api/sim/step", { n: 8 });
  const m = page.locator('[data-tag="mira"]');
  const view = page.getByTestId("world-canvas");
  const v = (await view.boundingBox())!;
  await expect.poll(async () => { const b = (await m.boundingBox())!; return Math.abs(b.x + b.width / 2 - (v.x + v.width / 2)); }, { timeout: 8000 }).toBeLessThan(40);
});

test("Dach ist offen, solange jemand im Haus ist, und schließt sich, wenn alle draußen sind", async ({ page, request }) => {
  test.setTimeout(120_000);
  await openApp(page);
  const roofs = page.getByTestId("overlays");
  await expect(roofs).toHaveAttribute("data-roofs", "open");
  await post(request, "/api/sim/speed", { level: "max" });
  await page.getByRole("button", { name: "Start" }).click();
  await expect(roofs).toHaveAttribute("data-roofs", "closed", { timeout: 90_000 });
  await post(request, "/api/sim/pause");
});
