import { expect, test } from "@playwright/test";
import { freshWorld, openApp, state } from "./helpers";
import { freieFlaeche, klickKachel, leereWelt, ueber, weltDatei, werkstattOeffnen } from "./gestalten-helfer";

/** Bilder für docs/status/AP16b.md bis AP16d.md (nur mit SIM_BILDER=1): Werkstatt, Fehler am Cursor, Gott, Übernehmen, Haus von innen. */
test.skip(!process.env.SIM_BILDER, "nur mit SIM_BILDER=1");
test.setTimeout(180_000);
const OUT = "../docs/status/img";
test.beforeEach(async ({ request }) => { await freshWorld(request); for (const w of await (await request.get("/api/worlds")).json()) if (!w.readonly) await request.delete(`/api/worlds/${w.id}`); });

test("Werkstatt: Entwurf, Fehler am Cursor", async ({ page, request }) => {
  const { id } = await leereWelt(request, "Bilderwiese", "mittel");
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await werkstattOeffnen(page, id);
  const [x, y] = freieFlaeche((await weltDatei(request, id)).tiles, 24, 12, [10, 10]);
  await page.getByTestId("werkzeug-weg").click();
  await klickKachel(page, x, y + 8); await klickKachel(page, x + 8, y + 6); await klickKachel(page, x + 14, y + 8); await klickKachel(page, x + 14, y + 8);
  await page.getByTestId("werkzeug-see").click();
  await klickKachel(page, x + 4, y + 2); await klickKachel(page, x + 7, y + 2);
  await page.getByTestId("werkzeug-haus").click();
  await klickKachel(page, x + 18, y + 6);
  await page.getByTestId("werkzeug-natur").click();
  await page.getByTestId("deko-bank").click();
  await klickKachel(page, x + 11, y + 9);
  await page.getByTestId("werkzeug-haus").click();
  await ueber(page, x + 4, y + 2);                                                           // mitten im See: rot
  await expect(page.getByTestId("cursor-tip")).toContainText("✗");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ap16b-1-werkstatt-fehler.png` });
  await ueber(page, x + 22, y + 10);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ap16b-2-werkstatt-haus.png` });
});

test("Gott: Entwurf, Übernehmen, Haus von innen", async ({ page, request }) => {
  await page.addInitScript(() => { (window as unknown as { __freezeT: number }).__freezeT = 12.5; });
  await openApp(page);
  const rows: string[] = (await state(request)).map.rows, [x, y] = freieFlaeche(rows, 1, 1, [2, 2], 1);
  await page.keyboard.press("b");
  await page.getByTestId("werkzeug-natur").click();
  await page.getByTestId("deko-bank").click();
  await klickKachel(page, x, y);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ap16b-3-gott-entwurf.png` });
  await page.getByTestId("uebernehmen").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ap16b-4-uebernehmen.png` });
  await page.getByTestId("uebernehmen-ok").click();
  await expect(page.getByTestId("gestalten-fertig-hinweis")).toBeVisible();
  const marke = page.locator('[data-house="0"]'), b = (await marke.boundingBox())!;
  await page.mouse.click(b.x, b.y);
  await page.getByTestId("werkzeug-moebel").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ap16c-1-haus-innen.png` });
});
