import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { freshWorld, openApp, state } from "./helpers";

/**
 * Assistent „Neue Simulation“ und Charaktereditor (AP17b): fünf Schritte, Vorschau der Welt unter einem Schleier, Bewohner mit Beziehungen, Regeln und Weltregeln als
 * Startereignisse, Anlegen nur nach Bestätigung; Vorlagen mit Export und Import. Für die Bewohner ändert sich nichts außerhalb der Welt.
 */
test.beforeEach(async ({ request }) => {
  await freshWorld(request);
  for (const t of await (await request.get("/api/templates")).json()) if (!t.builtin) await request.delete(`/api/templates/${t.id}`);       // eigene Vorlagen früherer Tests
});

async function openAssistant(page: Page) {
  await openApp(page);
  await page.evaluate(() => localStorage.removeItem("on-their-own.entwurf"));
  await page.reload();
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await page.getByTestId("open-menu").click();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-define").click();
  await expect(page.getByTestId("assistent")).toBeVisible();
  await expect(page.getByTestId("step-spielart")).toBeVisible();
  await toStep(page, 0);                                                                                              // die Tests beginnen beim Schritt „Welt“
  await expect(page.getByTestId("step-welt")).toBeVisible();
}

/** Schritt der alten Zählung (0 Welt … 4 Start): seit AP18d steht davor der Schritt „Spielart“. */
async function toStep(page: Page, i: number) { await page.getByTestId(`schritt-${i + 1}`).click(); }
const agentIds = async (req: APIRequestContext) => ((await state(req)).agents as { id: string }[]).map((a) => a.id).sort();

test("Schritt Welt: das neue Dorf erscheint unter dem Schleier, die laufende Welt bleibt unverändert", async ({ page, request }) => {
  const before = await state(request);
  await openAssistant(page);
  await page.getByTestId("welt-erzeugt").click();
  await page.getByTestId("welt-seed").fill("31");
  await expect(page.getByTestId("vorschau-fenster")).toBeVisible();
  await expect(page.getByTestId("vorschau-schleier")).toBeVisible();
  await expect(page.getByTestId("vorschau-bericht")).toContainText("bestanden");
  await expect(page.getByTestId("welt-haeuser-liste")).toContainText("2 Betten");
  await expect(page.getByTestId("welt-haeuser-liste")).toContainText("2 Betten für 2 Bewohner");
  await page.screenshot({ path: "test-results/assistent-welt.png" });
  expect((await state(request)).seq).toBe(before.seq);                                                          // Vorschau ändert nichts
  expect(await agentIds(request)).toEqual(["alex", "mira"]);
  await page.getByTestId("welt-haeuser").getByRole("button", { name: "Wohnhäuser mehr" }).click();                // von Hand: 2 Häuser
  await expect(page.getByTestId("welt-haeuser-liste")).toContainText("4 Betten für 2 Bewohner");
  await page.getByTestId("welt-haeuser-auto").click();
  await expect(page.getByTestId("welt-haeuser-liste")).toContainText("2 Betten für 2 Bewohner");
});

test("Bewohner: Anzahl mit Tempohinweis, Vorlagen, Maske mit Zählern, Wortprüfung, Beziehungen mit Vorgeschichte", async ({ page }) => {
  await openAssistant(page);
  await toStep(page, 1);
  await expect(page.getByTestId("bew-anzahl")).toHaveText("2");
  await expect(page.getByTestId("bew-tempo")).toContainText("9,0 s");
  for (let i = 0; i < 6; i++) await page.getByTestId("bew-mehr").click();
  await expect(page.getByTestId("bew-anzahl")).toHaveText("8");
  await expect(page.getByTestId("bew-mehr")).toBeDisabled();                                                        // Grenze 8
  await expect(page.getByTestId("bew-tempo")).toContainText("36,0 s");
  await page.getByTestId("bew-weniger").click();
  await expect(page.getByTestId("bew-tab-6")).toHaveCount(1);
  await expect(page.getByTestId("bew-tab-7")).toHaveCount(0);
  await page.getByTestId("bew-tab-2").click();                                                                      // dritte Vorlage: Hanne
  await expect(page.getByTestId("maske-name")).toHaveValue("Hanne");
  await page.getByTestId("maske-background").fill("Ein Spieler hat mich erfunden.");
  await expect(page.getByTestId("maske-warn")).toContainText("„Spieler“ in Hintergrund");
  await page.getByTestId("maske-name").fill("N".repeat(30));
  await expect(page.getByTestId("maske").getByText("30/24")).toBeVisible();
  await page.getByTestId("maske-interests").fill("Angeln, Kochen, ");                                               // Komma am Ende bleibt beim Tippen stehen
  await expect(page.getByTestId("maske-interests")).toHaveValue("Angeln, Kochen, ");
  await page.getByTestId("bew-tab-0").click();
  await page.getByTestId("rel-paar-0-1").click();
  await page.getByTestId("paar-vorschlag").click();
  await expect(page.getByTestId("paar-text")).toHaveValue("Alex und Mira kennen sich seit dem letzten Frühling.");
  await page.getByTestId("rel-0-1-trust").fill("80");
  await expect(page.getByTestId("rel-zelle-0-1")).toContainText("Vertrauen sehr");
  await expect(page.getByTestId("rel-zelle-1-0")).toContainText("Vertrauen mittel");                                             // die andere Richtung bleibt
  await page.getByTestId("paar-text").fill("Sie kennen sich vom Leitstelle-Spiel.");
  await expect(page.getByTestId("paar-warn")).toContainText("Leitstelle");
  await page.getByTestId("paar-standard").click();
  await expect(page.getByTestId("rel-zelle-0-1")).toContainText("Vertrauen mittel");
  await page.screenshot({ path: "test-results/assistent-bewohner.png", fullPage: true });
});

test("Wohnen: höchstens 2 je Haus, ohne Angabe sucht sich jeder selbst eine Bleibe", async ({ page }) => {
  await openAssistant(page);
  await page.getByTestId("welt-erzeugt").click();
  await toStep(page, 1);
  await page.getByTestId("bew-mehr").click();
  await page.getByTestId("bew-mehr").click();                                                                       // 4 Bewohner, 2 Häuser
  await expect(page.getByTestId("bew-wohnen")).toContainText("Es gibt keine Zuteilung von außen");
  await page.getByTestId("bew-haus").selectOption("1");
  await page.getByTestId("bew-tab-1").click();
  await page.getByTestId("bew-haus").selectOption("1");
  await page.getByTestId("bew-tab-2").click();
  await expect(page.getByTestId("bew-haus").locator("option[value='1']")).toHaveAttribute("disabled", "");                           // Haus 1 ist voll
  await expect(page.getByTestId("bew-haus").locator("option[value='1']")).toContainText("(voll)");
});

test("Start: Fehler des Entwurfs werden genannt und sperren das Anlegen; Hinweise der Wortprüfung nicht", async ({ page }) => {
  await openAssistant(page);
  await toStep(page, 1);
  await page.getByTestId("maske-name").fill("");
  await toStep(page, 4);
  await expect(page.getByTestId("start-fehler")).toContainText("Bewohner 1: Name: fehlt");
  await expect(page.getByTestId("start-anlegen")).toBeDisabled();
  await toStep(page, 1);
  await page.getByTestId("maske-name").fill("Ida");
  await page.getByTestId("maske-background").fill("Wurde von der Simulation geträumt.");
  await toStep(page, 4);
  await expect(page.getByTestId("start-warnungen")).toContainText("Simulation");
  await expect(page.getByTestId("start-fehler")).toHaveCount(0);
  await expect(page.getByTestId("start-anlegen")).toBeEnabled();
});

test("Alles durchklicken: 3 Bewohner, Beziehung, Preset, Weltregel, Modus, Anlegen nach Bestätigung; die alte Welt ist gesichert", async ({ page, request }) => {
  await openAssistant(page);
  await page.getByTestId("welt-erzeugt").click();
  await page.getByTestId("welt-seed").fill("5");
  await page.getByTestId("weiter").click();
  await page.getByTestId("bew-mehr").click();                                                                       // dritter Bewohner: Hanne
  await page.getByTestId("rel-paar-0-1").click();
  await page.getByTestId("rel-0-1-trust").fill("85");
  await page.getByTestId("paar-text").fill("Alex und Mira kennen sich vom Markt.");
  await expect(page.getByTestId("stimme-zeile")).toContainText("Vorschlag");                                         // Stimme: Vorschlag aus Geschlecht und Alter
  await page.getByTestId("stimme-einstellen").click();
  await page.getByTestId("stimme-feld").locator("select").first().selectOption("rau");
  await expect(page.getByTestId("stimme-zeile")).toContainText("eigene");
  await page.getByTestId("weiter").click();
  await page.getByTestId("preset-ressourcenknappheit").click();
  await page.getByTestId("regeltext").fill("Heute regnet es.");
  await page.getByTestId("regel-vorschau").click();
  await expect(page.getByTestId("regel-vorschau-ergebnis")).toContainText("natürlichen Vorgang");
  await page.getByTestId("regel-uebernehmen").click();
  await expect(page.getByTestId("startereignisse")).toContainText("Heute regnet es.");
  await page.screenshot({ path: "test-results/assistent-regeln.png", fullPage: true });
  await page.getByTestId("weiter").click();
  await page.getByTestId("weiter").click();
  await expect(page.getByTestId("start-uebersicht")).toContainText("3: Alex, Mira, Hanne");
  await expect(page.getByTestId("start-uebersicht")).toContainText("2 Angaben geändert");
  await expect(page.getByTestId("start-uebersicht")).toContainText("alle suchen sich selbst eine Bleibe");
  await expect(page.getByTestId("start-uebersicht")).toContainText("1 Startereignis");
  await expect(page.getByTestId("start-anlegen")).toBeEnabled();
  await page.screenshot({ path: "test-results/assistent-start.png", fullPage: true });
  expect(await agentIds(request)).toEqual(["alex", "mira"]);                                                         // bisher nichts angelegt
  await page.getByTestId("start-anlegen").click();
  await expect(page.getByTestId("start-bestaetigen")).toBeDisabled();                                                // ohne das Wort geht es nicht
  await page.getByTestId("start-wort").fill("neu starten");
  await page.getByTestId("start-bestaetigen").click();
  await expect(page.getByTestId("start-menu")).toHaveCount(0);                                                       // zurück im Spiel
  expect(await agentIds(request)).toEqual(["alex", "hanne", "mira"]);
  const s = await state(request);
  expect(s.world_name).toMatch(/^Dorf /);
  expect(s.simulation.state).toBe("stopped");
  expect(s.voices.alex.timbre).toBe("rau");                                                                          // die Stimme wanderte in die Welt
  expect((s.objects as { kind: string; owner: string | null }[]).filter((o) => o.kind === "bed" && o.owner)).toHaveLength(0);       // niemand bekam ein Bett zugeteilt
  expect((await (await request.get("/api/saves")).json()).some((x: { name: string }) => x.name.startsWith("Vor der neuen Simulation"))).toBe(true);
  const params = await (await request.get("/api/params")).json();
  expect(params.values["world.scarcity"]).toBeGreaterThan(0);                                                        // aus dem Preset
  const ev = await (await request.get("/api/events", { params: { type_prefix: "world.weather", limit: 20 } })).json();
  expect(JSON.stringify(ev)).toContain("rain");                                                                      // die Weltregel lief als Wetter
  await expect(page.getByTestId("agent-card-hanne")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("agent-card-hanne")).toBeVisible();
});

test("Der Entwurf bleibt nach dem Neuladen und lässt sich verwerfen", async ({ page }) => {
  await openAssistant(page);
  await toStep(page, 1);
  await page.getByTestId("bew-mehr").click();
  await page.getByTestId("maske-description").fill("Mein eigener Text.");
  await page.reload();
  await expect(page.getByTestId("conn")).toContainText("Verbunden");
  await page.getByTestId("open-menu").click();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-define").click();
  await expect(page.getByTestId("step-bewohner")).toBeVisible();                                                     // derselbe Schritt
  await expect(page.getByTestId("bew-anzahl")).toHaveText("3");
  await expect(page.getByTestId("maske-description")).toHaveValue("Mein eigener Text.");
  await page.getByTestId("verwerfen").click();
  await expect(page.getByTestId("step-spielart")).toBeVisible();                                                    // der Entwurf beginnt wieder vorn
  await toStep(page, 1);
  await expect(page.getByTestId("bew-anzahl")).toHaveText("2");
});

test("Startwelt: nur Alex und Mira, mit einem Bewohner geht es", async ({ page, request }) => {
  await openAssistant(page);
  await page.getByTestId("welt-start").click();
  await toStep(page, 1);
  await page.getByTestId("bew-weniger").click();
  await expect(page.getByTestId("bew-anzahl")).toHaveText("1");
  await page.getByTestId("bew-vorlage").selectOption("");                                                           // selbst geschrieben: in der Startwelt ohne Zimmer
  await expect(page.getByTestId("bew-startwelt-warnung")).toBeVisible();
  await toStep(page, 4);
  await expect(page.getByTestId("start-fehler")).toContainText("nur für Alex und Mira");
  await toStep(page, 1);
  await page.getByTestId("bew-vorlage").selectOption("mira");
  await toStep(page, 4);
  await expect(page.getByTestId("start-anlegen")).toBeEnabled();
  await page.getByTestId("start-anlegen").click();
  await page.getByTestId("start-wort").fill("neu starten");
  await page.getByTestId("start-bestaetigen").click();
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
  expect(await agentIds(request)).toEqual(["mira"]);
});

test("8 Bewohner: das Dorf wächst mit, jedes Haus hat zwei Betten", async ({ page, request }) => {
  await openAssistant(page);
  await page.getByTestId("welt-erzeugt").click();
  await toStep(page, 1);
  for (let i = 0; i < 6; i++) await page.getByTestId("bew-mehr").click();
  await toStep(page, 0);
  await expect(page.getByTestId("welt-haeuser-liste")).toContainText("8 Betten für 8 Bewohner");
  await expect(page.getByTestId("vorschau-fenster")).toBeVisible();
  await toStep(page, 4);
  await expect(page.getByTestId("start-anlegen")).toBeEnabled();
  await page.getByTestId("start-anlegen").click();
  await page.getByTestId("start-wort").fill("neu starten");
  await page.getByTestId("start-bestaetigen").click();
  await expect(page.getByTestId("start-menu")).toHaveCount(0);
  expect((await agentIds(request)).length).toBe(8);
  const beds = ((await state(request)).objects as { kind: string }[]).filter((o) => o.kind === "bed");
  expect(beds).toHaveLength(8);
});

// --- Charaktereditor ---------------------------------------------------------------------------------------------------------------------

async function openEditor(page: Page) {
  await openApp(page);
  await page.getByTestId("open-menu").click();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-editors").click();
  await page.getByTestId("editor-figuren").click();
  await expect(page.getByTestId("charaktereditor")).toBeVisible();
}

test("Charaktereditor: mitgelieferte Vorlagen sind schreibgeschützt, Duplizieren legt eine eigene an, Speichern und Löschen", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByTestId("vorlagen-liste").locator("button")).toHaveCount(6);
  await expect(page.getByTestId("vorlage-geschuetzt")).toBeVisible();
  await expect(page.getByTestId("editor-name")).toBeDisabled();
  await expect(page.getByTestId("vorlage-speichern")).toHaveCount(0);
  await page.getByTestId("vorlage-duplizieren").click();
  await expect(page.getByTestId("vorlage-titel")).toHaveText("Alex (Kopie)");
  await expect(page.getByTestId("vorlage-geschuetzt")).toHaveCount(0);
  await page.getByTestId("editor-name").fill("Otto");
  await page.getByTestId("editor-description").fill("Backt gern.");
  await page.getByTestId("vorlage-speichern").click();
  await expect(page.getByTestId("vorlage-info")).toHaveText("Gespeichert.");
  await expect(page.getByTestId("vorlagen-liste")).toContainText("Otto");
  await page.getByTestId("vorlage-loeschen").click();
  await expect(page.getByTestId("vorlagen-liste").locator("button")).toHaveCount(6);
});

test("Export als Datei und Import: Fehler kommen alle auf einmal, eine gute Datei wird als neue Vorlage angelegt", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("vorlage-kim").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("vorlage-export").click()]);
  expect(download.suggestedFilename()).toBe("vorlage-kim.json");
  const file = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(file).toMatchObject({ format: "on-their-own-vorlage", version: 1, profile: { name: "Kim" } });
  await page.getByTestId("vorlage-datei").setInputFiles({ name: "kaputt.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "on-their-own-vorlage", version: 2, profile: { name: "Ida", gender: "x", age: 200 }, personality: {} })) });
  await expect(page.getByTestId("vorlage-fehler")).toContainText("kaputt.json: nicht importiert");
  await expect(page.getByTestId("vorlage-fehler")).toContainText("Version 2");
  await expect(page.getByTestId("vorlage-fehler")).toContainText("Geschlecht: männlich, weiblich oder divers.");
  await expect(page.getByTestId("vorlage-fehler")).toContainText("Geselligkeit");
  await page.getByTestId("vorlage-datei").setInputFiles({ name: "nicht-json.json", mimeType: "application/json", buffer: Buffer.from("{kaputt") });
  await expect(page.getByTestId("vorlage-fehler")).toContainText("kein gültiges JSON");
  await expect(page.getByTestId("vorlagen-liste").locator("button")).toHaveCount(6);                               // nichts angelegt
  await page.getByTestId("vorlage-datei").setInputFiles({ name: "kim.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByTestId("vorlage-info")).toContainText("kim.json importiert");
  await expect(page.getByTestId("vorlagen-liste").locator("button")).toHaveCount(7);
  await expect(page.getByTestId("vorlage-titel")).toHaveText("Kim");
  await page.screenshot({ path: "test-results/charaktereditor.png", fullPage: true });
});
