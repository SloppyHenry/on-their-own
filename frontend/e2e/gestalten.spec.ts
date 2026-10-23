import { expect, test } from "@playwright/test";
import { freshWorld, openApp, post, state } from "./helpers";
import { freieFlaeche, klickKachel, leereWelt, ueber, weltDatei, werkstattOeffnen } from "./gestalten-helfer";

/**
 * Gestalten, Außenwerkzeuge (AP16b): dieselben Werkzeuge in der Welt-Werkstatt (Entwurf, Speichern) und im Spiel in der Spielart Gott (Entwurf, Übernehmen, Zeit steht still).
 * Das Backend (AP16a) rechnet; hier zählt, was im Browser ankommt: Leiste, Geist, Fehler am Cursor, Entwurfsliste, Rückgängig, Prüfung, Speichern und Übernehmen.
 */
test.beforeEach(async ({ request }) => {
  await freshWorld(request);
  for (const w of await (await request.get("/api/worlds")).json()) if (!w.readonly) await request.delete(`/api/worlds/${w.id}`);
});

const esc = (p: import("@playwright/test").Page) => p.keyboard.press("Escape");
const eintraege = (p: import("@playwright/test").Page) => p.getByTestId("entwurf-liste").locator("[data-testid^=entwurf-]:not([data-testid^=entwurf-x])");

test.describe("Welt-Werkstatt", () => {
  test("Leiste in Gruppen mit W-Zeichen, Tasten 1–9 und 0 wählen das Werkzeug, Esc geht je eine Ebene zurück", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Leiste");
    await werkstattOeffnen(page, id);
    const leiste = page.getByTestId("gestalten-leiste");
    for (const t of ["zeiger", "weg", "see", "garten", "haus", "natur", "loeschen", "startplatz", "gebiet", "karte"]) await expect(leiste.getByTestId(`werkzeug-${t}`)).toBeVisible();
    for (const g of ["Ansehen", "Zeichnen", "Setzen", "Ändern", "Welt"]) await expect(leiste).toContainText(g);
    await expect(leiste.getByTestId("werkzeug-startplatz")).toHaveClass(/\bw\b/);
    await page.keyboard.press("2");
    await expect(page.getByTestId("werkzeug-weg")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("0");
    await expect(page.getByTestId("werkzeug-karte")).toHaveAttribute("aria-pressed", "true");
    await esc(page);                                                                         // erst das Werkzeug
    await expect(page.getByTestId("werkzeug-zeiger")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("werkstatt")).toBeVisible();
    await esc(page);                                                                         // dann die Werkstatt (nichts ungespeichert)
    await expect(page.getByTestId("werkstatt")).toHaveCount(0);
    await expect(page.getByTestId("welten-pane")).toBeVisible();
  });

  test("Weg: Punkte setzen, Doppelklick beendet; Rückgängig und Wiederholen; Speichern schreibt den Entwurf in die Datei", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Wegwiese");
    const vorher = (await weltDatei(request, id)).look.regions[0].shapes.paths.length;
    await werkstattOeffnen(page, id);
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 10, 4, [10, 10]);
    await page.getByTestId("werkzeug-weg").click();
    await klickKachel(page, x, y);
    await ueber(page, x + 5, y + 2);
    await expect(page.getByTestId("geist").first()).toBeVisible();                           // gestrichelte Vorschau läuft mit dem Zeiger
    await klickKachel(page, x + 5, y + 2);
    await klickKachel(page, x + 9, y);
    await klickKachel(page, x + 9, y);                                                       // derselbe Punkt noch einmal = fertig
    await expect(eintraege(page)).toHaveCount(1);
    await expect(page.getByTestId("entwurf-0")).toContainText("Weg, 3 Punkte");
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("● ungespeichert");
    await expect(page.getByTestId("werkstatt-aktionen")).toHaveText("1 Aktion");
    await expect(page.getByTestId("pruefung")).toBeVisible();
    await expect(page.getByTestId("entwurf-schleier")).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(eintraege(page)).toHaveCount(0);
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
    await page.keyboard.press("Control+Shift+z");
    await expect(eintraege(page)).toHaveCount(1);
    await page.getByTestId("werkstatt-speichern").click();
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
    await expect(eintraege(page)).toHaveCount(0);                                            // der Entwurf ist nach dem Speichern leer
    expect((await weltDatei(request, id)).look.regions[0].shapes.paths.length).toBe(vorher + 1);
  });

  test("See, Garten, Haus, Baum und Löschen: je Werkzeug eine Aktion im Entwurf; das Haus bekommt Tür und Innenbereich", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Alles", "mittel");
    await werkstattOeffnen(page, id);
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 24, 12, [10, 10]);
    await page.getByTestId("werkzeug-see").click();
    await klickKachel(page, x + 3, y + 3);
    await klickKachel(page, x + 6, y + 3);
    await expect(page.getByTestId("entwurf-0")).toContainText("See");
    await page.getByTestId("werkzeug-garten").click();
    await klickKachel(page, x + 12, y + 1);
    await klickKachel(page, x + 16, y + 4);
    await expect(page.getByTestId("entwurf-1")).toContainText("Garten 5 × 4");
    await page.getByTestId("werkzeug-natur").click();
    await page.getByTestId("deko-bank").click();
    await klickKachel(page, x + 20, y + 3);
    await expect(page.getByTestId("entwurf-2")).toContainText("Bank");
    await page.getByTestId("werkzeug-haus").click();
    await page.getByTestId("haus-shop").click();
    await ueber(page, x + 10, y + 9);
    await expect(page.getByTestId("tuermarke")).toBeVisible();
    await expect(page.getByTestId("cursor-tip")).toContainText("✓");
    await klickKachel(page, x + 10, y + 9);
    await expect(page.getByTestId("entwurf-3")).toContainText("Haus: Laden");
    await page.getByTestId("werkzeug-loeschen").click();
    await klickKachel(page, x + 20, y + 3);                                                  // die Bank wieder weg
    await expect(page.getByTestId("entwurf-4")).toContainText("Gelöscht");
    await expect(page.getByTestId("pruefung")).toContainText("✓");
    await page.getByTestId("werkstatt-speichern").click();
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
    const neu = await weltDatei(request, id);
    expect(neu.locations.some((l: { name: string }) => /Laden/i.test(l.name))).toBeTruthy();
    expect(neu.links.length).toBeGreaterThan(0);                                             // Haustür ↔ Innenbereich
    expect(neu.look.regions[0].shapes.lakes.length).toBe(1);
  });

  test("Fehler am Cursor: Wasser im Weg färbt den Geist rot, nennt den Grund und der Klick tut nichts", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Hindernis");
    await werkstattOeffnen(page, id);
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 10, 6, [10, 10]);
    await page.getByTestId("werkzeug-see").click();
    await klickKachel(page, x + 5, y + 3);
    await klickKachel(page, x + 8, y + 3);
    await expect(eintraege(page)).toHaveCount(1);
    await page.getByTestId("werkzeug-haus").click();
    await ueber(page, x + 5, y + 3);                                                         // mitten im See
    await expect(page.getByTestId("cursor-tip")).toContainText("✗");
    await expect(page.getByTestId("geist").first()).toHaveAttribute("data-ok", "nein");
    await expect(page.getByTestId("tuermarke")).toBeVisible();
    await klickKachel(page, x + 5, y + 3);
    await expect(eintraege(page)).toHaveCount(1);                                            // der Klick hat nichts gesetzt
    await ueber(page, x - 2, y - 2);                                                         // wieder auf der Wiese: grün
    await expect(page.getByTestId("geist").first()).toHaveAttribute("data-ok", "ja");
  });

  test("Prüfung ✗: Speichern geht trotzdem, „Damit spielen“ ist gesperrt", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Fehlbett", "mittel");
    await werkstattOeffnen(page, id);
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 10, 6, [12, 12]);
    await page.getByTestId("werkzeug-haus").click();
    await klickKachel(page, x + 5, y + 3);
    await expect(eintraege(page)).toHaveCount(1);
    await expect(page.getByTestId("pruefung")).toBeVisible();
    await expect(page.getByTestId("werkstatt-spielen")).toBeEnabled();
    await page.evaluate(() => {                                                              // das Bett aus dem neuen Haus löschen (die Innenräume liegen außerhalb der Weltansicht)
      const g = (window as unknown as { __gestalten: { getState(): { rechnung: { welt: { objects: { kind: string; tile: number[] }[] } }; setze(a: object): void } } }).__gestalten.getState();
      g.setze({ art: "loeschen", tile: g.rechnung.welt.objects.find((o) => o.kind === "bed")!.tile });
    });
    await expect(eintraege(page)).toHaveCount(2);
    await expect(page.getByTestId("pruefung").locator("[data-stufe=fehler]")).toContainText("Bett");
    await expect(page.getByTestId("werkstatt-spielen")).toBeDisabled();
    await expect(page.getByTestId("werkstatt-speichern")).toBeEnabled();
    await page.getByTestId("werkstatt-speichern").click();
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
    expect((await weltDatei(request, id)).objects.some((o: { kind: string }) => o.kind === "bed")).toBeFalsy();
  });

  test("Karte erweitern: Süden +16 verlängert die Welt, Entwurf zeigt es, Speichern übernimmt die neue Größe", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Wachsend");
    const alt = await weltDatei(request, id);
    await werkstattOeffnen(page, id);
    await page.getByTestId("werkzeug-karte").click();
    await expect(page.getByTestId("karte-sued-n-16")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("karte-sued").click();
    await expect(page.getByTestId("entwurf-0")).toContainText("Karte: Süden +16");
    await expect(page.getByTestId("werkstatt-stand-info")).toContainText(`${alt.size[0]} × ${alt.size[1] + 16}`);
    await page.getByTestId("pfeil-ost").click();
    await expect(page.getByTestId("werkstatt-stand-info")).toContainText(`${alt.size[0] + 16} × ${alt.size[1] + 16}`);
    await page.getByTestId("werkstatt-speichern").click();
    await expect(page.getByTestId("werkstatt-stand")).toHaveText("gespeichert");
    expect((await weltDatei(request, id)).size).toEqual([alt.size[0] + 16, alt.size[1] + 16]);
  });

  test("Startplatz ist eine Aktion des Entwurfs; Gebiet erzeugen zeigt den gestrichelten Rahmen an der Ecke", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Ecken", "gross", false);
    await werkstattOeffnen(page, id);
    await expect(page.getByTestId("werkstatt-spielen")).toBeDisabled();
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 4, 4, [10, 10]);
    await page.getByTestId("werkzeug-startplatz").click();
    await klickKachel(page, x, y);
    await expect(page.getByTestId("entwurf-0")).toContainText("Startplatz");
    await expect(page.getByTestId("werkstatt-startplatz")).toHaveText(`${x}, ${y}`);
    await expect(page.getByTestId("werkstatt-marke")).toBeVisible();
    await expect(page.getByTestId("werkstatt-spielen")).toBeEnabled();
    const [gx, gy] = freieFlaeche(doc.tiles, 70, 48, [6, 6]);
    await page.getByTestId("werkzeug-gebiet").click();
    await expect(page.getByTestId("gebiet-erzeugen")).toBeDisabled();
    await klickKachel(page, gx, gy);
    await expect(page.getByTestId("gebiet-rahmen")).toBeVisible();
    await page.getByTestId("gebiet-erzeugen").click();
    await expect(page.getByTestId("werkstatt-hinweis")).toContainText("erzeugt", { timeout: 30_000 });
    await expect(page.getByTestId("werkstatt-startplatz")).toHaveText(`${x}, ${y}`);       // der Entwurf wurde vorher in die Welt geschrieben
    await expect(eintraege(page)).toHaveCount(0);
  });

  test("Ungespeicherter Entwurf: Esc fragt nach, „Weiter bearbeiten“ behält ihn", async ({ page, request }) => {
    const { id } = await leereWelt(request, "Rueckfrage");
    await werkstattOeffnen(page, id);
    const doc = await weltDatei(request, id), [x, y] = freieFlaeche(doc.tiles, 4, 4, [10, 10]);
    await page.getByTestId("werkzeug-natur").click();
    await klickKachel(page, x, y);
    await expect(eintraege(page)).toHaveCount(1);
    await esc(page);                                                                         // Werkzeug zurück
    await esc(page);
    await expect(page.getByTestId("werkstatt-rueckfrage")).toBeVisible();
    await esc(page);
    await expect(page.getByTestId("werkstatt-rueckfrage")).toHaveCount(0);
    await expect(eintraege(page)).toHaveCount(1);
    await expect(page.getByTestId("werkstatt-spielen")).toBeEnabled();
  });
});

test.describe("Gestalten im Spiel (Gott)", () => {
  test("Taste B öffnet den Werkzeugkasten ohne Startplatz und Gebiet; die Zeit steht still und läuft danach weiter, wenn sie lief", async ({ page, request }) => {
    await page.goto("/?messen");
    await expect(page.getByTestId("conn")).toContainText("Verbunden");
    await post(request, "/api/sim/start");
    await expect.poll(async () => (await state(request)).simulation.state).toBe("running");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __sim: { getState(): { world: { simulation: { state: string } } } } }).__sim.getState().world.simulation.state)).toBe("running");   // auch im Browser angekommen
    await page.keyboard.press("b");
    await expect(page.getByTestId("gestalten-spiel")).toBeVisible();
    await expect(page.getByTestId("zeit-steht-still")).toBeVisible();
    await expect(page.getByTestId("hud")).toHaveCount(0);
    await expect(page.getByTestId("werkzeug-startplatz")).toHaveCount(0);
    await expect(page.getByTestId("werkzeug-gebiet")).toHaveCount(0);
    await expect(page.getByTestId("werkzeug-karte")).toBeVisible();
    await expect.poll(async () => (await state(request)).simulation.state).toBe("paused");
    const t0 = (await state(request)).clock.minute;
    await page.waitForTimeout(1500);
    expect((await state(request)).clock.minute).toBe(t0);
    await page.getByTestId("gestalten-fertig").click();
    await expect(page.getByTestId("gestalten-spiel")).toHaveCount(0);
    await expect.poll(async () => (await state(request)).simulation.state).toBe("running");
  });

  test("Lief die Zeit vorher nicht, bleibt sie auch nach dem Gestalten stehen", async ({ page, request }) => {
    await openApp(page);
    const vor = (await state(request)).simulation.state;
    expect(vor).not.toBe("running");
    await page.keyboard.press("b");
    await expect(page.getByTestId("gestalten-spiel")).toBeVisible();
    await esc(page);
    await expect(page.getByTestId("gestalten-spiel")).toHaveCount(0);
    expect((await state(request)).simulation.state).toBe(vor);
  });

  test("Entwurf setzen und übernehmen: Bestätigung, Sicherung, die Bank steht in der Welt; ein Ereignis nur im Protokoll", async ({ page, request }) => {
    await openApp(page);
    const rows: string[] = (await state(request)).map.rows, [x, y] = freieFlaeche(rows, 1, 1, [2, 2], 1);
    const seq = (await state(request)).seq;
    await page.keyboard.press("b");
    await page.getByTestId("werkzeug-natur").click();
    await page.getByTestId("deko-bank").click();
    await klickKachel(page, x, y);
    await expect(page.getByTestId("entwurf-0")).toContainText("Bank");
    expect((await state(request)).seq).toBe(seq);                                            // der Entwurf verändert die Welt nicht
    await expect(page.getByTestId("uebernehmen")).toBeEnabled();
    await page.getByTestId("uebernehmen").click();
    await expect(page.getByTestId("uebernehmen-dialog")).toContainText("Vor dem Gestalten");
    await page.getByTestId("uebernehmen-ok").click();
    await expect(page.getByTestId("gestalten-fertig-hinweis")).toContainText("Vor dem Gestalten");
    await expect(eintraege(page)).toHaveCount(0);
    const s = await state(request);
    expect(Object.values(s.objects as Record<string, { kind: string; x?: number; y?: number }>).some((o) => o.kind === "bench")).toBeTruthy();
    const saves = await (await request.get("/api/saves")).json();
    expect(saves.some((q: { name: string }) => q.name.startsWith("Vor dem Gestalten"))).toBeTruthy();
    const ev = await (await request.get("/api/events?type_prefix=world.edited")).json();
    expect(ev.items.length).toBe(1);
  });

  test("Dorf anfügen gibt es nicht mehr; Verwerfen leert den Entwurf; Esc mit Entwurf fragt nach", async ({ page, request }) => {
    await openApp(page);
    const rows: string[] = (await state(request)).map.rows, [x, y] = freieFlaeche(rows, 1, 1, [2, 2], 1);
    await page.keyboard.press("b");
    await expect(page.getByTestId("seed")).toHaveCount(0);
    await expect(page.getByTestId("preview")).toHaveCount(0);
    await page.getByTestId("werkzeug-natur").click();
    await klickKachel(page, x, y);
    await expect(eintraege(page)).toHaveCount(1);
    await page.getByTestId("entwurf-verwerfen").click();
    await expect(eintraege(page)).toHaveCount(0);
    await klickKachel(page, x, y);
    await esc(page);                                                                         // Werkzeug zurück
    await esc(page);
    await expect(page.getByTestId("gestalten-rueckfrage")).toBeVisible();
    await esc(page);
    await expect(page.getByTestId("gestalten-rueckfrage")).toHaveCount(0);
    await esc(page);
    await page.getByTestId("gestalten-rueckfrage-ja").click();
    await expect(page.getByTestId("gestalten-spiel")).toHaveCount(0);
    expect((await state(request)).objects).not.toBeUndefined();
  });

  test("In der Spielart Leben gibt es weder Taste B noch den Werkzeugkasten", async ({ page, request }) => {
    await post(request, "/api/sim/reset", { confirm: true, play_mode: "leben" });
    await openApp(page);
    await page.keyboard.press("b");
    await expect(page.getByTestId("gestalten-spiel")).toHaveCount(0);
    await expect(page.getByTestId("open-editor")).toHaveCount(0);
    const res = await request.post("/api/world/draft/preview", { data: { actions: [] }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    expect(res.status()).toBe(403);
  });
});
