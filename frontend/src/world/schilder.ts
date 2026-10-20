// Schilder, Sprech- und Denkblasen setzen (AP18c): Inhalt und Lage je Bild. Die Auswahl, wer was zeigt, steht hier; das Ausweichen ist die reine Funktion in `blasen.ts`.
// Kosten je Bild bleiben klein: höchstens 8 Bewohner, nur die sichtbaren, Größen werden nur beim Inhaltswechsel gemessen.
import { activityOf } from "../panels/AgentPanel";
import type { Pulse } from "../store/simStore";
import type { Bubble, World } from "../store/types";
import { haeltBlase, sprechStand } from "../klang/stimmen";
import { ausweichen, type Teil } from "./blasen";
import type { Frame } from "./worldBridge";

export const MAX_CHARS = 140;
const MEMO_MS = 4000;
const snippet = (t?: string) => (!t ? "etwas" : t.length > 30 ? `${t.slice(0, 29)}…` : t);
export const bubbleDuration = (text: string) => Math.min(12000, Math.max(3500, 2500 + 55 * text.length));

const sizes = new WeakMap<HTMLElement, { key: string; w: number; h: number }>();
/** Größe eines Elements; nur neu gemessen, wenn sich sein Inhalt geändert hat (Layout-Messung ist teuer). */
function size(el: HTMLElement, key: string): { w: number; h: number } {
  const c = sizes.get(el);
  if (c && c.key === key) return c;
  const s = { key, w: el.offsetWidth, h: el.offsetHeight };
  sizes.set(el, s);
  return s;
}

export interface Optionen { selected: string | null; follow: string | null; wenig: boolean }

/** Was die Wolke eines Bewohners zeigt: die Tätigkeit und, wenn es einen gibt, sein Gedanke (der nächste Plan). */
export function wolke(w: World, id: string): { was: string; denkt: string } {
  const a = w.agents[id], act = activityOf(a, w);
  return { was: a.status === "deciding" ? "überlegt" : act.text.replace(/^überlegt: .*$/, "überlegt"), denkt: a.plan_next ?? "" };
}

/** Setzt alle Schilder und Blasen für dieses Bild. `el` ist die Überlagerung; die Elemente je Bewohner trägt React (Overlays.tsx). */
export function setzeSchilder(el: HTMLElement, f: Frame, w: World, bubbles: Record<string, Bubble>, pulses: Record<string, Pulse>, o: Optionen): void {
  const W = el.clientWidth, H = el.clientHeight, now = Date.now(), teile: Teil[] = [], an: { id: string; node: HTMLElement; zeiger?: boolean }[] = [];
  const q = (kind: string, id: string) => el.querySelector<HTMLElement>(`[data-${kind}="${id}"]`);
  f.agents.forEach((a, idx) => {
    const tag = q("tag", a.id), bub = q("bubble", a.id), think = q("think", a.id), mark = q("mark", a.id), memo = q("memo", a.id);
    const inside = a.house >= 0 && f.interior < 0;                                      // drinnen und draußen nicht zu sehen: Bildnis auf dem Dach (roofs)
    const foot = { x: a.x, y: a.y + 4 * a.scale }, head = { x: a.x, y: a.y - 26 * a.scale };
    const on = a.visible && !inside && foot.x > -60 && foot.x < W + 60 && foot.y > -40 && foot.y < H + 40;
    const pulse = pulses[a.id], active = pulse && now - pulse.at < MEMO_MS ? pulse.kind : "";
    if (tag) {
      tag.dataset.pulse = active;
      tag.dataset.inside = inside ? "1" : "";
      tag.dataset.foot = a.visible ? `${foot.x.toFixed(1)},${foot.y.toFixed(1)}` : "";                  // Fußpunkt vor dem Ausweichen (Prüfzugang)
      tag.style.display = on ? "" : "none";
      if (on) { const s = size(tag, tag.textContent ?? ""); teile.push({ id: `tag:${a.id}`, x: foot.x, y: foot.y, w: s.w, h: s.h, rang: idx * 0.001, runter: true }); an.push({ id: `tag:${a.id}`, node: tag }); }
    }
    const b = bubbles[a.id], rede = !!bub && !!b && on && (now - b.shownAt < bubbleDuration(b.text) || haeltBlase(a.id, b.text));
    if (bub) {
      bub.style.display = rede ? "" : "none";
      if (rede && b) {
        if (bub.dataset.id !== b.id) { bub.dataset.id = b.id; bub.dataset.seq = String(b.seq); bub.title = b.text.length > MAX_CHARS ? "Klicken für den ganzen Text im Tagebuch" : ""; }
        const said = sprechStand(a.id, b.text), text = said == null ? b.text : b.text.slice(0, said), shown = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
        const t = bub.querySelector<HTMLElement>("[data-text]");
        if (t && t.textContent !== shown) t.textContent = shown;
        const s = size(bub, shown);
        teile.push({ id: `say:${a.id}`, x: head.x, y: head.y - 4, w: s.w, h: s.h, rang: 1 + idx * 0.001 }); an.push({ id: `say:${a.id}`, node: bub, zeiger: true });
      }
    }
    const denkt = on && !rede && !!think, c = denkt ? wolke(w, a.id) : null;
    if (think) {
      think.dataset.show = denkt ? "1" : "";
      if (c) {
        const was = think.querySelector<HTMLElement>("[data-was]"), dk = think.querySelector<HTMLElement>("[data-denkt]");
        if (was && was.textContent !== c.was) was.textContent = c.was;
        if (dk) { if (dk.textContent !== c.denkt) dk.textContent = c.denkt; dk.style.display = c.denkt ? "" : "none"; }
      }
    }
    if (mark) mark.dataset.show = denkt && o.wenig ? "1" : "";
    if (think && c) {
      const rang = a.id === o.selected || a.id === o.follow ? 2 : 3;
      if (o.wenig && mark) { const s = size(mark, "m"); teile.push({ id: `mark:${a.id}`, x: head.x, y: head.y - 4, w: s.w, h: s.h, rang }); an.push({ id: `mark:${a.id}`, node: mark }, { id: `mark:${a.id}`, node: think }); }
      else { const s = size(think, `${c.was}|${c.denkt}`); teile.push({ id: `think:${a.id}`, x: head.x, y: head.y - 14, w: s.w, h: s.h, rang }); an.push({ id: `think:${a.id}`, node: think, zeiger: true }); }
    }
    if (memo) {
      const show = on && !!active;
      memo.dataset.show = show ? "1" : ""; memo.dataset.art = active;
      if (show) {
        const t = memo.querySelector<HTMLElement>("em"), ic = memo.querySelector<HTMLElement>("span"), txt = `${active === "saved" ? "merkt sich" : "erinnert sich an"}: ${snippet(pulse?.text)}`;
        if (t && t.textContent !== txt) t.textContent = txt;
        if (ic) ic.textContent = active === "saved" ? "＋" : "↺";
        const s = size(memo, txt);
        teile.push({ id: `memo:${a.id}`, x: head.x + 50, y: head.y + 24, w: s.w, h: s.h, rang: 4 }); an.push({ id: `memo:${a.id}`, node: memo });
      }
    }
  });
  for (const h of f.houses) {                                                            // Dach: Bildnisse derer, die im Haus sind
    const roof = q("roof", String(h.i));
    if (!roof) continue;
    const show = f.interior < 0 && h.occupants.length > 0;
    roof.style.display = show ? "" : "none";
    if (show) { const s = size(roof, h.occupants.join()); teile.push({ id: `roof:${h.i}`, x: h.x, y: h.y - 4, w: s.w, h: s.h, rang: 2 }); an.push({ id: `roof:${h.i}`, node: roof }); }
  }
  const plaetze = new Map(ausweichen(teile, W, H).map((p) => [p.id, p]));
  for (const { id, node, zeiger } of an) {
    const p = plaetze.get(id)!;
    node.style.transform = `translate(${p.left}px, ${p.top}px)`;
    if (zeiger) node.style.setProperty("--zeiger", `${p.zeiger}px`);
  }
}
