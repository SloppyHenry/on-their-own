// Würfeln (AP17b): derselbe Seed und dieselbe Wurfnummer ergeben dasselbe. Name, Alter und die zwölf Werte; Beziehungen um den Standard.
import { PKEYS, type Personality } from "./begrenzung";

export const NAMEN = ["Anselm", "Britta", "Cem", "Dora", "Emil", "Franka", "Gustav", "Hedi", "Ida", "Jakob", "Lena", "Malte", "Nora", "Otto", "Paula", "Rudi"];

/** Kleine Zufallsfolge (mulberry32), unabhängig vom Browser. */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wuerfelFigur(seed: number, n: number, taken: string[] = []): { name: string; age: number; personality: Personality } {
  const R = rng(seed * 1000 + n), mid = 35 + Math.floor(R() * 30);
  const free = NAMEN.filter((x) => !taken.includes(x));
  const pool = free.length ? free : NAMEN;
  const name = pool[Math.floor(R() * pool.length)];
  const personality = Object.fromEntries(PKEYS.map((k) => [k, Math.max(5, Math.min(95, mid - 35 + Math.floor(R() * 70)))])) as Personality;
  return { name, age: 20 + Math.floor(R() * 50), personality };
}

export type Rel = { trust: number; sympathy: number; tension: number; familiarity: number };
export const REL_DEFAULT: Rel = { trust: 50, sympathy: 50, tension: 10, familiarity: 30 };

/** Beziehung um den Standard, höchstens ±20 je Wert. */
export function wuerfelBeziehung(seed: number, n: number): Rel {
  const R = rng(seed * 7919 + n);
  const v = (base: number) => Math.max(0, Math.min(100, base + Math.floor(R() * 41) - 20));
  return { trust: v(REL_DEFAULT.trust), sympathy: v(REL_DEFAULT.sympathy), tension: v(REL_DEFAULT.tension), familiarity: v(REL_DEFAULT.familiarity) };
}
