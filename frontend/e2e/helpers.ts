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

/** Ansicht „Tiefe“ oder „Flach“ über den Schalter an der Welt. */
export async function setView(page: Page, name: "Tiefe" | "Flach") {
  const b = page.getByTestId("view-menu").getByRole("button", { name, exact: true });
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
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
