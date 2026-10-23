import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, state } from "./helpers";

/** Spielarten Leben und Gott (AP18d): Standard, Schnellstart, Wechsel in den Einstellungen, HUD je Spielart und Schutz im Backend. */
test.beforeEach(async ({ request }) => { await freshWorld(request); });

const aufLeben = (request: Parameters<typeof post>[0]) => post(request, "/api/sim/reset", { confirm: true, play_mode: "leben" });

test("Gott zeigt Werkzeuge und Abzeichen, Leben zeigt keine Leiste und lehnt Eingaben ab", async ({ page, request }) => {
  await openApp(page);
  expect((await state(request)).play_mode).toBe("gott");
  await expect(page.getByTestId("spielart-abzeichen")).toHaveAttribute("data-play-mode", "gott");
  await expect(page.getByTestId("werkzeuge")).toBeVisible();
  await expect(page.getByTestId("werkzeug-ereignis")).toBeVisible();
  await expect(page.getByTestId("open-editor")).toBeVisible();

  await aufLeben(request);
  await page.reload();
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await expect(page.getByTestId("spielart-abzeichen")).toHaveAttribute("data-play-mode", "leben");
  await expect(page.getByTestId("werkzeuge")).toHaveCount(0);
  await page.keyboard.press("e");                                                           // die Taste ruft in der Spielart Leben nichts auf
  await expect(page.getByTestId("ereignis-popover")).toHaveCount(0);
  const res = await request.post("/api/inject/parse", { data: { text: "Es regnet." }, headers: { "Idempotency-Key": crypto.randomUUID() } });
  expect(res.status()).toBe(403);
  expect(await res.text()).toContain("Spielart Leben");
});

test("Schnellstart legt das Dorf am See mit Alex und Mira an, in der Spielart Leben", async ({ page, request }) => {
  await openApp(page);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toBeVisible();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await expect(page.getByTestId("newsim-start")).toContainText("Schnellstart");
  await expect(page.getByTestId("newsim-generate")).toHaveCount(0);                          // „Neues Dorf erzeugen“ steckt jetzt im Assistenten und unter Editoren › Welten
  await page.getByTestId("newsim-start").click();
  await page.getByRole("dialog", { name: "Zurücksetzen bestätigen" }).getByRole("textbox").fill("zurücksetzen");
  await page.getByRole("button", { name: "Zurücksetzen", exact: true }).click();
  await expect(page.getByTestId("spielart-abzeichen")).toHaveAttribute("data-play-mode", "leben");
  expect((await state(request)).play_mode).toBe("leben");
  await expect(page.getByTestId("werkzeuge")).toHaveCount(0);
});

test("Einstellungen › Spielart: Wechsel mit Bestätigung in beide Richtungen, die Werkzeuge folgen", async ({ page, request }) => {
  await aufLeben(request);
  await openApp(page);
  await page.keyboard.press("Escape");
  await page.getByTestId("menu-settings").click();
  await page.getByRole("tab", { name: "Spielart" }).click();
  await expect(page.getByTestId("spielart-leben")).toBeDisabled();                            // die aktuelle Spielart ist gewählt
  await page.getByTestId("spielart-gott").click();
  await expect(page.getByTestId("spielart-frage")).toBeVisible();
  await page.keyboard.press("Escape");                                                         // Esc in der Frage heißt „Abbrechen“
  await expect(page.getByTestId("spielart-frage")).toHaveCount(0);
  expect((await state(request)).play_mode).toBe("leben");
  await page.getByTestId("spielart-gott").click();
  await page.getByTestId("spielart-frage-ja").click();
  await expect.poll(async () => (await state(request)).play_mode).toBe("gott");
  await page.keyboard.press("Escape");                                                         // von den Einstellungen geht Esc ins Spiel
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
  await expect(page.getByTestId("werkzeuge")).toBeVisible();
  const log = await (await request.get("/api/events?limit=20")).json();
  expect(JSON.stringify(log)).toContain("simulation.play_mode_changed");
});

test("Der Assistent beginnt mit der Spielart; „Leben mit eigener Figur“ ist wählbar", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toBeVisible();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-define").click();
  await expect(page.getByTestId("step-spielart")).toBeVisible();
  await expect(page.getByTestId("spielart-leben")).toHaveAttribute("aria-pressed", "true");  // Standard
  await expect(page.getByTestId("spielart-eigene-figur")).toContainText("einer von ihnen");
  await page.getByTestId("spielart-eigene-figur").click();
  await expect(page.getByTestId("spielart-eigene-figur")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("spielart-leben")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("spielart-gott").click();
  await page.getByTestId("schritt-5").click();
  await expect(page.getByTestId("start-uebersicht")).toContainText("Gott");
});
