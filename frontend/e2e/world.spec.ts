import { expect, test } from "@playwright/test";
import { clickFigure, freshWorld, moveAgent, openApp, openHouse, post, settled, settledTag, setView } from "./helpers";

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

test("Dorf wie Mockup A: Zoom nur in ganzen Stufen um den Zeiger, Schild bleibt unter der Figur, 0 zeigt wieder alles", async ({ page, request }) => {
  await moveAgent(request, "Bewege Alex in den Garten");
  await openApp(page);
  await expect(page.getByTestId("world-pixels")).toHaveAttribute("data-view", "dorf");
  const before = await settledTag(page, "alex");
  await page.mouse.move(before.x + before.width / 2, before.y - 22);
  await page.mouse.wheel(0, -100);                                                            // eine Raste = eine Stufe (2×)
  const after = await settledTag(page, "alex");
  expect(Math.abs(after.x + after.width / 2 - (before.x + before.width / 2))).toBeLessThan(12);  // die Figur unter dem Zeiger bleibt stehen
  const z = await page.evaluate(() => (window as unknown as { __welt: { Z: number } }).__welt.Z);
  expect(z).toBe(2);
  await page.keyboard.down("KeyD"); await page.waitForTimeout(120); await page.keyboard.up("KeyD");   // WASD verschiebt den Ausschnitt
  const moved = await settledTag(page, "alex");
  expect(moved.x).toBeLessThan(after.x - 20);
  await page.mouse.click(moved.x + moved.width / 2, moved.y - 60);                           // 2×: die Figur ist doppelt so groß
  await expect(page.getByTestId("drawer")).toContainText("Alex");
  await page.getByRole("button", { name: "Schließen" }).first().click();
  await page.keyboard.press("0");
  await expect.poll(async () => Math.round((await page.locator('[data-tag="alex"]').boundingBox())!.x)).toBe(Math.round(before.x));
});

test("Taste F folgt dem gewählten Agenten (auch ins Haus und im Dorf), Taste 0 zeigt die ganze Welt", async ({ page, request }) => {
  await openApp(page);
  await page.getByTestId("agent-card-mira").click();
  await page.getByRole("button", { name: "Schließen" }).first().click();
  await page.keyboard.press("f");
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");          // Mira ist im Haus: die Ansicht geht mit hinein
  await page.keyboard.press("f");
  await page.keyboard.press("0");
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "-1");
  await moveAgent(request, "Bewege Alex zum See");
  await page.getByTestId("agent-card-alex").click();
  await page.getByRole("button", { name: "Schließen" }).first().click();
  const v = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(v.x + 40, v.y + v.height - 40);
  await page.mouse.wheel(0, -100);
  const a = page.locator('[data-tag="alex"]');
  await expect(a).toBeHidden();                                                               // gezoomt in die linke untere Ecke: Alex am See ist nicht im Bild
  await page.keyboard.press("f");                                                             // der Ausschnitt folgt Alex (am Rand so weit es geht)
  await expect(a).toBeVisible();
  const b = (await a.boundingBox())!;
  expect(b.x).toBeGreaterThan(v.x); expect(b.x + b.width).toBeLessThan(v.x + v.width); expect(b.y).toBeLessThan(v.y + v.height);
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

test("Puppenhaus: Klick auf einen Raum zeigt ihn groß, Esc führt Schritt für Schritt zurück ins Haus und ins Dorf", async ({ page }) => {
  await openApp(page);
  await openHouse(page);
  const overlays = page.getByTestId("overlays"), labels = page.locator("[data-room]");
  await expect(labels).not.toHaveCount(1);                                                     // ganzes Haus: alle Räume beschriftet
  const l = await settled(page, '[data-room="house.kitchen"]');
  await page.mouse.click(l.x + l.width / 2, l.y - 25);                                                      // auf den Küchenboden über dem Schild
  await expect(labels).toHaveCount(1);
  await expect(page.locator('[data-room="house.kitchen"]')).toBeVisible();
  await expect(page.getByTestId("leave-house")).toContainText("ganzes Haus");
  await page.keyboard.press("Escape");
  await expect(labels).not.toHaveCount(1);
  await expect(overlays).toHaveAttribute("data-interior", "0");
  await page.keyboard.press("Escape");
  await expect(overlays).toHaveAttribute("data-interior", "-1");
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
