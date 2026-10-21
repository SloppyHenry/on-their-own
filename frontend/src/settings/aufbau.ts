// Aufbau der Einstellungen (Mockup docs/mockups/einstellungen.html): links eine Liste in drei Gruppen, rechts Seiten mit Abschnitten.
// Die Regler kommen aus dem Schema des Backends; hier steht nur, wo sie stehen und wie sie heißen. Die Namen und Erklärungen der Oberfläche
// (TEXTE) gelten auch für Tagebuch und Presets, das Backend behält seine eigenen (sie stehen teils in Prompts).

export type GruppeId = "spiel" | "geraet" | "ki";
export type SeiteId = "spielart" | "zeit" | "welt" | "bewohner" | "darstellung" | "ton" | "modell" | "denken" | "presets";

/** Eine Zeile: ein Regler (`key`) oder ein Bedürfnis (an/aus und Rate in einer Zeile). */
export type Zeile =
  | { key: string; als?: "tilt" | "select" | "area"; null?: string; wenn?: (v: Record<string, unknown>) => boolean }
  | { beduerfnis: string };

export interface Abschnitt { titel: string; notiz?: string; fein?: boolean; nurGott?: boolean; zeilen: Zeile[] }
export interface Seite { id: SeiteId; gruppe: GruppeId | null; icon: string; titel: string; lead: string; abschnitte: Abschnitt[] }

export const GRUPPEN: { id: GruppeId; titel: string }[] = [{ id: "spiel", titel: "Dieses Spiel" }, { id: "geraet", titel: "Dieses Gerät" }, { id: "ki", titel: "KI" }];

export const SEITEN: Seite[] = [
  { id: "spielart", gruppe: "spiel", icon: "✦", titel: "Spielart", lead: "Wer die Welt verändern darf. Gehört zu diesem Spielstand; die Bewohner merken nie etwas davon.",
    abschnitte: [{ titel: "Was die Bewohner wissen", nurGott: true, zeilen: [{ key: "mode" }, { key: "mode.creator_text", als: "area", wenn: (v) => v.mode === "creator" }] }] },
  { id: "zeit", gruppe: "spiel", icon: "◷", titel: "Zeit", lead: "Wie schnell die Welt läuft und wie oft gesichert wird.",
    abschnitte: [
      { titel: "Ablauf", zeilen: [{ key: "sim.speed" }, { key: "world.minutes_per_tick" }, { key: "sim.time_waits_for_decisions" }, { key: "sim.power_save" }] },
      { titel: "Automatisch sichern", zeilen: [{ key: "sim.autosave_sim_hours", null: "aus" }, { key: "sim.autosave_real_minutes", null: "aus" }, { key: "sim.autosave_keep" }] },
      { titel: "Feinheiten", fein: true, zeilen: [{ key: "sim.tick_pause_ms" }, { key: "sim.max_decisions_per_min", null: "frei" }, { key: "decision_interval" }] },
    ] },
  { id: "welt", gruppe: "spiel", icon: "❀", titel: "Welt & Regeln", lead: "Was die Welt hergibt und verlangt. Wirkt sofort.",
    abschnitte: [
      { titel: "Von selbst", zeilen: [{ key: "world.events" }, { key: "world.failure_consequence" }] },
      { titel: "Vorräte", zeilen: [{ key: "world.scarcity" }, { key: "world.resource_availability" }] },
      { titel: "Bedürfnisse", notiz: "Ausgeschaltet steigt ein Bedürfnis nicht mehr und kommt im Denken der Bewohner nicht vor.",
        zeilen: ["energy", "hunger", "thirst", "social", "calm", "warmth"].map((b) => ({ beduerfnis: b })) },
      { titel: "Bauen", zeilen: [{ key: "world.build_cost" }, { key: "world.build_duration" }, { key: "world.max_objects" }] },
      { titel: "Wege", zeilen: [{ key: "world.movement", als: "select" }, { key: "world.movement_custom", wenn: (v) => v["world.movement"] === "custom" }] },
    ] },
  { id: "bewohner", gruppe: "spiel", icon: "☺", titel: "Bewohner", lead: "Wie die Bewohner ticken – für alle auf einmal oder jeden einzeln.",
    abschnitte: [{ titel: "Für alle", notiz: "Die Mitte lässt jeden, wie er ist. Nach rechts verstärkt, nach links dämpft es diesen Zug bei allen.",
      zeilen: ["autonomy", "initiative", "spontaneity", "goal_persistence", "exploration"].map((key) => ({ key, als: "tilt" as const })) }] },
  { id: "darstellung", gruppe: "geraet", icon: "▣", titel: "Darstellung", lead: "Wie die Welt auf diesem Gerät aussieht. Ändert nichts an der Simulation.", abschnitte: [] },
  { id: "ton", gruppe: "geraet", icon: "♪", titel: "Ton", lead: "Alle Klänge entstehen im Browser, nichts wird geladen.", abschnitte: [] },
  { id: "modell", gruppe: "ki", icon: "◉", titel: "Modell", lead: "Das Sprachmodell, das für die Bewohner denkt.",
    abschnitte: [
      { titel: "Diese Simulation", zeilen: [{ key: "llm.model" }, { key: "llm.thinking" }] },
      { titel: "Feinheiten", fein: true, zeilen: ["llm.temperature", "llm.top_p", "llm.max_tokens", "llm.context_budget", "llm.max_concurrent", "llm.timeout_s", "llm.retries", "llm.base_url"].map((key) => ({ key })) },
    ] },
  { id: "denken", gruppe: "ki", icon: "✧", titel: "Denken & Gedächtnis", lead: "Für Fortgeschrittene: wie die Bewohner entscheiden und sich erinnern. Die Standards sind erprobt.",
    abschnitte: [
      { titel: "Entscheiden", zeilen: [{ key: "planning_horizon" }, { key: "top_k_options" }, { key: "rank_hint" }] },
      { titel: "Erinnern", zeilen: [{ key: "memory.max_in_context" }, { key: "memory.context_token_budget" }, { key: "memory.retrieval_threshold" }, { key: "memory.recency_half_life" }] },
      { titel: "Was beim Erinnern zählt", zeilen: [{ key: "memory.w_importance" }, { key: "memory.w_recency" }, { key: "memory.w_relevance" }, { key: "memory.w_shared" }] },
      { titel: "Nachdenken", zeilen: [{ key: "memory.reflection_threshold" }, { key: "memory.summary_interval" }, { key: "memory.archive_after_days", null: "nie" }] },
    ] },
  { id: "presets", gruppe: null, icon: "☰", titel: "Voreinstellungen", lead: "Alle Regler von „Dieses Spiel“ und „KI“ als Satz speichern und laden. Darstellung und Ton bleiben, wie sie sind.", abschnitte: [] },
];

/** Regler je Bewohner (Unterseite Bewohner › Name). */
export const JE_BEWOHNER = { persoenlichkeit: "personality", charakter: "persona" } as const;

export const seiteVon = (id: string): Seite => SEITEN.find((s) => s.id === id) ?? SEITEN[0];
export const zeilenKeys = (z: Zeile): string[] => ("beduerfnis" in z ? [`needs.${z.beduerfnis}.enabled`, `needs.${z.beduerfnis}.rate`] : [z.key]);
export const seitenKeys = (s: Seite): string[] => s.abschnitte.flatMap((a) => a.zeilen.flatMap(zeilenKeys));

/** Name und Erklärung in der Oberfläche (`h: ""` blendet die Erklärung aus; `o` benennt die Auswahl um). Fehlt ein Eintrag, gilt der Text des Backends. */
export const TEXTE: Record<string, { l?: string; h?: string; o?: Record<string, string> }> = {
  "mode": { l: "Wissen über dich", h: "Gilt nur in der Spielart Gott. Ändert keine Erinnerungen, nur künftige Entscheidungen." },
  "mode.creator_text": { l: "Was sie über den Schöpfer wissen", h: "Steht so im Prompt der Bewohner." },
  "sim.speed": { h: "Auch oben links neben der Uhr." },
  "world.minutes_per_tick": { l: "Minuten je Schritt", h: "Mehr Minuten: der Tag vergeht schneller, Entscheidungen fallen seltener." },
  "sim.time_waits_for_decisions": { l: "Zeit wartet auf die Bewohner", h: "Die Uhr steht, bis alle freien Bewohner entschieden haben." },
  "sim.power_save": { h: "Höchstens 4 Entscheidungen je Minute, tagsüber kein Nachdenken, Pause ohne Zuschauer." },
  "sim.autosave_sim_hours": { l: "Alle … Spielstunden", h: "0 = aus. Überschreibt nie deine eigenen Stände." },
  "sim.autosave_real_minutes": { l: "Zusätzlich alle … Minuten Echtzeit", h: "0 = aus." },
  "sim.autosave_keep": { l: "So viele Autosaves behalten", h: "Ältere werden gelöscht." },
  "sim.tick_pause_ms": { l: "Pause je Schritt", h: "Überschreibt das Tempo." },
  "sim.max_decisions_per_min": { l: "Höchstens … Entscheidungen je Minute", h: "Begrenzt die Last auf das Modell. 0 = unbegrenzt." },
  "decision_interval": { l: "Abstand zwischen zwei Entscheidungen", h: "Je Bewohner, in Spielminuten. 1 = sobald er frei ist." },
  "world.events": { l: "Ereignisse der Welt", h: "Gewitter, ein umgestürzter Baum, ein Fuchs im Garten … ohne Urheber." },
  "world.failure_consequence": { l: "Was ein Fehlschlag kostet", h: "Wenn eine Handlung nicht gelingt.", o: { none: "nichts", time: "Zeit", energy: "Zeit + Energie" } },
  "world.scarcity": { h: "100 % = nur noch ein Zehntel von allem." },
  "world.resource_availability": { l: "Höchstvorrat je Ort", h: "100 % = normal." },
  "world.max_objects": { l: "Höchstzahl Dinge", h: "Grenze für alles, was gebaut oder hergestellt wird." },
  "world.movement": { l: "Wohin die Bewohner dürfen", h: "", o: { free: "überallhin", house_garden: "nur Haus und Garten", no_forest: "nicht in den Wald", custom: "eigene Liste" } },
  "world.movement_custom": { l: "Gesperrte Orte", h: "Durch Komma getrennt, z. B. lake, forest." },
  "autonomy": { l: "Eigene Vorhaben", h: "Statt nur auf andere und Ereignisse zu reagieren." },
  "initiative": { h: "Von sich aus Gespräche und Unternehmungen beginnen." },
  "spontaneity": { h: "Vom Plan abweichen." },
  "goal_persistence": { l: "Beharrlichkeit", h: "Bei einem Ziel bleiben." },
  "exploration": { h: "Neugier auf Unbekanntes." },
  "personality.conflict_readiness": { l: "Widerspruch" },
  "personality.cooperation": { l: "Zusammenarbeit" },
  "personality.conversation_initiative": { l: "Spricht andere an" },
  "personality.suggestion_acceptance": { l: "Nimmt Vorschläge an" },
  "personality.persistence": { l: "Beharrlichkeit" },
  "personality.autonomy": { l: "Eigene Vorhaben" },
  "profile.description": { l: "Beschreibung", h: "Wie die Figur ist." },
  "profile.background": { h: "Was die Figur erlebt hat, bevor die Simulation beginnt." },
  "profile.interests": { h: "Wofür sich die Figur interessiert; wirkt auch darauf, welche Orte und Dinge sie mag. Mehrere Einträge mit Komma trennen." },
  "profile.dislikes": { h: "Was die Figur nicht mag. Mehrere Einträge mit Komma trennen." },
  "profile.goals": { l: "Ziele", h: "Langfristige Ziele der Figur. Mehrere Einträge mit Komma trennen." },
  "profile.communication_style": { l: "Sprechweise", h: "Wie die Figur spricht." },
  "llm.model": { h: "Gilt für die ganze Simulation. Ein anderes Modell braucht eine neue Simulation." },
  "llm.thinking": { l: "Nachdenken vor der Antwort", h: "Kostet deutlich Zeit." },
  "llm.temperature": { h: "Höher = freier, zufälliger." },
  "llm.top_p": { h: "Begrenzt die Wortauswahl." },
  "llm.max_tokens": { l: "Längste Antwort", h: "" },
  "llm.context_budget": { l: "Längster Prompt", h: "Darüber fallen erst alte Erinnerungen weg." },
  "llm.max_concurrent": { h: "Über 1 nur, wenn der Router mehrere Plätze hat." },
  "llm.timeout_s": { h: "" },
  "llm.retries": { h: "Bei einer fehlgeschlagenen Anfrage." },
  "planning_horizon": { l: "Schritte je Plan", h: "" },
  "top_k_options": { l: "Möglichkeiten je Entscheidung", h: "So viele bewertete Möglichkeiten sieht das Modell." },
  "rank_hint": { l: "Reihenfolge verraten", h: "Das Modell erfährt, dass die Möglichkeiten nach Passung geordnet sind." },
  "memory.max_in_context": { l: "Erinnerungen je Entscheidung", h: "" },
  "memory.context_token_budget": { l: "Platz für Erinnerungen", h: "" },
  "memory.retrieval_threshold": { h: "Ab dieser Punktzahl wird eine Erinnerung abgerufen." },
  "memory.recency_half_life": { l: "Halbwertszeit", h: "Danach zählt eine Erinnerung nur noch halb." },
  "memory.w_importance": { l: "Wichtigkeit", h: "" },
  "memory.w_recency": { l: "Aktualität", h: "" },
  "memory.w_relevance": { l: "Passung zur Lage", h: "" },
  "memory.w_shared": { l: "Gemeinsam Erlebtes", h: "" },
  "memory.reflection_threshold": { l: "Schwelle zum Nachdenken", h: "Summe der Wichtigkeit neuer Erinnerungen." },
  "memory.summary_interval": { l: "Zusammenfassung alle", h: "" },
  "memory.archive_after_days": { l: "Archivieren nach", h: "0 = nie." },
};
