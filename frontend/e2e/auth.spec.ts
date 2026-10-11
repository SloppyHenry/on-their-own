import { expect, test } from "@playwright/test";

// Der Zugangsschutz ist im Test-Backend aus; die Antworten der Anmelde-Schnittstelle werden hier nachgestellt,
// die eigentliche Prüfung (Cookie, 401, Sperre) steht in backend/tests/api/test_serving.py.
test("Mit aktivem Schutz zuerst die Anmeldung; falsches Token bleibt auf der Seite, richtiges öffnet die Leitstelle", async ({ page }) => {
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { required: true, authenticated: false } }));
  let tries = 0;
  await page.route("**/api/auth/login", (r) => {
    tries += 1;
    const ok = r.request().postDataJSON().token === "richtig";
    return r.fulfill({ status: ok ? 200 : 401, json: ok ? { required: true, authenticated: true } : { detail: "x" } });
  });
  await page.goto("/");
  await expect(page.getByTestId("login")).toBeVisible();
  await expect(page.getByTestId("agent-card-alex")).toHaveCount(0);            // dahinter wird nichts geladen
  await page.getByLabel("Token").fill("falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("alert")).toHaveText("Das Token stimmt nicht.");
  await page.getByLabel("Token").fill("richtig");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByTestId("agent-card-alex")).toBeVisible();
  expect(tries).toBe(2);
});

test("Läuft die Anmeldung ab (401 mitten im Betrieb), erscheint wieder die Anmeldung", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("agent-card-alex")).toBeVisible();
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { required: true, authenticated: false } }));
  await page.evaluate(() => fetch("/api/state").then(() => window.dispatchEvent(new Event("sim:auth-required"))));
  await expect(page.getByTestId("login")).toBeVisible();
});
