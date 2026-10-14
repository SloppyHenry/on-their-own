import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openHouse } from "./helpers";

/**
 * Goldbilder der Startwelt (AP12a): Die Startwelt muss Pixel für Pixel so aussehen wie das abgenommene Dorf (AP14), egal wie der
 * Renderer umgebaut wird. Zeit eingefroren (`__freezeT`), Figuren wie in der Testwelt (im Haus), klares Wetter, feste Uhrzeit.
 * Bilder neu erzeugen (nur mit Absicht, z. B. bei neuem Look): `npx playwright test golden --update-snapshots`.
 */
test.use({ viewport: { width: 1660, height: 930 } });

type Sim = { getState(): { world: { weather: object; clock: object; agents: object } }; setState(x: object): void };
async function prepare(page: Page, minute: number) {
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await page.goto("/?messen");
  await expect(page.getByTestId("world-pixels")).toBeVisible();
  await page.evaluate((m) => {
    const s = (window as unknown as { __sim: Sim }).__sim, w = s.getState().world;
    s.setState({ world: { ...w, weather: { ...w.weather, kind: "clear" }, clock: { ...w.clock, minute: m } } });
  }, minute);
  await page.waitForTimeout(1500);
}
/** Nur die Pixel der Zeichenfläche (ohne DOM-Schilder und Menüs, damit Textänderungen die Goldbilder nicht brechen). */
const raw = async (page: Page) => Buffer.from((await page.getByTestId("world-pixels").evaluate((c: HTMLCanvasElement) => c.toDataURL("image/png"))).split(",")[1], "base64");
/** Wartet, bis zwei Bilder hintereinander gleich sind (Boden und Kamera ruhen), und liefert das zweite: so hängt der Test nicht an festen Wartezeiten. */
const grab = async (page: Page) => {
  let prev = await raw(page);
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(250); const cur = await raw(page); if (cur.equals(prev)) return cur; prev = cur; }
  return prev;
};
const OPT = { maxDiffPixels: 0, threshold: 0 };

test.beforeEach(async ({ request }) => { await freshWorld(request); });

for (const [name, minute] of [["mittag", 12 * 60], ["abend", 19 * 60 + 50], ["nacht", 23 * 60 + 10]] as const) {
  test(`Startwelt ${name}: Dorf wie das abgenommene Bild`, async ({ page }) => {
    await prepare(page, minute);
    expect(await grab(page)).toMatchSnapshot(`dorf-${name}.png`, OPT);
  });
}

test("Startwelt Mittag: Haus von innen und Zoom 2×", async ({ page }) => {
  await prepare(page, 12 * 60);
  const box = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(600);
  expect(await grab(page)).toMatchSnapshot("dorf-mittag-zoom2.png", OPT);
  await page.keyboard.press("0");
  await page.waitForTimeout(400);
  await openHouse(page);
  await page.waitForTimeout(1200);
  expect(await grab(page)).toMatchSnapshot("haus-mittag.png", OPT);
});
