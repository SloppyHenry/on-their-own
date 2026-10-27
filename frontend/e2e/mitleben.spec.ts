import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, post, setPlayer, state } from "./helpers";

/** Mitleben, Teil b1 (AP18h): eigene Figur mit Ring, Kamera folgt, Handlungsleiste, Klick geht (`move_to`), Ablehnung der Welt, Abbrechen. */

test.beforeEach(async ({ request }) => { await freshWorld(request); });

type Welt = { tileCss(x: number, y: number): { x: number; y: number } };

/** Bildschirmpunkt einer Kachel, sobald die Kamera ruht. */
async function tilePoint(page: Page, x: number, y: number) {
  const canvas = (await page.getByTestId("world-pixels").boundingBox())!;
  let last = "", pt = { x: 0, y: 0 };
  await expect.poll(async () => {
    pt = await page.evaluate(([a, b]) => (window as unknown as { __welt: Welt }).__welt.tileCss(a, b), [x, y]);
    const now = `${Math.round(pt.x)},${Math.round(pt.y)}`, same = now === last; last = now; return same;
  }, { intervals: [250] }).toBe(true);
  return { x: canvas.x + pt.x, y: canvas.y + pt.y };
}

/** Eine freie, begehbare Kachel am See (nichts darauf, das den Klick zur Auswahl macht), erreichbar vom Platz aus. */
async function shore(page: Page, req: Parameters<typeof state>[0]) {
  const s = await state(req), lake = s.locations.find((l: { id: string }) => l.id === "lake").rect as number[];
  const walkable = (x: number, y: number) => s.tile_types[s.map.legend[s.map.rows[y][x]]]?.walkable;
  for (let x = lake[0]; x < lake[0] + lake[2]; x++) for (let y = lake[1] + lake[3] - 1; y >= lake[1]; y--) {
    if (!walkable(x, y)) continue;
    const free = await page.evaluate(([a, b]) => { const v = (window as unknown as { __welt: { tileCss(x: number, y: number): { x: number; y: number }; targetAt(x: number, y: number): unknown; dpr: number } }).__welt, q = v.tileCss(a, b); return v.targetAt(q.x * v.dpr, q.y * v.dpr) === null; }, [x, y]);
    if (free) return [x, y];
  }
  throw new Error("kein freies Ufer");
}

async function startAsAlexOnSquare(page: Page, request: Parameters<typeof state>[0]) {
  await post(request, "/api/e2e/place", { agent: "alex", x: 12, y: 13 });
  await setPlayer(request, "alex");
  await page.goto("/");
  await openApp(page);
}

test("Ohne eigene Figur gibt es weder Leiste noch Ring noch Plakette", async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId("handlungsleiste")).toHaveCount(0);
  await expect(page.getByTestId("plakette")).toHaveCount(0);
  await expect(page.getByTestId("player-layer")).toHaveCount(0);
});

test("Leiste, Plakette „wartet“, Kamera folgt der Figur; die Vorschau ist weg", async ({ page, request }) => {
  await startAsAlexOnSquare(page, request);
  await expect(page.getByTestId("handlungsleiste")).toBeVisible();
  await expect(page.getByTestId("handlungsleiste")).toContainText("Gehen");
  await expect(page.getByTestId("plakette-folgt")).toContainText("Kamera folgt Alex");
  await expect(page.getByTestId("plakette-takt")).toContainText("Alex wartet");
  await expect(page.getByText("Mitspieler-Vorschau")).toHaveCount(0);
  await page.keyboard.press("f");                                          // F schaltet das Folgen um
  await expect(page.getByTestId("plakette-folgt")).toHaveCount(0);
  await page.keyboard.press("f");
  await expect(page.getByTestId("plakette-folgt")).toBeVisible();
});

test("Klick auf das Ufer: Figur geht hin, Band mit Abbrechen, am Ziel wartet sie wieder", async ({ page, request }) => {
  await startAsAlexOnSquare(page, request);
  const [tx, ty] = await shore(page, request);
  const writes: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/api/player/")) writes.push(r.postData() ?? ""); });
  const p = await tilePoint(page, tx, ty);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("band")).toContainText("Alex");
  await expect(page.getByTestId("band")).toContainText(/noch \d+ Min\./);
  await expect(page.getByTestId("abbrechen")).toBeVisible();
  expect(writes.some((w) => w.includes('"move_to"') && w.includes(`[${tx},${ty}]`))).toBe(true);
  await expect.poll(async () => {                                          // die Zeit läuft: Alex geht den Weg
    await post(request, "/api/sim/step", { n: 50 });
    const a = (await state(request)).agents.find((q: { id: string }) => q.id === "alex");
    return a.x === tx && a.y === ty;
  }, { timeout: 60_000 }).toBe(true);
  await expect(page.getByTestId("band")).toHaveCount(0);
  await expect(page.getByTestId("plakette-takt")).toContainText("Alex wartet");
});

test("Abbrechen unterbricht die Handlung, die Figur bleibt unterwegs stehen", async ({ page, request }) => {
  await startAsAlexOnSquare(page, request);
  const [tx, ty] = await shore(page, request);
  const p = await tilePoint(page, tx, ty);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("band")).toBeVisible();
  await page.getByTestId("abbrechen").click();
  await expect(page.getByTestId("band")).toHaveCount(0);
  const a = (await state(request)).agents.find((q: { id: string }) => q.id === "alex");
  expect(a.action).toBeNull();
  const events = await (await request.get("/api/events?limit=20")).json();
  expect(JSON.stringify(events)).toContain("agent.action_interrupted");
});

test("Die Welt sagt nein: Ablehnungstext als Blase über der Figur, drei Sekunden", async ({ page, request }) => {
  await startAsAlexOnSquare(page, request);
  const s = await state(request);
  const water = (() => { for (let y = 0; y < s.map.rows.length; y++) for (let x = 0; x < s.map.rows[y].length; x++) if (!s.tile_types[s.map.legend[s.map.rows[y][x]]]?.walkable) return [x, y]; return null; })()!;
  const p = await tilePoint(page, water[0], water[1]);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("player-reject")).toBeVisible();
  await expect(page.getByTestId("player-reject")).not.toBeEmpty();
  await expect(page.getByTestId("player-reject")).toBeHidden({ timeout: 6_000 });
});
