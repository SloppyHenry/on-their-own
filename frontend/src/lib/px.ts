// Pixelbilder aus Zeichenketten: eine Palette, keine Bilddateien. Grundlage für Figuren, Icons und Weltbausteine.
export type Palette = Record<string, string>;

export function gridCanvas(rows: string[], pal: Palette, scale = 1): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(...rows.map((r) => r.length)) * scale;
  c.height = rows.length * scale;
  const g = c.getContext("2d")!;
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const col = pal[ch];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }),
  );
  return c;
}

export const ICONS: Record<string, string[]> = {
  hammer: ["..####..", "..#####.", "..####..", "...##...", "...##...", "...##...", "...##...", "...##..."],
  go: ["..#.....", "..##....", "..###...", "..####..", "..###...", "..##....", "..#.....", "........"],
  chat: [".######.", "########", "########", "########", ".######.", "..##....", ".#......", "........"],
  plan: ["...##...", "..####..", ".######.", "########", ".######.", "..####..", "...##...", "........"],
  leaf: ["....####", "..######", ".#######", ".#####.#", "..###.#.", "..#..#..", ".#......", "#......."],
  moon: ["..####..", ".##.....", "##......", "##......", "##......", ".##....#", "..#####.", "........"],
  sun: ["...#....", ".#.#.#..", "..###...", "#######.", "..###...", ".#.#.#..", "...#....", "........"],
  rain: ["..###...", ".#####.#", "########", "########", ".#.#.#..", "#.#.#.#.", ".#.#.#..", "........"],
  ok: ["......#.", ".....##.", "#...##..", "##.##...", ".###....", "..#.....", "........", "........"],
  no: ["#......#", ".#....#.", "..#..#..", "...##...", "...##...", "..#..#..", ".#....#.", "#......#"],
  link: [".##..##.", "#..##..#", "#......#", ".##..##.", "........", "........", "........", "........"],
  zzz: ["######..", "...#....", "..#.....", "######..", "....###.", ".....#..", "....#...", "....###."],
  think: ["..###...", ".#####..", "#######.", ".#####..", "...#....", "..#.....", ".#......", "#......."],
  warn: ["...##...", "...##...", "..####..", "..####..", ".##..##.", ".##..##.", "########", "........"],
};

const cache = new Map<string, string>();
export function iconUrl(name: string): string {
  let u = cache.get(name);
  if (!u) {
    u = gridCanvas(ICONS[name] ?? ICONS.warn, { "#": "#fff" }).toDataURL();
    cache.set(name, u);
  }
  return u;
}
