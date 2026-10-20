import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, showTab } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Agentenübersicht zeigt Ziel, Stimmung und Bedürfnisse aus den echten Daten", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 30 });
  await openApp(page);
  await page.getByTestId("agent-card-alex").click();                       // Bewohner-Karte (Überblick): Ziel, Stimmung und Bedürfnisse
  const goal = page.getByTestId("goal-line-alex");
  await expect(goal).toBeVisible();
  await expect(goal).toContainText("gehen und sich umsehen");
  await expect(page.getByTestId("mood-alex")).toHaveAttribute("title", "Stimmung");
  const bars = page.getByTestId("drawer").getByTestId("needs");
  await expect(bars.locator("[data-need]")).toHaveCount(5);              // Energie, Sattheit, Wasser, Gesellschaft, Ruhe (Wärme ist aus)
  const api = await (await request.get("/api/overview")).json();
  expect(api[0].goal.text).toContain("gehen und sich umsehen");
});

test("Agenten-Detail: Ziele mit Plan, Beziehung, Fehlschläge und „Warum?“ aus echten Daten", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 50 });
  await openApp(page);
  await page.getByTestId("agent-card-alex").click();
  const drawer = page.getByTestId("drawer");
  await expect(drawer.getByTestId("mood-detail")).toContainText("Stimmung:");
  await drawer.getByTestId("karte-ziele").click();
  await expect(drawer.getByTestId("current-goal")).toContainText("Erfüllt, wenn:");
  await expect(drawer.getByTestId("goals")).toContainText("etwas Bleibendes bauen");
  await drawer.getByTestId("karte-beziehungen").click();
  await expect(drawer.getByTestId("relations")).toContainText("Mira");
  await expect(drawer.getByTestId("relations").locator("[data-metric]")).toHaveCount(4);
  await drawer.getByTestId("karte-fehlschlaege").click();
  await expect(drawer.getByTestId("failures")).toBeVisible();
  await drawer.getByTestId("karte-entscheidungen").click();
  await drawer.getByRole("button", { name: /Warum\?/ }).first().click();
  const why = drawer.getByTestId("why");
  await expect(why).toContainText("entscheidet sich für");
  const text = (await why.textContent())!;
  const dec = (await (await request.get("/api/agents/alex/decisions?limit=8")).json()) as { why: string }[];
  expect(dec.some((d) => d.why === text)).toBe(true);                      // deckt sich mit den Rohdaten
  await expect(drawer.getByTestId("factor-bars")).toBeVisible();
});

test("Protokoll: „Warum?“ klappt Erklärung und Faktoren auf, Filter „Fehlschläge“ zeigt nur Fehlschläge", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 40 });
  await openApp(page);
  await showTab(page, "protokoll");
  const timeline = page.getByTestId("timeline");
  await timeline.getByRole("button", { name: "Warum?" }).first().click();
  const box = page.getByTestId("why-box").first();
  await expect(box).toContainText("entscheidet sich für");
  await expect(box.getByTestId("factor-bars")).toBeVisible();
  await page.getByTestId("filter-failures").click();
  const rows = timeline.locator("button[data-type]");
  await expect.poll(async () => rows.evaluateAll((els) => els.every((e) => ["agent.action_failed", "agent.action_rejected", "agent.decision_failed", "agent.guard_triggered"].includes((e as HTMLElement).dataset.type!)))).toBe(true);
});

test("Entscheidungsdetail im Ereignis zeigt Optionen mit Faktoren und das aktive Ziel", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 40 });
  await openApp(page);
  await showTab(page, "protokoll");
  await page.locator('[data-testid=timeline] [data-type="agent.decision"]').first().click();
  const drawer = page.getByTestId("drawer");
  await expect(drawer.getByTestId("decision-detail")).toContainText("Optionen (Punkte)");
  await expect(drawer.getByTestId("why")).toContainText("entscheidet sich für");
  await expect(drawer.getByTestId("factor-bars")).toContainText("Grundneigung");
});

test("Zielwechsel und Beziehungsänderungen erscheinen im Protokoll mit Grund", async ({ page, request }) => {
  await post(request, "/api/sim/speed", { level: "max" });
  await post(request, "/api/sim/step", { n: 50 });
  await post(request, "/api/sim/step", { n: 50 });
  await openApp(page);
  await showTab(page, "protokoll");
  await page.getByLabel("Protokoll durchsuchen").fill("Ziel «");
  await expect(page.locator('[data-testid=timeline] button[data-type="agent.goal_changed"]').first()).toBeVisible();
  const first = await page.locator('[data-testid=timeline] button[data-type="agent.goal_changed"]').first().textContent();
  expect(first).toMatch(/Ziel «.*» (gesetzt|erreicht|aufgegeben|ersetzt)/);
});
