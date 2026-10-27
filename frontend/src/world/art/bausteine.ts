// Neue Bausteine im Stil von Mockup A, 1:1 aus docs/mockups/welt-optik/bausteine.js (am 14.10.2026 abgenommen): Wohnhaus in
// Breiten und Farben, Werkstatt, Laden, Scheune, Stall, Marktstände, Heuballen, Holzstapel, Kiste. Gleiche Palette und Zeichenweise wie village.ts.
import { WP } from "./palette";
import { hash, sprite } from "./pen";

export const ROOF: Record<string, string[]> = {
  rot: ["#e6775c", "#cc5f48", "#a2463a"], blau: ["#7fa8dc", "#5f8bc4", "#456ba0"], stroh: ["#e3c274", "#c9a455", "#a1803d"],
  moos: ["#92bd6c", "#719f55", "#547d40"], schiefer: ["#9aa0b8", "#7d839c", "#5d637c"], holz: ["#b8825a", "#946040", "#6e4630"],
};
export const WALL: Record<string, string[]> = {
  creme: ["#f6e9cc", "#e5d2ad", "#cbb38c"], rosa: ["#f4d9d6", "#e3bfba", "#c9a39c"], blau: ["#d9e6f2", "#bfd0e3", "#9fb5cc"],
  gelb: ["#f6e0a0", "#e6cb7e", "#cdb062"], holz: ["#cf9159", "#b97d4a", "#9a6638"],
};
const WINDOWS: Record<number, number[]> = { 58: [9, 46], 66: [13, 50], 90: [10, 27, 64, 81] };

// ---- Wohnhaus: wHouse mit Breite, Dach- und Wandfarbe ----
export function bHouse(o: { ww?: number; roof?: string; wall?: string; lit?: boolean }): HTMLCanvasElement {
  let ww = o.ww || 66, SW = ww + 12, cx = 6 + ww / 2, R = ROOF[o.roof || 'rot'], Wl = WALL[o.wall || 'creme'], lit = !!o.lit, wins = WINDOWS[ww] || [13, 50];
  return sprite(SW, 80, (s) => {
    let y, x, chx = Math.round(cx + 16);
    s.r(chx, 1, 8, 18, WP.stone2); s.r(chx, 1, 3, 18, WP.stone1); s.r(chx - 1, 0, 10, 3, WP.stone3); for (y = 5; y < 18; y += 4) s.r(chx, y, 8, 1, WP.stone3);
    for (y = 6; y <= 34; y++) {
      let l = Math.round(13 - (y - 6) * 11 / 28), r = Math.round(ww - 1 + (y - 6) * 11 / 28), row = (y - 6) % 5;
      for (x = l; x <= r; x++) {
        let c = row < 2 ? R[0] : R[1];
        if (row === 4 && ((x + Math.floor((y - 6) / 5) * 3) % 6 <= 1)) c = R[2];
        if (x === l || x === r) c = R[2];
        s.p(x, y, c);
      }
    }
    s.r(13, 5, ww - 13, 2, R[2]); s.r(14, 4, ww - 15, 1, WP.wood3); s.r(2, 34, ww + 9, 2, R[2]);
    s.disc(cx + 0.5, 20.5, 5.5, WP.wood3); s.disc(cx + 0.5, 20.5, 4.2, lit ? WP.glassLit : WP.glass); s.r(cx, 16, 1, 9, WP.wood1); s.r(cx - 4, 20, 9, 1, WP.wood1);
    if (!lit) { s.p(cx - 2, 18, '#e9f8ff'); s.p(cx - 1, 17, '#e9f8ff'); }
    s.r(6, 36, ww, 36, Wl[0]);
    if (o.wall === 'holz') for (y = 38; y < 72; y += 4) s.r(7, y, ww - 2, 1, Wl[1]);
    else for (y = 37; y < 72; y += 3) for (x = 7; x < ww + 6; x += 7) if (hash(x, y, 3) > 0.7) s.p(x, y, Wl[1]);
    s.r(6, 36, ww, 2, Wl[2]);
    s.r(6, 36, 2, 36, WP.wood2); s.r(cx - 2, 36, 2, 12, WP.wood2); s.r(ww + 4, 36, 2, 36, WP.wood2); s.r(6, 54, ww, 2, WP.wood2);
    for (let i = 0; i < wins.length; i++) {
      let wx = wins[i], wy = 40;
      s.r(wx - 1, wy - 1, 17, 14, WP.wood3); s.r(wx, wy, 15, 12, lit ? WP.glassLit : WP.glass);
      s.r(wx + 7, wy, 1, 12, WP.wood1); s.r(wx, wy + 5, 15, 1, WP.wood1);
      if (!lit) { s.p(wx + 1, wy + 1, '#eefaff'); s.p(wx + 2, wy + 1, '#eefaff'); s.p(wx + 1, wy + 2, '#eefaff'); s.p(wx + 9, wy + 7, '#eefaff'); } else s.r(wx + 1, wy + 7, 5, 4, '#ffc46a');
      s.r(wx - 2, wy + 12, 19, 4, WP.wood2); s.r(wx - 2, wy + 12, 19, 1, WP.wood1);
      for (let f = 0; f < 7; f++) { let fx = wx - 1 + f * 2.6; s.p(fx, wy + 11, WP.leaf3); s.p(fx + 1, wy + 10, [WP.fP, WP.fY, WP.fW, WP.fR][(f + i) % 4]); s.p(fx, wy + 10, WP.leaf2); }
    }
    s.r(cx - 7, 52, 14, 20, WP.wood3); s.disc(cx, 53, 7, WP.wood3); s.r(cx - 6, 53, 12, 19, WP.wood1); s.disc(cx, 54, 6, WP.wood1);
    for (x = cx - 4; x < cx + 6; x += 3) s.r(x, 50, 1, 22, WP.wood2);
    s.r(cx + 3, 62, 2, 2, WP.fY); s.r(cx + 9, 46, 4, 6, WP.outline); s.r(cx + 10, 47, 2, 4, lit ? WP.lampLit : WP.lamp);
    for (x = 6; x < ww + 6; x += 5) { s.r(x, 72, 5, 4, hash(x, 1, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 72, WP.stone3); }
    s.r(6, 72, ww, 1, WP.stone3); s.r(cx - 9, 76, 18, 3, WP.stone1); s.r(cx - 9, 78, 18, 1, WP.stone2);
    s.outline(WP.outline);
  });
}

// ---- Werkstatt: flaches Dach aus Holzschindeln, Bretterwand, großes Tor, Schornstein, Schild mit Hammer ----
export function bWorkshop(lit: boolean): HTMLCanvasElement {
  return sprite(92, 70, (s) => {
    let x, y, R = ROOF.holz;
    s.r(66, 2, 8, 16, WP.stone2); s.r(66, 2, 3, 16, WP.stone1); s.r(65, 1, 10, 3, WP.stone3); for (y = 6; y < 16; y += 4) s.r(66, y, 8, 1, WP.stone3);
    for (y = 8; y <= 28; y++) {
      let l = Math.round(10 - (y - 8) * 8 / 20), r = Math.round(81 + (y - 8) * 8 / 20), row = (y - 8) % 5;
      for (x = l; x <= r; x++) { let c = row < 2 ? R[0] : R[1]; if (row === 4 && (x + Math.floor((y - 8) / 5) * 4) % 7 <= 1) c = R[2]; if (x === l || x === r) c = R[2]; s.p(x, y, c); }
    }
    s.r(10, 7, 72, 2, R[2]); s.r(2, 28, 88, 2, R[2]);
    s.r(6, 30, 80, 34, WP.wood1);
    for (x = 8; x < 85; x += 4) s.r(x, 31, 1, 33, WP.wood2);
    for (x = 10; x < 85; x += 8) s.r(x, 31, 1, 33, WP.wood3);
    s.r(6, 30, 80, 2, WP.wood3); s.r(6, 30, 3, 34, WP.wood3); s.r(83, 30, 3, 34, WP.wood3);
    s.r(12, 36, 32, 28, WP.wood3); s.r(14, 38, 14, 26, WP.wood2); s.r(30, 38, 12, 26, WP.wood2); s.r(28, 38, 2, 26, WP.wood3);
    for (let k = 0; k < 13; k++) { s.p(14 + k, 38 + Math.round(k * 24 / 13), WP.wood3); s.p(41 - k, 38 + Math.round(k * 24 / 13), WP.wood3); }
    s.r(14, 38, 28, 2, WP.wood3);
    s.r(56, 40, 20, 14, WP.wood3); s.r(57, 41, 18, 12, lit ? WP.glassLit : WP.glass); s.r(65, 41, 2, 12, WP.wood1); s.r(57, 46, 18, 1, WP.wood1);
    if (!lit) { s.p(58, 42, '#eefaff'); s.p(59, 42, '#eefaff'); s.p(58, 43, '#eefaff'); }
    s.r(52, 40, 4, 14, WP.roof3); s.r(76, 40, 4, 14, WP.roof3); s.r(50, 54, 30, 3, WP.wood2); s.r(50, 54, 30, 1, WP.wood1);
    s.r(47, 31, 14, 1, WP.wood3); s.r(48, 32, 12, 7, WP.wood1); s.r(48, 32, 12, 1, WP.wood2);                      // Schild: Hammer
    s.r(53, 34, 2, 4, '#5b5368'); s.r(51, 34, 6, 2, '#8b86a0'); s.p(51, 34, '#c9c5d8');
    for (x = 6; x < 86; x += 5) { s.r(x, 64, 5, 4, hash(x, 2, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 64, WP.stone3); }
    s.r(6, 64, 80, 1, WP.stone3);
    s.outline(WP.outline);
  });
}

// ---- Scheune: rotes Tonnendach-Giebel, weiße Zierkanten, X-Tor, Heuluke ----
export function bBarn(): HTMLCanvasElement {
  return sprite(100, 92, (s) => {
    let x, y, RD = ['#c7604a', '#a84a3a', '#7e362e'];
    for (y = 4; y <= 40; y++) {
      let hw = y < 20 ? 10 + (y - 4) * 1.5 : 34 + (y - 20) * 0.7, l = Math.round(50 - hw), r = Math.round(50 + hw), row = (y - 4) % 5;
      for (x = l; x <= r; x++) { let c = row < 2 ? RD[0] : RD[1]; if (row === 4 && (x + Math.floor((y - 4) / 5) * 3) % 6 <= 1) c = RD[2]; if (x === l || x === r) c = RD[2]; s.p(x, y, c); }
    }
    s.r(38, 3, 24, 2, RD[2]); s.r(2, 40, 96, 2, RD[2]);
    s.r(8, 42, 84, 42, '#c8553d');
    for (x = 10; x < 90; x += 4) s.r(x, 43, 1, 41, '#a84a3a');
    for (y = 46; y < 84; y += 8) for (x = 9; x < 90; x += 9) if (hash(x, y, 5) > 0.55) s.p(x, y, '#d9725a');
    s.r(8, 42, 84, 2, '#f6e9cc'); s.r(8, 42, 3, 42, '#f6e9cc'); s.r(89, 42, 3, 42, '#f6e9cc');
    s.r(36, 22, 28, 18, '#f6e9cc'); s.r(38, 24, 24, 16, '#3b2c3d'); s.r(38, 24, 24, 3, '#524258');
    for (let h = 0; h < 14; h++) s.p(40 + Math.round(hash(h, 1, 8) * 19), 28 + Math.round(hash(h, 2, 8) * 11), WP.path1);
    s.r(38, 33, 24, 2, '#e8c46a'); s.r(41, 31, 9, 2, '#e8c46a');
    s.r(30, 52, 40, 32, '#f6e9cc'); s.r(33, 54, 17, 30, '#c8553d'); s.r(50, 54, 17, 30, '#c8553d'); s.r(49, 54, 2, 30, '#f6e9cc');
    for (let k = 0; k < 16; k++) { s.p(34 + k, 55 + Math.round(k * 27 / 16), '#f6e9cc'); s.p(65 - k, 55 + Math.round(k * 27 / 16), '#f6e9cc'); s.p(35 + k, 55 + Math.round(k * 27 / 16), '#f6e9cc'); s.p(64 - k, 55 + Math.round(k * 27 / 16), '#f6e9cc'); }
    for (x = 8; x < 92; x += 5) { if (x > 28 && x < 70) continue; s.r(x, 84, 5, 4, hash(x, 3, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 84, WP.stone3); }
    s.r(8, 84, 84, 1, WP.stone3); s.r(28, 86, 44, 3, WP.stone1);
    s.outline(WP.outline);
  });
}

// ---- Laden: blaue Wand, rot-weiß gestreifte Markise, großes Schaufenster, Tür, Hängeschild mit Brot ----
export function bShop(lit: boolean): HTMLCanvasElement {
  return sprite(84, 80, (s) => {
    let x, y, R = ROOF.schiefer, Wl = WALL.blau;
    for (y = 6; y <= 28; y++) {
      let l = Math.round(10 - (y - 6) * 8 / 22), r = Math.round(73 + (y - 6) * 8 / 22), row = (y - 6) % 5;
      for (x = l; x <= r; x++) { let c = row < 2 ? R[0] : R[1]; if (row === 4 && (x + Math.floor((y - 6) / 5) * 3) % 6 <= 1) c = R[2]; if (x === l || x === r) c = R[2]; s.p(x, y, c); }
    }
    s.r(10, 5, 64, 2, R[2]); s.r(2, 28, 80, 2, R[2]);
    s.r(6, 30, 72, 42, Wl[0]); s.r(6, 30, 72, 2, Wl[2]); s.r(6, 30, 2, 42, WP.wood2); s.r(76, 30, 2, 42, WP.wood2);
    s.r(42, 6, 0, 0, '#fff'); s.r(32, 12, 20, 10, WP.wood3); s.r(33, 13, 18, 8, '#ffe7a8'); s.r(36, 15, 12, 1, '#c9a96a'); s.r(37, 17, 10, 1, '#c9a96a'); s.r(38, 19, 8, 1, '#c9a96a');     // Giebelschild
    for (x = 8; x < 76; x += 6) { s.r(x, 31, 6, 10, ((x - 8) / 6) % 2 ? '#f6f1e6' : '#d9534b'); s.r(x, 41, 6, 2, ((x - 8) / 6) % 2 ? '#d9d2c0' : '#a8403a'); }   // Markise
    for (x = 8; x < 76; x += 6) { s.r(x, 43, 6, 1, ((x - 8) / 6) % 2 ? '#f6f1e6' : '#d9534b'); s.p(x + 2, 44, ((x - 8) / 6) % 2 ? '#f6f1e6' : '#d9534b'); s.p(x + 3, 44, ((x - 8) / 6) % 2 ? '#f6f1e6' : '#d9534b'); }
    s.r(11, 47, 30, 20, WP.wood3); s.r(12, 48, 28, 18, lit ? WP.glassLit : WP.glass); s.r(25, 48, 2, 18, WP.wood1); s.r(12, 60, 28, 2, WP.wood1);
    s.r(14, 54, 6, 6, '#e9a24b'); s.r(22, 55, 6, 5, '#d9b06a'); s.r(30, 54, 8, 6, '#c9763a'); s.r(14, 54, 6, 1, '#f4c47a');       // Auslage: Brote, Körbe
    if (!lit) { s.p(13, 49, '#eefaff'); s.p(14, 49, '#eefaff'); s.p(13, 50, '#eefaff'); }
    s.r(50, 45, 16, 27, WP.wood3); s.r(51, 46, 14, 26, WP.wood1); s.r(51, 46, 14, 8, lit ? WP.glassLit : WP.glass); s.r(57, 46, 1, 8, WP.wood1);
    for (x = 52; x < 65; x += 3) s.r(x, 55, 1, 17, WP.wood2);
    s.r(62, 62, 2, 2, WP.fY);
    s.r(69, 36, 7, 1, '#4b4559'); s.r(75, 36, 1, 7, '#4b4559'); s.disc(72, 46, 5, WP.wood3); s.disc(72, 46, 4, '#ffd9a0'); s.r(70, 44, 4, 3, '#c9763a'); s.r(70, 44, 4, 1, '#e9a24b');   // Hängeschild
    for (x = 6; x < 78; x += 5) { s.r(x, 72, 5, 4, hash(x, 7, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 72, WP.stone3); }
    s.r(6, 72, 72, 1, WP.stone3); s.r(48, 76, 20, 3, WP.stone1);
    s.outline(WP.outline);
  });
}

// ---- Stall: lang, niedrig, Strohdach, zwei Halbtüren mit Pferdekopf ----
export function bStable(): HTMLCanvasElement {
  return sprite(96, 62, (s) => {
    let x, y, R = ROOF.stroh;
    for (y = 4; y <= 22; y++) {
      let l = Math.round(10 - (y - 4) * 8 / 18), r = Math.round(85 + (y - 4) * 8 / 18), row = (y - 4) % 4;
      for (x = l; x <= r; x++) { let c = row < 2 ? R[0] : R[1]; if (row === 3 && hash(x, y, 6) > 0.5) c = R[2]; if (x === l || x === r) c = R[2]; s.p(x, y, c); }
    }
    s.r(10, 3, 76, 2, R[2]); s.r(2, 22, 92, 2, R[2]);
    for (x = 3; x < 93; x += 4) { s.p(x, 24, R[1]); s.p(x + 1, 25, R[2]); }
    s.r(6, 24, 84, 30, WP.wood1);
    for (x = 8; x < 88; x += 4) s.r(x, 25, 1, 29, WP.wood2);
    s.r(6, 24, 3, 30, WP.wood3); s.r(87, 24, 3, 30, WP.wood3); s.r(46, 24, 3, 30, WP.wood3); s.r(6, 24, 84, 2, WP.wood3);
    for (let d = 0; d < 2; d++) {
      let dx = d ? 56 : 14;
      s.r(dx, 28, 26, 26, WP.wood3); s.r(dx + 2, 30, 22, 10, '#2f2538'); s.r(dx + 2, 41, 22, 12, WP.wood2); s.r(dx + 2, 41, 22, 1, WP.wood1); s.r(dx + 12, 41, 1, 12, WP.wood3);
      if (d === 0) {                                                  // Pferdekopf im Fenster
        s.ell(dx + 13, 36, 5, 5, '#9a5f3a'); s.ell(dx + 13, 38, 4, 5, '#b07448'); s.r(dx + 9, 29, 2, 4, '#7a4a2b'); s.r(dx + 15, 29, 2, 4, '#7a4a2b'); s.r(dx + 11, 41, 5, 1, '#9a5f3a'); s.p(dx + 11, 35, '#2f2538'); s.p(dx + 16, 35, '#2f2538'); s.r(dx + 12, 30, 2, 8, '#7a4a2b');
      } else { s.r(dx + 5, 34, 14, 6, '#e8c46a'); for (let h = 0; h < 6; h++) s.p(dx + 6 + h * 2, 33, '#e8c46a'); }   // Heu
    }
    s.r(40, 14, 16, 8, WP.wood3); s.r(41, 15, 14, 6, '#2f2538'); for (x = 42; x < 54; x += 2) s.p(x, 19, '#e8c46a');   // Dachluke
    for (x = 6; x < 90; x += 5) { s.r(x, 54, 5, 4, hash(x, 8, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 54, WP.stone3); }
    s.r(6, 54, 84, 1, WP.stone3);
    s.outline(WP.outline);
  });
}

// ---- Marktstand: Tisch, Pfosten, gestreifte Plane, Auslage ----
export function bStand(kind: number): HTMLCanvasElement {
  let A = [['#d9534b', '#f6f1e6'], ['#4f86d9', '#f6f1e6'], ['#4aa56b', '#ffe9a8']][kind % 3];
  return sprite(40, 40, (s) => {
    let x;
    s.r(3, 10, 2, 26, WP.wood2); s.r(35, 10, 2, 26, WP.wood2); s.r(3, 10, 1, 26, WP.wood1);
    for (x = 1; x < 39; x += 4) { s.r(x, 3, 4, 8, ((x - 1) / 4) % 2 ? A[1] : A[0]); s.r(x, 11, 4, 2, ((x - 1) / 4) % 2 ? A[1] : A[0]); }
    for (x = 1; x < 39; x += 4) { s.p(x + 1, 13, ((x - 1) / 4) % 2 ? A[1] : A[0]); s.p(x + 2, 13, ((x - 1) / 4) % 2 ? A[1] : A[0]); }
    s.r(1, 3, 38, 1, A[0]); s.r(4, 22, 32, 14, WP.wood1); s.r(4, 22, 32, 2, WP.wood2); s.r(4, 34, 32, 2, WP.wood3);
    for (x = 6; x < 34; x += 4) s.r(x, 25, 1, 9, WP.wood2);
    if (kind % 3 === 0) { for (x = 6; x < 34; x += 5) { s.disc(x + 1.5, 20, 2.2, '#e5483f'); s.p(x + 1, 19, '#ff9a8c'); } s.r(6, 21, 28, 2, WP.wood3); }          // Äpfel
    else if (kind % 3 === 1) { for (x = 6; x < 34; x += 7) { s.ell(x + 2.5, 20, 3.2, 2, '#d9a35b'); s.r(x + 1, 19, 3, 1, '#f0c98a'); } s.r(6, 21, 28, 2, WP.wood3); }     // Brot
    else { for (x = 6; x < 34; x += 4) { s.r(x, 16, 1, 6, WP.leaf3); s.disc(x + 0.5, 16, 1.6, [WP.fP, WP.fY, WP.fW, WP.fB][(x / 4 | 0) % 4]); } s.r(6, 21, 28, 2, WP.wood3); }   // Blumen
    s.outline(WP.outline);
  });
}

export function bHay(): HTMLCanvasElement {
  return sprite(18, 16, (s) => {
    s.ell(9, 8, 8, 7, '#d9b25a'); s.ell(9, 8, 6.2, 5.2, '#e8c46a'); s.ell(9, 8, 4, 3.2, '#d9b25a'); s.ell(9, 8, 2, 1.6, '#e8c46a'); s.p(9, 8, '#a1803d');
    s.r(2, 4, 14, 1, '#c9a455'); s.r(2, 12, 14, 1, '#c9a455'); s.outline(WP.outline);
  });
}
export function bLogs(): HTMLCanvasElement {
  return sprite(22, 14, (s) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - (r === 0 ? 1 : 0); c++) {
      let x = 4 + c * 6 + (r === 0 ? 3 : 0), y = 9 - r * 4;
      s.disc(x + 2, y, 3.2, WP.wood3); s.disc(x + 2, y, 2.4, WP.path1); s.disc(x + 2, y, 1.2, WP.path2); s.p(x + 2, y, WP.wood1);
    }
    s.outline(WP.outline);
  });
}
export function bCrate(): HTMLCanvasElement {
  return sprite(13, 12, (s) => {
    s.r(1, 2, 11, 9, WP.wood1); s.r(1, 2, 11, 1, WP.wood3); s.r(1, 10, 11, 1, WP.wood3); s.r(1, 2, 1, 9, WP.wood3); s.r(11, 2, 1, 9, WP.wood3); s.r(4, 3, 1, 7, WP.wood2); s.r(8, 3, 1, 7, WP.wood2);
    s.r(2, 1, 9, 2, '#d9534b'); s.p(4, 1, '#ff9a8c'); s.p(8, 1, '#ff9a8c'); s.outline(WP.outline);
  });
}

