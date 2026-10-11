import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, state, tagBox } from "./helpers";

test.beforeEach(async ({ request }) => { await freshWorld(request); });

test("Start: eine Figur bewegt sich sichtbar im Canvas (§17 Nr. 6)", async ({ page, request }) => {
  await openApp(page);
  await expect.poll(() => tagBox(page, "alex")).not.toBeNull();
  const before = { alex: await tagBox(page, "alex"), mira: await tagBox(page, "mira") };
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => JSON.stringify([await tagBox(page, "alex"), await tagBox(page, "mira")]), { timeout: 30_000 }).not.toBe(JSON.stringify([before.alex, before.mira]));
  await post(request, "/api/sim/pause");
});

test("Dialog erscheint als Sprechblase und als Protokolleintrag (§17 Nr. 5)", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Start" }).click();
  const bubble = page.locator("[data-testid^=bubble-]:visible").first();
  await expect(bubble).toBeVisible({ timeout: 30_000 });
  await expect(bubble).not.toHaveText("");
  const box = (await bubble.boundingBox())!, view = (await page.getByTestId("world-canvas").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(view.x);
  expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width);
  await expect(page.locator('[data-testid=timeline] [data-type="agent.dialogue"]').first()).toBeVisible();
  await post(request, "/api/sim/pause");
});

test("Pause hält an, Einzelschritt macht genau einen Tick (§17 Nr. 12)", async ({ page, request }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => (await state(request)).seq).toBeGreaterThan(20);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect.poll(async () => (await state(request)).simulation.state).toBe("paused");
  const a = await state(request);
  await page.waitForTimeout(1500);
  const b = await state(request);
  expect(b.seq).toBe(a.seq);
  expect(b.clock.minute).toBe(a.clock.minute);
  await page.getByRole("button", { name: "Einzelschritt" }).click();
  await expect.poll(async () => (await state(request)).clock.minute).toBe(a.clock.minute + 1);
  const c = await state(request);
  await page.waitForTimeout(500);
  expect((await state(request)).clock.minute).toBe(c.clock.minute);
});

test("Neu laden stellt Uhrzeit, Positionen und Protokoll wieder her (§17 Nr. 13)", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 30 });
  await openApp(page);
  await expect(page.getByTestId("clock")).toContainText("07:30");
  await expect.poll(() => tagBox(page, "alex")).not.toBeNull();
  const rows = () => page.locator("[data-testid=timeline] button[data-type]").evaluateAll((els) => els.slice(-6).map((e) => e.textContent));
  const before = { clock: await page.getByTestId("clock").textContent(), alex: await tagBox(page, "alex"), mira: await tagBox(page, "mira"), rows: await rows() };
  await page.reload();
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await expect(page.getByTestId("clock")).toHaveText(before.clock!);
  await expect.poll(async () => JSON.stringify(await rows())).toBe(JSON.stringify(before.rows));
  await expect.poll(() => tagBox(page, "alex")).toEqual(before.alex);
  expect(await tagBox(page, "mira")).toEqual(before.mira);
});

test("Verbindung kurz getrennt: „Verbinde neu“, danach vollständiger Stand", async ({ page, request }) => {
  let blocked = false;
  const sockets: { close: () => void }[] = [];
  await page.routeWebSocket(/\/ws$/, (ws) => {
    if (blocked) { void ws.close(); return; }
    const server = ws.connectToServer();
    sockets.push({ close: () => { void ws.close(); void server.close(); } });
  });
  await openApp(page);
  blocked = true;
  sockets.forEach((s) => s.close());
  await expect(page.getByTestId("conn")).toContainText("Verbinde neu");
  await post(request, "/api/sim/step", { n: 12 });
  blocked = false;
  await expect(page.getByTestId("conn")).toContainText("Verbunden", { timeout: 20_000 });
  const api = await state(request);
  await expect(page.getByTestId("clock")).toContainText(api.clock.time);
});

test("Zurücksetzen verlangt die Bestätigung durch Eingabe", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 15 });
  await openApp(page);
  await expect(page.getByTestId("clock")).toContainText("07:15");
  await page.getByRole("button", { name: /Zurücksetzen/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Zurücksetzen" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByTestId("clock")).toContainText("07:15");
  await page.getByRole("button", { name: /Zurücksetzen/ }).click();
  await dialog.getByRole("textbox").fill("zurücksetzen");
  await dialog.getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(page.getByTestId("clock")).toContainText("07:00");
});

test("Klick auf Agent und Ereignis öffnet Details mit echten Daten", async ({ page, request }) => {
  await post(request, "/api/sim/step", { n: 25 });
  await openApp(page);
  await page.getByTestId("agent-card-alex").click();
  const drawer = page.getByTestId("drawer");
  await expect(drawer).toContainText("Alex");
  await expect(drawer).toContainText("Bedürfnisse");
  await expect(drawer).toContainText("Letzte Entscheidungen");
  await drawer.getByRole("button", { name: "Schließen" }).first().click();
  await expect(drawer).toHaveCount(0);
  await page.locator('[data-testid=timeline] [data-type="agent.decision"]').first().click();
  await expect(drawer).toContainText("agent.decision");
  await expect(drawer).toContainText("Optionen");
  await expect(drawer).toContainText("Verursacht durch");
});

test("Tag und Nacht: abends ist die Welt sichtbar dunkler", async ({ page, request }) => {
  test.setTimeout(180_000);
  await post(request, "/api/sim/speed", { level: "max" });
  await openApp(page);
  const luminance = async () => {
    const buf = await page.locator("[data-testid=world-canvas]").screenshot();
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 40) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 40);
    }, buf.toString("base64"));
  };
  const day = await luminance();
  await post(request, "/api/sim/start");
  await expect.poll(async () => (await state(request)).clock.minute, { timeout: 150_000 }).toBeGreaterThan(21 * 60 + 30);
  await post(request, "/api/sim/pause");
  await expect(page.getByTestId("clock")).toContainText(/(2[1-3]|0[0-4]):/);
  await page.waitForTimeout(500);
  const night = await luminance();
  expect(night).toBeLessThan(day * 0.8);                       // Blick auf die erleuchteten Zimmer: die Welt außen ist deutlich dunkler
});
