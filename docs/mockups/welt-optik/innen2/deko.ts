// Mockup Innenräume: zusätzliche Einrichtung im Stil von Mockup A (16-Pixel-Welt, dunkle Kontur, warme Farben). Kein Produktionscode.
import { WP } from "../../../../frontend/src/world/art/palette";
import { memo, sprite } from "../../../../frontend/src/world/art/pen";

const O = WP.outline;

/** Fenster in der Rückwand; `sky` oben/unten nach Tageszeit, Vorhänge in der Raumfarbe. */
export const fenster = memo((top: string, bot: string, curtain: string, lit: boolean) => `${top}${bot}${curtain}${lit}`, (top, bot, curtain, lit) => sprite(22, 22, (s) => {
  s.r(2, 1, 18, 16, WP.wood3); s.r(3, 2, 16, 14, top); s.r(3, 9, 16, 7, bot);
  if (!lit) { s.p(5, 4, "#ffffff"); s.p(6, 4, "#ffffff"); s.p(5, 5, "#ffffff"); }
  s.r(10, 2, 2, 14, WP.wood1); s.r(3, 8, 16, 1, WP.wood1);
  s.r(0, 0, 4, 18, curtain); s.r(18, 0, 4, 18, curtain); s.r(0, 0, 22, 2, curtain); s.p(1, 6, "#00000022"); s.r(3, 0, 1, 18, "#00000020"); s.r(18, 0, 1, 18, "#00000020");
  s.r(1, 17, 20, 3, WP.wood1); s.r(1, 17, 20, 1, "#e0b07a");
  s.r(15, 13, 4, 4, "#c2603f"); s.p(16, 12, WP.leaf2); s.p(17, 11, WP.leaf1); s.p(18, 12, WP.fP);
  s.outline(O);
}));

export const bild = memo((art: string) => art, (art) => sprite(16, 12, (s) => {
  s.r(0, 0, 16, 12, "#b88a3a"); s.r(1, 1, 14, 10, "#e8c46a"); s.r(2, 2, 12, 8, art === "see" ? "#9fd6f0" : "#f6e4c8");
  if (art === "see") { s.r(2, 7, 12, 3, "#5cc2e3"); s.ell(6, 7, 4, 2, WP.leaf3); s.ell(11, 6, 3, 2, WP.leaf2); s.p(11, 3, "#ffe08a"); }
  else if (art === "blume") { s.r(7, 5, 1, 4, WP.leaf3); s.disc(7.5, 4.5, 2, WP.fP); s.p(7, 4, WP.fY); s.r(5, 8, 6, 2, "#c2603f"); }
  else { s.disc(8, 5, 2.5, WP.skin); s.r(5, 7, 6, 3, "#5d8fb0"); s.r(5, 2, 6, 2, WP.hairA); }
  s.outline(O);
}));

export const uhr = sprite(10, 16, (s) => { s.r(1, 0, 8, 15, WP.wood2); s.disc(5, 4, 3, "#fff8ec"); s.p(5, 3, O); s.p(5, 4, O); s.p(6, 4, O); s.r(4, 9, 2, 4, "#e8c46a"); s.outline(O); });
export const spiegel = sprite(12, 16, (s) => { s.ell(6, 8, 5, 7, "#b88a3a"); s.ell(6, 8, 4, 6, "#cfe8f0"); s.p(4, 5, "#ffffff"); s.p(4, 6, "#ffffff"); s.outline(O); });

export const wandregal = memo((was: string) => was, (was) => sprite(24, 12, (s) => {
  s.r(0, 9, 24, 3, WP.wood1); s.r(0, 9, 24, 1, "#e0b07a"); s.r(2, 11, 2, 1, WP.wood3); s.r(20, 11, 2, 1, WP.wood3);
  if (was === "glaeser") for (let i = 0; i < 5; i++) { const x = 1 + i * 5, c = ["#e05a5a", "#ffd94f", "#7fc48f", "#e0a458", "#c27ad8"][i]; s.r(x, 3, 4, 6, "#d8eef2"); s.r(x, 5, 4, 4, c); s.r(x, 2, 4, 1, WP.wood3); }
  else if (was === "buecher") for (let i = 0; i < 8; i++) s.r(1 + i * 3, 2 + (i % 3), 2, 7 - (i % 3), ["#e05a5a", "#5c8de0", WP.fY, "#7fc48f", "#c27ad8", "#f0e2c4"][i % 6]);
  else { s.ell(5, 6, 4, 3, "#c2603f"); s.p(5, 2, WP.leaf2); s.r(12, 4, 3, 5, "#fff8ec"); s.p(13, 3, "#ffd36e"); s.ell(19, 6, 3, 3, "#93baff"); }
  s.outline(O);
}));

export const toepfe = sprite(26, 12, (s) => {
  s.r(0, 0, 26, 2, WP.stone3);
  for (const [x, w, c] of [[2, 6, "#c27a3a"], [10, 7, WP.stone2], [19, 5, "#c27a3a"]] as const) { s.r(x + w / 2 - 0.5, 2, 1, 2, WP.stone3); s.ell(x + w / 2, 7, w / 2, 3, c); s.r(x, 6, w, 1, "#00000030"); }
  s.outline(O);
});

export const werkzeugwand = sprite(30, 16, (s) => {
  s.r(0, 0, 30, 16, "#8a5f3c"); for (let x = 2; x < 30; x += 4) for (let y = 2; y < 16; y += 4) s.p(x, y, "#5e3f28");
  s.r(3, 3, 1, 10, WP.wood2); s.r(1, 3, 5, 3, WP.stone2);                                   // Hammer
  s.r(9, 2, 9, 3, WP.stone1); for (let x = 9; x < 18; x += 2) s.p(x, 5, WP.stone3); s.r(17, 2, 3, 6, WP.wood2);   // Säge
  s.r(23, 3, 1, 9, WP.wood2); s.r(22, 11, 3, 3, WP.stone2);                                 // Schaufel
  s.r(26, 4, 2, 8, "#e05a5a");                                                              // Zange
  s.outline(O);
});

export const pflanze = memo((gross: boolean) => String(gross), (gross) => sprite(gross ? 14 : 10, gross ? 22 : 14, (s) => {
  const w = gross ? 14 : 10, h = gross ? 22 : 14;
  s.r(w / 2 - 3, h - 6, 6, 6, "#c2603f"); s.r(w / 2 - 3, h - 6, 6, 1, "#e08060");
  s.ell(w / 2, h - 10, w / 2 - 1, gross ? 8 : 4, WP.leaf3); s.ell(w / 2 - 1, h - 12, w / 2 - 3, gross ? 6 : 3, WP.leaf2); s.p(w / 2 - 2, h - 15, WP.leaf1); s.p(w / 2 + 2, h - 12, WP.leaf1);
  if (gross) { s.r(w / 2, 1, 1, 8, WP.leaf3); s.ell(w / 2 + 2, 3, 2, 2, WP.leaf2); }
  s.outline(O);
}));

export const stehlampe = memo((lit: boolean) => String(lit), (lit) => sprite(10, 24, (s) => {
  s.r(4, 8, 2, 14, WP.wood3); s.r(2, 22, 6, 2, WP.wood3);
  s.r(1, 2, 8, 6, lit ? "#ffe6a0" : "#f0d8a8"); s.r(2, 1, 6, 1, lit ? "#ffe6a0" : "#f0d8a8"); s.r(1, 7, 8, 1, "#c8a777");
  s.outline(O);
}));

export const nachttisch = memo((lit: boolean) => String(lit), (lit) => sprite(12, 16, (s) => {
  s.r(1, 7, 10, 9, WP.wood2); s.r(1, 7, 10, 2, WP.wood1); s.r(2, 11, 8, 1, WP.wood3); s.p(6, 13, WP.fY);
  s.r(4, 3, 3, 4, "#fff8ec"); s.r(3, 6, 5, 1, "#c8a777"); if (lit) { s.p(5, 1, "#ffd36e"); s.p(5, 2, "#ff9a4a"); } else s.p(5, 2, O);
  s.outline(O);
}));

export const schrank = sprite(20, 28, (s) => {
  s.r(0, 2, 20, 26, WP.wood2); s.r(0, 0, 20, 3, WP.wood3); s.r(1, 3, 9, 23, WP.wood1); s.r(10, 3, 9, 23, WP.wood1);
  s.r(9, 3, 2, 23, WP.wood3); s.p(8, 14, WP.fY); s.p(12, 14, WP.fY); s.r(2, 26, 3, 2, WP.wood3); s.r(15, 26, 3, 2, WP.wood3);
  s.outline(O);
});

export const sessel = memo((farbe: string) => farbe, (farbe) => sprite(14, 14, (s) => {
  s.r(1, 0, 12, 7, farbe); s.r(0, 4, 3, 9, farbe); s.r(11, 4, 3, 9, farbe); s.r(2, 7, 10, 5, farbe); s.r(3, 7, 8, 2, "#ffffff40"); s.r(1, 12, 2, 2, WP.wood3); s.r(11, 12, 2, 2, WP.wood3);
  s.r(1, 0, 12, 1, "#ffffff30");
  s.outline(O);
}));

export const kuechenzeile = sprite(34, 18, (s) => {
  s.r(0, 4, 34, 14, "#e8dcc4"); s.r(0, 2, 34, 3, "#a77a52"); s.r(0, 2, 34, 1, "#c99a6a");
  for (let i = 0; i < 4; i++) { s.r(1 + i * 8, 6, 7, 11, "#d2c3a4"); s.r(4 + i * 8, 9, 2, 1, WP.wood3); }
  s.r(4, 0, 8, 3, "#e8c890"); s.r(5, 1, 6, 1, "#c99a6a");                                   // Brett
  s.r(16, 0, 5, 2, "#e05a5a"); s.p(23, 1, "#7fc48f"); s.p(24, 0, "#7fc48f"); s.r(27, 0, 4, 2, "#ffd94f");
  s.outline(O);
});

export const korb = sprite(12, 9, (s) => { s.ell(6, 5, 5.5, 3.5, "#c99a5a"); s.r(1, 4, 11, 1, "#a07a42"); s.disc(4, 3, 1.5, "#e05a5a"); s.disc(7, 2.5, 1.5, "#ffd94f"); s.disc(9, 3, 1.3, "#e0782f"); s.outline(O); });
export const saegebock = sprite(18, 12, (s) => { s.r(0, 3, 18, 3, WP.wood1); s.r(2, 6, 2, 6, WP.wood3); s.r(14, 6, 2, 6, WP.wood3); s.r(6, 1, 8, 2, "#d8b07a"); s.outline(O); });
export const kiste = sprite(12, 11, (s) => { s.r(0, 1, 12, 10, WP.wood1); s.r(0, 1, 12, 2, "#e0b07a"); s.r(0, 5, 12, 1, WP.wood3); s.r(5, 1, 2, 10, WP.wood2); s.outline(O); });
export const kerze = sprite(6, 10, (s) => { s.r(2, 4, 2, 5, "#fff8ec"); s.r(1, 9, 4, 1, "#c8a777"); s.p(2, 2, "#ffd36e"); s.p(2, 3, "#ff9a4a"); s.outline(O); });
export const katze = sprite(14, 9, (s) => { s.ell(7, 6, 6, 3, "#e0a458"); s.disc(11, 3.5, 2.5, "#e0a458"); s.p(10, 1, "#e0a458"); s.p(12, 1, "#e0a458"); s.p(11, 3, O); s.r(1, 4, 2, 1, "#c27a3a"); s.outline(O); });
export const fussmatte = sprite(16, 6, (s) => { s.r(0, 0, 16, 6, "#b8864e"); for (let x = 1; x < 16; x += 2) s.r(x, 1, 1, 4, "#9a6a3a"); s.outline(O); });
