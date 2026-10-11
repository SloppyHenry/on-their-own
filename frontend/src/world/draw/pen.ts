// Kleine Zeichenhilfen für Pixelgrafik auf einem 2D-Kontext. Alles deterministisch (kein Math.random), damit Texturen reproduzierbar sind.
export const TILE = 16;
export const OUTLINE = "#2b3a24";

export const rnd = (x: number, y: number, s = 0): number => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export const pick = <T,>(a: T[], r: number): T => a[Math.min(a.length - 1, Math.floor(r * a.length))];

export interface Pen {
  ctx: CanvasRenderingContext2D;
  F(c: string, x: number, y: number, w?: number, h?: number): void;
  disc(cx: number, cy: number, r: number, c: string): void;
}

export function pen(ctx: CanvasRenderingContext2D): Pen {
  return {
    ctx,
    F(c, x, y, w = 1, h = 1) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    },
    disc(cx, cy, r, c) {
      ctx.fillStyle = c;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.8) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    },
  };
}

export function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; p: Pen } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, p: pen(canvas.getContext("2d")!) };
}
