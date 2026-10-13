// Dinge aus dem Weltzustand im Stil von Mockup A: Möbel, Pflanzen nach Stufe, Baustelle nach Fortschritt, Vorräte nach Menge, Kleinkram.
// Jede Art ist eine Zeichenfunktion mit Zustand; unbekannte Arten erscheinen als neutrale Kiste, nie als Fehler.
import type { ObjectInfo, ResourceInfo } from "../../store/types";
import { WP } from "./palette";
import { memo, sprite, type Spr } from "./pen";
import { accentOf } from "./people";
import { sunflower, tomato } from "./nature";
import { bench, board, well } from "./village";

const WET_MINUTES = 360;
type Draw = (s: Spr, v: string[]) => void;

const ownerColor = (o: ObjectInfo) => {
  const hay = `${o.id} ${o.name} ${o.owner ?? ""}`.toLowerCase(), id = ["alex", "mira"].find((a) => hay.includes(a)) ?? o.owner;
  return id ? accentOf(id) : "#b0b8c8";
};

const ART: Record<string, [number, number, Draw]> = {
  bed: [16, 19, (s, v) => { s.r(1, 0, 14, 5, WP.wood2); s.r(2, 1, 12, 3, WP.wood1); s.r(1, 5, 14, 12, WP.wood3); s.r(2, 6, 12, 4, "#fffaf0"); s.r(2, 10, 12, 7, v[0]); s.r(2, 10, 12, 1, "#fff2d8"); s.r(1, 17, 2, 2, WP.wood3); s.r(13, 17, 2, 2, WP.wood3); }],
  chest: [15, 12, (s) => { s.r(1, 2, 13, 9, WP.wood2); s.r(1, 2, 13, 3, WP.wood1); s.r(1, 5, 13, 1, WP.wood3); s.r(6, 5, 3, 3, WP.fY); }],
  desk: [16, 14, (s, v) => { s.r(0, 3, 16, 4, WP.wood1); s.r(0, 7, 16, 2, WP.wood3); s.r(1, 9, 2, 5, WP.wood3); s.r(13, 9, 2, 5, WP.wood3); s.r(4, 2, 5, 3, "#fffaf0"); s.r(11, 0, 1, 4, "#5c8de0"); if (v[0] !== "0") s.r(10, 3, 3, 2, WP.fR); }],
  workbench: [18, 15, (s) => { s.r(0, 4, 18, 4, "#b98a5a"); s.r(0, 8, 18, 2, WP.wood3); s.r(1, 10, 2, 5, WP.wood3); s.r(15, 10, 2, 5, WP.wood3); s.r(3, 1, 4, 3, WP.stone2); s.r(11, 2, 6, 1, WP.wood2); s.r(14, 0, 2, 3, WP.stone3); }],
  stove: [15, 15, (s, v) => { s.r(1, 2, 13, 13, "#4b4559"); s.r(1, 2, 13, 3, "#6b6478"); s.ell(4.5, 3.5, 2, 1, "#2b2233"); s.ell(10.5, 3.5, 2, 1, "#2b2233"); s.r(3, 7, 9, 6, "#2b2233"); if (v[0] === "1") s.r(4, 8, 7, 1, "#ff9a4a"); }],
  tap: [14, 14, (s) => { s.r(1, 5, 12, 9, WP.stone1); s.r(1, 5, 12, 2, "#efeae2"); s.r(3, 6, 8, 2, WP.water1); s.r(6, 0, 2, 6, WP.stone3); s.r(6, 0, 4, 1, WP.stone3); }],
  sofa: [22, 13, (s) => { s.r(0, 2, 22, 6, "#5d8fb0"); s.r(0, 8, 22, 5, "#4a7896"); s.r(0, 3, 3, 10, "#3e6580"); s.r(19, 3, 3, 10, "#3e6580"); s.r(4, 8, 7, 2, "#79acc9"); s.r(11, 8, 7, 2, "#79acc9"); }],
  table: [18, 14, (s) => { s.r(0, 2, 18, 5, WP.wood1); s.r(0, 7, 18, 2, WP.wood3); s.r(1, 9, 2, 5, WP.wood3); s.r(15, 9, 2, 5, WP.wood3); s.ell(9, 3, 2.5, 1.2, WP.fR); }],
  bookshelf: [16, 24, (s) => { s.r(0, 0, 16, 24, WP.wood3); s.r(1, 1, 14, 22, WP.wood2); for (let r = 0; r < 3; r++) { s.r(1, 7 + r * 7, 14, 1, WP.wood3); for (let b = 0; b < 6; b++) s.r(2 + b * 2, 2 + r * 7, 2, 5, ["#e05a5a", "#5c8de0", WP.fY, "#7fc48f", "#c27ad8", "#f0e2c4"][(b + r * 2) % 6]); } }],
  fireplace: [18, 22, (s, v) => { s.r(0, 2, 18, 20, WP.stone2); s.r(0, 2, 18, 3, WP.stone3); s.r(4, 9, 10, 13, "#2b2233"); s.r(0, 0, 18, 2, WP.wood2); for (let y = 6; y < 22; y += 4) s.r(0, y, 3, 1, WP.stone3); if (v[0] === "1") { s.r(6, 14, 6, 7, "#ff8a3a"); s.r(7, 12, 4, 6, WP.fY); s.r(8, 16, 2, 3, "#fff3b0"); } else s.r(6, 19, 6, 2, WP.wood3); }],
  firepit: [16, 12, (s, v) => { s.ell(8, 9, 7, 2.6, WP.stone2); s.ell(8, 9, 4.5, 1.5, "#2b2233"); if (v[0] === "1") { s.r(5, 3, 6, 6, "#ff8a3a"); s.r(6, 1, 4, 6, WP.fY); s.r(7, 5, 2, 3, "#fff3b0"); } else s.r(5, 8, 6, 1, WP.wood3); }],
  door: [14, 18, (s, v) => { s.r(1, 2, 12, 16, WP.wood3); s.disc(7, 3, 6, WP.wood3); s.r(2, 3, 10, 15, WP.wood1); s.disc(7, 4, 5, WP.wood1); for (let x = 4; x < 12; x += 3) s.r(x, 1, 1, 17, WP.wood2); if (v[0] === "L") s.r(9, 10, 2, 2, WP.fY); }],
  board: [20, 22, () => undefined],
  site: [16, 22, (s, v) => {
    const p = Number(v[0]) / 12;
    s.r(1, 4, 2, 18, WP.wood3); s.r(13, 4, 2, 18, WP.wood3); s.r(1, 10, 14, 2, WP.wood2); s.r(1, 4, 14, 1, "#e8b947");
    for (let i = 0; i < Math.round(p * 3); i++) s.r(3, 18 - i * 3, 10, 2, WP.wood1);
    s.r(1, 0, 14, 2, "#4b4559"); s.r(1, 0, Math.round(14 * p), 2, WP.leaf1);
  }],
  fishing_spot: [10, 18, (s) => { s.r(5, 2, 1, 15, WP.wood3); s.r(6, 2, 3, 1, "#e8d9a8"); s.r(8, 3, 1, 6, "#e8d9a8"); s.r(7, 9, 2, 2, WP.fR); }],
  birdhouse: [10, 24, (s) => { s.r(4, 10, 2, 14, WP.wood3); s.r(1, 3, 8, 8, WP.wood1); s.r(4, 6, 2, 2, "#2b2233"); s.r(0, 1, 10, 3, WP.roof2); }],
  fence: [14, 11, (s) => { s.r(1, 3, 3, 7, WP.wood1); s.r(10, 3, 3, 7, WP.wood1); s.r(0, 4, 14, 1, WP.wood1); s.r(0, 7, 14, 1, WP.wood1); s.r(0, 5, 14, 1, WP.wood2); }],
  pier_plank: [16, 5, (s) => { s.r(0, 0, 16, 4, WP.wood1); for (let x = 3; x < 16; x += 4) s.r(x, 0, 1, 4, WP.wood3); }],
  key: [8, 5, (s) => { s.r(0, 1, 3, 3, WP.fY); s.r(3, 2, 4, 1, WP.fY); s.r(6, 3, 1, 1, WP.fY); }],
  axe: [10, 9, (s) => { s.r(1, 6, 8, 1, WP.wood2); s.r(6, 3, 3, 4, WP.stone2); s.p(6, 3, WP.stone1); }],
  pickaxe: [11, 8, (s) => { s.r(5, 2, 1, 6, WP.wood2); s.r(1, 1, 9, 2, WP.stone2); s.r(1, 1, 9, 1, WP.stone1); }],
  note: [8, 6, (s) => { s.r(0, 0, 8, 6, "#fffaf0"); s.r(1, 2, 5, 1, "#c9bba0"); }],
  map: [10, 7, (s) => { s.r(0, 0, 10, 7, "#e8d9a8"); s.r(2, 2, 2, 1, WP.fR); s.r(5, 4, 3, 1, WP.water3); }],
  meal: [10, 6, (s) => { s.ell(5, 4, 4.5, 2, "#fffaf0"); s.r(3, 2, 2, 2, WP.fR); s.r(6, 2, 2, 2, "#e0a458"); }],
  item: [9, 8, (s) => { s.r(0, 1, 9, 7, "#b0b8c8"); s.r(0, 1, 9, 1, "#d8dde3"); }],
  unknown: [14, 13, (s) => { s.r(1, 2, 12, 11, "#8a8f99"); s.r(1, 2, 12, 2, "#b4b9c2"); s.r(6, 6, 2, 2, "#4a4f58"); }],
};

/** Sichtbarer Zustand eines Objekts als Schlüssel; gleiche Schlüssel teilen ein Sprite. */
export function objectKey(o: ObjectInfo, minute: number): string {
  const s = o.state;
  switch (o.kind) {
    case "plant": return `plant|${Math.max(0, Math.min(4, Number(s.stage ?? 0)))}|${s.crop ?? "carrot"}|${s.watered_at != null && minute - Number(s.watered_at) < WET_MINUTES ? "w" : "d"}`;
    case "door": return `door|${s.locked ? "L" : "o"}`;
    case "fireplace": case "firepit": return `${o.kind}|${s.lit ? 1 : 0}`;
    case "stove": return `stove|${s.lit || s.cooking ? 1 : 0}`;
    case "construction_site": return `site|${Math.round((Number(s.progress ?? 0) / Math.max(1, Number(s.total ?? 1))) * 12)}`;
    case "bed": return `bed|${ownerColor(o)}`;
    case "desk": case "board": return `${o.kind}|${Math.min(2, ((s.notes as unknown[]) ?? []).length)}`;
    case "well": case "bench": case "seedbed": return o.kind;
    default: return ART[o.kind] ? o.kind : "unknown";
  }
}

function plant(stage: number, crop: string, wet: boolean): HTMLCanvasElement {
  if (stage >= 4 && crop === "tomato") return tomato(3);
  if (stage >= 4 && crop === "sunflower") return sunflower();
  return sprite(13, 15, (s) => {
    if (wet) s.ell(6.5, 13, 5, 1.5, WP.soil2);
    if (stage === 0) { s.ell(6.5, 13, 3, 1.2, WP.soil1); s.p(6, 12, WP.soil2); }
    else if (stage === 1) { s.r(6, 10, 1, 4, WP.leaf3); s.p(5, 9, WP.leaf1); s.p(7, 9, WP.leaf1); }
    else {
      const h = stage === 2 ? 6 : stage === 3 ? 9 : 11;
      s.ell(6.5, 14 - h / 2, 3 + stage * 0.6, h / 2, WP.leaf3); s.ell(5.5, 13 - h / 2, 2 + stage * 0.4, h / 3, WP.leaf2); s.p(5, 14 - h, WP.leaf1);
      if (stage >= 3) { s.r(5, 13, 3, 2, "#e0782f"); }
      if (stage === 4) { s.r(2, 12, 2, 2, "#e0782f"); s.r(9, 12, 2, 2, "#e0782f"); }
    }
    s.outline(WP.outline);
  });
}

const make = (key: string): HTMLCanvasElement => {
  const [kind, ...v] = key.split("|");
  if (kind === "well") return well();
  if (kind === "bench") return bench();
  if (kind === "board") return board(Number(v[0]));
  if (kind === "plant") return plant(Number(v[0]), v[1], v[2] === "w");
  const [w, h, fn] = ART[kind] ?? ART.unknown;
  return sprite(w, h, (s) => { fn(s, v); s.outline(WP.outline); });
};
export const objectSprite = memo((key: string) => key, make);

/** Vorräte: Holzstapel, Steine, Pilze, Kiste, Saatsack; Menge sichtbar. */
export function resourceKey(n: ResourceInfo): string {
  const ratio = n.cap > 0 && n.cap < 500 ? Math.round(Math.max(0, Math.min(1, n.amount / n.cap)) * 5) : 5;
  return `res|${n.resource}|${n.id.includes("mushroom") ? "m" : ""}|${Math.max(n.amount >= 1 ? 1 : 0, ratio)}`;
}

export const resourceSprite = memo((key: string) => key, (key: string) => {
  const [, res, m, c] = key.split("|"), count = Number(c);
  return sprite(16, 14, (s) => {
    if (res === "wood") for (let r = 0, k = 0; r < 3 && k < count; r++) for (let i = 0; i < 3 - r && k < count; i++, k++) { const cx = 4 + i * 4 + r * 2, cy = 11 - r * 4; s.disc(cx, cy, 2.2, WP.wood3); s.disc(cx, cy, 1.2, "#e0b47a"); }
    else if (res === "stone") for (let i = 0; i < Math.max(1, Math.min(4, count)); i++) { const x = 2 + (i % 2) * 6 + (i > 1 ? 3 : 0), y = 9 - (i > 1 ? 4 : 0); s.ell(x + 3, y + 2, 3, 2.2, WP.stone2); s.p(x + 2, y + 1, WP.stone1); }
    else if (res === "food" && m) for (let i = 0; i < Math.min(4, count); i++) { const x = 2 + i * 3, y = 11 - (i % 2) * 3; s.r(x + 1, y, 1, 2, "#f2ece0"); s.r(x, y - 2, 3, 2, "#e05a5a"); s.p(x + 1, y - 2, "#fffaf0"); }
    else if (res === "food") { s.r(2, 4, 12, 9, WP.wood2); s.r(2, 4, 12, 1, WP.wood1); for (let i = 0; i < Math.min(4, count); i++) s.disc(4.5 + i * 2.5, 4, 1.4, i % 2 ? WP.fR : "#e0a458"); }
    else if (res === "seeds") { s.ell(8, 9, 5, 4.5, "#d9b77a"); s.r(6, 3, 4, 2, "#b08a50"); s.r(6, 8, 4, 2, WP.leaf2); }
    else if (res !== "water") { s.r(6, 8, 3, 3, WP.fY); }
    if (res !== "water") s.outline(WP.outline);
  });
});
