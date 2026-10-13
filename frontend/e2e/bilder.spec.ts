import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { freshWorld, openApp, openHouse, post, settled, settledTag, setView, state } from "./helpers";

/** Bildschirmfotos für docs/status/AP13.md (nur mit SIM_BILDER=1). Wetter für die Vergleichsbilder klar gesetzt (nur in der Anzeige). */
test.skip(!process.env.SIM_BILDER, "nur mit SIM_BILDER=1");
test.use({ channel: "chromium", launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } });
test.setTimeout(300_000);
const OUT = "../docs/status/img";

async function until(req: APIRequestContext, minuteOfDay: number) {
  for (let i = 0; i < 40; i++) {
    const m = (await state(req)).clock.minute % 1440;
    if (m >= minuteOfDay) return;
    await post(req, "/api/sim/step", { n: Math.min(50, minuteOfDay - m) });
  }
}
const clear = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as { __sim: { getState(): { world: { weather: object } }; setState(x: object): void } }).__sim;
  const w = s.getState().world;
  s.setState({ world: { ...w, weather: { ...w.weather, kind: "clear" } } });
});
const shot = async (page: Page, name: string) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/ap13-${name}.png` }); };

test("Bilder AP13", async ({ page, request }) => {
  await freshWorld(request);
  await until(request, 10 * 60);
  await page.goto("/?messen");
  await openApp(page);
  await clear(page);
  await settled(page, '[data-house="0"]');
  await shot(page, "tag-tiefe");
  await setView(page, "Flach");
  await shot(page, "tag-flach");
  await setView(page, "Tiefe");
  await page.keyboard.press("0");
  await shot(page, "gesamt-tiefe");
  await page.reload(); await openApp(page); await clear(page);
  await openHouse(page);
  await shot(page, "haus-innen");
  await page.keyboard.press("Escape");
  await until(request, 19 * 60 + 50);
  await page.reload(); await openApp(page); await clear(page); await settled(page, '[data-house="0"]');
  await shot(page, "abend-tiefe");
  await until(request, 23 * 60 + 10);
  await page.reload(); await openApp(page); await clear(page); await settled(page, '[data-house="0"]');
  await shot(page, "nacht-tiefe");
  await page.reload(); await openApp(page);
  await page.getByTestId("player-toggle").check();
  await clear(page);
  const house = await settled(page, '[data-house="0"]');
  await page.mouse.click(house.x + 300, house.y + 140);
  await expect(page.getByTestId("path-preview")).toBeVisible();
  const tag = await settledTag(page, "alex").catch(() => null);
  if (tag) await page.mouse.move(tag.x, tag.y);
  await page.mouse.click(house.x + 40, house.y - 10);
  await expect(page.getByTestId("player-menu")).toBeVisible();
  await shot(page, "mitspieler-vorschau");
  await page.getByTestId("player-toggle").uncheck();
});
