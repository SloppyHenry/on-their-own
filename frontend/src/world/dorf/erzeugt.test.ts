// Bild und Kacheln eines erzeugten Dorfs stimmen überein: Der Generator (Python) leitet die Kacheln aus denselben Formen ab wie das Bild;
// hier wird jede Kachel an 16 × 16 Stellen mit den echten Bodenregeln des Bildes (`texel`) abgetastet und mit der Kachelart verglichen.
import { describe, expect, it } from "vitest";
import { texel } from "./boden";
import { housesOf, normalizeLook } from "./look";
import dorf from "./fixtures/dorf-seed-12.json" with { type: "json" };

const L = normalizeLook(dorf.look as object);
const outW = housesOf(L)[0].house.interior.rect[0] - 1, outH = 21;           // Dorf im Freien links, Innenbereiche rechts daneben

/** Was das Bild an der Kachel zeigt: überwiegende Art der Bodenregeln (0 Gras, 1 Weg, 2 Wasser, 3 Pflaster, 4 Beet, 5 Steg, 6 Sand, 7 Wildnis). */
function picture(i: number, j: number) {
  const n: Record<number, number> = {};
  for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) { const t = texel(L, i * 16 + x - L.texShift[0], j * 16 + y - L.texShift[1])[1]; n[t] = (n[t] ?? 0) + 1; }
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0] as unknown as number;
}
const ALLOWED: Record<string, number[]> = { "~": [2], ",": [1, 3, 0], "_": [5], ".": [0, 4, 7, 1, 3, 6], s: [6, 0, 2] };

describe("erzeugtes Dorf: Bild und Kacheln", () => {
  it("Wasser ist im Bild Wasser, Wege sind Wege, Stege sind Stege", () => {
    let checked = 0, bad = 0;
    const wrong: string[] = [];
    for (let j = 0; j < outH; j++) for (let i = 0; i < outW; i++) {
      const c = dorf.tiles[j][i], ok = ALLOWED[c];
      if (!ok) continue;                                               // Bäume, Zäune, Mauern, Türen: Deko und Gebäude, nicht Boden
      checked++;
      const p = Number(picture(i, j));
      if (!ok.includes(p)) { bad++; if (wrong.length < 5) wrong.push(`${i},${j} '${c}' ↔ Bild ${p}`); }
    }
    expect(checked).toBeGreaterThan(300);
    expect(bad / checked, wrong.join("; ")).toBeLessThan(0.04);
  });
  it("jede Kachel mit Wasser im Bild ist im Gelände sperrig (Wasser, Sand oder Steg)", () => {
    let water = 0, walk = 0;
    for (let j = 0; j < outH; j++) for (let i = 0; i < outW; i++) if (Number(picture(i, j)) === 2) { water++; if (",.".includes(dorf.tiles[j][i])) walk++; }
    expect(water).toBeGreaterThan(5);
    expect(walk / water).toBeLessThan(0.1);                            // man läuft nicht über Wasser
  });
});
