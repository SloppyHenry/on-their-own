import { expect, test } from "@playwright/test";
import { freshWorld, openApp } from "./helpers";

/** Die Welt füllt den Bildschirm (AP18b): Bedienteile schweben klein in den Ecken; im Editor und im Titelbild gibt es kein HUD. */
type Ui = { getState(): { appMode: string; setAppMode(m: string): void } };
test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Die Welt füllt das ganze Fenster, das HUD sitzt in den vier Ecken und die Hinweisschrift ist weg", async ({ page }) => {
  await openApp(page);
  const vp = page.viewportSize()!, canvas = (await page.getByTestId("world-canvas").boundingBox())!;
  expect(canvas.width).toBeGreaterThan(vp.width - 2);
  expect(canvas.height).toBeGreaterThan(vp.height - 2);
  const box = async (t: string) => (await page.getByTestId(t).boundingBox())!;
  const ol = await box("hud-oben-links"), or = await box("hud-oben-rechts"), bw = await box("bewohner"), ei = await box("einblicke"), wz = await box("werkzeuge");
  expect(ol.x).toBeLessThan(40); expect(ol.y).toBeLessThan(40);
  expect(or.x + or.width).toBeGreaterThan(vp.width - 40); expect(or.y).toBeLessThan(40);
  expect(bw.x).toBeLessThan(40); expect(bw.y + bw.height).toBeGreaterThan(vp.height - 40);
  expect(ei.x + ei.width).toBeGreaterThan(vp.width - 40); expect(ei.y + ei.height).toBeGreaterThan(vp.height - 40);
  expect(Math.abs(wz.x + wz.width / 2 - vp.width / 2)).toBeLessThan(4);                      // Werkzeuge unten in der Mitte
  await expect(page.getByTestId("sidebar")).toHaveCount(0);                                   // keine Infoleiste, keine Kopfzeile, keine Ereigniszeile
  await expect(page.getByText("Klick aufs Haus: hineinschauen")).toHaveCount(0);              // keine Hinweisschrift über der Welt
});

test("Ohne Kopfzeile: Uhr, Zeitsteuerung, Modellpunkt, Ton, Hilfe und Menü sind im HUD erreichbar", async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId("clock")).toContainText("Tag 1");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByTestId("status-chip")).toBeVisible();
  await expect(page.getByTestId("ton-toggle")).toBeVisible();
  await page.getByTestId("open-help").click();
  await expect(page.getByTestId("hilfe")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("hilfe")).toHaveCount(0);
  await page.getByTestId("open-menu").click();
  await expect(page.getByTestId("start-menu")).toBeVisible();
});

test("Im Editor-Modus und im Titelbild gibt es kein HUD; zurück im Spiel kommt es wieder", async ({ page }) => {
  await page.goto("/?messen");
  await openApp(page);
  await expect(page.getByTestId("hud")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("editor"); });
  await expect(page.getByTestId("hud")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("menu"); });
  await expect(page.getByTestId("hud")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __ui: Ui }).__ui.getState().setAppMode("game"); });
  await expect(page.getByTestId("hud")).toBeVisible();
});

test("Einblicke und Tagebuch sind mit einem Klick da und nicht dauerhaft offen", async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId("tagebuch")).toHaveCount(0);
  await page.getByTestId("einblick-tagebuch").click();
  await expect(page.getByTestId("tagebuch")).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.getByTestId("tagebuch")).toHaveCount(0);
  await page.getByTestId("einblick-stats").click();
  await expect(page.getByTestId("einblick-seite")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("einblick-seite")).toHaveCount(0);
});

test.describe("schmales Fenster", () => {
  test.use({ viewport: { width: 1100, height: 700 } });

  test("1100 × 700: Bewohnerleiste, Werkzeuge und Einblicke überdecken sich nicht, die Einblicke zeigen nur Symbole", async ({ page }) => {
    await openApp(page);
    const b = async (t: string) => (await page.getByTestId(t).boundingBox())!;
    const bw = await b("bewohner"), wz = await b("werkzeuge"), ei = await b("einblicke");
    const overlap = (a: typeof bw, c: typeof bw) => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
    expect(overlap(bw, wz)).toBe(false);
    expect(overlap(wz, ei)).toBe(false);
    expect(overlap(bw, ei)).toBe(false);
    await expect(page.getByTestId("werkzeug-ereignis").locator("kbd")).toBeHidden();         // unter etwa 1320 px keine Tastenhinweise
  });
});
