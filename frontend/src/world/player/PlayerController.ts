// Eine Schnittstelle für Absichten des Menschen: gehen, handeln, sagen. In AP13 nur Vorschau („würde …“), es wird NICHTS an die
// Simulation geschickt. Später hängt der Mitspieler-Modus diese Methoden an das Backend (gleiche Aktions-Schnittstelle wie KI-Agenten).
import { create } from "zustand";
import type { World } from "../../store/types";
import type { Target } from "../view/scene";
import { choicesFor, nameOf, type Choice } from "./actions";
import { findPath, gridOf, nearestOpen, walkMinutes, type Tile } from "./pathfind";

export const SAY_MAX = 500;                                  // wie `speak` im Backend

export interface Preview {
  /** Vorschau-Figur „Du (Vorschau)“, nur im Browser (offene Frage 20). */
  ghost: Tile | null;
  path: Tile[] | null;
  minutes: number | null;
  goal: Tile | null;
  menu: { x: number; y: number; target: Target } | null;
  say: { open: boolean; to: string | null };
  /** Was der Mensch tun würde, neueste zuerst. */
  intents: string[];
}

export const usePlayer = create<Preview>(() => ({ ghost: null, path: null, minutes: null, goal: null, menu: null, say: { open: false, to: null }, intents: [] }));

const note = (text: string) => usePlayer.setState((s) => ({ intents: [text, ...s.intents].slice(0, 5) }));

export class PlayerController {
  constructor(private world: () => World | null) {}

  /** Startpunkt der Vorschau-Figur: Mitte des Pflasterplatzes, sonst Kartenmitte; nächste begehbare Kachel. */
  place(): Tile | null {
    const w = this.world();
    if (!w) return null;
    const square = Object.values(w.locations).find((l) => (l.props.style as { surface?: string } | undefined)?.surface === "cobble");
    const [x, y] = square ? [square.rect[0] + Math.floor(square.rect[2] / 2), square.rect[1] + Math.floor(square.rect[3] / 2)] : [Math.floor(w.map.width / 2), Math.floor(w.map.height / 2)];
    const t = nearestOpen(gridOf(w), x, y);
    usePlayer.setState({ ghost: t });
    return t;
  }

  /** „würde gehen nach …“: Weg und Dauer als Vorschau; die Figur bleibt stehen. */
  moveTo(tile: Tile): boolean {
    const w = this.world(), from = usePlayer.getState().ghost ?? this.place();
    if (!w || !from) return false;
    const g = gridOf(w), path = findPath(g, from, tile);
    if (!path) { usePlayer.setState({ path: null, minutes: null, goal: tile }); note(`kein Weg nach (${tile[0]}, ${tile[1]})`); return false; }
    const minutes = walkMinutes(g, path, w.weather.kind);
    usePlayer.setState({ path, minutes, goal: tile });
    note(`würde gehen nach (${tile[0]}, ${tile[1]}), etwa ${minutes} Min.`);
    return true;
  }

  /** „würde … tun“: Handlung an einem Ziel (Figur, Objekt, Vorrat, Haus), nur angezeigt. */
  interact(target: Target, action: string, params: Record<string, unknown> = {}): Choice | null {
    const w = this.world();
    if (!w) return null;
    const c = choicesFor(target, w).find((x) => x.action === action && (x.params.mode ?? null) === (params.mode ?? null)) ?? null;
    note(c ? `würde ${nameOf(target, w)} ${c.label}` : `würde ${action} an ${nameOf(target, w)} versuchen`);
    return c;
  }

  /** „würde sagen …“: höchstens SAY_MAX Zeichen, wie `speak`. */
  say(to: string | null, text: string): boolean {
    const t = text.trim().slice(0, SAY_MAX);
    if (!t) return false;
    const w = this.world(), name = to ? w?.agents[to]?.name ?? to : null;
    note(name ? `würde zu ${name} sagen: „${t}“` : `würde sagen: „${t}“`);
    return true;
  }

  clear() { usePlayer.setState({ path: null, minutes: null, goal: null, menu: null, say: { open: false, to: null } }); }
}

/** Tippt der Mensch gerade (Eingabefeld, Textfeld, Auswahl, bearbeitbarer Text)? Dann lösen Tasten keine Kürzel aus. */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName, type = ((el as HTMLInputElement).type ?? "text").toLowerCase();
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  return tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
}
