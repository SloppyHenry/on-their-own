// Modellverwaltung (AP17c-4): echtes Backend mit kleinen Dateien statt Hugging Face, einem falschen llama-server und fester Hardware (scripts/e2e_models.py).
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { freshWorld, openApp, post, openSettingsMenu } from "./helpers";

test.describe.configure({ mode: "serial" });                       // die Tests bauen aufeinander auf (zuerst ohne Laufzeit, dann mit)

const call = async (req: APIRequestContext, method: "delete" | "put", path: string, data?: unknown) =>
  (await req[method](path, { data, headers: { "Idempotency-Key": randomUUID() } })).json();
const llm = async (req: APIRequestContext) => (await req.get("/api/llm")).json();

/** Lädt ein Modell über die API und wartet, bis es fertig ist (für Tests, die nicht das Laden selbst prüfen). */
async function install(req: APIRequestContext, repo: string, file: string) {
  await post(req, "/api/models/downloads", { repo, file, confirm: true });
  await expect.poll(async () => (await llm(req)).transfer?.phase, { timeout: 30_000 }).toBe("done");
  await call(req, "delete", "/api/models/downloads/current");
}

async function openModelle(page: Page) {
  await openApp(page);
  await openSettingsMenu(page);
  await page.getByRole("tab", { name: "Modelle", exact: true }).click();
  await expect(page.getByTestId("modelle")).toBeVisible();
}

/** Zeile eines Modells in „Empfohlen“ (dort steht es zuerst); in „Alle Modelle suchen“ erscheint dasselbe Modell noch einmal. */
const row = (page: Page, repo: string) => page.getByTestId(`modell-${repo.replace(/[^A-Za-z0-9]+/g, "-")}`).first();

test.beforeEach(async ({ request }) => {
  await freshWorld(request);
  const s = await llm(request);
  if (s.probe && (s.probe.phase === "starting" || s.probe.phase === "running")) await call(request, "delete", "/api/models/probe");
  if (s.transfer && ["downloading", "verifying", "preparing", "unpacking"].includes(s.transfer.phase)) await call(request, "delete", "/api/models/downloads/current");
  await expect.poll(async () => { const t = (await llm(request)).transfer; return !t || !["downloading", "verifying", "preparing", "unpacking"].includes(t.phase); }).toBe(true);
  await call(request, "delete", "/api/models/downloads/current");                  // beendete Meldung ausblenden
  for (const m of s.installed) await call(request, "delete", `/api/models/installed/${m.id}?confirm=true`);
  await call(request, "put", "/api/llm", { mode: "external", external_url: "http://127.0.0.1:9/v1" });
});

test("Hardware, Betriebsart und Empfehlungen sind zu sehen; ohne Laufzeit ist „Eingebaut“ noch leer", async ({ page }) => {
  await openModelle(page);
  await expect(page.getByTestId("hardware-name")).toHaveText("Prozessor (Test)");
  await expect(page.getByTestId("hardware-summary")).toContainText("16 GB RAM");
  await expect(page.getByTestId("hardware-usable")).toContainText("nutzbar für Modelle");
  await expect(page.getByTestId("runtime-info")).toContainText("noch nicht installiert");
  await expect(page.getByTestId("mode-external")).toHaveAttribute("aria-pressed", "true");
  const best = row(page, "Qwen/Qwen3-8B-GGUF");
  await expect(best).toBeVisible();
  await expect(best.getByTestId("fit")).toHaveText("passt gut");
  await expect(best).toContainText("Apache-2.0");
  await expect(best).toContainText("Schätzung");
  await expect(page.getByTestId("katalog-stand")).toContainText("Hugging Face");
  await expect(page.getByTestId("nichts-installiert")).toBeVisible();
  await expect(page.getByTestId("suche-treffer").getByTestId("modell-unsloth-Gemma-Test-GGUF")).toBeVisible();    // die Suche zeigt auch Modelle außerhalb der Empfehlung
});

test("Die Suche filtert; „nur passende“ und „alle Herausgeber“ sind schaltbar", async ({ page }) => {
  await openModelle(page);
  await page.getByTestId("suche-feld").fill("gemma");
  const hits = page.getByTestId("suche-treffer");
  await expect(hits.getByTestId("modell-unsloth-Gemma-Test-GGUF")).toBeVisible();
  await expect(hits.getByTestId("modell-Qwen-Qwen3-8B-GGUF")).toHaveCount(0);
  await page.getByTestId("suche-feld").fill("gibt-es-nicht-xyz");
  await expect(page.getByText("Keine Treffer.")).toBeVisible();
  await page.getByTestId("suche-feld").fill("");
  await page.getByTestId("alle-herausgeber").check();
  await page.getByTestId("liste-aktualisieren").click();
  await expect(hits.getByTestId("modell-Qwen-Qwen3-8B-GGUF")).toBeVisible();
  await expect(page.getByTestId("empfohlen").getByTestId("modell-Qwen-Qwen3-8B-GGUF")).toBeVisible();
});

test("Laufzeit installieren: erst Bestätigung, dann Fortschritt, dann eingerichtet", async ({ page, request }) => {
  await openModelle(page);
  await page.getByTestId("runtime-install").click();
  const dlg = page.getByTestId("bestaetigung");
  await expect(dlg).toContainText("github.com/ggml-org/llama.cpp");
  await dlg.getByTestId("bestaetigung-nein").click();
  expect((await llm(request)).transfer).toBeNull();                                // ohne Bestätigung wurde nichts geladen
  await page.getByTestId("runtime-install").click();
  await page.getByTestId("bestaetigung-ja").click();
  await expect(page.getByTestId("runtime-info")).toContainText("b100", { timeout: 30_000 });
  await expect(page.getByTestId("runtime-info")).toContainText("(cpu)");
  await expect(page.getByTestId("runtime-install")).toHaveCount(0);
  expect((await llm(request)).runtime.installed).toBe(true);
});

test("Laden braucht Bestätigung mit Datei, Quelle und Größe; Abbrechen räumt weg", async ({ page, request }) => {
  await openModelle(page);
  const small = row(page, "Qwen/Qwen3-4B-GGUF");
  await small.getByTestId("laden").click();
  const dlg = page.getByTestId("bestaetigung");
  await expect(dlg).toContainText("Qwen3-4B-Q4_K_M.gguf");
  await expect(dlg).toContainText("huggingface.co/Qwen/Qwen3-4B-GGUF");
  await expect(dlg).toContainText("SHA-256");
  await expect(dlg).toContainText("MB");
  await expect(dlg).toContainText("frei, reicht");
  await dlg.getByTestId("bestaetigung-nein").click();
  expect((await llm(request)).transfer).toBeNull();
  await small.getByTestId("laden").click();
  await page.getByTestId("bestaetigung-ja").click();
  const t = page.getByTestId("transfer");
  await expect(t).toHaveAttribute("data-phase", "downloading");
  await expect(t.getByRole("progressbar")).toBeVisible();
  await expect(page.getByTestId("transfer-detail")).toContainText("von");
  await page.getByTestId("transfer-cancel").click();
  await expect(t).toHaveAttribute("data-phase", "cancelled");
  await expect(page.getByTestId("nichts-installiert")).toBeVisible();
  expect((await llm(request)).installed).toEqual([]);
  await page.getByTestId("transfer-dismiss").click();
  await expect(t).toHaveCount(0);
});

test("Laden, automatisch messen, Siegel: das Modell ist geprüft und läuft", async ({ page, request }) => {
  await post(request, "/api/llm/runtime/install", { confirm: true });             // Laufzeit aus dem vorigen Test ist da; ein zweiter Aufruf ist harmlos
  await expect.poll(async () => (await llm(request)).runtime.installed, { timeout: 30_000 }).toBe(true);
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await openModelle(page);
  await expect(page.getByTestId("mode-builtin")).toHaveAttribute("aria-pressed", "true");
  await row(page, "Qwen/Qwen3-8B-GGUF").getByTestId("laden").click();
  await expect(page.getByTestId("bestaetigung")).toContainText("Probelauf");
  await page.getByTestId("bestaetigung-ja").click();
  const inst = page.getByTestId("installiert-Qwen3-8B-Q4_K_M");
  await expect(inst).toBeVisible({ timeout: 30_000 });
  await expect(inst.getByTestId("siegel")).toContainText("geprüft · 100 % gültig", { timeout: 30_000 });            // Probelauf lief von selbst
  await expect(inst.getByTestId("laeuft")).toBeVisible();
  await expect(page.getByTestId("runtime-state")).toContainText("läuft");
  await expect(page.getByTestId("mode-builtin")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="modell-Qwen-Qwen3-8B-GGUF"] [data-testid="laden"]')).toHaveCount(0);   // schon installiert: nirgends ein zweites Laden
  const s = await llm(request);
  expect(s.installed[0].probe).toMatchObject({ seal: "checked", valid: 10, n: 10 });
  expect(s.installed[0].source).toBe("tool");
});

test("Als Standard vorgewählt: das Zurücksetzen-Fenster bietet es an und startet es; Löschen fragt nach", async ({ page, request }) => {
  await install(request, "Qwen/Qwen3-4B-GGUF", "Qwen3-4B-Q4_K_M.gguf");
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await post(request, "/api/llm/start", { model_id: "Qwen3-4B-Q4_K_M" });
  await expect.poll(async () => (await llm(request)).runtime.state, { timeout: 30_000 }).toBe("running");
  await openModelle(page);
  const small = page.getByTestId("installiert-Qwen3-4B-Q4_K_M");
  await expect(small.getByTestId("standard")).toHaveCount(0);
  await small.getByTestId("als-standard").click();
  await expect(small.getByTestId("standard")).toBeVisible();
  expect((await llm(request)).default_model).toBe("Qwen3-4B-Q4_K_M");
  await page.keyboard.press("Escape");                                              // zurück ins Spiel
  await page.keyboard.press("Escape");
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-start").click();                                   // Schnellstart: das Zurücksetzen-Fenster
  const dialog = page.getByRole("dialog", { name: "Zurücksetzen bestätigen" });
  await expect(dialog.getByLabel("Modell")).toHaveValue("Qwen3-4B-Q4_K_M");       // das Standardmodell ist vorgewählt
  await dialog.getByRole("button", { name: "Abbrechen" }).click();

  await openSettingsMenu(page);
  await page.getByRole("tab", { name: "Modelle", exact: true }).click();
  await page.getByTestId("installiert-Qwen3-4B-Q4_K_M").getByTestId("loeschen").click();
  await page.getByTestId("bestaetigung-nein").click();
  expect((await llm(request)).installed).toHaveLength(1);                          // Abbrechen löscht nichts
  await page.getByTestId("installiert-Qwen3-4B-Q4_K_M").getByTestId("loeschen").click();
  await expect(page.getByTestId("bestaetigung")).toContainText("Qwen3-4B-Q4_K_M.gguf");
  await page.getByTestId("bestaetigung-ja").click();
  await expect(page.getByTestId("nichts-installiert")).toBeVisible();
  expect((await llm(request)).default_model).toBeNull();
});

test("Zwei Modelle: Neue Simulation mit dem gewählten Modell startet dieses im eingebauten Server", async ({ page, request }) => {
  await install(request, "Qwen/Qwen3-4B-GGUF", "Qwen3-4B-Q4_K_M.gguf");
  await install(request, "Qwen/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf");
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await post(request, "/api/llm/start", { model_id: "Qwen3-4B-Q4_K_M" });
  await expect.poll(async () => (await llm(request)).runtime.state, { timeout: 30_000 }).toBe("running");
  await call(request, "put", "/api/llm/default", { model_id: "Qwen3-8B-Q4_K_M" });
  await openApp(page);
  await page.keyboard.press("Escape");
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-start").click();                                   // Schnellstart: das Zurücksetzen-Fenster
  const dialog = page.getByRole("dialog", { name: "Zurücksetzen bestätigen" });
  await expect(dialog.getByLabel("Modell")).toHaveValue("Qwen3-8B-Q4_K_M");        // das Standardmodell ist vorgewählt
  await expect(dialog.getByLabel("Modell")).toContainText("noch nicht gemessen");
  await dialog.getByRole("textbox").fill("zurücksetzen");
  await dialog.getByRole("button", { name: "Zurücksetzen", exact: true }).click();
  await expect.poll(async () => { const s = await llm(request); return `${s.sim_model}|${s.runtime.model_id}|${s.runtime.state}`; }, { timeout: 30_000 }).toBe("Qwen3-8B-Q4_K_M|Qwen3-8B-Q4_K_M|running");
});

test("Läuft die Simulation, sind Wechsel, Starten und Testen gesperrt und erklärt", async ({ page, request }) => {
  await install(request, "Qwen/Qwen3-4B-GGUF", "Qwen3-4B-Q4_K_M.gguf");
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await post(request, "/api/sim/start", {});
  await openModelle(page);
  await expect(page.getByTestId("mode-external")).toBeDisabled();
  await expect(page.getByTestId("mode-builtin")).toBeDisabled();
  await expect(page.getByTestId("betriebsart-gesperrt")).toContainText("Simulation läuft");
  const m = page.getByTestId("installiert-Qwen3-4B-Q4_K_M");
  await expect(m.getByTestId("testen")).toBeDisabled();
  await expect(m.getByTestId("starten")).toBeDisabled();
  const refused = await request.put("/api/llm", { data: { mode: "external", external_url: "http://x/v1" }, headers: { "Idempotency-Key": randomUUID() } });
  expect(refused.status()).toBe(409);
  await post(request, "/api/sim/pause");
});

test("Externer Server: Adresse prüfen und übernehmen", async ({ page, request }) => {
  await openModelle(page);
  await page.getByTestId("extern-adresse").fill("http://127.0.0.1:9/v1");
  await page.getByTestId("extern-testen").click();
  await expect(page.getByTestId("extern-ergebnis")).toContainText("nicht erreichbar");
  await page.getByTestId("extern-adresse").fill("http://127.0.0.1:9/v2");
  await page.getByTestId("extern-schluessel").fill("geheim-123");
  await page.getByTestId("extern-speichern").click();
  await expect.poll(async () => (await llm(request)).external_url).toBe("http://127.0.0.1:9/v2");
  const s = await llm(request);
  expect(s.mode).toBe("external");
  expect(s.external_key_set).toBe(true);
  expect(JSON.stringify(s)).not.toContain("geheim-123");                           // der Schlüssel verlässt das Backend nie
  await expect(page.getByTestId("extern-schluessel")).toHaveValue("");
  await expect(page.getByTestId("extern-schluessel")).toHaveAttribute("placeholder", /gespeichert/);
});

test("Der Schritt „Modell“ im Assistenten wählt unter den installierten Modellen und verweist auf die Verwaltung", async ({ page, request }) => {
  await install(request, "Qwen/Qwen3-4B-GGUF", "Qwen3-4B-Q4_K_M.gguf");
  await install(request, "Qwen/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf");
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await call(request, "put", "/api/llm", { mode: "builtin" });
  await post(request, "/api/llm/start", { model_id: "Qwen3-4B-Q4_K_M" });
  await call(request, "put", "/api/llm/default", { model_id: "Qwen3-8B-Q4_K_M" });
  await openApp(page);
  await page.getByTestId("open-menu").click();
  await page.getByTestId("menu-title").click();
  await page.getByTestId("menu-newsim").click();
  await page.getByTestId("newsim-define").click();
  await page.getByTestId("schritt-4").click();
  await expect(page.getByTestId("step-modell")).toBeVisible();
  await expect(page.getByTestId("modell-wahl")).toHaveValue("Qwen3-8B-Q4_K_M");                                       // Standard für neue Simulationen vorgewählt
  await expect(page.getByTestId("modell-siegel")).toContainText("noch nicht gemessen");
  await expect(page.getByTestId("modell-wahl")).toContainText("hier nicht installiert");                              // das bisherige Modell der Simulation steht als erste Wahl, mit Hinweis
  await expect(page.getByTestId("modell-wahl")).toContainText("Qwen3-4B Q4_K_M");
  await page.getByTestId("modelle-verwalten").click();
  await expect(page.getByTestId("modelle")).toBeVisible();
});
