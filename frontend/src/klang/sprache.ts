// Klang (AP17d): Text für die Plapperstimmen zerlegen (Mockup docs/mockups/klang/stimmen.js). Ohne Audio, daher auch im Test prüfbar.
// Text → Sätze und Teilsätze → Wörter → Silben (Anlaut, Vokal, Auslaut) → Satzmelodie und Zeitplan.
import { seeded } from "./kern";

export const VOWEL_F: Record<string, number[]> = { a: [730, 1100, 2450], e: [470, 1950, 2550], i: [300, 2250, 2950], o: [460, 830, 2700], u: [330, 780, 2250], ä: [620, 1750, 2500], ö: [430, 1450, 2300], ü: [310, 1650, 2200], y: [310, 1650, 2200], "@": [500, 1500, 2450] };
export const DIPH: Record<string, string[]> = { ei: ["a", "i"], ai: ["a", "i"], au: ["a", "u"], eu: ["o", "ü"], äu: ["o", "ü"], ie: ["i"], aa: ["a"], ee: ["e"], oo: ["o"] };
const FUNC = new Set("der die das den dem des ein eine einen einem einer und oder aber ich du er sie es wir ihr mir mich dir dich uns ist bin bist sind war hat hab habe zu zum zur im in an am auf aus mit von vom für bei so wie als dass the a".split(" "));
const WQ = /^(wer|wen|wem|wie|was|wo|wann|warum|wieso|weshalb|welche[rsnm]?|woher|wohin|wozu)$/;
const NUC = /ei|ai|au|eu|äu|ie|aa|ee|oo|[aeiouyäöü]/g;
/** Nach so vielen Silben verklingt die Stimme (~8 s); die Blase zeigt trotzdem den ganzen Text. */
export const MAX_SYL = 36;

export type Ende = "?" | "!" | "…" | "." | ",";
interface Word { w: string; s: number; e: number }
interface Phrase { words: Word[]; end: Ende; pe: number }
export interface Syl { on: string; v: string; coda: string; s: number; e: number; vs?: number; stress?: boolean; func?: boolean; long?: boolean; weak?: boolean; wi?: number; first?: boolean }
export interface Planned extends Syl { st: number; dur: number; amp: number; wordStart: boolean; end: Ende | null; pe: number }

export function parseText(text: string): Phrase[] {
  const phrases: Phrase[] = []; let cur: Word[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+|\.{3}|[.!?…,;:—–]+/gu)) {
    const tok = m[0], at = m.index ?? 0;
    if (/[\p{L}\p{N}]/u.test(tok)) { cur.push({ w: tok.toLowerCase(), s: at, e: at + tok.length }); continue; }
    if (!cur.length) continue;
    const end: Ende = tok.includes("?") ? "?" : tok.includes("!") ? "!" : /…|\.\.\./.test(tok) ? "…" : tok.includes(".") ? "." : ",";
    phrases.push({ words: cur, end, pe: at + tok.length }); cur = [];
  }
  if (cur.length) phrases.push({ words: cur, end: ".", pe: cur[cur.length - 1].e });
  return phrases;
}

export function syllables(word: string, off: number): Syl[] {
  if (/^\d+$/.test(word)) return [...word].map((_, i) => ({ on: "", v: "ei", coda: "", s: off + i, e: off + i + 1 }));
  const nucs = [...word.matchAll(NUC)];
  if (!nucs.length) return [{ on: word, v: "@", coda: "", s: off, e: off + word.length, weak: true }];
  const out: Syl[] = [];
  nucs.forEach((n, i) => {
    const prev = nucs[i - 1], ni = n.index ?? 0;
    let on = word.slice(prev ? (prev.index ?? 0) + prev[0].length : 0, ni);
    if (i) { const keep = (on.match(/(sch|ch|ck|qu|[^aeiouyäöü])$/) || [""])[0]; out[i - 1].coda = on.slice(0, on.length - keep.length); on = keep; }
    out.push({ on, v: n[0], coda: "", vs: ni, s: 0, e: 0 });
  });
  const last = nucs[nucs.length - 1]; out[out.length - 1].coda = word.slice((last.index ?? 0) + last[0].length);
  out.forEach((sy, i) => { sy.s = off + (i ? sy.vs! - sy.on.length : 0); sy.e = off + (i < out.length - 1 ? out[i + 1].vs! - out[i + 1].on.length : word.length); });
  // Betonung: erste Silbe, nach unbetonter Vorsilbe die zweite; Füllwörter unbetont
  const stressAt = out.length > 1 && /^(be|ge|ver|er|zer|ent|emp)/.test(word) ? 1 : 0;
  out.forEach((sy, i) => { sy.stress = i === stressAt && !FUNC.has(word); sy.func = FUNC.has(word); sy.long = /^(ie|aa|ee|oo)$/.test(sy.v) || sy.coda.startsWith("h") || !!DIPH[sy.v]; });
  return out;
}

export interface Cons { k: "fric" | "plos" | "son" | "asp"; f?: number; q?: number; a: number; d: number; clo?: number; voiced?: boolean; F?: number[]; roll?: boolean }
/** Konsonanten in Laute zerlegen: Art (Reibe-, Verschluss-, Nasal-, Fließlaut, Hauch), Filter, Dauer. */
export function consonants(cl: string): Cons[] {
  const segs: Cons[] = [];
  for (const c of cl.match(/sch|ch|ck|ph|qu|ng|ß|./g) || []) {
    if (/^(s|ß|c)$/.test(c)) segs.push({ k: "fric", f: 6300, q: 1.6, a: 0.3, d: 0.065 });
    else if (c === "z" || c === "x") segs.push({ k: "plos", f: 3800, a: 0.25, d: 0.012, clo: 0.025 }, { k: "fric", f: 6300, q: 1.6, a: 0.3, d: 0.05 });
    else if (c === "sch") segs.push({ k: "fric", f: 2700, q: 1.3, a: 0.4, d: 0.08 });
    else if (c === "ch") segs.push({ k: "fric", f: 3900, q: 1, a: 0.22, d: 0.06 });
    else if (/^(f|v|ph)$/.test(c)) segs.push({ k: "fric", f: 7500, q: 0.7, a: 0.12, d: 0.055 });
    else if (c === "h") segs.push({ k: "asp", a: 0.5, d: 0.04 });
    else if (/^(p|t|k|ck|qu)$/.test(c)) segs.push({ k: "plos", f: ({ p: 900, t: 4200, k: 2100, ck: 2100, qu: 2100 } as Record<string, number>)[c], a: 0.45, d: 0.018, clo: 0.035 });
    else if (/^(b|d|g)$/.test(c)) segs.push({ k: "plos", f: ({ b: 700, d: 3200, g: 1700 } as Record<string, number>)[c], a: 0.2, d: 0.01, clo: 0.022, voiced: true });
    else if (/^(m|n|ng)$/.test(c)) segs.push({ k: "son", F: [260, 1050, 2300], a: 0.5, d: 0.05 });
    else if (/^(l|r|w|j)$/.test(c)) segs.push({ k: "son", F: c === "j" ? [300, 2100, 2900] : c === "l" ? [360, 1300, 2600] : [420, 1200, 2400], a: 0.55, d: 0.04, roll: c === "r" });
  }
  return segs;
}

/** Satzmelodie und Zeitplan: Betonung, Absinken, Frage steigt, Aussage fällt, Komma hebt, Ausruf weiter und lauter, „…“ verklingt. */
export function plan(text: string, v: { base: number; lively: number; speed: number }): Planned[] & { truncated?: boolean } {
  const rnd = seeded(text + "|" + v.base), out: Planned[] & { truncated?: boolean } = [], L = v.lively;
  for (const ph of parseText(text)) {
    const syl: Syl[] = []; ph.words.forEach((w, wi) => syllables(w.w, w.s).forEach((sy) => syl.push(Object.assign(sy, { wi, first: wi === 0 }))));
    const n = syl.length, wq = WQ.test(ph.words[0].w), lastStress = syl.reduce((a, s, i) => (s.stress ? i : a), n - 1);
    const lift = ph.end === "!" ? 2 : 0, wide = ph.end === "!" ? 1.4 : 1;
    syl.forEach((sy, i) => {
      if (out.length >= MAX_SYL) { out.truncated = true; return; }
      let st = lift + L * (1.6 - (3.2 * i) / Math.max(1, n - 1)) + (rnd() - 0.5) * 0.6;
      if (sy.stress) st += L * wide * (2 + rnd() * 1.5);
      if (sy.func) st -= 0.8 * L;
      if (wq && sy.first && sy.stress) st += 2.5 * L;
      const tail = i - (n - 3);
      if (ph.end === "?" && !wq && tail >= 0) st += L * (2.5 + 2.5 * tail);
      else if (ph.end === "," && i === n - 1) st += 1.6 * L;
      else if ((ph.end === "." || ph.end === "!" || wq) && i > lastStress) st -= L * (2 + 1.5 * (i - lastStress));
      else if (ph.end === "…" && i === n - 1) st -= 1.5 * L;
      const dur = 0.1 * (sy.stress ? 1.3 : sy.func ? 0.75 : 1) * (sy.long ? 1.2 : 1) * (i === n - 1 ? 1.45 : 1) * (ph.end === "…" && i === n - 1 ? 1.4 : 1);
      out.push({ ...sy, st, dur: dur / v.speed, amp: (sy.stress ? 1 : 0.72) * (ph.end === "!" ? 1.12 : 1), wordStart: sy.s === ph.words[sy.wi!].s, end: i === n - 1 ? ph.end : null, pe: ph.pe });
    });
    if (out.truncated) { const l = out[out.length - 1]; l.end = "…"; l.pe = text.length; break; }
  }
  return out;
}
