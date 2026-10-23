// Die eigene Figur steuern (AP18h): Klick auf eine Kachel schickt `move_to` an die Simulation, über dieselbe Schnittstelle wie bei jedem Bewohner (POST /api/player/act).
// Die Welt entscheidet; ein Nein erscheint als kleine Blase über der Figur. Weg und Dauer sind nur die Vorschau (A* wie im Backend), die Figur geht erst, wenn die Engine annimmt.
import { create } from "zustand";
import { api, ApiError } from "../../net/api";
import { useSimStore } from "../../store/simStore";
import type { World } from "../../store/types";
import { findPath, gridOf, walkMinutes, type Tile } from "./pathfind";

export const SAY_MAX = 500;                                  // wie `speak` im Backend
export const REJECT_MS = 3000;                               // so lange steht die Ablehnung über der Figur

export interface Preview {
  path: Tile[] | null;
  minutes: number | null;
  goal: Tile | null;
  /** Ablehnung der Welt oder Fehler, drei Sekunden über der Figur. */
  reject: { text: string; at: number } | null;
}

export const usePlayer = create<Preview>(() => ({ path: null, minutes: null, goal: null, reject: null }));

export class PlayerController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private world: () => World | null) {}

  /** Wo die eigene Figur gerade steht. */
  here(): Tile | null {
    const w = this.world(), a = w?.player ? w.agents[w.player] : null;
    return a ? [a.x, a.y] : null;
  }

  /** Klick auf eine Kachel: Weg vorschauen und `move_to` abschicken. Liefert, ob die Engine angenommen hat. */
  async moveTo(tile: Tile): Promise<boolean> {
    const w = this.world(), from = this.here();
    if (!w || !from) return false;
    const g = gridOf(w), path = findPath(g, from, tile);
    usePlayer.setState({ path, minutes: path ? walkMinutes(g, path, w.weather.kind) : null, goal: tile, reject: null });
    try {
      const res = await api.playerAct("move_to", { tile });
      if (res.ok) { if (res.minutes != null) usePlayer.setState({ minutes: res.minutes }); return true; }
      this.refuse(res.text ?? "Das geht gerade nicht.");
    } catch (e) {
      this.refuse(e instanceof ApiError ? e.detail : "Keine Verbindung zur Simulation.");
    }
    return false;
  }

  /** „Abbrechen“ im Band: die laufende Handlung der Figur unterbrechen. */
  async cancel() {
    try {
      const res = await api.playerCancel();
      if (!res.ok) this.refuse(res.text ?? "Das lässt sich nicht abbrechen.");
      else this.clear();
    } catch (e) {
      this.refuse(e instanceof ApiError ? e.detail : "Keine Verbindung zur Simulation.");
    }
  }

  private refuse(text: string) {
    clearTimeout(this.timer);
    usePlayer.setState({ path: null, minutes: null, goal: null, reject: { text, at: Date.now() } });
    this.timer = setTimeout(() => usePlayer.setState({ reject: null }), REJECT_MS);
  }

  clear() { usePlayer.setState({ path: null, minutes: null, goal: null }); }
}

/** Die eine Steuerung deiner Figur (ein Mensch je Simulation). */
export const pc = new PlayerController(() => useSimStore.getState().world);

/** Tippt der Mensch gerade (Eingabefeld, Textfeld, Auswahl, bearbeitbarer Text)? Dann lösen Tasten keine Kürzel aus. */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName, type = ((el as HTMLInputElement).type ?? "text").toLowerCase();
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  return tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
}
