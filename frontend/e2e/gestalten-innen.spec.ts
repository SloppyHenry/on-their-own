import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, state } from "./helpers";
import { kachelPunkt } from "./gestalten-helfer";

/** Gestalten, Haus von innen einrichten (AP16c): Möbel, Wand, Teppich, Farben und Löschen im Puppenhaus; Übernehmen schreibt alles in die Welt. */
test.beforeEach(async ({ request }) => { await freshWorld(request); });

type Snap = { map: { rows: string[] }; objects: Record<string, { kind: string; x: number | null; y: number | null; name: string; id: string }>; look: { regions: { houses: { interior: { rect: number[]; rooms: Record<string, Record<string, string>>; wall: unknown[][]; rugs: unknown[][] } }[] }[] } };

/** Eine freie Bodenkachel im ersten Haus, nicht neben einer Tür und ohne Ding. */
async function freieKachel(request: Parameters<typeof state>[0], nr = 0): Promise<[number, number]> {
  const s = (await state(request)) as Snap, r = s.look.regions[0].houses[0].interior.rect, rows = s.map.rows;
  const belegt = new Set(Object.values(s.objects).filter((o) => o.x != null).map((o) => `${o.x},${o.y}`));
  const nahTuer = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => rows[y + b]?.[x + a] === "+");
  const frei: [number, number][] = [];
  for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (rows[y][x] === "_" && !belegt.has(`${x},${y}`) && !nahTuer(x, y)) frei.push([x, y]);
  return frei[nr];
}

async function insHaus(page: Page) {
  await openApp(page);
  await page.keyboard.press("b");
  await expect(page.getByTestId("gestalten-spiel")).toBeVisible();
  const marke = page.locator('[data-house="0"]');
  await expect.poll(async () => (await marke.boundingBox())?.width !== undefined).toBe(true);
  const b = (await marke.boundingBox())!;
  await page.mouse.click(b.x, b.y);
  await expect(page.getByTestId("werkzeug-moebel")).toBeVisible();                            // andere Werkzeuge: das Haus ist von innen offen
  await expect(page.getByTestId("nach-draussen")).toBeVisible();
}

async function klickIn(page: Page, t: [number, number]) {
  let p: { x: number; y: number } | null = null;
  await expect.poll(async () => { p = await kachelPunkt(page, t[0], t[1]); return p !== null; }, { timeout: 10_000 }).toBe(true);
  await page.mouse.move(p!.x - 2, p!.y);
  await page.mouse.move(p!.x, p!.y);
  await page.mouse.click(p!.x, p!.y);
}

test("Im Haus gibt es andere Werkzeuge; Esc geht erst nach draußen, dann erst aus dem Gestalten", async ({ page }) => {
  await insHaus(page);
  for (const t of ["zeiger", "moebel", "wand", "teppich", "farbe", "loeschen"]) await expect(page.getByTestId(`werkzeug-${t}`)).toBeVisible();
  await expect(page.getByTestId("werkzeug-weg")).toHaveCount(0);
  await page.getByTestId("werkzeug-moebel").click();
  await page.keyboard.press("Escape");                                                         // Werkzeug zurück
  await expect(page.getByTestId("werkzeug-zeiger")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");                                                         // aus dem Haus
  await expect(page.getByTestId("werkzeug-weg")).toBeVisible();
  await expect(page.getByTestId("gestalten-spiel")).toBeVisible();
  await page.keyboard.press("Escape");                                                         // erst jetzt aus dem Gestalten
  await expect(page.getByTestId("gestalten-spiel")).toHaveCount(0);
});

test("Möbel setzen, übernehmen: das Möbel ist ein Objekt der Welt; vor der Tür wird abgelehnt", async ({ page, request }) => {
  const t = await freieKachel(request);
  await insHaus(page);
  await page.getByTestId("werkzeug-moebel").click();
  await page.getByTestId("moebel-sofa").click();
  await klickIn(page, t);
  await expect(page.getByTestId("entwurf-0")).toContainText("Möbel: Sofa");
  await expect(page.getByTestId("uebernehmen")).toBeEnabled();
  await page.getByTestId("uebernehmen").click();
  await page.getByTestId("uebernehmen-ok").click();
  await expect(page.getByTestId("gestalten-fertig-hinweis")).toBeVisible();
  const s = (await state(request)) as Snap;
  expect(Object.values(s.objects).some((o) => o.kind === "sofa" && o.x === t[0] && o.y === t[1])).toBeTruthy();
});

test("Farben, Teppich und Wandschmuck: Entwurf, Übernehmen, Stil des Raums in der Welt", async ({ page, request }) => {
  const t = await freieKachel(request);
  const vorher = ((await state(request)) as Snap).look.regions[0].houses[0].interior;
  await insHaus(page);
  await page.getByTestId("werkzeug-farbe").click();
  await page.getByTestId("tapete-kacheln").click();
  await page.getByTestId("boden-parkett").click();
  await klickIn(page, t);
  await expect(page.getByTestId("entwurf-0")).toContainText("Farben im Raum");
  await page.getByTestId("werkzeug-teppich").click();
  await page.getByTestId("teppich-rosa").click();
  await klickIn(page, t);
  await expect(page.getByTestId("entwurf-1")).toContainText("Teppich");
  await expect(page.getByTestId("pruefung")).toBeVisible();
  await page.getByTestId("uebernehmen").click();
  await page.getByTestId("uebernehmen-ok").click();
  await expect(page.getByTestId("gestalten-fertig-hinweis")).toBeVisible();
  const nachher = ((await state(request)) as Snap).look.regions[0].houses[0].interior;
  expect(nachher.rugs.length).toBe(vorher.rugs.length + 1);
  expect(Object.values(nachher.rooms).some((r) => r.paper === "kacheln" && r.floor === "parkett")).toBeTruthy();
});

test("Löschen im Haus: ein neu gestelltes Möbel lässt sich im Entwurf wieder entfernen (Rückgängig)", async ({ page, request }) => {
  const t = await freieKachel(request);
  await insHaus(page);
  await page.getByTestId("werkzeug-moebel").click();
  await klickIn(page, t);
  await expect(page.getByTestId("entwurf-0")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("entwurf-0")).toHaveCount(0);
});
