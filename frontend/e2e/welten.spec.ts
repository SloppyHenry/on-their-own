import { expect, test, type Page } from "@playwright/test";
import { freshWorld, openApp } from "./helpers";

/** Weltenbibliothek und Welt-Werkstatt (AP18e): leere Welt, Werkstatt mit Startplatz, Speichern, Rückweg mit Esc, „Damit spielen“. */
test.beforeEach(async ({ request }) => {
  await freshWorld(request);
  for (const w of await (await request.get("/api/worlds")).json()) if (!w.readonly) await request.delete(`/api/worlds/${w.id}`);
});

const esc = (page: Page) => page.keyboard.press("Escape");

async function zuWelten(page: Page) {
  await openApp(page);
  await esc(page);
  await page.getByTestId("menu-editors").click();
  await page.getByTestId("editor-welten").click();
  await expect(page.getByTestId("welten-pane")).toBeVisible();
}

async function leereWeltAnlegen(page: Page, name: string) {
  await page.getByTestId("welt-leer").click();
  await page.getByTestId("leer-name").fill(name);
  await page.getByTestId("leer-groesse-klein").click();
  await page.getByTestId("leer-anlegen").click();
  await expect(page.getByTestId("welten-liste")).toBeVisible();
}

test("Die Bibliothek zeigt die mitgelieferten Welten schreibgeschützt; Esc geht zu Editoren zurück", async ({ page }) => {
  await zuWelten(page);
  await expect(page.getByTestId("welt-dorf-am-see")).toContainText("mitgeliefert");
  await expect(page.getByTestId("welt-oeffnen-dorf-am-see")).toHaveText("Kopie bearbeiten");
  await expect(page.getByTestId("welt-del-dorf-am-see")).toHaveCount(0);
  await expect(page.getByTestId("esc-hinweis")).toContainText("zurück zu Editoren");
  await esc(page);
  await expect(page.getByTestId("editor-welten")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
});

test("Leere Welt anlegen, in der Werkstatt den Startplatz setzen, speichern; Esc führt zur Bibliothek zurück", async ({ page, request }) => {
  await zuWelten(page);
  await leereWeltAnlegen(page, "Testwiese");
  await expect(page.getByTestId("welt-testwiese")).toContainText("ohne Startplatz");
  await page.getByTestId("welt-oeffnen-testwiese").click();
  await expect(page.getByTestId("werkstatt")).toBeVisible();
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
  await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
  await expect(page.getByTestId("werkstatt-spielen")).toBeDisabled();                         // ohne Startplatz nicht startbar
  await page.getByTestId("werkzeug-startplatz").click();
  const welt = page.getByTestId("world-canvas");
  await expect(welt).toBeVisible();
  await expect.poll(async () => (await welt.boundingBox())?.width ?? 0).toBeGreaterThan(300);
  const box = (await welt.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("werkstatt-startplatz")).not.toHaveText("keiner");
  await expect(page.getByTestId("werkstatt-stand")).toHaveText("● ungespeichert");
  await expect(page.getByTestId("werkstatt-marke")).toBeVisible();
  await page.getByTestId("werkstatt-speichern").click();
  await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
  const ws = await (await request.get("/api/worlds")).json();
  expect(ws.find((w: { id: string }) => w.id === "testwiese").startplatz).toBe(true);
  await expect(page.getByTestId("werkstatt-spielen")).toBeEnabled();

  await esc(page);                                                                            // gespeichert: ohne Rückfrage zur Bibliothek
  await expect(page.getByTestId("werkstatt")).toHaveCount(0);
  await expect(page.getByTestId("welten-pane")).toBeVisible();
  await expect(page.getByTestId("welt-testwiese")).toContainText("mit Startplatz");
});

test("Ungespeichert: Esc fragt nach, Esc in der Frage heißt „weiter bearbeiten“", async ({ page }) => {
  await zuWelten(page);
  await leereWeltAnlegen(page, "Entwurf");
  await page.getByTestId("welt-oeffnen-entwurf").click();
  await page.getByTestId("werkstatt-name").fill("Neuer Name");
  await expect(page.getByTestId("werkstatt-stand")).toHaveText("● ungespeichert");
  await esc(page);                                                                            // erstes Esc nimmt dem Namensfeld den Fokus
  await esc(page);
  await expect(page.getByTestId("werkstatt-rueckfrage")).toBeVisible();
  await esc(page);
  await expect(page.getByTestId("werkstatt-rueckfrage")).toHaveCount(0);
  await expect(page.getByTestId("werkstatt")).toBeVisible();
  await esc(page);
  await page.getByTestId("werkstatt-rueckfrage-ja").click();                                  // verwerfen und gehen
  await expect(page.getByTestId("welten-pane")).toBeVisible();
  await expect(page.getByTestId("welt-entwurf")).toBeVisible();                               // der alte Name steht noch
});

test("Duplizieren, Umbenennen, Löschen mit Rückfrage und Welt aus der Simulation sichern", async ({ page }) => {
  await zuWelten(page);
  await leereWeltAnlegen(page, "Original");
  await page.getByTestId("welt-dupl-original").click();
  await expect(page.getByTestId("welt-original-kopie")).toContainText("Kopie");
  await page.getByTestId("welt-name-original-kopie").click();
  await page.getByTestId("welt-umbenennen-name").fill("Zweite Wiese");
  await page.getByTestId("welt-umbenennen-ok").click();
  await expect(page.getByTestId("welt-original-kopie")).toContainText("Zweite Wiese");            // die Kennung bleibt, der Name ändert sich
  await page.getByTestId("welt-del-original-kopie").click();
  await page.getByTestId("welt-loeschen-nein").click();
  await expect(page.getByTestId("welt-original-kopie")).toBeVisible();
  await page.getByTestId("welt-del-original-kopie").click();
  await page.getByTestId("welt-loeschen-ja").click();
  await expect(page.getByTestId("welt-original-kopie")).toHaveCount(0);
  await page.getByTestId("welt-sichern").click();
  await page.getByTestId("welt-sichern-dialog-ok").click();
  await expect(page.getByTestId("welt-gesicherte-welt")).toContainText("aus Simulation");
});

test("Zufallswelt: Vorschau, Stellgrößen und vier Pläne; „In die Bibliothek legen“ ohne Bewohner", async ({ page, request }) => {
  await zuWelten(page);
  await page.getByTestId("welt-erzeugen").click();
  await expect(page.getByTestId("vorschau-pixels")).toBeVisible();
  await page.getByTestId("erzeugen-seed").fill("12");
  await page.getByTestId("stell-form-beidseitig").click();
  await page.getByTestId("erzeugen-name").fill("Zwei Seiten");
  await expect(page.getByTestId("plan-0")).toBeVisible();
  await page.getByTestId("erzeugen-anlegen").click();
  await expect(page.getByTestId("welten-liste")).toBeVisible();
  const card = page.getByTestId("welt-zwei-seiten");
  await expect(card).toContainText("erzeugt");
  const doc = await (await request.get("/api/worlds/zwei-seiten")).json();
  expect(doc.world.agents).toEqual([]);
  expect(doc.world.generator.stil.form).toBe("beidseitig");
});

test("Zufallswelt: die Dorfform beginnt bei „Nach Zufall“, Anger, Fluss quer und Streusiedlung lassen sich wählen", async ({ page, request }) => {
  await zuWelten(page);
  await page.getByTestId("welt-erzeugen").click();
  await expect(page.getByTestId("stell-form-zufall")).toHaveAttribute("aria-pressed", "true");
  for (const f of ["anger", "fluss", "streu"]) {
    await page.getByTestId(`stell-form-${f}`).click();
    await expect(page.getByTestId(`stell-form-${f}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("vorschau-pixels")).toBeVisible({ timeout: 20_000 });          // die Vorschau wird nach jeder Änderung neu erzeugt
  }
  await page.getByTestId("erzeugen-name").fill("Streuhof");
  await page.getByTestId("erzeugen-anlegen").click();
  await expect(page.getByTestId("welt-streuhof")).toContainText("erzeugt");
  expect((await (await request.get("/api/worlds/streuhof")).json()).world.generator.stil.form).toBe("streu");
});

test("Damit spielen: Neue Simulation › Selbst definieren mit dieser Welt vorgewählt", async ({ page, request }) => {
  const info = await (await request.post("/api/worlds/blank", { data: { name: "Spielwiese", size: "klein", edge: "wald" }, headers: { "Idempotency-Key": crypto.randomUUID() } })).json();
  const doc = await (await request.get(`/api/worlds/${info.id}`)).json();
  doc.world.startplatz = [24, 16];
  await request.put(`/api/worlds/${info.id}`, { data: { world: doc.world }, headers: { "Idempotency-Key": crypto.randomUUID() } });
  await zuWelten(page);
  await page.getByTestId("welt-oeffnen-spielwiese").click();
  await expect(page.getByTestId("werkstatt-spielen")).toBeEnabled();
  await page.getByTestId("werkstatt-spielen").click();
  await expect(page.getByTestId("assistent")).toBeVisible();
  await expect(page.getByTestId("schritt-1")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("welt-lib-spielwiese")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("welt-lib-info")).toContainText("Spielwiese");
});
