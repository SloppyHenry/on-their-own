// Klang (AP17d): Bühne – verbindet die Weltansicht mit den Klängen. Klänge gibt es nur für Sichtbares: links/rechts nach der Lage im Bild,
// leiser und dumpfer mit Abstand zur Bildmitte. Schritte entstehen aus der Bewegung der Figur (Boden unter den Füßen), Türen beim
// Betreten und Verlassen eines Hauses, Geräusche aus den Aktionen (Ereignisse), Stimmen aus den Gesprächen. Nichts davon erreicht die Bewohner.
import { onLiveEvents } from "../store/simStore";
import type { World } from "../store/types";
import type { EventOut } from "../types/generated";
import { useUiStore } from "../store/uiStore";
import type { AgentFrame, Frame, WorldBridge } from "../world/worldBridge";
import { hatAufnahme, spieleAufnahme } from "./aufnahmen";
import { useTon } from "./einstellungen";
import { SFX, type Boden, type Sfx } from "./geraeusche";
import { clamp, k, place } from "./kern";
import { ansicht, klangBereit } from "./regie";
import { isSpeaking, speak, standardStimme, wartend, type Stimme } from "./stimmen";

/** Stimme eines Bewohners: eigene Stimme aus der Welt (Spielstand), sonst der Vorschlag aus Geschlecht und Alter. */
export function stimmeVon(w: World | null, id: string): Stimme {
  return { ...standardStimme(id, w?.agents[id]?.profile), ...(w?.voices?.[id] as Partial<Stimme> | undefined) };
}
/** Wie oft welcher Klang im Spiel erklang (Messung und Tests). */
export const zaehler: Record<string, number> = {};
/** Spielt ein Geräusch an einem Ort; ohne Aufnahme (oder solange sie lädt) aus Code. */
export function geraeusch(name: Sfx, dest: AudioNode, boden?: Boden) {
  const key = name === "step" ? `step:${boden}` : name; zaehler[key] = (zaehler[key] ?? 0) + 1;
  if (useTon.getState().quelle.fig === "cc0" && hatAufnahme(name) && spieleAufnahme(name, dest, boden)) return;
  if (name === "step") SFX.step(dest, boden); else (SFX[name] as (d: AudioNode) => void)(dest);
}

/** Aktion → Geräusch (use nach Modus, gather nach Rohstoff). */
export function klangFuer(action: string, params: Record<string, unknown>): Sfx | null {
  const mode = String(params.mode ?? ""), res = String(params.resource ?? params.object_id ?? "").toLowerCase();
  if (action === "use") return ({ cook: "pot", read: "book", write: "write", sit: "cloth", sleep: "cloth", store: "latch", retrieve: "latch", lock: "latch", unlock: "latch", light: "light", extinguish: "blow", harvest: "cloth", fish: "splash", row: "splash", post: "cloth", collect: "cloth", fix: "hammer", pet: "purr" } as Record<string, Sfx>)[mode] ?? null;
  if (action === "gather") return /holz|wood|log|ast/.test(res) ? "chop" : /stein|stone|erz|ore/.test(res) ? "hammer" : /wasser|water/.test(res) ? "splash" : "cloth";
  if (/coin|münz|geld|taler|gold/.test(res) && (action === "give" || action === "take")) return "coins";
  return ({ plant: "dig", water: "pour", build: "hammer", eat: "clink", drink: "clink", rest: "cloth", sleep: "cloth", take: "cloth", drop: "cloth", give: "cloth" } as Record<string, Sfx>)[action] ?? null;
}
/** Boden unter einer Kachel: Kachelart, im Haus Dielen, Pflaster und Fliesen nach dem Stil des Ortes. */
export function bodenAt(w: World, tx: number, ty: number, inside: boolean): Boden | null {
  const ch = w.map.rows[ty]?.[tx], type = ch ? w.map.legend[ch] : undefined;
  if (type === "water") return null;
  const loc = Object.values(w.locations).find((l) => tx >= l.rect[0] && ty >= l.rect[1] && tx < l.rect[0] + l.rect[2] && ty < l.rect[1] + l.rect[3]);
  const style = (loc?.props?.style ?? {}) as { surface?: string; floor?: string };
  if (style.surface === "cobble" || style.floor === "tile") return "stein";
  if (inside || type === "floor" || type === "door" || type === "furniture") return "holz";
  if (type === "path") return "weg";
  return "gras";
}

const STEP_PX = 9, STEP_GAP = 0.22;
/** Bremse für schnelle Simulation: je Schlüssel ein Mindestabstand, insgesamt höchstens 6 Geräusche je Sekunde (Schritte zählen nicht). */
const zuletztAm = new Map<string, number>(), kurz: number[] = [];
function darf(key: string, gap: number): boolean {
  const t = performance.now() / 1000;
  while (kurz.length && t - kurz[0] > 1) kurz.shift();
  if (kurz.length >= 6 || t - (zuletztAm.get(key) ?? -1e9) < gap) return false;
  zuletztAm.set(key, t); kurz.push(t); return true;
}
interface Fig { pos: [number, number] | null; acc: number; last: number; home: number; snore: number }

/** Meldet die Weltansicht an; liefert das Abmelden. `size` liefert die Größe der Fläche in CSS-Pixeln. */
export function verbindeBuehne(bridge: WorldBridge, size: () => { w: number; h: number }): () => void {
  let F: Frame | null = null; const figs = new Map<string, Fig>(), queue: { who: string; text: string; at: number }[] = [];
  ansicht.aktiv = true;
  const spielt = () => klangBereit() && useUiStore.getState().appMode === "game";
  /** Ort einer Figur (0–1 und Abstand) oder null, wenn sie nicht zu sehen ist. */
  const ortVon = (a: AgentFrame | undefined) => {
    if (!F || !a || !a.visible) return null;
    const { w, h } = size(), x = clamp(a.x / Math.max(1, w), 0, 1), y = clamp(a.y / Math.max(1, h), 0, 1);
    const c = Math.min(1, Math.hypot((x - 0.5) * 2, (y - 0.5) * 2) / 1.3);
    return { x, d: F.interior >= 0 ? 0.1 + 0.2 * c : 0.8 * c };
  };
  /** Ort als Eingang in den Kanal; nach 8 s abgehängt (dann ist jedes Geräusch verklungen), damit keine Knoten liegen bleiben. */
  const ziel = (o: { x: number; d: number }) => { const g = place(k().bus.fig, o.x, o.d); setTimeout(() => g.disconnect(), 8000); return g; };
  const beiFigur = (id: string, name: Sfx) => { const o = ortVon(F?.agents.find((a) => a.id === id)); if (o && darf(`fig:${id}`, 1.5)) geraeusch(name, ziel(o)); };

  const onFrame = (f: Frame) => {
    const first = !F; F = f; ansicht.interior = f.interior;
    if (!spielt()) { for (const a of f.agents) figs.set(a.id, { pos: a.pos ?? null, acc: 0, last: 0, home: a.home ?? -1, snore: figs.get(a.id)?.snore ?? 0 }); return; }
    const w = bridge.world(), t = k().ctx.currentTime;
    for (const a of f.agents) {
      const g = figs.get(a.id) ?? { pos: null, acc: 0, last: 0, home: a.home ?? -1, snore: 0 }; figs.set(a.id, g);
      // Tür: Haus betreten oder verlassen (am Haus, wenn man draußen hinsieht; drinnen nur im gezeigten Haus)
      const home = a.home ?? -1;
      if (!first && home !== g.home) {
        const n = home >= 0 ? home : g.home, hf = f.houses[n], { w: W, h: H } = size();
        const o = f.interior >= 0 ? (f.interior === n ? { x: clamp(a.x / Math.max(1, W), 0, 1), d: 0.15 } : null)
          : hf && hf.x > -40 && hf.x < W + 40 && hf.cy > -40 && hf.cy < H + 40 ? { x: clamp(hf.x / W, 0, 1), d: 0.8 * Math.min(1, Math.hypot(hf.x / W - 0.5, hf.cy / H - 0.5) * 1.6) } : null;
        if (o && darf(`tuer:${n}`, 2.5)) { geraeusch("doorOpen", ziel(o)); setTimeout(() => { if (klangBereit()) geraeusch("doorClose", ziel(o)); }, 1100); }
        g.home = home;
      }
      // Schritte: alle STEP_PX Weltpixel einer, höchstens alle STEP_GAP Sekunden; Sprünge (Boot, Laden) zählen nicht
      const p = a.pos ?? null;
      if (p && g.pos) {
        const d = Math.hypot(p[0] - g.pos[0], p[1] - g.pos[1]);
        g.acc = d > 40 ? 0 : g.acc + d;
        if (g.acc >= STEP_PX && t - g.last >= STEP_GAP) {
          g.acc = 0; g.last = t;
          const o = ortVon(a), boden = w && o ? bodenAt(w, Math.floor(p[0] / 16), Math.floor(p[1] / 16), home >= 0) : null;
          if (o && boden) geraeusch("step", ziel(o), boden);
        }
      } else g.acc = 0;
      g.pos = p;
    }
  };
  // Schlafen: alle 7–9 s ein Atemzug mit Schnarchen, solange man die schlafende Figur sieht
  const sleep = window.setInterval(() => {
    const w = bridge.world(); if (!w || !F || !spielt()) return;
    const t = k().ctx.currentTime;
    for (const a of Object.values(w.agents)) {
      const asleep = a.action?.type === "sleep" || (a.action?.type === "use" && a.action.params?.mode === "sleep") || a.status === "sleeping";
      const g = figs.get(a.id); if (!asleep || !g || t - g.snore < 8) continue;
      const o = ortVon(F.agents.find((x) => x.id === a.id)); if (o) { g.snore = t; geraeusch("snore", ziel(o)); }
    }
  }, 1000);
  // Gespräche: eine Zeile nach der anderen, jede mit der Stimme ihrer Figur; alte Zeilen (über 10 s) entfallen
  const pump = () => {
    if (!spielt() || isSpeaking()) return;
    while (queue.length) {
      const q = queue.shift()!;
      if (wartend.get(q.who) === q.text) wartend.delete(q.who);
      if (Date.now() - q.at > 10000) continue;
      const o = ortVon(F?.agents.find((a) => a.id === q.who)); if (!o) continue;
      zaehler.stimme = (zaehler.stimme ?? 0) + 1;
      speak(q.who, q.text, stimmeVon(bridge.world(), q.who), { x: o.x, d: o.d * 0.6, onDone: () => setTimeout(pump, 250) });
      return;
    }
  };
  const pumpTimer = window.setInterval(pump, 400);
  const offEvents = onLiveEvents((evs: EventOut[]) => {
    if (!spielt()) return;
    for (const ev of evs) {
      const who = ev.agents[0];
      if (ev.type === "agent.dialogue") { const d = ev.data as { speaker: string; text: string }; queue.push({ who: d.speaker, text: d.text, at: Date.now() }); if (isSpeaking() && ortVon(F?.agents.find((a) => a.id === d.speaker))) wartend.set(d.speaker, d.text); }
      else if (ev.type === "agent.action_started" && who) { const d = ev.data as { action: string; params?: Record<string, unknown> }; const s = klangFuer(d.action, d.params ?? {}); if (s) beiFigur(who, s); }
    }
    pump();
  });
  const offFrame = bridge.onFrame(onFrame);
  return () => { offFrame(); offEvents(); clearInterval(sleep); clearInterval(pumpTimer); wartend.clear(); ansicht.aktiv = false; ansicht.interior = -1; };
}
