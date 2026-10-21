import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, openSettingsMenu } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

const values = async (request: import("@playwright/test").APIRequestContext) => (await (await request.get("/api/params")).json()).values;

async function openTab(page: import("@playwright/test").Page, name: string) {
  if (!(await page.getByTestId("settings").isVisible())) await openSettingsMenu(page);
  await page.getByRole("tab", { name, exact: true }).click();
}

test("Regler Knappheit: Status „übernommen“ und die Welt schrumpft wirklich (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  const before = (await (await request.get("/api/state")).json()).resources.find((r: { id: string }) => r.id === "forest_wood").amount;
  await openTab(page, "Welt & Regeln");
  const row = page.getByTestId("param-world.scarcity");
  const slider = row.getByRole("slider");
  await slider.focus();
  await slider.fill("60");
  await expect(row.getByTestId("param-status")).toHaveAttribute("data-status", "applied");
  await expect(row.getByTestId("param-value")).toContainText("60");
  expect((await values(request))["world.scarcity"]).toBe(60);                       // die API bestätigt den Wert beim Verbraucher
  const after = (await (await request.get("/api/state")).json()).resources.find((r: { id: string }) => r.id === "forest_wood").amount;
  expect(after).toBeLessThan(before * 0.6);
  await row.getByRole("button", { name: /auf Standard/ }).click();
  await expect.poll(async () => (await values(request))["world.scarcity"]).toBe(0);
});

test("Wirkung erst später: Gedächtnisregler zeigt „ab nächster Entscheidung“, ein falscher Wert wird abgelehnt", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Denken & Gedächtnis");
  const row = page.getByTestId("param-memory.reflection_threshold");
  await row.getByRole("slider").fill("150");
  await expect(row.getByTestId("param-status")).toHaveAttribute("data-status", "pending_next_decision");
  expect((await values(request))["memory.reflection_threshold"]).toBe(150);
  // direkt gegen die API: außerhalb des Bereichs wird abgelehnt, nie begrenzt
  const bad = await request.patch("/api/params", { data: { changes: [{ key: "memory.reflection_threshold", value: 9999 }] }, headers: { "Idempotency-Key": crypto.randomUUID() } });
  expect((await bad.json()).results[0]).toMatchObject({ status: "rejected" });
  expect((await values(request))["memory.reflection_threshold"]).toBe(150);
});

test("Bewohner: Regler für alle, je Bewohner eine eigene Seite mit Persönlichkeit und Charakter (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Bewohner");
  await expect(page.getByTestId("param-autonomy").getByTestId("param-value")).toHaveText("Mitte");      // 50 = jeder, wie er ist
  await page.getByTestId("einst-bewohner-mira").click();
  const mira = page.getByTestId("bewohner-seite-mira");
  await expect(mira).toBeVisible();
  await expect(page.locator('[data-testid="param-personality.curiosity"][data-agent="alex"]')).toHaveCount(0);   // keine Spalten nebeneinander mehr
  await mira.getByTestId("param-personality.curiosity").getByRole("slider").fill("12");
  await expect(mira.getByTestId("param-personality.curiosity").getByTestId("param-status")).toHaveAttribute("data-status", "pending_next_decision");
  await mira.getByTestId("param-profile.interests").getByRole("textbox").fill("Schach, Drachen");
  await expect.poll(async () => (await values(request))["profile.interests"].mira).toBe("Schach, Drachen");
  const v = await values(request);
  expect(v["personality.curiosity"].mira).toBe(12);
  expect(v["personality.curiosity"].alex).toBe(70);                                  // Alex bleibt unberührt
  await page.keyboard.press("Escape");                                               // das erste Esc nimmt dem Textfeld den Fokus (AP18a)
  await page.keyboard.press("Escape");                                               // zurück zur Liste der Bewohner; dort steht, was geändert ist
  await expect(page.getByTestId("einst-bewohner-mira")).toContainText("geändert");
  await expect(page.getByRole("tab", { name: "Bewohner", exact: true }).locator("em")).toHaveText("2");
  await page.getByTestId("seite-standard").click();
  await expect.poll(async () => (await values(request))["personality.curiosity"].mira).not.toBe(12);
  await expect(page.getByTestId("einst-bewohner-mira")).not.toContainText("geändert");
});

test("Presets: Vorschau mit alt und neu, Laden, eigenes Preset speichern und löschen (§17 Nr. 8)", async ({ page, request }) => {
  await openApp(page);
  await openTab(page, "Voreinstellungen");
  await expect(page.getByTestId("preset-ressourcenknappheit")).toBeVisible();
  await page.getByTestId("preset-ressourcenknappheit").getByRole("button", { name: "Laden…" }).click();
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

test("Tempo, Wissen über dich und Modellzustand sind erreichbar; das Modell lässt sich im Lauf nicht ändern", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "2×" }).click();
  await expect.poll(async () => (await values(request))["sim.speed"]).toBe("2x");
  await openTab(page, "Zeit");
  await expect(page.getByTestId("param-sim.speed").getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");
  await openTab(page, "Spielart");
  await page.getByTestId("param-mode").getByRole("button", { name: "Schöpfer" }).click();
  await expect.poll(async () => (await values(request))["mode"]).toBe("creator");
  await expect(page.getByTestId("param-mode.creator_text").getByRole("textbox")).toBeVisible();   // den Text gibt es nur bei „Schöpfer“
  await openTab(page, "Modell");
  await expect(page.getByTestId("param-llm.model").locator("input")).toHaveCount(0);
  await expect(page.getByText(/Neue Simulation mit anderem Modell/)).toBeVisible();
  await expect(page.getByTestId("status-actions")).toBeVisible();                     // der Zustand steht oben auf der Seite Modell
  await expect(page.getByTestId("status-reachable")).toBeVisible();
  await expect(page.getByTestId("feinheiten")).not.toHaveAttribute("open", "");         // Feinheiten sind eingeklappt
});

test("Liste in drei Gruppen, jede Seite sagt, wofür sie gilt; Geändertes ist markiert", async ({ page, request }) => {
  await openApp(page);
  await openSettingsMenu(page);
  const namen = await page.getByRole("tab").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(namen).toEqual(["Spielart", "Zeit", "Welt & Regeln", "Bewohner", "Darstellung", "Ton", "Modell", "Denken & Gedächtnis", "Voreinstellungen"]);
  await expect(page.getByText("Dieses Spiel", { exact: true })).toBeVisible();
  await expect(page.getByText("Dieses Gerät", { exact: true })).toBeVisible();
  await openTab(page, "Darstellung");
  await expect(page.getByTestId("geltung")).toHaveText(/nur dieses Gerät/);
  await openTab(page, "Welt & Regeln");
  await expect(page.getByTestId("geltung")).toHaveText(/dieser Spielstand/);
  await page.getByTestId("param-needs.hunger.enabled").getByRole("switch").uncheck();
  await expect.poll(async () => (await values(request))["needs.hunger.enabled"]).toBe(false);
  await expect(page.getByTestId("param-needs.hunger.enabled").getByRole("slider")).toBeDisabled();   // ohne Hunger keine Rate
  await expect(page.getByRole("tab", { name: "Welt & Regeln" }).locator("em")).toHaveText("1");
  await page.getByTestId("seite-standard").click();
  await expect.poll(async () => (await values(request))["needs.hunger.enabled"]).toBe(true);
  await expect(page.getByRole("tab", { name: "Welt & Regeln" }).locator("em")).toHaveCount(0);
});

test("Suche findet Einstellungen über alle Bereiche und springt an die Stelle; Esc leert erst die Suche", async ({ page }) => {
  await openApp(page);
  await openSettingsMenu(page);
  const suche = page.getByLabel("Einstellungen durchsuchen");
  await suche.fill("Temperatur");
  await expect(page.getByTestId("param-llm.temperature")).toBeVisible();
  await suche.fill("Pause je");
  await page.getByRole("button", { name: "Zeit › Feinheiten" }).click();              // Fundort: springt auf die Seite und klappt die Feinheiten auf
  await expect(page.getByTestId("krume-aktuell")).toHaveText("Zeit");
  await expect(page.getByTestId("param-sim.tick_pause_ms")).toBeVisible();
  await suche.fill("Titelbild");
  await expect(page.getByText("Titelbild zeigen")).toBeVisible();                       // auch Einstellungen des Geräts
  await suche.fill("gibtesnicht");
  await expect(page.getByText(/Nichts gefunden/)).toBeVisible();
  await page.keyboard.press("Escape");                                                    // im Suchfeld mit Text: das erste Esc nimmt den Fokus (AP18a)
  await page.keyboard.press("Escape");                                                    // dann leert Esc die Suche
  await expect(suche).toHaveValue("");
  await expect(page.getByTestId("settings")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings")).toHaveCount(0);
});
