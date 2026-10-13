import { expect, test } from "@playwright/test";
import { clickFigure, freshWorld, openApp, openHouse, post, settled, settledTag, setView } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

for (const view of ["Tiefe", "Flach"] as const) {
  test(`${view}: Klick aufs Haus zeigt es innen, Klick auf die Figur öffnet das Agentendetail`, async ({ page }) => {
    await openApp(page);
    await setView(page, view);
    await openHouse(page);
    await clickFigure(page, "alex");
    await expect(page.getByTestId("drawer")).toContainText("Alex");
    await expect(page.getByTestId("drawer")).toContainText("Bedürfnisse");
  });

  test(`${view}: Klick auf einen Raum im Haus zeigt den Ort mit Objekten`, async ({ page }) => {
    await openApp(page);
    await setView(page, view);
    await openHouse(page);
    const label = await settled(page, '[data-room="house.bedroom_a"]');
    await page.mouse.click(label.x + label.width / 2, label.y - 6);
    const drawer = page.getByTestId("drawer");
    await expect(drawer).toContainText("Objekte");
    await expect(drawer).toContainText("Zimmer Alex");
    await expect(drawer).toContainText("Bett (Alex)");
  });
}

test("Namensschild sitzt unter der Figur und folgt ihr beim Zoomen", async ({ page }) => {
  await openApp(page);
  await openHouse(page);
  const before = await settledTag(page, "alex");
  const view = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y - 22);
  await page.mouse.wheel(0, -400);
  const after = await settledTag(page, "alex");
  expect(Math.abs(after.x + after.width / 2 - (before.x + before.width / 2))).toBeLessThan(12);  // Zoom um den Zeiger: die Figur bleibt stehen
  await clickFigure(page, "alex");
  await expect(page.getByTestId("drawer")).toContainText("Alex");
  expect(after.y).toBeLessThan(view.y + view.height);
});

test("Taste F folgt dem gewählten Agenten (auch ins Haus), Taste 0 zeigt die ganze Welt", async ({ page, request }) => {
  await openApp(page);
  await page.getByTestId("agent-card-mira").click();
  await page.getByRole("button", { name: "Schließen" }).first().click();
  const before = await settledTag(page, "mira");
  await page.keyboard.press("0");
  await expect.poll(async () => Math.round((await page.locator('[data-tag="mira"]').boundingBox())!.y)).not.toBe(Math.round(before.y));
  await page.keyboard.press("f");
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
  await post(request, "/api/sim/step", { n: 8 });
  const m = page.locator('[data-tag="mira"]');
  const v = (await page.getByTestId("world-canvas").boundingBox())!;
  await expect.poll(async () => { const b = (await m.boundingBox())!; return Math.abs(b.x + b.width / 2 - (v.x + v.width / 2)); }, { timeout: 8000 }).toBeLessThan(40);
});

test("Haus zeigt, wer drin ist; leer ohne Anzeige; Esc führt aus der Innenansicht zurück", async ({ page, request }) => {
  test.setTimeout(120_000);
  await openApp(page);
  const overlays = page.getByTestId("overlays");
  await expect(overlays).toHaveAttribute("data-houses", "besetzt");
  await expect(page.locator('[data-tag="alex"]')).toHaveAttribute("data-inside", "1");
  await openHouse(page);
  await expect(page.locator('[data-tag="alex"]')).toHaveAttribute("data-inside", "");
  await page.keyboard.press("Escape");
  await expect(overlays).toHaveAttribute("data-interior", "-1");
  await post(request, "/api/sim/speed", { level: "max" });
  await page.getByRole("button", { name: "Start" }).click();
  await expect(overlays).toHaveAttribute("data-houses", "leer", { timeout: 90_000 });
  await post(request, "/api/sim/pause");
});

test("Ansicht umschalten: Tiefe und Flach, die Wahl bleibt nach dem Neuladen", async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId("view-menu").getByRole("button", { name: "Tiefe", exact: true })).toHaveAttribute("aria-pressed", "true");
  const tag = await settledTag(page, "alex");
  await setView(page, "Flach");
  await expect.poll(async () => JSON.stringify(await page.locator('[data-tag="alex"]').boundingBox())).not.toBe(JSON.stringify(tag));
  await page.reload();
  await expect(page.getByTestId("view-menu").getByRole("button", { name: "Flach", exact: true })).toHaveAttribute("aria-pressed", "true");
  await setView(page, "Tiefe");
});
