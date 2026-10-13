// Figuren: Vorderansicht 1:1 wPerson aus Mockup A (ohne die Gießkanne, die ist jetzt Werkzeug), dazu hinten, Seite, Laufbilder,
// Sitzen, Schlafen und Werkzeug im selben Stil (Frage 19). Aussehen aus einer Palette je Agent, für unbekannte aus der Kennung.
import { WP } from "./palette";
import { memo, mirror, sprite, type Spr } from "./pen";

export type Dir = "down" | "up" | "left" | "right";
export type Frame = 0 | 1 | 2 | 3 | "stand";

export interface Look {
  hair: string;
  hairHi: string;
  top: string;
  topHi: string;
  topLo: string;
  legs: string;
  shoes: string;
  dress: boolean;
  longHair: boolean;
  clip?: string;
  /** Akzentfarbe für Namensschild, Auswahlring, Portrait. */
  accent: string;
}

const LOOKS: Record<string, Look> = {
  alex: { hair: WP.hairA, hairHi: "#9b6a44", top: WP.shirtA, topHi: "#ffc07a", topLo: "#c9802f", legs: WP.pantsA, shoes: "#5a3a2a", dress: false, longHair: false, accent: "#e8ac5c" },
  mira: { hair: WP.hairM, hairHi: "#5a4058", top: WP.dressM, topHi: "#a2dcae", topLo: WP.dressM2, legs: WP.skin, shoes: "#c95c6c", dress: true, longHair: true, clip: WP.fP, accent: "#93c79f" },
};
const TOPS = [["#d9695a", "#f08a7c", "#a8473b"], ["#5a8fd9", "#86b2ef", "#3f68a8"], ["#b58ad9", "#d0aeee", "#8660a8"], ["#d9c25a", "#efdc86", "#a8943b"], ["#5ac2b5", "#88dcd2", "#3b9186"]];
const HAIRS = [["#2a2420", "#4a413a"], ["#8a5a2f", "#ad7a4a"], ["#c9a55a", "#e6c88a"], ["#7a3a2a", "#a05a45"]];
const idHash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function lookOf(id: string): Look {
  if (LOOKS[id]) return LOOKS[id];
  const h = idHash(id), t = TOPS[h % TOPS.length], hr = HAIRS[(h >>> 3) % HAIRS.length], dress = ((h >>> 6) & 1) === 1;
  return { hair: hr[0], hairHi: hr[1], top: t[0], topHi: t[1], topLo: t[2], legs: dress ? WP.skin : "#4a5568", shoes: "#5a3a2a", dress, longHair: dress, accent: t[0] };
}

export const accentOf = (id: string) => lookOf(id).accent;

const EYE = "#2a1f2b", BLUSH = "#ffb0a8", CX = 7.5;

function legs(s: Spr, L: Look, dir: Dir, frame: Frame, sit: boolean) {
  const top = L.dress ? 19 : 18;
  if (sit) { s.r(4, 20, 3, 1, L.legs); s.r(8, 20, 3, 1, L.legs); s.r(4, 21, 3, 1, L.shoes); s.r(8, 21, 3, 1, L.shoes); return; }
  if (dir === "left") {
    if (frame === "stand" || frame === 1 || frame === 3) { s.r(6, top, 3, 21 - top, L.legs); s.r(5, 21, 4, 1, L.shoes); return; }
    const [front, back] = frame === 0 ? [L.legs, L.topLo] : [L.topLo, L.legs];
    s.r(9, top, 2, 21 - top, L.dress ? L.legs : back); s.r(9, 21, 3, 1, L.shoes);
    s.r(4, top, 2, 21 - top, L.dress ? L.legs : front); s.r(3, 21, 3, 1, L.shoes);
    return;
  }
  const liftL = frame === 2 ? 1 : 0, liftR = frame === 0 ? 1 : 0;
  s.r(5, top, 2, 21 - top - liftL, L.legs); s.r(8, top, 2, 21 - top - liftR, L.legs);
  s.r(4, 21 - liftL, 3, 1, L.shoes); s.r(8, 21 - liftR, 3, 1, L.shoes);
}

function body(s: Spr, L: Look, dir: Dir, b: number, swing: number) {
  const side = dir === "left";
  if (L.dress) {
    for (let y = 0; y < 8; y++) {
      const hw = (side ? 2 : 3) + Math.floor(y / 3);
      s.r(CX - hw, 12 - b + y, hw * 2, 1, y < 2 ? L.top : y % 3 === 2 ? L.topLo : L.top);
    }
  } else {
    s.r(side ? 5 : 4, 12 - b, side ? 5 : 7, 7, L.top);
    s.r(side ? 5 : 4, 12 - b, side ? 5 : 7, 1, L.topHi);
  }
  if (side) { s.r(7 - swing, 13 - b, 2, 3, L.topLo); s.p(7 - swing * 2, 16 - b, WP.skin); return; }
  const hl = L.dress ? 2 : 3, hr = L.dress ? 12 : 11;
  s.p(hl, 14 - b + swing, WP.skin); s.p(hr, 14 - b - swing, WP.skin);
}

function head(s: Spr, L: Look, dir: Dir, b: number) {
  s.disc(CX, 7 - b, 5.4, WP.skin);
  if (dir === "down") {
    if (!L.longHair) { s.disc(CX, 4.5 - b, 5, L.hair); s.r(2, 4 - b, 11, 2, L.hair); s.p(3, 7 - b, L.hair); s.p(12, 7 - b, L.hair); s.p(6, 2 - b, L.hairHi); }
    else { s.disc(CX, 4.6 - b, 5.2, L.hair); s.r(2, 4 - b, 2, 9, L.hair); s.r(11, 4 - b, 2, 9, L.hair); s.r(4, 3 - b, 7, 2, L.hair); }
    if (L.clip) { s.p(10, 2 - b, L.clip); s.p(11, 3 - b, L.clip); }
    s.r(5, 8 - b, 1, 2, EYE); s.r(9, 8 - b, 1, 2, EYE); s.p(4, 10 - b, BLUSH); s.p(10, 10 - b, BLUSH);
    return;
  }
  if (dir === "up") {
    s.disc(CX, 6 - b, 5.5, L.hair); s.r(2, 4 - b, 11, 5, L.hair); s.p(6, 2 - b, L.hairHi);
    if (L.longHair) s.r(3, 8 - b, 9, 6, L.hair);
    if (L.clip) { s.p(4, 2 - b, L.clip); s.p(3, 3 - b, L.clip); }
    return;
  }
  // links (rechts ist gespiegelt): Gesicht nach links, Haar am Hinterkopf
  s.disc(8.5, 4.6 - b, 5.1, L.hair); s.r(9, 4 - b, 4, L.longHair ? 9 : 5, L.hair); s.r(4, 3 - b, 6, 2, L.hair);
  if (!L.longHair) s.p(7, 2 - b, L.hairHi);
  if (L.clip) { s.p(11, 3 - b, L.clip); s.p(12, 4 - b, L.clip); }
  s.p(2, 8 - b, WP.skin); s.r(4, 8 - b, 1, 2, EYE); s.p(4, 10 - b, BLUSH);
}

function draw(id: string, dir: Dir, frame: Frame, pose: "" | "sit" = ""): HTMLCanvasElement {
  if (dir === "right") return mirror(figure(id, "left", frame, pose));
  const L = lookOf(id), walk = frame !== "stand", b = walk && (frame === 1 || frame === 3) ? 1 : 0, sit = pose === "sit";
  const swing = !walk ? 0 : frame === 0 ? 1 : frame === 2 ? -1 : 0;
  return sprite(15, 23, (s) => {
    const off = sit ? 2 : 0;
    if (off) s.g.translate(0, off);
    legs(s, L, dir, frame, false);
    body(s, L, dir, b, swing);
    head(s, L, dir, b);
    if (off) { s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.clearRect(0, 20, 15, 3); legs(s, L, dir, frame, true); }
    s.outline(WP.outline);
  });
}

/** Figur (15 × 23, Fußpunkt unten Mitte). */
export const figure = memo((id: string, dir: Dir, frame: Frame, pose: "" | "sit" = "") => `${id}|${dir}|${frame}|${pose}`, draw);

/** Schlafende Figur im Bett: Kopf auf dem Kissen, Decke darüber; wird über das Bett gelegt. */
export const sleeper = memo((id: string) => id, (id: string) => {
  const L = lookOf(id);
  return sprite(16, 14, (s) => {
    s.disc(8, 5, 3.8, L.hair); s.ell(8, 7.2, 3, 2.2, WP.skin); s.r(6, 7, 1, 1, EYE); s.r(9, 7, 1, 1, EYE);
    if (L.longHair) { s.r(3, 4, 2, 6, L.hair); s.r(11, 4, 2, 6, L.hair); }
    s.r(1, 9, 14, 5, L.top); s.r(1, 9, 14, 1, L.topHi);
    s.outline(WP.outline);
  });
});

/** Liegende Figur ohne Bett (z. B. draußen eingeschlafen). */
export const lying = memo((id: string) => id, (id: string) => {
  const up = figure(id, "down", "stand"), c = document.createElement("canvas");
  c.width = up.height; c.height = up.width;
  const g = c.getContext("2d")!;
  g.translate(c.width / 2, c.height / 2); g.rotate(-Math.PI / 2); g.drawImage(up, -up.width / 2, -up.height / 2);
  return c;
});

/** Werkzeuge in der Hand, im Stil des Mockups (Gießkanne 1:1 aus wPerson). */
export const tool = memo((name: string) => name, (name: string) => sprite(8, 8, (s) => {
  if (name === "can") { s.r(1, 2, 5, 4, "#6aa7da"); s.r(5, 1, 2, 1, "#6aa7da"); s.r(2, 1, 3, 1, "#4f86b8"); s.p(7, 0, "#9fd0f5"); }
  else if (name === "axe") { s.r(4, 1, 1, 7, WP.wood2); s.r(1, 1, 3, 3, WP.stone2); s.p(1, 1, WP.stone1); }
  else if (name === "hammer") { s.r(4, 2, 1, 6, WP.wood2); s.r(2, 0, 5, 2, WP.stone3); }
  else if (name === "shovel") { s.r(3, 0, 1, 5, WP.wood2); s.r(2, 5, 3, 3, WP.stone2); }
  else if (name === "book") { s.r(1, 2, 6, 5, "#b24a3a"); s.r(2, 3, 4, 3, "#f2ece0"); }
  s.outline(WP.outline);
}));

/** Aktion → Werkzeug in der Hand. */
export const TOOL_FOR_ACTION: Record<string, string> = { build: "hammer", water: "can", plant: "shovel", gather: "axe", use: "hammer", read: "book", write: "book" };

/** Brustbild für die Oberfläche (Bewohnerliste, Details): Kopf und Schultern der Vorderansicht. */
export function portrait(id: string, size = 44): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!, f = figure(id, "down", "stand"), s = Math.max(1, Math.floor(size / 16));
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#1c2128";
  g.fillRect(0, 0, size, size);
  g.drawImage(f, 0, 0, 15, 16, Math.floor((size - 15 * s) / 2), size - 16 * s, 15 * s, 16 * s);
  return c;
}
