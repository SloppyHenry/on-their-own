import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

type Ansicht = { bridge: { commands: { punktCss(wx: number, wy: number): { x: number; y: number } | null; focusTile(x: number, y: number): void } }; host: HTMLElement };
type Fenster = { __welt: Ansicht };

/** Bildschirmposition (Seite) der Mitte einer Kachel, oder null, wenn sie nicht zu sehen ist. */
export const kachelPunkt = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const v = (window as unknown as Fenster).__welt, c = v.bridge.commands.punktCss((x + 0.5) * 16, (y + 0.5) * 16), r = v.host.getBoundingClientRect();
  return c && c.x > 140 && c.x < r.width - 360 && c.y > 80 && c.y < r.height - 20 ? { x: r.left + c.x, y: r.top + c.y } : null;
}, [x, y]);

/** Fährt die Kamera zur Kachel und wartet, bis sie ruht und die Kachel frei klickbar (nicht unter der Leiste) ist. */
export async function zuKachel(page: Page, x: number, y: number) {
  await page.evaluate(([x, y]) => (window as unknown as Fenster).__welt.bridge.commands.focusTile(x, y), [x, y]);
  let letzte = "";
  await expect.poll(async () => { const p = await kachelPunkt(page, x, y); const s = JSON.stringify(p); const ruhig = !!p && s === letzte; letzte = s; return ruhig; }, { timeout: 15_000, intervals: [250] }).toBe(true);
  return (await kachelPunkt(page, x, y))!;
}

export async function klickKachel(page: Page, x: number, y: number) {
  const p = await zuKachel(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}

/** Zeiger auf die Kachel stellen (ohne Klick) und warten, bis die Prüfung am Cursor geantwortet hat. */
export async function ueber(page: Page, x: number, y: number) {
  const p = await zuKachel(page, x, y);
  await page.mouse.move(p.x - 3, p.y);
  await page.mouse.move(p.x, p.y);
}

/** Eine freie Fläche aus Wiese (`.`) von b × h Kacheln mit einem freien Rand von `rand` Kacheln: linke obere Kachel. */
export function freieFlaeche(rows: string[], b: number, h: number, ab: [number, number] = [4, 4], rand = 3): [number, number] {
  for (let y = ab[1]; y < rows.length - h - rand; y++) for (let x = ab[0]; x < rows[0].length - b - rand; x++) {
    let frei = true;
    for (let j = -rand; j < h + rand && frei; j++) for (let i = -rand; i < b + rand; i++) if (rows[y + j][x + i] !== ".") { frei = false; break; }
    if (frei) return [x, y];
  }
  throw new Error(`Keine freie Fläche ${b} × ${h}`);
}

export async function leereWelt(request: APIRequestContext, name: string, size: "klein" | "mittel" | "gross" = "klein", startplatz = true) {
  const kopf = { "Idempotency-Key": randomUUID() };
  const info = await (await request.post("/api/worlds/blank", { data: { name, size, edge: "wald" }, headers: kopf })).json();
  if (startplatz) {
    const doc = await (await request.get(`/api/worlds/${info.id}`)).json();
    const [x, y] = freieFlaeche(doc.world.tiles, 1, 1, [8, 8]);
    doc.world.startplatz = [x, y];
    await request.put(`/api/worlds/${info.id}`, { data: { world: doc.world }, headers: { "Idempotency-Key": randomUUID() } });
  }
  return info as { id: string };
}

export const weltDatei = async (request: APIRequestContext, id: string) => (await (await request.get(`/api/worlds/${id}`)).json()).world;

export async function werkstattOeffnen(page: Page, id: string) {
  await page.goto("/?messen");
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await page.keyboard.press("Escape");
  await page.getByTestId("menu-editors").click();
  await page.getByTestId("editor-welten").click();
  await page.getByTestId(`welt-oeffnen-${id}`).click();
  await expect(page.getByTestId("werkstatt")).toBeVisible();
  await expect(page.getByTestId("world-pixels")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __welt?: unknown }).__welt)).toBe(true);
}
