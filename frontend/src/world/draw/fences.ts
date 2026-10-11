// Zaun um Orte mit `style.fence`: ein Ring außerhalb des Rechtecks, Lücken an den Eingängen.
import type { LocationInfo } from "../../store/types";
import { H } from "./furniture";
import { newCanvas, OUTLINE, TILE, type Pen } from "./pen";

export type FencePiece = { x: number; y: number; kind: "h" | "v" | "corner" };

export function fencePieces(locs: LocationInfo[]): FencePiece[] {
  const out: FencePiece[] = [];
  for (const l of locs) {
    if (!(l.props.style as { fence?: boolean } | undefined)?.fence) continue;
    const [rx, ry, rw, rh] = l.rect, gates = new Set(l.entrances.map(([x, y]) => `${x},${y}`));
    for (let x = rx - 1; x <= rx + rw; x++) for (const y of [ry - 1, ry + rh]) if (!gates.has(`${x},${y}`)) out.push({ x, y, kind: x === rx - 1 || x === rx + rw ? "corner" : "h" });
    for (let y = ry; y < ry + rh; y++) for (const x of [rx - 1, rx + rw]) if (!gates.has(`${x},${y}`)) out.push({ x, y, kind: "v" });
  }
  return out;
}

const post = (p: Pen, x: number) => { p.F(OUTLINE, x - 1, H - 15, 4, 14); p.F("#b98a58", x, H - 14, 2, 12); p.F("#d9b378", x, H - 14, 1, 12); };

export function fenceCanvas(kind: FencePiece["kind"]): HTMLCanvasElement {
  const { canvas, p } = newCanvas(TILE, H);
  p.F("rgba(30,40,20,.3)", 0, H - 2, TILE, 2);
  if (kind !== "v") { p.F(OUTLINE, 0, H - 11, TILE, 4); p.F("#c99a5b", 0, H - 10, TILE, 2); p.F("#8a5a32", 0, H - 9, TILE, 1); }
  if (kind === "v") { p.F(OUTLINE, 5, H - 15, 6, 15); p.F("#c99a5b", 6, H - 14, 4, 13); }
  post(p, kind === "corner" ? 7 : 1);
  return canvas;
}
