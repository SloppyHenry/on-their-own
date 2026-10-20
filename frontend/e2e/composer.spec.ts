import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { freshWorld, openApp, openComposer, showTab } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

const send = async (page: Page, text: string) => {
  await openComposer(page);                                                    // die Eingabe ist das Gott-Werkzeug „Ereignis“ (Popover unten in der Mitte)
  const input = page.getByTestId("composer-input");
  await input.fill(text);
  await input.press("Enter");
};
const status = (page: Page) => page.getByTestId("composer-status");
const state = async (r: APIRequestContext) => (await r.get("/api/state")).json();
const memories = async (r: APIRequestContext, agent: string) => (await (await r.get(`/api/agents/${agent}/memories?limit=100`)).json()).items.map((m: { text: string }) => m.text) as string[];

test("Regen per Texteingabe: Status „ausgeführt ✓“, Wetter wirklich geändert, Protokolleintrag (§17 Nr. 10)", async ({ page, request }) => {
  await openApp(page);
  await send(page, "Heute beginnt es zu regnen.");
  await expect(status(page)).toContainText("ausgeführt ✓");
  expect((await state(request)).weather.kind).toBe("rain");
  await showTab(page, "protokoll");
  await expect(page.locator('[data-testid=timeline] [data-type="simulation.event_injected"]').first()).toContainText("Heute beginnt es zu regnen");
  await expect(page.locator('[data-testid=timeline] [data-type="world.weather_changed"]').first()).toBeVisible();
  await expect(page.getByTestId("composer-input")).toHaveValue("");
});

test("Alex findet eine Karte: sie existiert, nur Alex weiß davon (§17 Nr. 11)", async ({ page, request }) => {
  await openApp(page);
  await send(page, "Alex findet eine alte Karte im Haus.");
  await expect(status(page)).toContainText("ausgeführt ✓");
  const s = await state(request);
  const map = s.objects.find((o: { name: string }) => o.name === "Alte Karte");
  expect(map).toMatchObject({ kind: "map", hidden: true, known_by: ["alex"] });
  await expect.poll(async () => (await memories(request, "alex")).some((t) => t.includes("Alte Karte"))).toBe(true);
  expect((await memories(request, "mira")).some((t) => t.includes("Alte Karte"))).toBe(false);
});

test("Mehrdeutig: Rückfrage statt Vermutung, danach ausgeführt; nur Mira bekommt die Einladung", async ({ page, request }) => {
  await openApp(page);
  await send(page, "Mira erhält eine Einladung zu einem Fest.");
  await expect(page.getByTestId("clarify-card")).toBeVisible();
  await expect(page.getByTestId("clarify-question")).toContainText("wann");
  expect((await memories(request, "mira")).some((t) => t.includes("Einladung"))).toBe(false);          // bis zur Antwort ändert sich nichts
  await page.getByRole("button", { name: /Morgen Abend/ }).click();
  await expect(status(page)).toContainText("ausgeführt ✓");
  await expect.poll(async () => (await memories(request, "mira")).some((t) => t.includes("Einladung") && t.includes("Tag 2, 18:00"))).toBe(true);
  expect((await memories(request, "alex")).some((t) => t.includes("Einladung"))).toBe(false);
});

test("Nebenfigur: Vorschau mit Klartext, erst nach Bestätigung entsteht sie (§10.4)", async ({ page, request }) => {
  await openApp(page);
  await send(page, "Ein Fremder zieht in das Dorf.");
  const card = page.getByTestId("preview-card");
  await expect(card).toContainText("ohne eigenes Gedächtnis");
  expect((await state(request)).agents.some((a: { id: string }) => a.id === "npc_fremder")).toBe(false);
  await page.getByTestId("confirm-event").click();
  await expect(status(page)).toContainText("ausgeführt ✓");
  await expect.poll(async () => (await state(request)).agents.some((a: { id: string }) => a.id === "npc_fremder")).toBe(true);
  await expect(page.getByTestId("preview-card")).toHaveCount(0);
});

test("Unklare Eingabe: das Modell fragt nach, nichts ändert sich; Antwort führt zum Ergebnis", async ({ page, request }) => {
  await openApp(page);
  const before = (await state(request)).objects.length;
  await send(page, "Etwas Seltsames geschieht");
  await expect(page.getByTestId("clarify-card")).toBeVisible();
  expect((await state(request)).objects.length).toBe(before);
  await page.getByLabel("Antwort auf die Rückfrage").fill("Im Garten liegt ein rostiger Eimer");
  await page.getByRole("button", { name: "Antworten" }).click();
  await expect(page.getByTestId("preview-card")).toContainText("Rostiger Eimer");                         // was das Modell deutet, wird erst gezeigt
  expect((await state(request)).objects.some((o: { name: string }) => o.name === "Rostiger Eimer")).toBe(false);
  await page.getByTestId("confirm-event").click();
  await expect(status(page)).toContainText("ausgeführt ✓");
  expect((await state(request)).objects.some((o: { name: string }) => o.name === "Rostiger Eimer")).toBe(true);
});

test("Zeitpunkt und Verlauf: geplantes Ereignis steht im Verlauf, Eingabe zu lang oder ungültig wird abgelehnt", async ({ page, request }) => {
  await openApp(page);
  await openComposer(page);
  await page.getByRole("button", { name: "In 30 Min." }).click();
  await expect(page.getByTestId("when-label")).toBeVisible();
  await send(page, "Heute beginnt es zu regnen.");
  await expect(page.getByTestId("preview-card")).toContainText("Am Tag 1");                              // geplante Ereignisse zeigen eine Vorschau mit dem Zeitpunkt
  await page.getByTestId("confirm-event").click();
  await expect(status(page)).toContainText("ausgeführt ✓");
  expect((await state(request)).weather.kind).not.toBe("rain");                                        // erst in 30 Minuten
  const sched = await (await request.get("/api/scheduled")).json();
  expect(sched).toHaveLength(1);
  await page.getByTestId("open-history").click();
  await expect(page.getByTestId("inject-history")).toContainText("Heute beginnt es zu regnen");
  await expect(page.getByTestId("inject-history")).toContainText("ausgeführt");
  await send(page, "Bewege Alex zum See");
  await expect(status(page)).toContainText("abgelehnt");
  await expect(status(page)).toContainText("Eingriffsmodus");
});

test("Vorschläge erscheinen beim Fokussieren und lassen sich übernehmen", async ({ page }) => {
  await openApp(page);
  await openComposer(page);
  await page.getByTestId("composer-input").focus();
  await expect(page.getByTestId("suggestions")).toBeVisible();
  await page.getByRole("option", { name: /Markt statt/ }).click();
  await expect(page.getByTestId("composer-input")).toHaveValue(/Markt statt/);
  await page.getByTestId("composer-input").fill("");
  await page.getByTestId("composer-input").press("Shift+Enter");                                      // neue Zeile statt Senden
  await expect(status(page)).not.toContainText("gelesen");
});

test("„Er findet etwas“: das Pronomen wird erfragt, nicht geraten", async ({ page, request }) => {
  await openApp(page);
  const before = (await state(request)).objects.length;
  await send(page, "Er findet einen Schlüssel im Garten.");
  await expect(page.getByTestId("clarify-question")).toContainText("Wer ist mit");
  expect((await state(request)).objects.length).toBe(before);
  await page.getByTestId("clarify-card").getByRole("button", { name: "Mira" }).click();
  await expect(status(page)).toContainText("ausgeführt ✓");
  const key = (await state(request)).objects.find((o: { name: string; known_by?: string[] }) => o.name === "Schlüssel" && o.known_by?.includes("mira"));
  expect(key).toMatchObject({ kind: "key", location_id: "garden" });
});
