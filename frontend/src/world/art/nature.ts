// Bäume, Büsche, Pflanzen, Steine und Schilf 1:1 aus Mockup A (world.js), nur nach TypeScript übertragen.
import { WP } from "./palette";
import { rng, sprite } from "./pen";

export function tree(variant: number, seed: number): HTMLCanvasElement {
  return sprite(32, 42, (s) => {
    let R = rng(seed);
    s.r(14, 28, 5, 12, WP.trunk1); s.r(17, 28, 2, 12, WP.trunk2); s.r(12, 38, 9, 2, WP.trunk2); s.p(13, 37, WP.trunk1);
    let L = variant === 2 ? ["#ffc6da", "#f7a0c0", "#e27da5", "#be5f88"] : [WP.leaf1, WP.leaf2, WP.leaf3, WP.leaf4];
    s.disc(16, 17, 13, L[3]); s.disc(9, 21, 7.5, L[3]); s.disc(23, 21, 7.5, L[3]);
    s.disc(15, 15, 11.5, L[2]); s.disc(9, 19, 6.2, L[2]); s.disc(22.5, 19, 6, L[2]);
    s.disc(14, 13, 9, L[1]); s.disc(20, 12, 5, L[1]); s.disc(8, 16, 4, L[1]);
    s.disc(12, 9, 4.6, L[0]); s.disc(18, 8, 2.6, L[0]);
    for (let k = 0; k < 34; k++) {
      let a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 11, x = Math.round(16 + Math.cos(a) * rr), y = Math.round(16 + Math.sin(a) * rr * 0.9);
      let shade = y > 16 ? L[3] : L[2];
      s.p(x, y, shade); s.p(x + 1, y, shade); s.p(x - 1, y - 1, y > 14 ? L[2] : L[0]);
    }
    if (variant === 1) for (let f = 0; f < 7; f++) { let ax = Math.round(7 + R() * 18), ay = Math.round(9 + R() * 14); s.r(ax, ay, 2, 2, WP.fR); s.p(ax, ay, "#ffd0c8"); }
    if (variant === 2) for (let q = 0; q < 10; q++) { s.p(Math.round(6 + R() * 20), Math.round(6 + R() * 18), WP.fW); }
    s.outline(WP.outline);
  });
}

export function pine(_seed: number): HTMLCanvasElement {
  return sprite(26, 46, (s) => {
    let C = ["#62b071", "#47975e", "#337b52", "#245f45"];
    s.r(11, 36, 4, 9, WP.trunk1); s.r(13, 36, 2, 9, WP.trunk2);
    for (let i = 0; i < 4; i++) {
      let top = 2 + i * 8, hw = 4 + i * 3, hgt = 13;
      for (let y = 0; y < hgt; y++) {
        let half = Math.round(hw * (y + 1) / hgt + 1);
        for (let x = -half; x <= half; x++) s.p(13 + x, top + y, x < -half / 3 ? C[0] : x < half / 3 ? C[1] : C[2]);
        s.p(13 - half, top + y, C[1]);
      }
      for (let x2 = -hw - 1; x2 <= hw + 1; x2 += 2) s.p(13 + x2, top + hgt - 1, C[3]);
    }
    s.outline(WP.outline);
  });
}

export function bush(seed: number, flowers: string | null): HTMLCanvasElement {
  return sprite(20, 14, (s) => {
    let R = rng(seed);
    s.ell(10, 8, 8.5, 5.5, WP.leaf4); s.ell(9, 7, 7.5, 4.6, WP.leaf3); s.ell(8, 6, 5, 3, WP.leaf2); s.ell(7, 5, 2.5, 1.5, WP.leaf1);
    if (flowers) for (let i = 0; i < 6; i++) { let x = Math.round(3 + R() * 14), y = Math.round(3 + R() * 7); s.p(x, y, flowers); s.p(x, y - 1, WP.fW); }
    s.outline(WP.outline);
  });
}

export function sunflower(): HTMLCanvasElement {
  return sprite(11, 22, (s) => {
    s.r(5, 8, 1, 13, WP.leaf3); s.ell(3, 13, 2, 1, WP.leaf2); s.ell(8, 16, 2, 1, WP.leaf2);
    s.disc(5.5, 5.5, 4.5, WP.fY); s.disc(5.5, 5.5, 2.2, "#8a5a2b"); s.p(4, 4, "#b07a3a");
    s.outline(WP.outline);
  });
}

export function tomato(seed: number): HTMLCanvasElement {
  return sprite(13, 15, (s) => {
    let R = rng(seed);
    s.r(6, 1, 1, 13, WP.wood2);
    s.ell(6.5, 7, 5, 6, WP.leaf3); s.ell(5.5, 6, 3.5, 4, WP.leaf2);
    for (let i = 0; i < 5; i++) { let x = Math.round(3 + R() * 7), y = Math.round(3 + R() * 8); s.r(x, y, 2, 2, WP.fR); s.p(x, y, "#ffc0b5"); }
    s.outline(WP.outline);
  });
}

export function rock(_seed: number): HTMLCanvasElement { return sprite(12, 9, (s) => { s.ell(6, 5, 5, 3.5, WP.stone2); s.ell(5, 4, 3.5, 2.2, WP.stone1); s.p(4, 3, "#efeae2"); s.outline(WP.outline); }); }

export function reed(): HTMLCanvasElement { return sprite(8, 13, (s) => { s.r(2, 3, 1, 9, WP.leaf3); s.r(4, 1, 1, 11, WP.leaf2); s.r(6, 4, 1, 8, WP.leaf3); s.r(4, 1, 1, 4, "#8a5a35"); s.outline(WP.outline); }); }
