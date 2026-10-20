import { expect, test } from "@playwright/test";
import { freshWorld, openApp } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

// Ohne den Vorgabewert der Tests (kein Titelbild): so öffnet ein neuer Besucher die Seite.
test.describe("Titelbild", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Beim Öffnen erscheint das Menü über der lebenden Welt; Fortsetzen zeigt, was passiert, und führt ins Spiel", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByTestId("start-menu");
    await expect(menu).toHaveAttribute("data-mode", "title");
    await expect(page.getByTestId("conn")).toHaveCount(0);                              // keine Kopfzeile im Titelbild
    await expect(page.getByTestId("menu-resume")).toBeVisible();
    await expect(page.getByTestId("resume-live")).toContainText("Alex");
    await expect(page.getByTestId("resume-live")).toContainText("Mira");
    await page.getByTestId("menu-resume").click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId("conn")).toContainText("Verbunden");
  });

  test("Abschalten gilt je Gerät: beim nächsten Öffnen kein Titelbild", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-settings").click();
    await page.getByTestId("title-on-start").uncheck();
    await page.reload();
    await expect(page.getByTestId("conn")).toContainText("Verbunden");
    await expect(page.getByTestId("start-menu")).toHaveCount(0);
  });
});

test("Esc öffnet das Pausenmenü im Spiel, die Simulation läuft weiter, Esc setzt fort", async ({ page, request }) => {
  await openApp(page);
  const before = (await (await request.get("/api/state")).json()).simulation.state;
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toHaveAttribute("data-mode", "pause");
  await expect(page.getByTestId("menu-resume")).toContainText("Zurück zum Spiel");
  expect((await (await request.get("/api/state")).json()).simulation.state).toBe(before);          // das Menü ändert den Lauf nicht
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
});

test("Pfeiltasten wählen, der Inhalt rechts folgt; Hauptmenü führt zum Titelbild", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-menu").click();
  await expect(page.getByTestId("menu-resume")).toHaveAttribute("aria-selected", "true");             // erst wenn die Auswahl steht, zählt die Taste (sonst flackert der Test)
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("menu-load")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("menu-pane-load")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("menu-pane-editors")).toBeVisible();
  await page.getByTestId("menu-title").click();
  await expect(page.getByTestId("start-menu")).toHaveAttribute("data-mode", "title");
});

test("Esc öffnet das Menü nicht, solange die Einstellungen offen sind: erst schließt Esc diese", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings")).toHaveCount(0);
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
});

test("Editoren → Welt öffnet den Welteditor, Neue Simulation → Startwelt fragt nach Bestätigung", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-menu").click();
  await page.getByTestId("menu-editors").click();
  await expect(page.getByText("später")).toHaveCount(2);                                 // Häuser und Dinge: nur gezeigt, nicht benutzbar (Figuren: Charaktereditor, AP17b)
  await expect(page.getByTestId("editor-figuren")).toBeVisible();
  await page.getByTestId("editor-world").click();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
  await page.getByTestId("editor-close").click();
  await expect(page.getByTestId("menu-pane-editors")).toBeVisible();                     // zurück an dieselbe Stelle im Menü (AP18a), nicht ins Spiel
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-start").click();
  await expect(page.getByRole("dialog", { name: "Zurücksetzen bestätigen" })).toBeVisible();
});
