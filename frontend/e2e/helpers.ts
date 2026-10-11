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
  await post(req, "/api/sim/speed", { level: "fast" });
}

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await expect(page.getByTestId("agent-card-alex")).toBeVisible();
  await expect(page.locator("[data-testid=world-canvas] canvas")).toBeVisible();
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
