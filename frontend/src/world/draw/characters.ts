// Figuren 12 x 17 Pixel in vier Blickrichtungen, je zwei Laufbilder. Aussehen aus einer Palette je Agent.
import { gridCanvas, type Palette } from "../../lib/px";

export type Dir = "down" | "up" | "left" | "right";
type Mods = Partial<Record<Dir | "all", Record<number, string>>>;

const DOWN = [
  "...kkkkkk...", "..khhhhhhk..", "..khHHhhhk..", "..khsssshk..", "..ksessesk..", "..kssssssk..", "...kssssk...",
  "..kbbbbbbk..", ".kbbbbbbbbk.", ".ksbbbbbbsk.", ".ksbBBBBbsk.", "..kbbbbbbk..",
  "..kppppppk..", "..kppkkppk..", "..kpp..ppk..", "..koo..ook..", "..kkk..kkk..",
];
const UP = [
  "...kkkkkk...", "..khhhhhhk..", "..khHhhhhk..", "..khhhhhhk..", "..khhhhhhk..", "..khhhhhhk..", "...khhhhk...",
  ...DOWN.slice(7),
];
const SIDE = [
  "...kkkkkk...", "..khhhhhhk..", "..khHhhhhk..", "..khhhsssk..", "..khhhsesk..", "..khhhsssk..", "...khhsssk..",
  "...kbbbbbk..", "..kbbbbbbbk.", "..kbbbbbsbk.", "..kbBBBBbbk.", "...kbbbbbk..",
  "...kpppppk..", "...kppkppk..", "...kpp.kppk.", "...koo.kook.", "...kkk.kkk..",
];
const LEGS_B: Record<Dir, string[]> = {
  down: ["..kppkkppk..", "..kppk.ppk..", "..kook.ook..", "...kk..kkk.."],
  up: ["..kppkkppk..", "..kppk.ppk..", "..kook.ook..", "...kk..kkk.."],
  left: ["...kppkppk..", "....kpkpk...", "....kokok...", "....kkkkk..."],
  right: ["...kppkppk..", "....kpkpk...", "....kokok...", "....kkkkk..."],
};

interface Look {
  pal: Palette;
  mods?: Mods;
}

const BASE_PAL = { k: "#2a1d18", e: "#2a1d18", o: "#3a2a20" };
const LOOKS: Record<string, Look> = {
  alex: {
    pal: { ...BASE_PAL, h: "#5b3a24", H: "#7d5334", s: "#e8b98f", b: "#e0a458", B: "#b57d34", p: "#4a5568" },
    mods: { down: { 5: "..kshhhhsk..", 6: "...khhhhk..." }, right: { 5: "..khhhhhhk..", 6: "...khhhhhk.." } },
  },
  mira: {
    pal: { ...BASE_PAL, k: "#25212e", h: "#3a3350", H: "#5a5078", s: "#f0c8a0", b: "#8fb996", B: "#5f8a6a", p: "#6b4f3a" },
    mods: {
      down: { 0: "...khhhhk...", 3: ".hkhsssshkh.", 4: ".hksessesk" + "h.", 5: ".hkssssssk" + "h.", 6: ".h.kssssk.h." },
      up: { 7: "..khhhhhhk..", 8: ".kbhhhhhhbk." },
      right: { 3: ".hkhhhsssk..", 4: ".hkhhhsesk..", 5: ".hkhhhsssk..", 6: ".h.khhsssk.." },
    },
  },
};
const SHIRTS = [["#d9695a", "#a8473b"], ["#5a8fd9", "#3f68a8"], ["#b58ad9", "#8660a8"], ["#d9c25a", "#a8943b"], ["#5ac2b5", "#3b9186"]];
const HAIRS = [["#2a2420", "#4a413a"], ["#8a5a2f", "#ad7a4a"], ["#c9a55a", "#e6c88a"], ["#7a3a2a", "#a05a45"]];
const SKINS = ["#f0c8a0", "#e8b98f", "#c98f68", "#8a5a3a"];

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function lookOf(id: string): Look {
  if (LOOKS[id]) return LOOKS[id];
  const h = hash(id), sh = SHIRTS[h % SHIRTS.length], hr = HAIRS[(h >> 3) % HAIRS.length];
  return { pal: { ...BASE_PAL, h: hr[0], H: hr[1], s: SKINS[(h >> 5) % SKINS.length], b: sh[0], B: sh[1], p: "#4a5568" } };
}

export function accentOf(id: string): string {
  return id === "alex" ? "#e8ac5c" : id === "mira" ? "#93c79f" : lookOf(id).pal.b;
}

function rowsFor(look: Look, dir: Dir, frame: 0 | 1): string[] {
  const flip = dir === "left";
  const key: Dir = flip ? "right" : dir;
  const rows = (key === "down" ? DOWN : key === "up" ? UP : SIDE).slice();
  const mods = look.mods?.[key];
  if (mods) Object.entries(mods).forEach(([i, r]) => { rows[+i] = r; });
  if (frame === 1) LEGS_B[dir].forEach((r, i) => { rows[13 + i] = r; });
  return flip ? rows.map((r) => [...r].reverse().join("")) : rows;
}

const cache = new Map<string, HTMLCanvasElement>();
export function charCanvas(id: string, dir: Dir = "down", frame: 0 | 1 = 0): HTMLCanvasElement {
  const k = `${id}|${dir}|${frame}`;
  let c = cache.get(k);
  if (!c) {
    const look = lookOf(id);
    c = gridCanvas(rowsFor(look, dir, frame), look.pal);
    cache.set(k, c);
  }
  return c;
}

export function portrait(id: string, size = 44): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#1c2128";
  g.fillRect(0, 0, size, size);
  const look = lookOf(id), s = Math.max(1, Math.floor(size / 13));
  const bust = gridCanvas(rowsFor(look, "down", 0).slice(0, 11), look.pal, s);
  g.drawImage(bust, Math.floor((size - bust.width) / 2), 2);
  return c;
}
