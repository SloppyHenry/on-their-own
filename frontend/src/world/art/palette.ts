// Farben und Tageszeiten 1:1 aus Mockup A (WP, W_TIMES in world.js); Tageszeiten werden nach der Uhr fließend gemischt.
import { hex, type RGB } from "./pen";

export const WP = {
  outline: "#3b2c3d",
  grass1: "#97d66e", grass2: "#7ec35c", grass3: "#68ae52", grassDark: "#539848", grassLight: "#b2e47f", wild1: "#5f9f4c", wild2: "#4f8c45", wild3: "#437c40",
  path1: "#efdaa8", path2: "#e0c48e", path3: "#c8a777", pebble: "#b49a7b",
  cob1: "#ddd4c4", cob2: "#c6bba9", cob3: "#a59a88", cobHi: "#efe9dd",
  water1: "#86dbf0", water2: "#5cc2e3", water3: "#3fa4d3", waterDeep: "#2e86c0", foam: "#eafcff",
  soil1: "#9c6b47", soil2: "#83573a",
  wood1: "#cf9159", wood2: "#a96f42", wood3: "#7c4e30",
  roof1: "#e6775c", roof2: "#cc5f48", roof3: "#a2463a",
  wall1: "#f6e9cc", wall2: "#e5d2ad", wall3: "#cbb38c",
  leaf1: "#8ad868", leaf2: "#67bb55", leaf3: "#4a9f4b", leaf4: "#327d44",
  trunk1: "#a06c45", trunk2: "#764b30",
  fP: "#ff9fc2", fY: "#ffd94f", fW: "#fffaf0", fB: "#93baff", fR: "#ff6b6b",
  stone1: "#d2cbc0", stone2: "#aca499", stone3: "#888077",
  glass: "#a6dcf2", glassLit: "#ffd88a", lamp: "#fff2c6", lampLit: "#ffd36e",
  skin: "#f7cba2", hairA: "#7a4a2b", hairM: "#3d2a3c", shirtA: "#efa24b", pantsA: "#4f6c9c", dressM: "#7fc48f", dressM2: "#5ea873",
};

export type ColorName = keyof typeof WP;
export const WPA = Object.fromEntries(Object.entries(WP).map(([k, v]) => [k, hex(v)])) as Record<ColorName, RGB>;

export interface Mood {
  skyTop: RGB;
  skyBot: RGB;
  haze: RGB;
  grade: RGB;
  /** 0 … 1: Lampen und Fenster an, Sterne, Stärke des Lichtscheins. */
  lights: number;
  stars: number;
  glowA: number;
}

type Key = "Morgen" | "Mittag" | "Abend" | "Nacht";
const T = (skyTop: string, skyBot: string, haze: string, grade: string, lights: number, stars: number, glowA: number): Mood =>
  ({ skyTop: hex(skyTop), skyBot: hex(skyBot), haze: hex(haze), grade: hex(grade), lights, stars, glowA });

export const TIMES: Record<Key, Mood> = {
  Morgen: T("#a9cff2", "#ffe2cb", "#ffe8d6", "#fff1e4", 0, 0, 0),
  Mittag: T("#6cb7f3", "#cfefff", "#e2f4ff", "#ffffff", 0, 0, 0),
  Abend: T("#5d5ba8", "#ffab79", "#ffcaa2", "#ffd2ad", 1, 0, 0.42),
  Nacht: T("#0f1534", "#353b70", "#3b4378", "#6070b8", 1, 1, 0.75),
};

// Stützstellen über den Tag (Minute des Tages → Tageszeit), dazwischen wird gemischt.
const KEYS: [number, Key][] = [[0, "Nacht"], [285, "Nacht"], [375, "Morgen"], [480, "Morgen"], [600, "Mittag"], [1020, "Mittag"], [1125, "Abend"], [1200, "Abend"], [1290, "Nacht"], [1440, "Nacht"]];

const mixC = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export function mixMood(a: Mood, b: Mood, k: number): Mood {
  return {
    skyTop: mixC(a.skyTop, b.skyTop, k), skyBot: mixC(a.skyBot, b.skyBot, k), haze: mixC(a.haze, b.haze, k), grade: mixC(a.grade, b.grade, k),
    lights: a.lights + (b.lights - a.lights) * k, stars: a.stars + (b.stars - a.stars) * k, glowA: a.glowA + (b.glowA - a.glowA) * k,
  };
}

/** Stimmung zur Minute des Tages (0 … 1439). */
export function moodAt(minuteOfDay: number): Mood {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [m0, a] = KEYS[i], [m1, b] = KEYS[i + 1];
    if (m >= m0 && m <= m1) {
      const k = m1 === m0 ? 0 : (m - m0) / (m1 - m0), s = k * k * (3 - 2 * k);
      return mixMood(TIMES[a], TIMES[b], s);
    }
  }
  return TIMES.Nacht;
}

/** Wetter dämpft Himmel und Licht (Wolken, Regen, Nebel, Schnee). */
export function weatherMood(m: Mood, weather: string): Mood {
  const grey: Record<string, [number, RGB]> = {
    cloudy: [0.35, [176, 186, 198]], rain: [0.55, [128, 140, 160]], storm: [0.7, [92, 100, 122]], fog: [0.55, [214, 220, 226]], snow: [0.45, [224, 232, 242]],
  };
  const g = grey[weather];
  if (!g) return m;
  const [k, c] = g;
  return { ...m, skyTop: mixC(m.skyTop, c, k), skyBot: mixC(m.skyBot, c, k), haze: mixC(m.haze, c, k * 0.8), grade: mixC(m.grade, mixC(m.grade, [200, 206, 216], 0.6), k * 0.6) };
}

export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
