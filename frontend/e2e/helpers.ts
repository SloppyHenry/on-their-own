import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const post = async (req: APIRequestContext, path: string, body: unknown = {}) => {
  const res = await req.post(path, { data: body, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), `${path}: ${res.status()}`).toBeTruthy();
  return res.json();
};

export const state = async (req: APIRequestContext) => (await req.get("/api/state")).json();

/** Jeder Test beginnt mit derselben frischen Welt (Mira und Alex im selben Zimmer), angehalten. */
export async function freshWorld(req: APIRequestContext) {
  await post(req, "/api/sim/reset", { confirm: true });
  await post(req, "/api/params/reset");                   // Einstellungen überleben das Zurücksetzen der Welt: Tests starten mit den Standardwerten
  await post(req, "/api/sim/speed", { level: "4x" });
}

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await expect(page.getByTestId("agent-card-alex")).toBeVisible();
  await expect(page.getByTestId("world-pixels")).toBeVisible();
}

export const tagBox = async (page: Page, id: string) => {
  const box = await page.locator(`[data-tag="${id}"]`).boundingBox();
  return box ? { x: Math.round(box.x), y: Math.round(box.y) } : null;
};

/** Wartet, bis die Kamera ruht (Schild zweimal an derselben Stelle), und liefert die Fläche des Schildes. */
export async function settledTag(page: Page, id: string) {
  const loc = page.locator(`[data-tag="${id}"]`);
  let last = "";
  await expect.poll(async () => {
    const b = await loc.boundingBox();
    const now = b ? `${Math.round(b.x)},${Math.round(b.y)}` : "";
    const same = now !== "" && now === last;
    last = now;
    return same;
  }, { intervals: [200] }).toBe(true);
  return (await loc.boundingBox())!;
}

/** Viele Einzelschritte in Paketen (die API erlaubt je Aufruf nur eine begrenzte Zahl). */
export async function steps(req: APIRequestContext, n: number) {
  for (let left = n; left > 0; left -= 50) await post(req, "/api/sim/step", { n: Math.min(50, left) });
}

/** Wartet, bis ein Element zweimal an derselben Stelle steht (Kamerafahrt beendet), und liefert seine Fläche. */
export async function settled(page: Page, selector: string) {
  const loc = page.locator(selector).first();
  let last = "";
  await expect.poll(async () => {
    const b = await loc.boundingBox();
    const now = b ? `${Math.round(b.x)},${Math.round(b.y)}` : "";
    const same = now !== "" && now === last;
    last = now;
    return same;
  }, { intervals: [200] }).toBe(true);
  return (await loc.boundingBox())!;
}

/** Klick aufs Haus: die Kamera fährt hinein, die Innenansicht zeigt Räume und Figuren (Frage 18). */
export async function openHouse(page: Page) {
  const m = await settled(page, '[data-house="0"]');
  await page.mouse.click(m.x, m.y);
  await expect(page.getByTestId("leave-house")).toBeVisible();
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");
}

/** Das Tagebuch (Protokoll) öffnen, falls es nicht schon offen ist. „bewohner“ und „ansicht“ gibt es seit AP18b nicht mehr als Reiter: die Bewohner stehen immer im HUD. */
export async function showTab(page: Page, tab: "bewohner" | "protokoll" | "ansicht") {
  if (tab !== "protokoll") return;
  if (!(await page.getByTestId("tagebuch").isVisible())) await page.getByTestId("einblick-tagebuch").click();
  await expect(page.getByTestId("tagebuch")).toBeVisible();
}

/** Einstellungen › Darstellung öffnen (Menü); wer fertig ist, schließt das Menü mit Esc. */
export async function viewMenu(page: Page) {
  if (await page.getByTestId("editor-panel").isVisible()) return page.getByTestId("view-menu");          // im Welteditor gibt es den Schalter in der Werkzeugleiste
  if (!(await page.getByTestId("start-menu").isVisible())) await page.keyboard.press("Escape");
  await page.getByTestId("menu-settings").click();
  await page.getByRole("tab", { name: "Darstellung" }).click();
  return page.getByTestId("view-menu");
}

/** Ansicht „Tiefe“ oder „Flach“ (Einstellungen › Darstellung), danach zurück ins Spiel. */
export async function setView(page: Page, name: "Tiefe" | "Flach") {
  const b = (await viewMenu(page)).getByRole("button", { name, exact: true });
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
  await closeMenu(page);
}

/** Welche Ansicht gerade gilt (öffnet und schließt das Menü). */
export async function expectView(page: Page, name: "Tiefe" | "Flach") {
  await expect((await viewMenu(page)).getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await closeMenu(page);
}

export async function closeMenu(page: Page) {
  if (!(await page.getByTestId("start-menu").isVisible())) return;
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
}

/** Ereigniseingabe (Gott-Werkzeug) öffnen. */
export async function openComposer(page: Page) {
  if (!(await page.getByTestId("composer").isVisible())) await page.getByTestId("werkzeug-ereignis").click();
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/** Klick auf die Figur selbst: das Schild steht unter den Füßen, die Figur darüber. */
export async function clickFigure(page: Page, id: string) {
  const tag = await settledTag(page, id);
  await page.mouse.click(tag.x + tag.width / 2, tag.y - 22);
}

/** Versetzt einen Agenten per Eingriff an einen Ort (z. B. hinaus ins Dorf); danach wieder Beobachtermodus. */
export async function moveAgent(req: APIRequestContext, sentence: string) {
  const patch = (value: string) => req.patch("/api/params", { data: { changes: [{ key: "mode", value }] }, headers: { "Idempotency-Key": randomUUID() } });
  expect((await patch("intervention")).ok()).toBeTruthy();
  const p = await post(req, "/api/inject/parse", { text: sentence });
  expect(["ready", "needs_confirmation"], JSON.stringify(p)).toContain(p.status);
  expect((await post(req, "/api/inject/confirm", { proposal_id: p.id })).status).toBe("executed");
  expect((await patch("observer")).ok()).toBeTruthy();
}

/** Mitspieler-Vorschau ein- oder ausschalten (Einstellungen › Darstellung), danach zurück ins Spiel. */
export async function setPlayer(page: Page, on: boolean) {
  const box = (await viewMenu(page)).getByTestId("player-toggle");
  await (on ? box.check() : box.uncheck());
  await closeMenu(page);
}
