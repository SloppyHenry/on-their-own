import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, setPlayer, state } from "./helpers";

/** Mitleben, Teil b2 (AP18h): Benutzen-Liste aus dem Optionsgenerator, Sagen, Antwortzeile bei Ansprache. Alex ist die eigene Figur, Mira steht neben ihm. */

test.beforeEach(async ({ request, page }) => {
  await freshWorld(request);
  await setPlayer(request, "alex");
  await page.goto("/");
  await openApp(page);
});

test("U öffnet die Liste mit Dauer und Grund; eine Möglichkeit wählen startet die Handlung", async ({ page, request }) => {
  await page.keyboard.press("u");
  const liste = page.getByTestId("benutzen");
  await expect(liste).toBeVisible();
  await expect(liste).toContainText("Genau diese Liste bekäme auch ein Bewohner angeboten");
  await expect(page.getByTestId("benutzen-option").first()).toBeVisible();
  const choices = await (await request.get("/api/player/choices")).json();
  await expect(page.getByTestId("benutzen-option")).toHaveCount(choices.length);
  const go = page.getByTestId("benutzen-option").filter({ hasText: /gehen/i }).first();
  await go.click();
  await expect(liste).toHaveCount(0);
  await expect.poll(async () => (await state(request)).agents.find((a: { id: string }) => a.id === "alex").action !== null).toBe(true);
  await expect(page.getByTestId("band")).toBeVisible();
});

test("T öffnet die Sagen-Zeile an Mira; Enter sagt es als normale Sprechblase, Esc schließt", async ({ page, request }) => {
  await page.keyboard.press("t");
  const zeile = page.getByTestId("sagenzeile");
  await expect(zeile).toBeVisible();
  await expect(page.getByTestId("sagen-wer")).toContainText("Mira");
  const box = zeile.getByRole("textbox", { name: "Sagen" });
  await expect(box).toBeFocused();
  await box.fill("Guten Morgen, Mira!");
  await box.press("Enter");
  await post(request, "/api/sim/step", { n: 3 });                          // Sprechen dauert eine Minute: erst dann steht die Blase
  await expect(page.getByTestId("bubble-alex")).toContainText("Guten Morgen, Mira!");
  await expect(zeile).toHaveCount(0);
  await page.keyboard.press("t");
  await page.getByRole("textbox", { name: "Sagen" }).press("Escape");
  await expect(zeile).toHaveCount(0);
});

test("Spricht Mira Alex an, steht die Antwortzeile mit Zähler da; Antworten schließt sie", async ({ page, request }) => {
  const r = await post(request, "/api/e2e/propose", { agent: "mira", action: "speak", params: { to: "alex", text: "Hast du kurz Zeit?" } });
  expect(r.ok, JSON.stringify(r)).toBe(true);
  await post(request, "/api/sim/step", { n: 3 });
  const zeile = page.getByTestId("sagenzeile");
  await expect(zeile).toBeVisible();
  await expect(page.getByTestId("sagen-wer")).toContainText("Mira wartet auf deine Antwort");
  await expect(page.getByTestId("antwort-zaehler")).toContainText(/\d+ s/);
  await zeile.getByRole("textbox", { name: "Sagen" }).fill("Ja, gern.");
  await page.getByTestId("sagen-senden").click();
  await post(request, "/api/sim/step", { n: 3 });
  await expect(page.getByTestId("bubble-alex")).toContainText("Ja, gern.");
  await expect(zeile).toHaveCount(0);
});

/** Teil b3 (AP18h): Bauen zeigt die Bauvorlagen mit Kosten und Grund, Gepäck zeigt Hände und Rucksack mit Geben an Mira. */
test("B zeigt die Bauvorlagen (Unmögliches mit Grund), I das Gepäck mit Geben an Mira", async ({ page, request }) => {
  await page.keyboard.press("b");
  const bauen = page.getByTestId("bauen");
  await expect(bauen).toBeVisible();
  await expect(bauen.getByTestId("benutzen-option").first()).toContainText("bauen");
  await expect(bauen).toContainText("Kosten");
  await page.keyboard.press("Escape");
  await expect(bauen).toHaveCount(0);

  const alex = (await state(request)).agents.find((a: { id: string }) => a.id === "alex");
  await page.keyboard.press("i");
  const gepaeck = page.getByTestId("gepaeck");
  await expect(gepaeck).toBeVisible();
  await expect(gepaeck).toContainText("Geben geht nur, wer am selben Ort steht: Mira");
  const stock = Object.entries(alex.inventory as Record<string, number>).filter(([, n]) => n > 0);
  if (stock.length) {                                                      // hat Alex etwas im Rucksack, lässt es sich Mira geben
    await gepaeck.getByRole("button", { name: "Geben an Mira" }).first().click();
    await expect.poll(async () => (await state(request)).agents.find((a: { id: string }) => a.id === "alex").action !== null).toBe(true);
  } else {
    await expect(gepaeck.getByTestId("gepaeck-zeile")).toHaveCount(0);
  }
});
