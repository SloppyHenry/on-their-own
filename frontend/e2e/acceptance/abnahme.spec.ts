import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, post, settledTag, state, steps, tagBox } from "../helpers";

/** Abnahme (§17, AP11): je Kriterium mit Browseranteil ein benannter Test. Die Backend-Seite steht in backend/tests/acceptance/. */

interface Seen { type: string; agents: string[]; data: Record<string, unknown>; seq: number; at: number }

/** Liest jedes Ereignis mit, das der Browser über den WebSocket bekommt, mit dem Zeitpunkt des Empfangs. */
function watchEvents(page: Page): Seen[] {
  const seen: Seen[] = [];
  page.on("websocket", (ws) => ws.on("framereceived", ({ payload }) => {
    const m = JSON.parse(String(payload));
    const items = m.type === "event" ? [m.event] : m.type === "events" ? m.items : [];
    for (const e of items) seen.push({ type: e.type, agents: e.agents, data: e.data, seq: e.seq, at: Date.now() });
  }));
  return seen;
}

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("K01 zwei Agenten in einer Welt: beide mit Position im Zustand und als Figur im Canvas", async ({ page, request }) => {
  const s = await state(request);
  expect(s.agents.map((a: { id: string }) => a.id).sort()).toEqual(["alex", "mira"]);
  for (const a of s.agents) expect(Number.isInteger(a.x) && Number.isInteger(a.y) && typeof a.location_id === "string").toBeTruthy();
  await openApp(page);
  for (const id of ["alex", "mira"]) {
    await expect(page.locator(`[data-tag="${id}"]`)).toBeVisible();
    await expect(page.getByTestId(`agent-card-${id}`)).toBeVisible();
  }
});

test("K05 Dialoge live: Sprechblase und Protokollzeile binnen 2 s nach dem Ereignis", async ({ page, request }) => {
  const seen = watchEvents(page);
  await openApp(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(() => seen.some((e) => e.type === "agent.dialogue"), { timeout: 45_000 }).toBe(true);
  const ev = seen.find((e) => e.type === "agent.dialogue")!;
  const bubble = page.locator(`[data-bubble="${ev.data.speaker}"]`);
  await expect(bubble).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('[data-testid=timeline] [data-type="agent.dialogue"]').first()).toBeVisible({ timeout: 2_000 });
  expect(Date.now() - ev.at).toBeLessThan(2_000 + 500);                // Puffer nur für die Prüfaufrufe selbst
  await post(request, "/api/sim/pause");
});

test("K06 Ortswechsel sichtbar: die Figur folgt dem Fahrplan aus agent.walking", async ({ page, request }) => {
  test.setTimeout(120_000);
  const seen = watchEvents(page);
  await openApp(page);
  await page.keyboard.press("0");                                      // ganze Welt, die Kamera bleibt stehen
  await page.getByRole("button", { name: "Start" }).click();
  // ein Weg von mindestens drei Kacheln, damit die Richtung auf dem Bildschirm eindeutig ist
  const walk = () => seen.find((e) => e.type === "agent.walking" && (e.data.path as number[][]).length >= 3);
  await expect.poll(() => Boolean(walk()), { timeout: 60_000 }).toBe(true);
  const w = walk()!, id = w.agents[0];
  await post(request, "/api/sim/pause");
  const from = w.data.from as number[], path = w.data.path as number[][], arrive = w.data.arrive as number[];
  const start = await settledTag(page, id);
  // bis zur Ankunft weiterlaufen, dann anhalten: Figur und Engine stehen auf der letzten Kachel
  const s0 = await state(request);
  const left = arrive[arrive.length - 1] - s0.clock.minute;
  if (left > 0) await steps(request, left);
  const s1 = await state(request);
  const body = s1.agents.find((a: { id: string }) => a.id === id);
  const end = path[path.length - 1];
  if (!seen.some((e) => e.type === "agent.walking" && e.agents[0] === id && e.seq > w.seq)) {   // kein neuer Fahrplan dazwischen
    expect([body.x, body.y]).toEqual(end);
  }
  const target = [body.x, body.y], stop = await settledTag(page, id);
  const dx = target[0] - from[0], dy = target[1] - from[1];
  const sx = stop.x - start.x, sy = stop.y - start.y;
  expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
  if (dx !== 0) expect(Math.sign(sx)).toBe(Math.sign(dx));             // Bildschirmrichtung = Kachelrichtung
  if (dy !== 0) expect(Math.sign(sy)).toBe(Math.sign(dy));
  if (dx !== 0 && dy !== 0) expect(Math.abs(sx / dx / (sy / dy) - 1)).toBeLessThan(0.35);   // gleicher Maßstab in beiden Achsen
});

test("K12 Pause, Fortsetzen und Einzelschritt über die Bedienleiste", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => (await state(request)).simulation.state).toBe("running");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect.poll(async () => (await state(request)).simulation.state).toBe("paused");
  const a = await state(request);
  await page.waitForTimeout(1_200);
  expect((await state(request)).clock.minute).toBe(a.clock.minute);
  await page.getByRole("button", { name: "Einzelschritt" }).click();
  await expect.poll(async () => (await state(request)).clock.minute).toBe(a.clock.minute + 1);
  await expect(page.getByTestId("clock")).toContainText((await state(request)).clock.time);
  await page.getByRole("button", { name: "Fortsetzen" }).click();
  await expect.poll(async () => (await state(request)).clock.minute).toBeGreaterThan(a.clock.minute + 2);
  await post(request, "/api/sim/pause");
});

test("K13 Neu laden stellt den Zustand her, auch mitten auf einem Weg", async ({ page, request }) => {
  test.setTimeout(120_000);
  await openApp(page);
  await page.keyboard.press("0");
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => (await state(request)).agents.some((a: { walk: unknown }) => a.walk), { timeout: 60_000, intervals: [100] }).toBe(true);
  await post(request, "/api/sim/pause");
  const s = await state(request);
  const rows = () => page.locator("[data-testid=timeline] button[data-type]").evaluateAll((els) => els.slice(-8).map((e) => e.textContent));
  const before = { clock: await page.getByTestId("clock").textContent(), alex: await settledTag(page, "alex"), mira: await settledTag(page, "mira"), rows: await rows() };
  await page.reload();
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await page.keyboard.press("0");
  await expect(page.getByTestId("clock")).toHaveText(before.clock!);
  await expect.poll(async () => JSON.stringify(await rows())).toBe(JSON.stringify(before.rows));
  for (const id of ["alex", "mira"] as const) {
    const b = before[id], a = await settledTag(page, id);
    expect(Math.abs(a.x + a.width / 2 - (b.x + b.width / 2)) + Math.abs(a.y - b.y)).toBeLessThan(3);   // Mitte: das Abzeichen „gemerkt“ verbreitert das Schild nur kurz
  }
  expect((await state(request)).agents).toEqual(s.agents);
  expect(await tagBox(page, "alex")).not.toBeNull();
});
