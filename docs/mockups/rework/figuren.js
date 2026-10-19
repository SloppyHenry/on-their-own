// Kleine Pixelbildnisse und die Bewohner des Mockups (Daten wie im Spiel: Name, Farbe, Zustand, Bedürfnisse).
// Im Spiel kommen die Bildnisse aus lib/Portrait.tsx; hier nur genähert.
const FACES = {
  alex: { hair: "#7a4a2a", hair2: "#5e3720", skin: "#f2c9a0", shirt: "#e8963c", eyes: "#2b2233" },
  mira: { hair: "#2a2030", hair2: "#16101c", skin: "#f5d2b4", shirt: "#7dbb8a", eyes: "#2b2233", long: true },
  hanne: { hair: "#d9d4cf", hair2: "#b7b0aa", skin: "#eec3a3", shirt: "#c97a9c", eyes: "#2b2233", bun: true },
};
const PEOPLE = [
  { id: "alex", name: "Alex", c: "var(--alex)", age: "34 · männlich", st: "🎣", where: "See", doing: "angelt am Steg", mood: 72,
    needs: { Energie: 85, Sattheit: 64, Wasser: 80, Gesellschaft: 55, Ruhe: 78 } },
  { id: "mira", name: "Mira", c: "var(--mira)", age: "31 · weiblich", st: "💬", where: "Wald", doing: "spricht mit Alex", mood: 81,
    needs: { Energie: 70, Sattheit: 52, Wasser: 66, Gesellschaft: 88, Ruhe: 60 } },
  { id: "hanne", name: "Hanne", c: "var(--hanne)", age: "67 · weiblich", st: "😴", where: "Haus", doing: "schläft im Wohnzimmer", mood: 64,
    needs: { Energie: 22, Sattheit: 70, Wasser: 58, Gesellschaft: 40, Ruhe: 35 } },
];

function portrait(id, size = 48) {
  const f = FACES[id], c = document.createElement("canvas"); c.width = c.height = 12;
  const g = c.getContext("2d"), px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(0, 0, 12, 12, "#3b2c3d");
  if (f.long) px(2, 3, 8, 8, f.hair2);
  px(3, 9, 6, 3, f.shirt); px(2, 10, 8, 2, f.shirt);
  px(3, 3, 6, 6, f.skin); px(4, 9, 4, 1, f.skin);
  px(2, 2, 8, 2, f.hair); px(2, 3, 1, 3, f.hair); px(9, 3, 1, 3, f.hair); px(3, 1, 6, 1, f.hair);
  if (f.bun) { px(5, 0, 2, 1, f.hair); px(4, 0, 4, 1, f.hair2); }
  px(4, 5, 1, 1, f.eyes); px(7, 5, 1, 1, f.eyes); px(5, 7, 2, 1, "#c98a7a");
  const out = document.createElement("canvas"); out.width = out.height = size;
  const o = out.getContext("2d"); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, size, size);
  out.className = "portrait"; return out;
}
/** Setzt Bildnisse in alle Platzhalter <canvas data-face="id">. */
function faces(root) { root.querySelectorAll("[data-face]").forEach((el) => { const p = portrait(el.dataset.face, 48); p.style.cssText = el.style.cssText; p.className = el.className + " portrait"; el.replaceWith(p); }); }

// Figurenpunkte im Bild img/dorf-tiefe.jpg (1440 × 910): Kopf und Fuß. Hanne ist im Haus (Dach).
const SPOTS = { mira: { head: [741, 344], foot: [741, 414] }, alex: { head: [1121, 514], foot: [1121, 606] }, roof: [487, 258] };

// Kleines Gespräch im Wechsel: wer spricht, wer denkt, wer merkt sich etwas.
const BEATS = [
  { mira: { say: "Alex, hast du heute schon Fische gesehen? Ich wollte nachher noch Äpfel ernten." },
    alex: { think: "Ob Mira mir beim Steg hilft? Allein dauert das ewig.", what: "angelt · überlegt" } },
  { alex: { say: "Zwei kleine bisher. Komm doch rüber, das Wasser ist ganz ruhig heute." },
    mira: { think: "Erst die Äpfel, dann zum See. Vielleicht bringe ich ihm einen mit.", what: "→ Garten · überlegt", memo: "merkt sich: Alex angelt am See" } },
  { alex: { think: "Mira mag Äpfel. Ich könnte ihr dafür einen Fisch abgeben.", what: "angelt · überlegt", recall: "erinnert sich: Mira mag Äpfel" },
    mira: { say: "Gute Idee! Ich komme gleich, warte auf mich." } },
];
