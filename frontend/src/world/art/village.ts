// Haus, Brunnen, Bank, Laterne, Brett, Zaun und die übrigen Dorfdinge 1:1 aus Mockup A (world.js), nur nach TypeScript übertragen.
import { WP } from "./palette";
import { hash, sprite } from "./pen";

export function house(lit: boolean): HTMLCanvasElement {
  return sprite(78, 80, (s) => {
    let y, x;
    s.r(55, 1, 8, 18, WP.stone2); s.r(55, 1, 3, 18, WP.stone1); s.r(54, 0, 10, 3, WP.stone3); for (y = 5; y < 18; y += 4) s.r(55, y, 8, 1, WP.stone3);
    for (y = 6; y <= 34; y++) {
      let l = Math.round(13 - (y - 6) * 11 / 28), r = Math.round(65 + (y - 6) * 11 / 28), row = (y - 6) % 5;
      for (x = l; x <= r; x++) {
        let c = row < 2 ? WP.roof1 : WP.roof2;
        if (row === 4 && ((x + Math.floor((y - 6) / 5) * 3) % 6 === 0)) c = WP.roof3;
        if (row === 4 && ((x + Math.floor((y - 6) / 5) * 3) % 6 === 1)) c = WP.roof3;
        if (x === l || x === r) c = WP.roof3;
        s.p(x, y, c);
      }
    }
    s.r(13, 5, 53, 2, WP.roof3); s.r(14, 4, 51, 1, WP.wood3);
    s.r(2, 34, 75, 2, WP.roof3);
    s.disc(39.5, 20.5, 5.5, WP.wood3); s.disc(39.5, 20.5, 4.2, lit ? WP.glassLit : WP.glass); s.r(39, 16, 1, 9, WP.wood1); s.r(35, 20, 9, 1, WP.wood1);
    if (!lit) { s.p(37, 18, "#e9f8ff"); s.p(38, 17, "#e9f8ff"); }
    s.r(6, 36, 66, 36, WP.wall1);
    for (y = 37; y < 72; y += 3) for (x = 7; x < 72; x += 7) if (hash(x, y, 3) > 0.7) s.p(x, y, WP.wall2);
    s.r(6, 36, 66, 2, WP.wall3);
    s.r(6, 36, 2, 36, WP.wood2); s.r(37, 36, 2, 12, WP.wood2); s.r(70, 36, 2, 36, WP.wood2); s.r(6, 54, 66, 2, WP.wood2);
    let wins = [[13, 40], [50, 40]];
    for (let i = 0; i < wins.length; i++) {
      let wx = wins[i][0], wy = wins[i][1];
      s.r(wx - 1, wy - 1, 17, 14, WP.wood3); s.r(wx, wy, 15, 12, lit ? WP.glassLit : WP.glass);
      s.r(wx + 7, wy, 1, 12, WP.wood1); s.r(wx, wy + 5, 15, 1, WP.wood1);
      if (!lit) { s.p(wx + 1, wy + 1, "#eefaff"); s.p(wx + 2, wy + 1, "#eefaff"); s.p(wx + 1, wy + 2, "#eefaff"); s.p(wx + 9, wy + 7, "#eefaff"); }
      else { s.r(wx + 1, wy + 7, 5, 4, "#ffc46a"); }
      s.r(wx - 2, wy + 12, 19, 4, WP.wood2); s.r(wx - 2, wy + 12, 19, 1, WP.wood1);
      for (let f = 0; f < 7; f++) { let fx = wx - 1 + f * 2.6; s.p(fx, wy + 11, WP.leaf3); s.p(fx + 1, wy + 10, [WP.fP, WP.fY, WP.fW, WP.fR][f % 4]); s.p(fx, wy + 10, WP.leaf2); }
    }
    s.r(32, 52, 14, 20, WP.wood3); s.disc(39, 53, 7, WP.wood3);
    s.r(33, 53, 12, 19, WP.wood1); s.disc(39, 54, 6, WP.wood1);
    for (x = 35; x < 45; x += 3) s.r(x, 50, 1, 22, WP.wood2);
    s.r(42, 62, 2, 2, WP.fY);
    s.r(48, 46, 4, 6, WP.outline); s.r(49, 47, 2, 4, lit ? WP.lampLit : WP.lamp);
    for (x = 6; x < 72; x += 5) { s.r(x, 72, 5, 4, hash(x, 1, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 72, WP.stone3); }
    s.r(6, 72, 66, 1, WP.stone3); s.r(30, 76, 18, 3, WP.stone1); s.r(30, 78, 18, 1, WP.stone2);
    s.outline(WP.outline);
  });
}

export function well(): HTMLCanvasElement {
  return sprite(24, 30, (s) => {
    let x;
    s.r(4, 7, 2, 14, WP.wood2); s.r(18, 7, 2, 14, WP.wood2);
    for (let y = 0; y < 8; y++) { let hw = Math.round(3 + y * 1.35); s.r(12 - hw, y, hw * 2, 1, y < 3 ? WP.roof1 : y < 6 ? WP.roof2 : WP.roof3); }
    s.r(5, 9, 14, 1, WP.wood3); s.r(11, 9, 1, 6, "#6b5a45"); s.r(9, 14, 5, 4, WP.wood2); s.r(9, 14, 5, 1, WP.wood1);
    s.ell(12, 20, 10, 3.5, WP.stone2); s.ell(12, 20, 7.5, 2.2, "#2f5f80"); s.ell(12, 20.5, 6, 1.4, "#3f7ea6");
    for (let yy = 22; yy < 29; yy++) for (x = 2; x < 22; x++) { let c = ((yy - 22) % 3 === 0 || ((x + (Math.floor((yy - 22) / 3) % 2) * 2) % 5 === 0)) ? WP.stone3 : (x < 8 ? WP.stone1 : WP.stone2); s.p(x, yy, c); }
    s.outline(WP.outline);
  });
}

export function bench(): HTMLCanvasElement {
  return sprite(22, 13, (s) => {
    s.r(2, 1, 18, 2, WP.wood1); s.r(2, 3, 18, 1, WP.wood2); s.r(2, 5, 18, 1, WP.wood1);
    s.r(1, 7, 20, 2, WP.wood1); s.r(1, 9, 20, 1, WP.wood3);
    s.r(3, 1, 1, 11, WP.wood3); s.r(18, 1, 1, 11, WP.wood3);
    s.outline(WP.outline);
  });
}

export function lamp(lit: boolean): HTMLCanvasElement {
  return sprite(10, 30, (s) => {
    s.r(4, 9, 2, 19, "#4b4559"); s.r(2, 27, 6, 2, "#4b4559");
    s.r(2, 2, 6, 7, "#4b4559"); s.r(3, 3, 4, 5, lit ? WP.lampLit : WP.lamp); s.r(1, 1, 8, 1, "#4b4559"); s.r(3, 0, 4, 1, "#4b4559");
    s.outline(WP.outline);
  });
}

/** Brett mit Zetteln; `notes` aus dem Zustand (Mockup: 2). */
export function board(notes = 2): HTMLCanvasElement {
  return sprite(20, 22, (s) => {
    s.r(3, 2, 2, 19, WP.wood3); s.r(15, 2, 2, 19, WP.wood3);
    s.r(1, 2, 18, 12, WP.wood3); s.r(2, 3, 16, 10, WP.wood1);
    if (notes >= 1) { s.r(3, 4, 6, 5, WP.fW); s.r(4, 5, 4, 1, "#c9bba0"); s.r(4, 7, 3, 1, "#c9bba0"); s.p(6, 4, WP.fR); }
    if (notes >= 2) { s.r(11, 5, 6, 6, "#ffe7a8"); s.r(12, 7, 4, 1, "#c9a96a"); s.r(12, 9, 3, 1, "#c9a96a"); s.p(14, 5, "#5c8de0"); }
    s.outline(WP.outline);
  });
}

export function fence(): HTMLCanvasElement {
  return sprite(14, 11, (s) => {
    s.r(1, 3, 3, 7, WP.wood1); s.p(2, 2, WP.wood1); s.r(3, 3, 1, 7, WP.wood2);
    s.r(10, 3, 3, 7, WP.wood1); s.p(11, 2, WP.wood1); s.r(12, 3, 1, 7, WP.wood2);
    s.r(0, 4, 14, 1, WP.wood1); s.r(0, 7, 14, 1, WP.wood1); s.r(0, 5, 14, 1, WP.wood2);
    s.outline(WP.outline);
  });
}

export function post(): HTMLCanvasElement { return sprite(5, 11, (s) => { s.r(1, 2, 3, 8, WP.wood1); s.p(2, 1, WP.wood1); s.r(3, 2, 1, 8, WP.wood2); s.outline(WP.outline); }); }

export function scarecrow(): HTMLCanvasElement {
  return sprite(18, 26, (s) => {
    s.r(8, 9, 2, 16, WP.wood2); s.r(2, 12, 14, 2, WP.wood2);
    s.r(4, 11, 10, 7, "#5f86c4"); s.r(7, 13, 3, 3, "#e2b25c");
    s.disc(9, 7, 3.6, "#e9d3a2"); s.p(8, 7, WP.outline); s.p(10, 7, WP.outline);
    s.r(3, 3, 12, 2, "#e8b947"); s.r(6, 0, 6, 3, "#e8b947"); s.r(6, 2, 6, 1, "#c79531");
    s.p(1, 12, "#e8b947"); s.p(16, 12, "#e8b947");
    s.outline(WP.outline);
  });
}

export function sign(): HTMLCanvasElement {
  return sprite(16, 18, (s) => {
    s.r(7, 4, 2, 13, WP.wood3);
    s.r(1, 3, 11, 6, WP.wood1); s.p(12, 4, WP.wood1); s.r(12, 5, 2, 2, WP.wood1); s.p(12, 7, WP.wood1);
    s.r(3, 5, 6, 1, WP.wood3); s.r(3, 7, 4, 1, WP.wood3);
    s.outline(WP.outline);
  });
}

export function mailbox(): HTMLCanvasElement { return sprite(8, 14, (s) => { s.r(3, 6, 2, 7, WP.wood3); s.r(1, 1, 6, 5, "#e05a5a"); s.r(1, 1, 6, 1, "#ff8a7a"); s.p(6, 2, WP.fY); s.outline(WP.outline); }); }

export function barrel(): HTMLCanvasElement { return sprite(11, 13, (s) => { s.ell(5.5, 6, 4.5, 5.5, WP.wood1); s.r(1, 3, 9, 1, WP.wood3); s.r(1, 8, 9, 1, WP.wood3); s.ell(5.5, 1.6, 4, 1.3, WP.wood2); s.outline(WP.outline); }); }

export function boat(): HTMLCanvasElement {
  return sprite(24, 10, (s) => {
    s.ell(12, 4, 11, 4, WP.wood1); s.ell(12, 3.5, 9, 2.5, WP.wood3); s.r(11, 1, 2, 5, WP.wood2);
    s.r(1, 6, 22, 1, "#3fa4d3"); s.r(3, 7, 18, 2, "#5cc2e3");
    s.outline(WP.outline);
  });
}
