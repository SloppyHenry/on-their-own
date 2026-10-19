import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, openHouse, state } from "./helpers";

// Klang (AP17d): in Tests ist der Ton sonst aus (automatisierter Browser); hier ausdrücklich an, Abspielen ohne Geste erlaubt.
test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });
test.beforeEach(async ({ request, page }) => {
  await freshWorld(request);
  await page.addInitScript(() => { if (!localStorage.getItem("simulacra.ton")) localStorage.setItem("simulacra.ton", JSON.stringify({ an: true })); });
});

type Klang = { zustand(): string; laeuft: { musik: string; umgebung: string }; kanalPegel(c: string, ms?: number): Promise<number>; zaehler: Record<string, number> };
const errors = (page: Page) => { const e: string[] = []; page.on("pageerror", (x) => e.push(x.message)); page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("WebSocket")) e.push(m.text()); }); return e; };

test("Ton läuft: Musik und Umgebung nach Tageszeit, drinnen das eigene Lied, Ausschalten macht still", async ({ page }) => {
  const errs = errors(page);
  await openApp(page);
  await page.mouse.click(600, 200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.zustand())).toBe("running");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.laeuft.musik)).toContain("(Code)");        // CC0 ist vorerst aus: die Musik kommt aus dem Code
  expect(await page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.kanalPegel("amb", 1500))).toBeGreaterThan(-60);
  // ins Haus schauen: eigenes Lied, zurück: wieder die Musik zur Tageszeit
  await openHouse(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.laeuft.musik)).toContain("Stube");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.laeuft.musik)).not.toContain("Stube");
  await page.getByTestId("ton-toggle").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.zustand())).toBe("suspended");
  expect(errs).toEqual([]);
});

test("Einstellungen Ton: Lautstärke je Gerät, keine Einzelklänge und keine Quellenwahl (CC0 aus), Stimme je Bewohner einstellen; die Stimme gehört zur Welt (Spielstand)", async ({ page, request }) => {
  const errs = errors(page);
  await openApp(page);
  await page.getByTestId("open-settings").click();
  await page.getByRole("tab", { name: "Ton", exact: true }).click();
  await expect(page.getByTestId("ton-settings")).toBeVisible();
  await expect(page.getByTestId("ton-klaenge")).toHaveCount(0);                                // einzelne Klänge gehören später in den Sound-Generator
  await expect(page.getByTestId("ton-kanal-music").getByRole("button", { name: "CC0" })).toHaveCount(0);   // CC0 ist vorerst ausgeschaltet
  await expect.poll(() => page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.laeuft.musik)).toContain("(Code)");
  await page.getByTestId("ton-gesamt").fill("50");
  const alex = page.getByTestId("ton-stimme-alex");
  const slider = alex.getByRole("slider", { name: "Tonhöhe" });
  await slider.fill("250");
  await slider.dispatchEvent("pointerup");                                                    // Loslassen: Stimme geht an die Welt
  await expect(alex.getByText("250 Hz")).toBeVisible();
  await expect.poll(async () => (await state(request)).voices?.alex?.base).toBe(250);
  await alex.getByTestId("ton-sprich-alex").click();
  expect(await page.evaluate(() => (window as unknown as { __klang: Klang }).__klang.kanalPegel("voice", 1200))).toBeGreaterThan(-60);
  await page.reload();
  await page.getByTestId("open-settings").click();
  await page.getByRole("tab", { name: "Ton", exact: true }).click();
  await expect(page.getByTestId("ton-stimme-alex").getByText("250 Hz")).toBeVisible();       // aus der Welt
  await expect(page.getByTestId("ton-gesamt")).toHaveValue("50");                              // Mischpult: je Gerät
  await page.evaluate(() => localStorage.removeItem("simulacra.ton"));                        // auch ein anderer Browser hört dieselbe Stimme
  await page.reload();
  await page.getByTestId("open-settings").click();
  await page.getByRole("tab", { name: "Ton", exact: true }).click();
  await expect(page.getByTestId("ton-stimme-alex").getByText("250 Hz")).toBeVisible();
  await page.getByTestId("ton-standard-alex").click();
  await expect.poll(async () => (await state(request)).voices?.alex).toBeUndefined();
  expect(errs).toEqual([]);
});
