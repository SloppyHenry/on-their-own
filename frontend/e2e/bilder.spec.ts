import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { freshWorld, moveAgent, openApp, openHouse, post, settled, settledTag, setView, state } from "./helpers";

/** Bildschirmfotos für docs/status/AP14.md (nur mit SIM_BILDER=1). Wetter für die Vergleichsbilder klar gesetzt (nur in der Anzeige). */
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
const shot = async (page: Page, name: string) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/ap14-${name}.png` }); };
const world = async (page: Page, name: string) => { await page.waitForTimeout(1200); await page.getByTestId("world-pixels").screenshot({ path: `${OUT}/ap14-${name}.png` }); };

test("Bilder AP14", async ({ page, request }) => {
  await freshWorld(request);
  await moveAgent(request, "Bewege Alex in den Garten");                 // Ausgangslage wie in Bild A: beide draußen
  await moveAgent(request, "Bewege Mira zum zentralen Platz");
  await until(request, 10 * 60);
  await page.setViewportSize({ width: 1660, height: 930 });             // Weltfläche 1280 × 800 wie Bild A
  await page.goto("/?messen");
  await openApp(page);
  await clear(page);
  await settled(page, '[data-house="0"]');
  await world(page, "dorf-mittag");
  await setView(page, "Flach");
  await world(page, "dorf-flach");
  await setView(page, "Tiefe");
  const box = (await page.getByTestId("world-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.wheel(0, -100);
  await world(page, "dorf-zoom2");
  await page.keyboard.press("0");
  await openHouse(page);
  await world(page, "haus-innen");
  const l = await settled(page, '[data-room="house.living"]');
  await page.mouse.click(l.x + l.width / 2, l.y - 25);                    // Raum groß
  await world(page, "haus-raum");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, "app-mittag");
  await until(request, 19 * 60 + 50);
  await page.setViewportSize({ width: 1660, height: 930 });
  await page.reload(); await openApp(page); await clear(page); await settled(page, '[data-house="0"]');
  await world(page, "dorf-abend");
  await openHouse(page);
  await world(page, "haus-abend");
  await page.keyboard.press("Escape");
  await until(request, 23 * 60 + 10);
  await page.reload(); await openApp(page); await clear(page); await settled(page, '[data-house="0"]');
  await world(page, "dorf-nacht");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload(); await openApp(page);
  await page.getByTestId("player-toggle").check();
  await clear(page);
  const house = await settled(page, '[data-house="0"]');
  await page.mouse.click(house.x + 420, house.y + 330);                  // freie Wiese vor dem See
  await expect(page.getByTestId("path-preview")).toBeVisible();
  const tag = await settledTag(page, "alex").catch(() => null);
  if (tag) await page.mouse.move(tag.x, tag.y);
  await page.mouse.click(house.x, house.y);
  await expect(page.getByTestId("player-menu")).toBeVisible();
  await shot(page, "mitspieler-vorschau");
  await page.getByTestId("player-toggle").uncheck();
});

/** Bis die Handlung angenommen wird (Figur muss erst ankommen oder frei sein): je Versuch ein paar Minuten weiter; mit `at` vorher hinsetzen. */
async function act(req: APIRequestContext, agent: string, action: string, params: Record<string, unknown>, at?: [number, number]) {
  await expect.poll(async () => {
    if (at) await post(req, "/api/e2e/place", { agent, x: at[0], y: at[1] });
    const r = await post(req, "/api/e2e/propose", { agent, action, params });
    if (!r.ok && /bereits/.test(r.rejected?.text ?? "")) return true;           // schon erledigt (die Agenten handeln selbst)
    if (!r.ok) await post(req, "/api/sim/step", { n: 3 });
    return r.ok;
  }, { timeout: 60_000 }).toBe(true);
}

test("Bilder AP15: Dinge im Dorf", async ({ page, request }) => {
  await freshWorld(request);
  await moveAgent(request, "Bewege Alex zum See");
  await act(request, "alex", "use", { object_id: "boat", mode: "row", minutes: 60 });
  await page.setViewportSize({ width: 1660, height: 930 });
  await page.goto("/?messen");
  await openApp(page);
  await clear(page);
  await settled(page, '[data-house="0"]');
  await page.waitForTimeout(1200);
  await page.getByTestId("world-pixels").screenshot({ path: `${OUT}/ap15-dorf-boot.png` });
  await until(request, 20 * 60 + 30);
  await act(request, "mira", "use", { object_id: "lantern_2", mode: "light" }, [13, 13]);
  await post(request, "/api/sim/step", { n: 1 });                                        // Anzünden dauert eine Minute
  await page.reload(); await openApp(page); await clear(page); await settled(page, '[data-house="0"]');
  await page.waitForTimeout(1200);
  await page.getByTestId("world-pixels").screenshot({ path: `${OUT}/ap15-dorf-laterne.png` });
  await act(request, "alex", "use", { object_id: "floor_lamp_2", mode: "light" }, [38, 12]);   // Wohnzimmer, neben der Stehlampe
  await post(request, "/api/sim/step", { n: 2 });
  await act(request, "alex", "use", { object_id: "armchair", mode: "sit", minutes: 60 }, [44, 13]);
  await page.reload(); await openApp(page); await clear(page);
  await openHouse(page);
  await page.waitForTimeout(1200);
  await page.getByTestId("world-pixels").screenshot({ path: `${OUT}/ap15-haus-abend.png` });
});
