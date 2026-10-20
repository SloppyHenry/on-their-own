// Schilder und Blasen weichen einander aus (AP18c): reine Funktion, damit sie sich ohne Browser testen lässt. Ein Teil hat einen Ankerpunkt (Mitte der Unterkante)
// und eine gemessene Größe. Teile mit höherer Rangzahl werden zuerst gesetzt und bleiben stehen; die späteren rutschen nach oben, bis nichts mehr überdeckt wird,
// und bleiben im Bild (mit einem Rand). Kosten: höchstens (Teile)² Vergleiche je Bild; bei 8 Bewohnern und drei Teilen je Bewohner sind das wenige Hundert.

export interface Teil {
  id: string;
  /** Ankerpunkt in Bildschirmpixeln: Mitte der Unterkante (bei `runter`: der Oberkante). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Je kleiner, desto früher gesetzt (bleibt stehen). */
  rang: number;
  /** Weicht nach unten statt nach oben aus (Namensschilder am Fuß der Figuren). */
  runter?: boolean;
}

export interface Platz { id: string; left: number; top: number; /** Verschiebung nach oben gegenüber dem Anker (0 = steht am Anker). */ hoch: number; /** Anker-x relativ zur linken Kante, für den Zeiger zur Figur. */ zeiger: number }

const ABSTAND = 3, RAND = 4;

const stoesst = (a: { left: number; top: number; w: number; h: number }, b: { left: number; top: number; w: number; h: number }) =>
  a.left < b.left + b.w + ABSTAND && b.left < a.left + a.w + ABSTAND && a.top < b.top + b.h + ABSTAND && b.top < a.top + a.h + ABSTAND;

export function ausweichen(teile: Teil[], breite: number, hoehe: number): Platz[] {
  const gesetzt: { left: number; top: number; w: number; h: number }[] = [];
  const out = new Map<string, Platz>();
  for (const t of [...teile].sort((a, b) => a.rang - b.rang)) {
    const left = Math.max(RAND, Math.min(t.x - t.w / 2, breite - t.w - RAND));
    let top = t.runter ? t.y : t.y - t.h;                            // Schilder hängen mit der Oberkante am Anker, Blasen stehen mit der Unterkante darauf
    for (let i = 0; i < 64; i++) {
      const hit = gesetzt.find((g) => stoesst({ left, top, w: t.w, h: t.h }, g));
      if (!hit) break;
      top = t.runter ? hit.top + hit.h + ABSTAND : hit.top - t.h - ABSTAND;      // am getroffenen Teil vorbei
    }
    top = Math.max(RAND, Math.min(top, hoehe - t.h - RAND));
    gesetzt.push({ left, top, w: t.w, h: t.h });
    out.set(t.id, { id: t.id, left, top, hoch: (t.runter ? t.y : t.y - t.h) - top, zeiger: Math.max(10, Math.min(t.w - 10, t.x - left)) });
  }
  return teile.map((t) => out.get(t.id)!);
}
