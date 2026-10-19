import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, state } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

async function ids(request: import("@playwright/test").APIRequestContext, agent: string) {
  const page = await (await request.get(`/api/agents/${agent}/memories?limit=200`)).json();
  return page.items.map((m: { id: string }) => m.id) as string[];
}

test("Inspektor zeigt die Erinnerungen des gewählten Agenten und nur diese (§17 Nr. 2)", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 40 });
  expect((await ids(request, "alex")).length).toBeGreaterThan(3);
  await openApp(page);
  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-memory").click();
  const inspector = page.getByTestId("memory-inspector");
  await expect(inspector).toBeVisible();
  const rows = page.getByTestId("memory-row");
  await expect(rows.first()).toBeVisible();
  const shown = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!));
  const alex = await ids(request, "alex"), mira = await ids(request, "mira");
  expect(shown.length).toBeGreaterThan(3);
  expect(shown.every((id) => alex.includes(id))).toBe(true);
  expect(shown.some((id) => mira.includes(id))).toBe(false);
  await page.getByTestId("memory-agent-mira").click();
  await expect.poll(async () => (await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!))).every((id) => mira.includes(id))).toBe(true);
});

test("Filter, Suche und Detail mit Herkunft", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 50 });
  await openApp(page);
  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-memory").click();
  const rows = page.getByTestId("memory-row");
  await expect(rows.first()).toBeVisible();
  const all = await rows.count();
  await page.getByTestId("kind-episode").click();
  await expect.poll(async () => rows.evaluateAll((els) => els.every((e) => (e as HTMLElement).dataset.kind === "episode"))).toBe(true);
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await page.getByLabel("Erinnerungen durchsuchen").fill("zzzgibtesnicht");
  await expect(page.getByText("Keine Erinnerungen mit diesen Filtern.")).toBeVisible();
  await page.getByLabel("Erinnerungen durchsuchen").fill("");
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(Math.min(all, 5));
  await rows.first().click();
  const detail = page.getByTestId("memory-detail");
  await expect(detail).toContainText("Wichtigkeit");
  await expect(detail).toContainText("Abrufe");
});

test("Wissen und Abrufe sind einsehbar", async ({ page, request }) => {
  // so lange weiter, bis Alex einen Abruf hatte: wann das ist, hängt vom Zähler des Fake-Modells ab, den das Zurücksetzen nicht zurückstellt
  for (let i = 0; i < 8; i++) {
    await post(request, "/api/sim/step", { n: 50 });
    if ((await (await request.get("/api/agents/alex/retrievals?limit=1")).json()).length) break;
  }
  await openApp(page);
  await page.getByTestId("open-insights").click();
  await page.getByTestId("open-memory").click();
  await page.getByRole("button", { name: "Was ich weiß" }).click();
  await expect(page.getByTestId("knowledge")).toContainText("Personen");
  await expect(page.getByTestId("knowledge")).toContainText("Bett (Alex)");
  await page.getByRole("button", { name: "Abrufe" }).click();
  await expect(page.getByTestId("retrievals")).toContainText("Entscheidung");
  await page.getByTestId("retrievals").getByRole("button").first().click();
  await expect(page.getByTestId("memory-detail")).toBeVisible();
});

test("Speichern und Abrufen leuchten am Agenten auf", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => page.locator("[data-tag][data-pulse]:not([data-pulse=''])").count(), { timeout: 45_000, intervals: [100] }).toBeGreaterThan(0);
  await post(request, "/api/sim/pause");
});

test("Das Agentendetail zeigt die letzten Erinnerungen und öffnet den Inspektor", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 30 });
  await openApp(page);
  await page.getByTestId("agent-card-mira").click();
  const drawer = page.getByTestId("drawer");
  await expect(drawer).toContainText("Erinnerungen");
  await drawer.getByRole("button", { name: "Gedächtnis öffnen" }).click();
  await expect(page.getByTestId("memory-inspector")).toBeVisible();
  expect((await state(request)).agents.length).toBe(2);
});
