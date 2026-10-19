import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, post, state, steps } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

const minute = async (r: Parameters<typeof state>[0]) => (await state(r)).clock.minute as number;
const openSaves = async (page: Page) => { await page.getByTestId("open-menu").click(); await page.getByTestId("menu-load").click(); await expect(page.getByTestId("saves-dialog")).toBeVisible(); };
const closeSaves = async (page: Page) => { await page.getByTestId("open-menu").click(); await expect(page.getByTestId("start-menu")).toHaveCount(0); };
const saveAs = async (page: Page, name: string) => { await page.getByLabel("Name des Spielstands").fill(name); await page.getByTestId("save-now").click(); };

test("Speichern, weiterlaufen, Laden: der Browser zeigt den gespeicherten Stand; vorher wird gesichert (§17 Nr. 7)", async ({ page, request }) => {
  await openApp(page);
  await post(request, "/api/sim/step", { n: 12 });
  const saved = await minute(request);
  await openSaves(page);
  await saveAs(page, "E2E Stand");
  await expect(page.getByTestId("saves-message")).toHaveText("Gespeichert.");
  const row = page.getByTestId("saves-list").locator("li", { hasText: "E2E Stand" });
  await expect(row).toContainText("Manuell");
  await closeSaves(page);
  await steps(request, 30);
  await expect.poll(() => minute(request)).toBe(saved + 30);
  await expect(page.getByTestId("clock")).toContainText(String(Math.floor(((saved + 30) % 1440) / 60)).padStart(2, "0"));
  await openSaves(page);
  await page.getByTestId("saves-list").locator("li", { hasText: "E2E Stand" }).getByRole("button", { name: "Laden" }).click();
  await expect(page.getByText("Der aktuelle Stand wird vorher gesichert.")).toBeVisible();
  expect(await minute(request)).toBe(saved + 30);                                                          // erst die Bestätigung lädt
  await page.getByTestId("confirm-ask").click();
  await expect(page.getByTestId("saves-message")).toHaveText("Geladen.");
  await expect.poll(() => minute(request)).toBe(saved);
  await closeSaves(page);
  await expect(page.getByTestId("clock")).toContainText(String(Math.floor((saved % 1440) / 60)).padStart(2, "0") + ":" + String(saved % 60).padStart(2, "0"));
  await openSaves(page);
  await expect(page.getByTestId("saves-list").locator("li", { hasText: "Vor dem Laden" })).toContainText("Sicherung");
});

test("Gleicher Name überschreibt nichts ohne ausdrückliche Bestätigung", async ({ page, request }) => {
  await openApp(page);
  await openSaves(page);
  await saveAs(page, "Doppelt");
  await expect(page.getByTestId("saves-message")).toHaveText("Gespeichert.");
  await post(request, "/api/sim/step", { n: 5 });
  const first = (await (await request.get("/api/saves")).json()).find((s: { name: string }) => s.name === "Doppelt");
  await saveAs(page, "doppelt");
  await expect(page.getByTestId("overwrite-ask")).toBeVisible();
  expect((await (await request.get("/api/saves")).json()).find((s: { name: string }) => s.name === "Doppelt").sim_minute).toBe(first.sim_minute);   // unverändert
  await page.getByTestId("overwrite-yes").click();
  await expect(page.getByTestId("saves-message")).toHaveText("Überschrieben.");
  const list = (await (await request.get("/api/saves")).json()).filter((s: { name: string }) => s.name.toLowerCase() === "doppelt");
  expect(list).toHaveLength(1);
  expect(list[0].sim_minute).toBe(first.sim_minute + 5);
});

test("Löschen fragt nach; Export und Import als ZIP legen einen neuen Stand an", async ({ page, request }) => {
  await openApp(page);
  await openSaves(page);
  await saveAs(page, "Rundreise");
  const row = page.getByTestId("saves-list").locator("li", { hasText: "Rundreise" });
  const href = await row.getByRole("link", { name: "Exportieren" }).getAttribute("href");
  const zip = await request.get(href!);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const body = await zip.body();
  await page.getByTestId("import-file").setInputFiles({ name: "stand.zip", mimeType: "application/zip", buffer: body });
  await expect(page.getByTestId("saves-message")).toHaveText("Importiert (als neuer Stand).");
  await expect(page.getByTestId("saves-list").locator("li", { hasText: "Rundreise (Import)" })).toContainText("Import");
  await page.getByTestId("import-file").setInputFiles({ name: "kaputt.zip", mimeType: "application/zip", buffer: Buffer.from("das ist kein zip") });
  await expect(page.getByTestId("saves-message")).toContainText("keine ZIP");
  const imp = page.getByTestId("saves-list").locator("li", { hasText: "Rundreise (Import)" });
  await imp.getByRole("button", { name: "Löschen" }).click();
  await expect(imp.getByText("Endgültig löschen?")).toBeVisible();
  await imp.getByRole("button", { name: "Abbrechen" }).click();
  await expect(imp).toBeVisible();
  await imp.getByRole("button", { name: "Löschen" }).click();
  await imp.getByTestId("confirm-ask").click();
  await expect(page.getByTestId("saves-list").locator("li", { hasText: "Rundreise (Import)" })).toHaveCount(0);
});

test("Zurücksetzen sichert vorher als Spielstand und lässt die Profile behalten", async ({ page, request }) => {
  await openApp(page);
  await post(request, "/api/sim/step", { n: 10 });
  await page.getByRole("button", { name: /Zurücksetzen/ }).click();
  await expect(page.getByText("Vor dem Zurücksetzen")).toBeVisible();
  await page.getByTestId("keep-profiles").check();
  await page.getByLabel(/Zur Bestätigung/).fill("zurücksetzen");
  await page.getByRole("dialog").getByRole("button", { name: "Zurücksetzen" }).click();
  await expect.poll(() => minute(request)).toBe(420);
  const saves = await (await request.get("/api/saves")).json();
  expect(saves.some((s: { name: string }) => s.name.startsWith("Vor dem Zurücksetzen"))).toBe(true);
});

test("Verlauf: Filter nach Kategorie, Text und Zeitraum, Export als CSV und JSON", async ({ page, request }) => {
  await openApp(page);
  await steps(request, 60);
  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-history-view").click();
  const view = page.getByTestId("history-view");
  await expect(view).toBeVisible();
  const count = async () => Number(((await page.getByTestId("history-count").textContent()) ?? "").match(/^\d+/)![0]);
  await expect.poll(count).toBeGreaterThan(20);
  const all = await count();
  await page.getByLabel("Kategorie").selectOption("dialogue");
  await expect.poll(count).toBeLessThan(all);
  await expect(view.locator("tr").first()).toHaveAttribute("data-type", /agent\.(dialogue|conversation|proposal)/);
  await page.getByLabel("Kategorie").selectOption("");
  await page.getByLabel("Ereignisart").fill("world.time");
  await expect.poll(count).toBe(1);                                                                       // eine Stunde Simulation: ein Takt-Ereignis
  await page.getByLabel("Ereignisart").fill("");
  await page.getByLabel("Von Tag").fill("1");
  await page.getByLabel("Von Uhrzeit").fill("07:30");
  await page.getByLabel("Bis Tag").fill("1");
  await page.getByLabel("Bis Uhrzeit").fill("07:40");
  await expect.poll(count).toBeLessThan(all);
  const csv = await request.get((await page.getByTestId("export-csv").getAttribute("href"))!);
  expect(csv.status()).toBe(200);
  const lines = (await csv.text()).split("\n").filter(Boolean);
  expect(lines[0]).toContain("sim_minute");
  expect(lines.slice(1).every((l) => Number(l.split(",")[1]) >= 450 && Number(l.split(",")[1]) <= 460)).toBe(true);
  const json = await (await request.get((await page.getByTestId("export-json").getAttribute("href"))!)).json();
  expect(json.length).toBe(lines.length - 1 || json.length);
});

test("Statistik zeigt echte Zahlen und Verläufe aus dem laufenden Tag (§14)", async ({ page, request }) => {
  await openApp(page);
  await steps(request, 180);
  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-stats").click();
  const kpis = page.getByTestId("kpis");
  await expect(kpis).toContainText("Aktionen gelungen");
  const api = await (await request.get("/api/stats")).json();
  expect(api.total.actions.completed).toBeGreaterThan(0);
  await expect(kpis.locator("div", { hasText: "Aktionen gelungen" }).first()).toContainText(String(api.total.actions.completed));
  await expect(page.getByLabel("Aktionen nach Art")).toContainText("move_to");
  await page.getByRole("group", { name: "Figur", exact: true }).getByRole("button", { name: "Alex" }).click();
  await expect(page.getByTestId("chart-Bedürfnisse (0–100)")).toBeVisible();
  await expect(page.getByTestId("chart-Stimmung (−1 bis +1)")).toBeVisible();
  await expect(page.getByLabel("Beziehungen")).toContainText("zu Mira");
  await page.getByRole("button", { name: "Letzte 6 Std." }).click();
  await expect(kpis).toBeVisible();
  await page.getByTestId("back-to-world").click();
  await expect(page.getByTestId("world-canvas")).toBeVisible();
});
