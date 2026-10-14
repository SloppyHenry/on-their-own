import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp } from "./helpers";

/** Die Kamera fährt durch die Welt (AP12a): 1× ist Standard, herauszoomen bis ¼×, WASD und Ziehen fahren auch bei 1×. */
type Welt = { kam: { x: number; y: number; level: number; zo: number; zoom: number }; interior: number };
const kam = (page: Page) => page.evaluate(() => { const k = (window as unknown as { __welt: Welt }).__welt.kam; return { x: k.x, y: k.y, level: k.level }; });

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Zoom: 1× ist Standard, das Rad geht in ganzen Stufen von ¼× bis 3×, ein Wisch ist eine Stufe, 0 zeigt wieder Bild A", async ({ page }) => {
  await openApp(page);
  expect(await kam(page)).toEqual({ x: 192, y: 288, level: 1 });
  const box = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (const want of [0.5, 0.25]) {                                     // Rad nach unten: heraus
    await page.mouse.wheel(0, 100); await page.waitForTimeout(450);
    expect((await kam(page)).level).toBe(want);
  }
  await page.mouse.wheel(0, 100); await page.waitForTimeout(450);
  expect((await kam(page)).level).toBe(0.25);                           // am Ende der Stufen
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -8); await page.waitForTimeout(20); }   // ein Trackpad-Wisch nach oben mit Nachlauf = eine Stufe
  await page.waitForTimeout(500);
  expect((await kam(page)).level).toBe(0.5);
  await page.keyboard.press("BracketRight");                            // + auf der deutschen Tastatur
  await page.keyboard.press("+");
  expect((await kam(page)).level).toBe(2);
  await page.keyboard.press("Slash");
  await page.keyboard.press("-");
  expect((await kam(page)).level).toBe(0.5);
  await page.keyboard.press("0");
  expect(await kam(page)).toEqual({ x: 192, y: 288, level: 1 });
});

test("Fahren: WASD verschiebt die Welt auch bei 1×, Ziehen hält den Boden unter dem Zeiger, 0 kehrt zurück", async ({ page }) => {
  await openApp(page);
  await page.keyboard.down("KeyD"); await page.waitForTimeout(400); await page.keyboard.up("KeyD");
  const a = await kam(page);
  expect(a.x).toBeGreaterThan(192 + 20);
  const box = (await page.getByTestId("world-canvas").boundingBox())!;
  const x0 = box.x + box.width * 0.5, y0 = box.y + box.height * 0.7;
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x0 - 120, y0, { steps: 6 }); await page.mouse.up();   // nach links ziehen: die Kamera fährt nach rechts
  expect((await kam(page)).x).toBeGreaterThan(a.x + 20);
  await page.keyboard.press("0");
  expect(await kam(page)).toEqual({ x: 192, y: 288, level: 1 });
});

test("Im Haus lässt sich nicht zoomen; nach dem Verlassen ist die Kamera wie vorher", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("BracketRight");                            // 2×
  const before = await kam(page);
  expect(before.level).toBe(2);
  await page.keyboard.press("0");
  const house = page.locator('[data-house="0"]').first();
  await expect(house).toBeAttached();
  const hb = (await house.boundingBox())!;
  await page.mouse.click(hb.x, hb.y);
  await expect(page.getByTestId("leave-house")).toBeVisible();
  await page.keyboard.press("BracketRight");
  expect((await kam(page)).level).toBe(1);                              // drinnen unverändert
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("leave-house")).toBeHidden();
  expect(await kam(page)).toEqual({ x: 192, y: 288, level: 1 });
});
