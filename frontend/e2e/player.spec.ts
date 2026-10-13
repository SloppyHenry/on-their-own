import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, settled, settledTag } from "./helpers";

/** Mitspieler-Vorschau (AP13): Klick geht/handelt, Enter spricht – alles nur Vorschau, nichts geht an die Simulation. */

test.beforeEach(async ({ request }) => { await freshWorld(request); });

/** Zählt verändernde Anfragen an die API ab jetzt (die Vorschau darf keine schicken). */
function watchWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => { if (r.method() !== "GET" && r.url().includes("/api/")) writes.push(`${r.method()} ${r.url()}`); });
  return writes;
}

async function enable(page: Page) {
  await page.getByTestId("player-toggle").check();
  await expect(page.getByTestId("player-layer")).toContainText("nichts wird an die Simulation geschickt");
}

test("Wegvorschau: Klick auf die Wiese zeigt Weg und Dauer, nichts wird gesendet", async ({ page }) => {
  await openApp(page);
  const writes = watchWrites(page);
  await enable(page);
  const house = await settled(page, '[data-house="0"]');
  await page.mouse.click(house.x + 260, house.y + 60);
  await expect(page.getByTestId("player-intent")).toContainText(/würde gehen nach \(\d+, \d+\), etwa \d+ Min\./);
  await expect(page.getByTestId("path-preview")).toContainText(/≈ \d+ Min\./);
  await expect(page.getByTestId("path-preview")).toBeVisible();
  expect(writes).toEqual([]);
});

test("Kontextmenü: Haus ansehen, Figur ansprechen; Sagen ohne Kürzel, Esc bricht ab", async ({ page }) => {
  await openApp(page);
  const writes = watchWrites(page);
  await enable(page);
  const house = await settled(page, '[data-house="0"]');
  await page.mouse.click(house.x, house.y);
  const menu = page.getByTestId("player-menu");
  await expect(menu).toContainText("hineinschauen");
  await menu.getByRole("menuitem", { name: "hineinschauen" }).click();
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
  const tag = await settledTag(page, "alex");
  await page.mouse.click(tag.x + tag.width / 2, tag.y - 22);
  await expect(menu).toContainText("Alex");
  await menu.getByRole("menuitem", { name: "ansehen" }).click();
  await expect(page.getByTestId("player-intent")).toHaveText("würde Alex ansehen");
  await page.mouse.click(tag.x + tag.width / 2, tag.y - 22);
  await menu.getByRole("menuitem", { name: "ansprechen" }).click();
  const box = page.getByTestId("say-box").getByRole("textbox", { name: "Sagen" });
  await expect(box).toBeFocused();
  await box.pressSequentially("f0 Hallo");                         // F und 0 dürfen weder folgen noch die Gesamtansicht zeigen
  await expect(box).toHaveValue("f0 Hallo");
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
  await box.press("Enter");
  await expect(page.getByTestId("player-intent")).toHaveText("würde zu Alex sagen: „f0 Hallo“");
  await page.keyboard.press("Enter");                               // Enter öffnet das Feld, Esc bricht ab, die Innenansicht bleibt
  await expect(box).toBeFocused();
  await box.fill("x".repeat(600));
  await expect(box).toHaveValue("x".repeat(500));
  await box.press("Escape");
  await expect(page.getByTestId("say-box")).toHaveCount(0);
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
  expect(writes).toEqual([]);
});

test("Mit Schalter: Rechtsklick wählt aus; ohne Schalter verhält sich alles wie vorher", async ({ page }) => {
  await openApp(page);
  await enable(page);
  const house = await settled(page, '[data-house="0"]');
  await page.mouse.click(house.x, house.y, { button: "right" });
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
  const tag = await settledTag(page, "alex");
  await page.keyboard.down("Shift");
  await page.mouse.click(tag.x + tag.width / 2, tag.y - 22);
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("drawer")).toContainText("Bedürfnisse");
  await page.getByTestId("player-toggle").uncheck();
  await expect(page.getByTestId("player-layer")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("say-box")).toHaveCount(0);
});
