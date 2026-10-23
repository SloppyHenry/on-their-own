import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp, post, setPlayer, state } from "./helpers";

/** Mitleben, Takt und Einrichten (AP18h-a3, c1): Schalter in den Einstellungen, Anhalten, wenn ich dran bin, Figur wechseln, Assistent „Das bist du“. */

test.beforeEach(async ({ request }) => { await freshWorld(request); await setPlayer(request, "alex"); });

/** Esc nimmt Ebene für Ebene zurück: erst die Innenansicht (die Kamera folgt deiner Figur ins Haus), dann öffnet sich das Menü. */
async function menuOeffnen(page: Page) {
  await expect(page.getByTestId("overlays")).toHaveAttribute("data-interior", "0");        // die Kamera ist Alex ins Haus gefolgt
  for (let i = 0; i < 4 && (await page.getByTestId("overlays").getAttribute("data-interior")) !== "-1"; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }   // Raum, Haus, Dorf
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("start-menu")).toBeVisible();
}

const takt = async (req: Parameters<typeof state>[0]) => (await req.get("/api/player/takt")).json();

test("Einstellungen › Spielart › Eigene Figur: Schalter, Frist und Wechseln mit Bestätigung", async ({ page, request }) => {
  await openApp(page);
  await menuOeffnen(page);
  await page.getByTestId("menu-settings").click();
  await page.getByRole("tab", { name: "Spielart" }).click();
  await expect(page.getByTestId("eigene-figur")).toBeVisible();
  await page.getByTestId("takt-hold").click();
  await expect.poll(async () => (await takt(request)).hold).toBe(true);
  await page.getByTestId("takt-auto").click();
  await page.getByTestId("takt-minuten").fill("9");
  await expect.poll(async () => { const t = await takt(request); return [t.auto, t.auto_minutes]; }).toEqual([true, 9]);
  await page.getByTestId("figur-wahl").selectOption("mira");
  await page.getByTestId("figur-wechseln").click();
  await expect(page.getByTestId("figur-frage")).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await takt(request)).player).toBe("alex");
  await page.getByTestId("figur-wechseln").click();
  await page.getByTestId("figur-frage-ja").click();
  await expect.poll(async () => (await takt(request)).player).toBe("mira");
});

test("Anhalten, wenn ich dran bin: Ansprache hält die Zeit an, Sagen setzt fort", async ({ page, request }) => {
  await post(request, "/api/sim/speed", { level: "1x" });
  await post(request, "/api/player/act", { action: "wait", params: {} }).catch(() => undefined);
  await request.put("/api/player/takt", { data: { hold: true }, headers: { "Idempotency-Key": "takt-hold-0001" } });
  await openApp(page);
  const r = await post(request, "/api/e2e/propose", { agent: "mira", action: "speak", params: { to: "alex", text: "Hast du kurz Zeit?" } });
  expect(r.ok, JSON.stringify(r)).toBe(true);
  await post(request, "/api/sim/start");
  await expect(page.getByTestId("banner-wartet")).toContainText("Alex ist dran");
  await expect.poll(async () => (await state(request)).simulation.state).toBe("paused");
  await page.getByTestId("sagenzeile").getByRole("textbox", { name: "Sagen" }).fill("Ja, gern.");
  await page.getByTestId("sagen-senden").click();
  await expect(page.getByTestId("banner-wartet")).toHaveCount(0);
  await expect.poll(async () => (await state(request)).simulation.state).toBe("running");
  await post(request, "/api/sim/pause");
});

test("Assistent: „Leben mit eigener Figur“ wählen, im Schritt Bewohner „Das bist du“", async ({ page }) => {
  await openApp(page);
  await menuOeffnen(page);
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-define").click();
  await page.getByTestId("spielart-eigene-figur").click();
  await expect(page.getByTestId("spielart-eigene-figur")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("schritt-2").click();
  await expect(page.getByTestId("bew-das-bist-du")).toBeVisible();
  await page.getByTestId("bew-ich-1").check();
  await page.getByTestId("schritt-5").click();
  await expect(page.getByTestId("start-uebersicht")).toContainText("Leben mit eigener Figur: du bist");
});
