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
  await post(req, "/api/sim/reset", { confirm: true, play_mode: "gott" });          // die Spielart Gott (AP18d): die Tests brauchen die Werkzeuge Ereignis und Gestalten
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
  const box = await figure(page, id).boundingBox();
  return box ? { x: Math.round(box.x), y: Math.round(box.y) } : null;
};

/** Die Figur auf dem Bild: ihr Schild draußen, drinnen (Haus von außen) ihr Bildnis auf dem Dach. */
export const figure = (page: Page, id: string) => page.locator(`[data-tag="${id}"]:visible, [data-chip="${id}"]:visible`).first();

/** Wo die Figur auf dem Bild steht, ohne Rücksicht auf die Breite ihres Schildes: das Schild selbst, im Haus die Dachmarke des Hauses (alle Bildnisse darauf zusammen). */
export const placeOf = (page: Page, id: string) => page.locator(`[data-tag="${id}"]:visible, [data-roof]:has([data-chip="${id}"]):visible`).first();

/** Ort der Figur als Punkt: draußen der Fußpunkt (unabhängig von der Breite des Schildes), im Haus die Mitte der Dachmarke. */
export async function whereIs(page: Page, id: string): Promise<[number, number]> {
  const tag = page.locator(`[data-tag="${id}"]:visible`);
  if (await tag.count()) { const v = await tag.first().getAttribute("data-foot"); if (v) return v.split(",").map(Number) as [number, number]; }
  const b = (await placeOf(page, id).boundingBox())!;
  return [b.x + b.width / 2, b.y];
}

/** Fußpunkt der Figur in Bildschirmpixeln, wie die Weltansicht ihn setzt (vor dem Ausweichen der Schilder), sobald die Kamera ruht. */
export async function settledFoot(page: Page, id: string) {
  const read = async () => { const v = await page.locator(`[data-tag="${id}"]`).getAttribute("data-foot"); return v ? (v.split(",").map(Number) as [number, number]) : null; };
  let last = "";
  await expect.poll(async () => { const p = await read(), now = p ? p.map(Math.round).join(",") : ""; const same = now !== "" && now === last; last = now; return same; }, { intervals: [200] }).toBe(true);
  return (await read())!;
}

/** Wartet, bis die Kamera ruht (Schild zweimal an derselben Stelle), und liefert die Fläche des Schildes (oder des Bildnisses auf dem Dach). */
export async function settledTag(page: Page, id: string) {
  const loc = figure(page, id);
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
  if (await page.getByTestId("gestalten").isVisible()) return page.getByTestId("view-menu");          // im Gestalten gibt es den Schalter in der oberen Leiste
  await openMenu(page);
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

/** Öffnet das Menü mit Esc; offene Ebenen (Detail, Einblick, Haus) nehmen jeweils selbst ein Esc, deshalb so lange, bis das Menü da ist. */
export async function openMenu(page: Page) {
  for (let i = 0; i < 6 && !(await page.getByTestId("start-menu").isVisible()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
  await expect(page.getByTestId("start-menu")).toBeVisible();
}

/** Menü › Einstellungen öffnen (es gibt keine Schublade mehr), optional gleich einen Bereich. */
export async function openSettingsMenu(page: Page, tab?: string) {
  await openMenu(page);
  await page.getByTestId("menu-settings").click();
  await expect(page.getByTestId("settings")).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab, exact: true }).click();
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

/** Eigene Figur wählen (Spielart Leben, AP18h): nur der Testserver kann das, bis der Assistent sie wählen lässt (c1). Danach neu laden. */
export async function setPlayer(req: APIRequestContext, agent: string | null) {
  await post(req, "/api/e2e/player", { agent });
}
