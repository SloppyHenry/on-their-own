import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

const values = async (request: import("@playwright/test").APIRequestContext) => (await (await request.get("/api/params")).json()).values;

async function openTab(page: import("@playwright/test").Page, name: string) {
  if (!(await page.getByTestId("settings").isVisible())) await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("settings")).toBeVisible();
  await page.getByRole("tab", { name, exact: true }).click();
}

test("Regler Knappheit: Status „übernommen“ und die Welt schrumpft wirklich (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  const before = (await (await request.get("/api/state")).json()).resources.find((r: { id: string }) => r.id === "forest_wood").amount;
  await openTab(page, "Welt");
  const row = page.getByTestId("param-world.scarcity");
  const slider = row.getByRole("slider");
  await slider.focus();
  await slider.fill("60");
  await expect(row.getByTestId("param-status")).toHaveAttribute("data-status", "applied");
  await expect(row.getByTestId("param-value")).toContainText("60");
  expect((await values(request))["world.scarcity"]).toBe(60);                       // die API bestätigt den Wert beim Verbraucher
  const after = (await (await request.get("/api/state")).json()).resources.find((r: { id: string }) => r.id === "forest_wood").amount;
  expect(after).toBeLessThan(before * 0.6);
  await expect(page.getByTestId("sidebar")).toBeVisible();
  await row.getByRole("button", { name: /auf Standard/ }).click();
  await expect.poll(async () => (await values(request))["world.scarcity"]).toBe(0);
});

test("Wirkung erst später: Gedächtnisregler zeigt „ab nächster Entscheidung“, ein falscher Wert wird abgelehnt", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Gedächtnis");
  const row = page.getByTestId("param-memory.reflection_threshold");
  await row.getByRole("slider").fill("150");
  await expect(row.getByTestId("param-status")).toHaveAttribute("data-status", "pending_next_decision");
  expect((await values(request))["memory.reflection_threshold"]).toBe(150);
  // direkt gegen die API: außerhalb des Bereichs wird abgelehnt, nie begrenzt
  const bad = await request.patch("/api/params", { data: { changes: [{ key: "memory.reflection_threshold", value: 9999 }] }, headers: { "Idempotency-Key": crypto.randomUUID() } });
  expect((await bad.json()).results[0]).toMatchObject({ status: "rejected" });
  expect((await values(request))["memory.reflection_threshold"]).toBe(150);
});

test("Agenten nebeneinander: Persönlichkeit je Figur und Charaktertext (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Agenten");
  const alex = page.getByTestId("agent-col-alex"), mira = page.getByTestId("agent-col-mira");
  await expect(alex).toBeVisible();
  await expect(mira).toBeVisible();
  const [a, m] = [await alex.boundingBox(), await mira.boundingBox()];
  expect(Math.abs(a!.y - m!.y)).toBeLessThan(4);                                    // nebeneinander
  await mira.getByTestId("param-personality.curiosity").getByRole("slider").fill("12");
  await expect(mira.getByTestId("param-personality.curiosity").getByTestId("param-status")).toHaveAttribute("data-status", "pending_next_decision");
  await mira.getByTestId("param-profile.interests").getByRole("textbox").fill("Schach, Drachen");
  await expect.poll(async () => (await values(request))["profile.interests"].mira).toBe("Schach, Drachen");
  const v = await values(request);
  expect(v["personality.curiosity"].mira).toBe(12);
  expect(v["personality.curiosity"].alex).toBe(70);                                  // Alex bleibt unberührt
});

test("Presets: Vorschau mit alt und neu, Laden, eigenes Preset speichern und löschen (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Presets");
  await expect(page.getByTestId("preset-ressourcenknappheit")).toBeVisible();
  await page.getByTestId("preset-ressourcenknappheit").getByRole("button", { name: /Ansehen/ }).click();
  const diff = page.getByTestId("preset-diff");
  await expect(diff).toContainText("Knappheit");
  expect((await values(request))["world.scarcity"]).toBe(0);                          // nur angesehen: nichts geändert
  await page.getByRole("dialog").getByRole("button", { name: "Laden" }).click();
  await expect.poll(async () => (await values(request))["world.scarcity"]).toBe(70);

  await page.getByLabel("Name des Presets").fill("Mein Test");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Mein Test").first()).toBeVisible();
  const card = page.locator('[data-testid^="preset-custom-"]').first();
  await card.getByRole("button", { name: "Löschen" }).click();
  await card.getByRole("button", { name: "Wirklich löschen" }).click();
  await expect(page.getByText("Mein Test")).toHaveCount(0);
  await post(request, "/api/params/reset");
});

test("Tempo, Modus und Status sind erreichbar; das Modell lässt sich im Lauf nicht ändern", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "2×" }).click();
  await expect.poll(async () => (await values(request))["sim.speed"]).toBe("2x");
  await openTab(page, "Modus");
  await page.getByTestId("param-mode").getByRole("combobox").selectOption("creator");
  await expect.poll(async () => (await values(request))["mode"]).toBe("creator");
  await openTab(page, "Modell");
  await expect(page.getByTestId("param-llm.model").locator("input")).toBeDisabled();
  await expect(page.getByText(/neue Simulation/).first()).toBeVisible();
  await openTab(page, "Status");
  await expect(page.getByTestId("status-actions")).toBeVisible();
  await expect(page.getByTestId("status-reachable")).toBeVisible();
});

test("Suche findet Einstellungen über alle Bereiche", async ({ page }) => {
  await openApp(page);
  await page.getByTestId("open-settings").click();
  await page.getByLabel("Einstellungen durchsuchen").fill("Temperatur");
  await expect(page.getByTestId("param-llm.temperature")).toBeVisible();
  await page.getByLabel("Einstellungen durchsuchen").fill("gibtesnicht");
  await expect(page.getByText(/Nichts gefunden/)).toBeVisible();
  await page.keyboard.press("Escape");                                                    // im Suchfeld mit Text: das erste Esc nimmt den Fokus (AP18a)
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings")).toHaveCount(0);
});
