import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Bilder des Mockups „Welt gestalten“ (docs/mockups/welt-optik/gestalten.html) für docs/status/AP16-schritt0.md; nur mit SIM_BILDER=1. Das Mockup braucht kein Backend. */
test.skip(!process.env.SIM_BILDER, "nur mit SIM_BILDER=1");
test.use({ viewport: { width: 1660, height: 800 } });
test.setTimeout(120_000);
const DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../docs/mockups/welt-optik");
const PAGE = `file://${DIR}/gestalten.html`;

type Mock = { S: { tool: string }; G: { X0: number; Y0: number; SC: number; draft: unknown[] }; I: { FX: number; WY: number; WALLH: number; TW: number; TH: number; SC: number } };
async function open(page: Page, query = "") {
  await page.goto(`${PAGE}${query}`);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "1");
}
/** Zeigerereignis an Dorfkoordinaten (vx, vy). */
const at = (page: Page, type: string, v: [number, number], extra: object = {}) =>
  page.evaluate(([t, p, x]) => {
    const cv = document.getElementById("c") as HTMLCanvasElement, r = cv.getBoundingClientRect(), G = (window as unknown as { MOCK: Mock }).MOCK.G;
    const px = (p[0] - G.X0) * G.SC, py = (p[1] - G.Y0) * G.SC;
    cv.dispatchEvent(new PointerEvent(t as string, { clientX: r.left + (px * r.width) / cv.width, clientY: r.top + (py * r.height) / cv.height, button: 0, buttons: t === "pointerup" ? 0 : 1, bubbles: true, ...(x as object) }));
  }, [type, v, extra] as const);
/** Zeigerereignis im Innenraum an Kachel (col, row); row < 0: Wand. */
const inAt = (page: Page, type: string, col: number, row: number) =>
  page.evaluate(([t, c, rw]) => {
    const cv = document.getElementById("c") as HTMLCanvasElement, r = cv.getBoundingClientRect(), I = (window as unknown as { MOCK: Mock }).MOCK.I;
    const px = I.FX + (c + 0.5) * I.TW * I.SC, py = rw < 0 ? I.WY + 20 * I.SC : I.WY + (I.WALLH + (rw + 0.5) * I.TH) * I.SC;
    cv.dispatchEvent(new PointerEvent(t as string, { clientX: r.left + (px * r.width) / cv.width, clientY: r.top + (py * r.height) / cv.height, button: 0, buttons: t === "pointerup" ? 0 : 1, bubbles: true }));
  }, [type, col, row] as const);
const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/gestalten-${name}.png` });
const click = async (page: Page, v: [number, number], extra: object = {}) => { await at(page, "pointermove", v); await at(page, "pointerdown", v, extra); await at(page, "pointerup", v); };
const drag = async (page: Page, a: [number, number], b: [number, number]) => { await at(page, "pointermove", a); await at(page, "pointerdown", a); await at(page, "pointermove", b); await at(page, "pointerup", b); };

test("Dorf: Zeiger, Weg, See, Garten, Haus, Deko, Löschen, Entwurf", async ({ page }) => {
  await open(page);
  await at(page, "pointermove", [126, 40]);
  await shot(page, "1-zeiger");
  await click(page, [126, 40]);                                                                   // Haus gewählt: „Von innen einrichten“
  await shot(page, "2-haus-gewaehlt");

  await page.keyboard.press("2");                                                                 // Weg: Punkte, die Vorschau läuft mit
  for (const p of [[118, 262], [150, 268], [190, 262]] as [number, number][]) await click(page, p);
  await at(page, "pointermove", [222, 250]);
  await shot(page, "3-weg");
  await at(page, "pointerdown", [222, 250], { detail: 2 }); await at(page, "pointerup", [222, 250]);

  await page.keyboard.press("3");                                                                 // See: erst im Wald (Fehler), dann auf der Wiese
  await at(page, "pointermove", [200, 150]); await at(page, "pointerdown", [200, 150]); await at(page, "pointermove", [232, 168]);
  await shot(page, "4-see-fehler");
  await at(page, "pointerup", [232, 168]);
  await drag(page, [226, 268], [252, 280]);

  await page.keyboard.press("4");                                                                 // Garten
  await drag(page, [160, 214], [224, 240]);

  await page.keyboard.press("5");                                                                 // Haus: gültig mit Türmarke, dann gesetzt
  await at(page, "pointermove", [60, 262]);
  await shot(page, "5-haus");
  await click(page, [60, 262]);
  await at(page, "pointermove", [112, 150]);
  await shot(page, "6-haus-fehler");

  await page.keyboard.press("6");                                                                 // Deko
  for (const p of [[18, 278], [108, 278], [160, 282]] as [number, number][]) await click(page, p);
  await page.keyboard.press("7");                                                                 // Löschen: bewohntes Haus nicht, Busch ja
  const bush = await page.evaluate(() => { const o = (window as unknown as { MOCK: { G: { build(d: boolean): { objs: { kind: string; vx: number; vy: number }[] } } } }).MOCK.G.build(false).objs.find((q) => q.kind.startsWith("bush"))!; return [o.vx, o.vy - 5] as [number, number]; });
  await click(page, bush);
  await at(page, "pointermove", [126, 40]);
  await shot(page, "7-loeschen-bewohnt");
  await at(page, "pointermove", [-45, 125]);
  await shot(page, "8-entwurf");
  await page.locator("#zeit").selectOption("Abend");
  await shot(page, "9-abend");
  await page.locator("#apply").click();
  await shot(page, "10-uebernehmen");
});

test("Haus von innen einrichten", async ({ page }) => {
  await open(page, "?view=in&room=kueche");
  await page.keyboard.press("1");
  await page.getByRole("button", { name: /Sofa/ }).click();
  await inAt(page, "pointermove", 7, 4);
  await shot(page, "11-innen-moebel");
  await inAt(page, "pointerdown", 7, 4); await inAt(page, "pointerup", 7, 4);
  await inAt(page, "pointermove", 1, 0);                                                          // vor der Tür: Fehler
  await shot(page, "12-innen-fehler");
  await page.getByRole("button", { name: /Sessel/ }).click();
  await inAt(page, "pointermove", 6, 5); await inAt(page, "pointerdown", 6, 5); await inAt(page, "pointerup", 6, 5);
  await page.keyboard.press("2");
  await inAt(page, "pointermove", 2, -1);
  await shot(page, "13-innen-wand");
  await page.keyboard.press("3");
  await page.locator("#opts .sw").nth(2).click();
  await page.locator("#opts .sw").nth(7).click();
  await shot(page, "14-innen-farben");
});
