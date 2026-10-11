// Außenobjekte, Pflanzen, Türen, Baustellen und Rohstoffquellen. Unbekannte Arten werden als neutrale Kiste gezeichnet, nie als Fehler.
import type { ObjectInfo, ResourceInfo } from "../../store/types";
import { FURNITURE, H, type Drawer } from "./furniture";
import { OUTLINE, type Pen } from "./pen";

const DARK = "#2e2218", WOOD = "#b98a58", WOOD_D = "#8a5a32", WOOD_L = "#d3a672";
const shadow = (p: Pen, x = 1, w = 14) => p.F("rgba(30,40,20,.3)", x, H - 2, w, 2);

const PLANT_CROPS: Record<string, { leaf: string; tip: string }> = { carrot: { leaf: "#58a64f", tip: "#e0782f" } };

export function drawPlant(p: Pen, o: ObjectInfo, wet: boolean) {
  const stage = Math.max(0, Math.min(4, Number(o.state.stage ?? 0)));
  const c = PLANT_CROPS[String(o.state.crop ?? "carrot")] ?? { leaf: "#58a64f", tip: "#d9c25a" };
  if (wet) p.F("rgba(20,12,6,.35)", 1, H - 14, 14, 13);
  const base = H - 7;
  if (stage === 0) { p.F("#8a6040", 6, base, 4, 2); p.F("#a67a52", 7, base - 1, 2, 1); return; }
  if (stage === 1) { p.F("#6bbf4f", 7, base - 3, 2, 3); p.F("#8fd96a", 5, base - 4, 2, 1); p.F("#8fd96a", 9, base - 4, 2, 1); return; }
  const h = stage === 2 ? 5 : stage === 3 ? 8 : 10;
  for (const dx of [-3, 0, 3]) {
    p.F("#3f8a3a", 7 + dx, base - h + (dx ? 2 : 0), 1, h - (dx ? 2 : 0));
    p.F(c.leaf, 8 + dx, base - h - 1 + (dx ? 2 : 0), 1, h - (dx ? 2 : 0));
  }
  p.F("#8fd96a", 5, base - h, 6, 1);
  if (stage >= 3) p.F(c.tip, 6, base, 4, 2);
  if (stage === 4) { p.F(c.tip, 4, base - 1, 3, 3); p.F(c.tip, 9, base - 1, 3, 3); p.F("#ffd9a0", 7, base - 2, 2, 1); }
}

function site(p: Pen, o: ObjectInfo) {
  const total = Math.max(1, Number(o.state.total ?? 1)), prog = Math.min(1, Number(o.state.progress ?? 0) / total);
  shadow(p);
  for (const x of [1, 12]) { p.F(DARK, x - 1, H - 15, 4, 15); p.F(WOOD_D, x, H - 14, 2, 14); }
  p.F(WOOD_D, 2, H - 10, 12, 2);
  p.F("#c9a23a", 2, H - 15, 12, 1);
  const planks = Math.round(prog * 3);
  for (let i = 0; i < planks; i++) { p.F(DARK, 3, H - 4 - i * 3, 10, 3); p.F(WOOD_L, 3, H - 4 - i * 3, 10, 2); }
  p.F(DARK, 1, H - 19, 14, 3);
  p.F("#4a4f58", 2, H - 18, 12, 1);
  p.F("#8fd96a", 2, H - 18, Math.round(12 * prog), 1);
}

export const OUTDOOR: Record<string, Drawer> = {
  well: (p) => {
    shadow(p);
    p.F(OUTLINE, 0, H - 14, 16, 14); p.F("#8e9198", 1, H - 13, 14, 12); p.F("#b9bcc2", 1, H - 13, 14, 2);
    p.F("#2f6fa8", 3, H - 10, 10, 5); p.F("#59a0da", 4, H - 9, 4, 1);
    p.F("#6b4a2f", 1, H - 24, 2, 12); p.F("#6b4a2f", 13, H - 24, 2, 12);
    p.F(OUTLINE, 0, H - 29, 16, 6); p.F("#b24a3a", 1, H - 28, 14, 4); p.F("#c65b48", 1, H - 28, 14, 1); p.F("#7b2f27", 1, H - 25, 14, 1);
    p.F("#c9a066", 7, H - 23, 1, 8);
  },
  bench: (p) => {
    shadow(p);
    p.F(DARK, 0, H - 11, 16, 6); p.F(WOOD, 1, H - 10, 14, 4); p.F(WOOD_L, 1, H - 10, 14, 1);
    p.F(WOOD_D, 1, H - 6, 2, 4); p.F(WOOD_D, 13, H - 6, 2, 4); p.F(WOOD, 1, H - 14, 14, 2); p.F(WOOD_D, 1, H - 13, 14, 1);
  },
  fishing_spot: (p) => { p.F("#6b4a2f", 11, H - 18, 1, 16); p.F("#e8d9a8", 12, H - 18, 3, 1); p.F("#d9453a", 14, H - 17, 2, 2); p.F("#f2ece0", 15, H - 15, 1, 1); },
  birdhouse: (p) => {
    shadow(p, 5, 6);
    p.F("#6b4a2f", 7, H - 14, 2, 14); p.F(DARK, 3, H - 24, 10, 10); p.F(WOOD, 4, H - 23, 8, 8); p.F("#2e2218", 7, H - 20, 2, 3); p.F("#b24a3a", 2, H - 26, 12, 3);
  },
  firepit: (p, o) => {
    shadow(p);
    p.F(OUTLINE, 1, H - 9, 14, 8); p.F("#8e9198", 2, H - 8, 12, 6); p.F("#2a2824", 4, H - 7, 8, 4);
    if (o.state.lit) { p.F("#e0702f", 5, H - 10, 6, 5); p.F("#f2d24b", 6, H - 12, 4, 5); p.F("#fff3b0", 7, H - 9, 2, 3); } else p.F("#5a5650", 5, H - 6, 6, 2);
  },
  fence: (p) => {
    shadow(p);
    p.F(DARK, 0, H - 13, 16, 3); p.F("#c99a5b", 0, H - 12, 16, 2);
    for (const x of [1, 13]) { p.F(DARK, x - 1, H - 15, 4, 14); p.F("#b98a58", x, H - 14, 2, 12); }
  },
  pier_plank: (p) => { p.F(DARK, 0, H - 14, 16, 14); p.F("#a8794a", 1, H - 13, 14, 12); for (let i = 3; i < 14; i += 4) p.F("#6e4a2a", 1, H - 13 + i, 14, 1); },
  construction_site: (p, o) => site(p, o),
  plant: (p, o) => drawPlant(p, o, false),
  unknown: (p) => { shadow(p); p.F(DARK, 2, H - 12, 12, 11); p.F("#8a8f99", 3, H - 11, 10, 9); p.F("#b4b9c2", 3, H - 11, 10, 1); p.F("#4a4f58", 7, H - 8, 2, 2); },
};

/** Tür: unverschlossen als offener Durchgang mit Türblatt am Rand, verschlossen als geschlossene Füllung mit Schlüsselloch. */
export function drawDoor(p: Pen, o: ObjectInfo, horizontal: boolean) {
  const locked = !!o.state.locked;
  if (horizontal) {
    if (locked) { p.F(DARK, 1, H - 16, 14, 16); p.F("#84562e", 2, H - 15, 12, 14); p.F("#6a4424", 7, H - 15, 2, 14); p.F("#f3cf6a", 5, H - 8, 2, 2); }
    else { p.F("#6a4424", 1, H - 15, 2, 14); p.F("#84562e", 2, H - 14, 1, 12); }
  } else if (locked) { p.F(DARK, 0, H - 15, 16, 14); p.F("#84562e", 1, H - 14, 14, 12); p.F("#6a4424", 1, H - 8, 14, 1); p.F("#f3cf6a", 11, H - 9, 2, 2); }
  else p.F("#6a4424", 1, H - 15, 12, 2);
}

export function drawResource(p: Pen, n: ResourceInfo) {
  const ratio = n.cap > 0 && n.cap < 500 ? Math.max(0, Math.min(1, n.amount / n.cap)) : 1;
  const count = Math.max(n.amount >= 1 ? 1 : 0, Math.round(ratio * 5));
  if (count === 0) return;
  if (n.resource === "wood") {
    shadow(p, 1, 14);
    for (let r = 0, k = 0; r < 3 && k < count; r++) for (let c = 0; c < 3 - r && k < count; c++, k++) { const cx = 4 + c * 4 + r * 2, cy = H - 4 - r * 4; p.disc(cx, cy, 2, "#5b3a22"); p.disc(cx, cy, 1, "#d9ac6e"); }
  } else if (n.resource === "stone") {
    shadow(p, 1, 14);
    for (let i = 0; i < Math.max(1, Math.min(4, count)); i++) { const x = 2 + (i % 2) * 6 + (i > 1 ? 3 : 0), y = H - 4 - (i > 1 ? 4 : 0); p.F(OUTLINE, x, y - 1, 7, 6); p.F("#9a9ca4", x + 1, y, 5, 4); p.F("#c4c6cc", x + 1, y, 3, 1); }
  } else if (n.resource === "food" && n.id.includes("mushroom")) {
    for (let i = 0; i < Math.min(4, count); i++) { const x = 2 + i * 3, y = H - 3 - (i % 2) * 3; p.F("#f2ece0", x + 1, y, 1, 2); p.F("#c8453a", x, y - 2, 3, 2); p.F("#fff", x + 1, y - 2, 1, 1); }
  } else if (n.resource === "food") {
    shadow(p); p.F(DARK, 1, H - 11, 14, 10); p.F("#8a5a32", 2, H - 10, 12, 8); p.F(WOOD_L, 2, H - 10, 12, 1);
    for (let i = 0; i < Math.min(4, count); i++) p.disc(4 + i * 3, H - 11, 1, i % 2 ? "#d84a3a" : "#e0a458");
  } else if (n.resource === "seeds") {
    shadow(p); p.F(DARK, 2, H - 11, 12, 10); p.F("#c9a066", 3, H - 10, 10, 8); p.F("#8a5a32", 3, H - 10, 10, 2); p.F("#58a64f", 6, H - 7, 4, 2);
  } else if (n.resource !== "water") {
    p.F("#f2d24b", 6, H - 6, 3, 3); p.F("#fff3b0", 7, H - 5, 1, 1);
  }
}

export const ALL_DRAWERS: Record<string, Drawer> = { ...FURNITURE, ...OUTDOOR };
void WOOD;
