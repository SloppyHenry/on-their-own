import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, openHouse } from "./helpers";

/**
 * Rückweg (AP18a): Esc nimmt überall genau eine Ebene zurück und landet nie unerwartet im Spiel oder im falschen Menü.
 * Jeder Test geht einen Pfad hin und mit Esc Ebene für Ebene zurück.
 */
test.beforeEach(async ({ request }) => {
  await freshWorld(request);
  for (const t of await (await request.get("/api/templates")).json()) if (!t.builtin) await request.delete(`/api/templates/${t.id}`);
});

const esc = (page: Page) => page.keyboard.press("Escape");
const menu = (page: Page) => page.getByTestId("start-menu");
const title = (page: Page) => expect(menu(page)).toHaveAttribute("data-mode", "title");
const pause = (page: Page) => expect(menu(page)).toHaveAttribute("data-mode", "pause");

// Ohne den Vorgabewert der Tests (kein Titelbild): so öffnet ein neuer Besucher die Seite.
test.describe("Titelbild", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Neue Simulation › Assistent: Esc geht Schritt für Schritt zurück, dann zur Liste, und bleibt im Titelbild", async ({ page }) => {
    await page.goto("/");
    await title(page);
    await page.getByTestId("menu-newsim").click();
    await expect(page.getByTestId("brotkrumen")).toContainText("Neue Simulation");
    await expect(page.getByTestId("esc-hinweis")).toHaveCount(0);                         // im Titelbild gibt es von der Liste aus kein Zurück
    await page.getByTestId("newsim-define").click();
    await expect(page.getByTestId("assistent")).toBeVisible();
    await page.getByTestId("schritt-2").click();                                          // Regeln
    await expect(page.getByTestId("krume-aktuell")).toHaveText("Regeln");
    await expect(page.getByTestId("brotkrumen")).toContainText(/Neue Simulation\s*›\s*Welt\s*›\s*Bewohner/);
    await expect(page.getByTestId("esc-hinweis")).toContainText("zurück zu Bewohner");

    await esc(page);
    await expect(page.getByTestId("schritt-1")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("esc-hinweis")).toContainText("zurück zu Welt");
    await esc(page);
    await expect(page.getByTestId("schritt-0")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("esc-hinweis")).toContainText("zurück zu Neue Simulation");
    await esc(page);
    await expect(page.getByTestId("assistent")).toHaveCount(0);
    await expect(page.getByTestId("newsim-define")).toBeVisible();                        // wieder bei Neue Simulation
    await esc(page);
    await title(page);                                                                    // Esc führt aus dem Titelbild nie ins Spiel
    await expect(page.getByTestId("conn")).toHaveCount(0);
  });

  test("Krumen sind anklickbar; Esc und der Knopf unten führen an dieselbe Stelle", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-newsim").click();
    await page.getByTestId("newsim-define").click();
    await page.getByTestId("schritt-3").click();
    await page.getByTestId("krume-2").click();                                            // „Bewohner“
    await expect(page.getByTestId("schritt-1")).toHaveAttribute("aria-current", "step");
    await page.getByTestId("zurueck").click();
    await expect(page.getByTestId("schritt-0")).toHaveAttribute("aria-current", "step");
    await page.getByTestId("zurueck").click();                                            // am ersten Schritt: zu Neue Simulation
    await expect(page.getByTestId("newsim-define")).toBeVisible();
  });

  test("Neues Dorf erzeugen: Esc führt aus dem Editor in dasselbe Menü (Neue Simulation) zurück, nicht ins Spiel", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-newsim").click();
    await page.getByTestId("newsim-generate").click();
    await expect(page.getByTestId("editor-panel")).toBeVisible();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.getByTestId("editor-close")).toContainText("Zurück zum Menü");
    await esc(page);
    await expect(page.getByTestId("editor-panel")).toHaveCount(0);
    await title(page);
    await expect(page.getByTestId("menu-pane-newsim")).toBeVisible();
    await expect(page.getByTestId("newsim-generate")).toBeVisible();
    await page.getByTestId("newsim-generate").click();                                    // und der Knopf im Editor führt an dieselbe Stelle
    await page.getByTestId("editor-close").click();
    await title(page);
    await expect(page.getByTestId("menu-pane-newsim")).toBeVisible();
  });

  test("Zurücksetzen-Dialog: Esc bricht ab, das nächste Esc bleibt im Titelbild", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-newsim").click();
    await page.getByTestId("newsim-start").click();
    const dialog = page.getByRole("dialog", { name: "Zurücksetzen bestätigen" });
    await expect(dialog).toBeVisible();
    await esc(page);                                                                      // das Feld ist leer: Esc geht gleich zurück
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("newsim-start")).toBeVisible();
    await esc(page);
    await title(page);
  });
});

test("Pausenmenü: Esc öffnet, auf der Liste schließt Esc und setzt das Spiel fort", async ({ page }) => {
  await openApp(page);
  await esc(page);
  await pause(page);
  await esc(page);
  await expect(menu(page)).toHaveCount(0);
  await esc(page);
  await page.getByTestId("menu-load").click();
  await expect(page.getByTestId("esc-hinweis")).toContainText("zurück zum Spiel");
  await esc(page);
  await expect(menu(page)).toHaveCount(0);
});

test("Editoren › Welt: Esc führt aus dem Editor zu Editoren zurück, dann ins Spiel", async ({ page }) => {
  await openApp(page);
  await esc(page);
  await page.getByTestId("menu-editors").click();
  await page.getByTestId("editor-world").click();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("editor-panel")).toHaveCount(0);
  await pause(page);
  await expect(page.getByTestId("menu-pane-editors")).toBeVisible();
  await expect(page.getByTestId("editor-world")).toBeVisible();
  await esc(page);
  await expect(menu(page)).toHaveCount(0);
});

test("„Welt gestalten“ in der Kopfzeile: Esc führt ins Spiel zurück, nicht ins Menü", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-editor").click();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
  await expect(page.getByTestId("editor-close")).toContainText("Zurück ins Spiel");
  await esc(page);
  await expect(page.getByTestId("editor-panel")).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);
});

test("Charaktereditor: Esc führt zu Editoren zurück; bei ungesicherten Änderungen fragt er vorher", async ({ page }) => {
  await openApp(page);
  await esc(page);
  await page.getByTestId("menu-editors").click();
  await page.getByTestId("editor-figuren").click();
  await expect(page.getByTestId("charaktereditor")).toBeVisible();
  await expect(page.getByTestId("brotkrumen")).toContainText(/Editoren\s*›\s*Charaktereditor/);
  await esc(page);                                                                         // nichts geändert: gleich zurück
  await expect(page.getByTestId("charaktereditor")).toHaveCount(0);
  await expect(page.getByTestId("editor-figuren")).toBeVisible();

  await page.getByTestId("editor-figuren").click();
  await page.getByTestId("vorlage-neu").click();                                           // eigene Vorlage, ändern, nicht speichern
  const name = page.getByTestId("editor-name");
  await expect(name).toBeEnabled();
  await name.fill("Zorro");
  await esc(page);                                                                         // im Feld mit Text: das erste Esc nimmt den Fokus
  await expect(name).not.toBeFocused();
  await expect(page.getByTestId("vorlage-rueckfrage")).toHaveCount(0);
  await esc(page);
  await expect(page.getByTestId("vorlage-rueckfrage")).toBeVisible();
  await esc(page);                                                                         // Esc heißt „weiter bearbeiten“
  await expect(page.getByTestId("vorlage-rueckfrage")).toHaveCount(0);
  await expect(page.getByTestId("charaktereditor")).toBeVisible();
  await expect(name).toHaveValue("Zorro");
  await page.getByTestId("krume-0").click();                                               // die Krume fragt genauso
  await expect(page.getByTestId("vorlage-rueckfrage")).toBeVisible();
  await page.getByTestId("vorlage-rueckfrage-ja").click();
  await expect(page.getByTestId("charaktereditor")).toHaveCount(0);
  await expect(page.getByTestId("editor-figuren")).toBeVisible();
  await esc(page);
  await expect(menu(page)).toHaveCount(0);
});

test("Spiel: Esc schließt erst das Detail, dann den Einblick, dann öffnet es das Menü", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("agent-card-alex").click();
  await expect(page.getByTestId("drawer")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("drawer")).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);

  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-stats").click();
  await expect(page.getByTestId("back-to-world")).toBeVisible();
  await page.getByTestId("open-insights").click();                                         // Untermenü offen: Esc schließt zuerst das
  await expect(page.getByRole("menu")).toBeVisible();
  await esc(page);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByTestId("back-to-world")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("back-to-world")).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);
  await esc(page);
  await pause(page);
});

test("Innenansicht: Esc geht erst aus dem Haus, das nächste Esc öffnet das Menü", async ({ page }) => {
  await openApp(page);
  await openHouse(page);
  await esc(page);
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "-1");
  await expect(menu(page)).toHaveCount(0);
  await esc(page);
  await pause(page);
});

test("Einstellungen im Menü: Esc geht zum Spiel; die Schublade schließt Esc zuerst", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("settings")).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);
  await esc(page);
  await pause(page);
  await page.getByTestId("menu-settings").click();
  await expect(page.getByTestId("krume-aktuell")).toHaveText("Einstellungen");
  await esc(page);
  await expect(menu(page)).toHaveCount(0);
});
