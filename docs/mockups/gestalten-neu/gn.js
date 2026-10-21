// AP16 Schritt 0 (neu, 21.10.2026): Werkzeuge der Welt-Werkstatt und des Gestaltens im Spiel (Gott), Haus von innen einrichten.
// Nutzt stamp() und CROP aus ../rework/editor.js. Koordinaten im Bild 1440 × 910 wie im Rework-Mockup.
const TOOLS_G = [
  ["zeiger", "⇱", "Zeiger", ""], ["weg", "〰", "Weg", ""], ["see", "◍", "See", ""], ["garten", "▦", "Garten", ""], ["haus", "⌂", "Haus", ""], ["natur", "♣", "Baum, Deko", ""],
  ["loeschen", "✕", "Löschen", ""], ["platz", "⚑", "Startplatz", "w"], ["gebiet", "✦", "Gebiet", "w"], ["karte", "⤢", "Karte", ""],
];
const GROUPS = { zeiger: "Ansehen", weg: "Zeichnen", haus: "Setzen", loeschen: "Ändern", platz: "Welt" };
const TOOLS_IN = [["moebel", "🛏", "Möbel"], ["wand", "🖼", "Wand"], ["farbe", "🎨", "Farben"], ["loeschen", "✕", "Löschen"]];
const GS = { screen: "haus", note: true };
const SCR = [
  ["1 Haus setzen", { screen: "haus" }, "Werkstatt · Haus setzen",
    "Die <b>Welt-Werkstatt</b> (Menü › Editoren › Welten › Öffnen). Links die Werkzeuge in Gruppen: <b>Ansehen, Zeichnen, Setzen, Ändern, Welt</b>; Tasten <kbd>1</kbd>–<kbd>0</kbd>. Der Zeiger folgt dem Raster; beim Haus zeigt der Geist das Sprite, die <b>Türmarke</b> vor der Tür ist grün, wenn alles passt. Alles seit dem letzten Speichern liegt als <b>Entwurf</b> (violett umrandet, rechte Liste, jede Zeile mit ✕). <b>W</b> im Werkzeug heißt: nur in der Werkstatt. Oben: Name, „● ungespeichert“, Rückgängig/Wiederholen, Speichern, Damit spielen."],
  ["2 Weg ziehen", { screen: "weg" }, "Werkstatt · Weg ziehen",
    "Klick setzt Punkte, die gestrichelte Vorschau läuft mit dem Zeiger, Doppelklick oder <kbd>Enter</kbd> beendet, <kbd>Esc</kbd> bricht den Zug ab (ein zweites <kbd>Esc</kbd> geht eine Ebene zurück, wie überall). Optionen rechts: Breite und Belag. Seen und Gärten funktionieren ebenso (See: Mitte nach außen ziehen, Garten: Rechteck aufziehen, Zaun und Beete entstehen von selbst)."],
  ["3 Fehler am Cursor", { screen: "see" }, "Fehler stehen am Cursor",
    "Verbotenes Setzen scheitert nicht still und nicht im Nachhinein: Der Geist wird <b>rot</b> und nennt den Grund („Eine Kiefer steht dort“, „Dort ist Wasser“, „Zu klein“, „Vor der Tür bleibt es frei“). Der Klick tut dann nichts. So kann der Entwurf nie in einen Zustand geraten, den die Welt nicht tragen würde."],
  ["4 Prüfung", { screen: "pruefung" }, "Werkstatt · Prüfung nach dem Löschen",
    "Was <i>später</i> kaputtgeht (ein Weg wird gelöscht, das Haus ist nicht mehr erreichbar), steht in der <b>Prüfung</b> als ✗. In der Werkstatt lässt sich trotzdem <b>speichern</b> (Arbeit in Arbeit), aber „Damit spielen“ ist gesperrt, bis alles ✓ ist. Im Spiel (Gott) sperrt ein ✗ das Übernehmen."],
  ["5 Gott: Entwurf", { screen: "gott" }, "Gestalten im Spiel (Gott)",
    "Dieselben Werkzeuge im laufenden Spiel, nur in der Spielart Gott (<kbd>B</kbd>). <b>Die Zeit steht still</b>; es gibt weder Startplatz noch Gebiet (die gehören in die Werkstatt). Die Welt ist die der laufenden Simulation, der Entwurf liegt unter dem <b>Schleier</b> (gestrichelt, violett). Wo eine Figur oder ein Ding steht, lässt sich nichts bauen: <b>rot schraffiert</b> mit Grund. Kein Generator."],
  ["6 Übernehmen", { screen: "uebernehmen" }, "Übernehmen (Gott)",
    "Ein Klick übernimmt den ganzen Entwurf als <b>einen</b> Patch, davor wird der Stand gesichert („Vor dem Gestalten“). Die Bewohner erfahren nichts: Das Ereignis steht nur im Tagebuch des Spielers, nie in Wahrnehmung, Gedächtnis oder Prompt. Danach läuft die Zeit weiter, wenn sie vorher lief. Wege, die der Umbau ungültig macht, werden still neu geplant."],
  ["7 Innen: Möbel", { screen: "innen", tab: "moebel" }, "Haus von innen einrichten",
    "Doppelklick auf ein Haus (oder „Von innen einrichten“ im Katalog) öffnet das Haus als Puppenhaus. Links Möbel, Wand, Farben, Löschen; rechts der Katalog der <b>vorhandenen Möbel</b> (echte Objekte mit Handlungen: schlafen, kochen, ablegen …). Das Raster sind die Kacheln der Räume. Sprites und Optik kommen im Spiel aus innen2, das Mockup zeichnet schematisch."],
  ["8 Innen: Fehler", { screen: "innen", tab: "moebel", bad: true }, "Innen · Fehler am Cursor",
    "Vor jeder Tür und zwischen den Zimmern bleibt eine Kachel frei; Möbel dürfen keinen Weg im Raum abschneiden. Schlafzimmer braucht ein Bett, Küche einen Herd (steht in der Prüfung, nicht als Sperre, solange noch eingerichtet wird)."],
  ["9 Innen: Farben", { screen: "innen", tab: "farbe" }, "Innen · Wand und Farben",
    "Tapete, Boden, Vorhang je Zimmer; Wandschmuck (Fenster, Bilder, Regale) hängt an der Rückwand. Jede Wahl ist eine Aktion im Entwurf und rückgängig zu machen."],
  ["10 Karte", { screen: "karte" }, "Karte erweitern (ersetzt „Dorf anfügen“ im Spiel)",
    "Statt „Dorf anfügen“ gibt es im Spiel nur noch <b>Karte erweitern</b>: ein Pfeil je Seite (Osten, Süden) fügt Wiese an, höchstens 256 × 256. Ein ganzes Dorf erzeugt <b>Gebiet</b> (nur Werkstatt, mit den Stellgrößen des Generators). So bleibt der Generator beim Erschaffen, und in Gott ist trotzdem Platz zum Bauen."],
  ["11 Zwei Orte", { screen: "orte" }, "Ein Werkzeugkasten, zwei Orte", "Was gleich ist, was sich unterscheidet."],
];
const $ = (q) => document.querySelector(q);

function ghostHouse(x, y, bad) { return `${stamp({ t: "house", x, y }, true)}<div class="ghostbox ${bad ? "bad" : ""}" style="left:${x - 159}px;top:${y - 100}px;width:318px;height:100px"><span>${bad ? "✗ Zu nah am See" : "✓ Wohnhaus · 2 Zimmer"}</span></div><div class="doormark ${bad ? "bad" : ""}" style="left:${x}px;top:${y + 3}px"></div>`; }
function pathSvg(d, dash) { return `<svg class="paths" viewBox="0 0 1440 910"><path d="${d}" ${dash ? 'stroke-dasharray="14 10" style="stroke:#d9c8ffcc;filter:none"' : ""}/></svg>`; }
const draftStamp = (it) => stamp(it).replace('class="stamp ', 'class="stamp draftit ');

function baseWorld() { return pathSvg("M720 560 C 760 700, 700 820, 720 910") + stamp({ t: "well", x: 720, y: 640 }) + stamp({ t: "lantern", x: 620, y: 520 }); }
function werkWorld(S) {
  const s = S.screen;
  let h = `<div class="gridlines"></div>${baseWorld()}`;
  if (s !== "pruefung") h += pathSvg("M470 340 C 520 420, 600 470, 700 560").replace('class="paths"', 'class="paths" style="opacity:1"');
  h += [{ t: "house", x: 470, y: 330 }, { t: "cherry", x: 230, y: 300 }, { t: "tree", x: 740, y: 250 }, { t: "bench", x: 520, y: 470 }, { t: "garden", x: 300, y: 820 }].map(draftStamp).join("");
  h += `<div class="draftveil" style="left:300px;top:130px;width:340px;height:230px"><span>neu im Entwurf</span></div><div class="draftveil" style="left:150px;top:520px;width:330px;height:310px"><span>neu im Entwurf</span></div>`;
  if (s === "haus") h += ghostHouse(890, 450) + `<div class="cursor" style="left:890px;top:458px"></div><div class="tip ok" style="left:700px;top:520px">Tür nach Süden · Weg zur Straße wird vorgeschlagen</div>`;
  if (s === "weg") h += pathSvg("M300 700 C 380 690, 480 640, 600 610") + pathSvg("M600 610 L 780 560", true) + [[300, 700], [450, 650], [600, 610]].map(([x, y]) => `<div class="pt" style="left:${x}px;top:${y}px"></div>`).join("") + `<div class="cursor" style="left:780px;top:560px"></div><div class="tip" style="left:800px;top:520px">Doppelklick beendet · Esc bricht ab</div>`;
  if (s === "see") h += stamp({ t: "tree", x: 880, y: 640 }) + `<div class="lake ghost" style="left:870px;top:580px;width:330px;height:200px;outline-color:var(--warn);background:#e0806f66;box-shadow:none"></div><div class="cursor" style="left:880px;top:600px;border-color:var(--warn)"></div><div class="tip bad" style="left:640px;top:450px">✗ Ein Baum steht dort · zuerst löschen oder woanders ausheben</div>`;
  if (s === "pruefung") h += `<div class="tip bad" style="left:600px;top:420px">✗ gelöscht: Weg (Haus verliert die Anbindung)</div><div class="cursor" style="left:560px;top:520px"></div>`;
  return h;
}
function gottWorld(S) {
  const s = S.screen;
  let h = `<div class="gridlines"></div>`;
  h += [{ t: "cherry", x: 975, y: 880 }, { t: "bench", x: 1045, y: 892 }].map(draftStamp).join("");
  h += pathSvg("M720 640 C 800 700, 860 780, 960 800").replace("<svg", '<svg style="opacity:.95"');
  h += `<div class="draftveil" style="left:880px;top:690px;width:260px;height:210px"><span>neu im Entwurf</span></div>`;
  h += `<div class="blocked" style="left:670px;top:50px;width:160px;height:150px"></div><div class="tip bad" style="left:850px;top:120px">✗ Mira steht dort · nicht überbaubar</div>`;
  return h;
}
function karteWorld() {
  return `<div class="gridlines"></div><div class="maprim" style="left:0;right:0;bottom:0;height:130px"></div><div class="maprim" style="right:0;top:0;bottom:130px;width:150px"></div>
    <div class="arrow" style="left:700px;bottom:56px">↓</div><div class="arrow" style="right:56px;top:420px">→</div><div class="tip" style="left:700px;top:790px">Süden: +16 Kacheln · Karte 96 × 76</div>`;
}
function warte(S) { return S.screen === "gott" || S.screen === "uebernehmen" ? gottWorld(S) : S.screen === "karte" ? karteWorld() : S.screen === "innen" ? "" : werkWorld(S); }

function draftList(items) { return `<div class="sub">Entwurf (${items.length})</div><div class="draft">${items.map(([t, bad, n]) => `<div class="${bad ? "bad" : ""}"><span>${t}${n ? `<span class="n">${n}</span>` : ""}</span><button class="b icon ghost">✕</button></div>`).join("")}</div>`; }
function checks(c) { return `<div class="sub">Prüfung</div><div class="checks">${c.map(([k, t]) => `<div class="${k}">${{ ok: "✓", bad: "✗", warn: "!" }[k]} ${t}</div>`).join("")}</div>`; }
function catalogG(S) {
  const t = S.screen === "weg" ? "weg" : S.screen === "see" ? "see" : S.screen === "haus" ? "haus" : S.screen === "karte" ? "karte" : S.screen === "gott" ? "haus" : "loeschen";
  if (t === "haus") return `<div class="sub">Gebäude</div><div class="cat">${[["Wohnhaus", "2 Zimmer · Küche", "#d65a40"], ["Kleines Haus", "1 Zimmer", "#5470c8"], ["Langhaus", "4 Zimmer", "#e0b440"], ["Laden", "Theke · Lager", "#3f7fd0"], ["Werkstatt", "Werkbank", "#8a5a3c"], ["Scheune", "Heu · Stroh", "#a8402f"], ["Stall", "2 Boxen", "#9a6a3a"]].map(([n, s, c], i) => `<button class="catit ${i === 0 ? "on" : ""}"><i style="background:${c}"></i><b>${n}</b><small>${s}</small></button>`).join("")}</div>
    <div class="opt"><span>Dach</span><span class="sw" style="margin:0">${["#d65a40", "#5470c8", "#e0b440", "#7a5a9a"].map((c, i) => `<span class="swatch ${i === 0 ? "on" : ""}" style="background:${c}"></span>`).join("")}</span></div>
    <p class="dim" style="font-size:12px">Klick setzt das Haus, die Tür zeigt nach Süden. Doppelklick auf ein Haus: <b>von innen einrichten</b>.</p>`;
  if (t === "weg") return `<div class="sub">Weg</div><div class="opt"><span>Breite</span><span class="seg"><button>schmal</button><button class="on">breit</button></span></div><div class="opt"><span>Belag</span><span class="seg"><button class="on">Erde</button><button>Pflaster</button></span></div><p class="dim" style="font-size:12px">Ein Weg bleibt immer begehbar; er schneidet Gras, nie Wasser oder Häuser (dort wird die Vorschau rot).</p>`;
  if (t === "see") return `<div class="sub">See</div><p style="font-size:13px">Von der Mitte nach außen ziehen. Ein See braucht mindestens 4 × 3 Kacheln; Ufer (Sand) entsteht von selbst. Ein Steg ist ein eigenes Ding unter „Baum, Deko“.</p>`;
  if (t === "karte") return `<div class="sub">Karte erweitern</div><div class="opt"><span>Süden</span><span class="seg"><button>+8</button><button class="on">+16</button><button>+32</button></span></div><div class="opt"><span>Osten</span><span class="seg"><button>+8</button><button class="on">+16</button><button>+32</button></span></div><p class="dim" style="font-size:12px">Neue Wiese, nichts Bestehendes ändert sich. Höchstens 256 × 256 Kacheln.</p>`;
  return `<p class="dim" style="font-size:13px">Löschen: Klick auf ein Ding, einen Weg, einen See, einen Garten oder ein Haus. Ein <b>bewohntes</b> Haus (Betten mit Besitzer, Figuren darin) lässt sich nicht löschen.</p>`;
}
function panelG(S) {
  const s = S.screen;
  if (s === "gott" || s === "uebernehmen") return `<div class="glass edpanel">${catalogG({ screen: "gott" })}${draftList([["Weg, 4 Punkte"], ["Kirschbaum"], ["Bank"], ["Garten 5 × 4", true, "blockiert"]])}${checks([["ok", "Alle Haustüren sind vom Dorfplatz aus erreichbar"], ["bad", "Mira steht auf der Fläche „Garten 5 × 4“"], ["ok", "Bild und Karte stimmen überein"]])}
    <div style="display:flex;gap:6px;margin-top:12px"><button class="b" style="flex:1" data-g="verwerfen">Verwerfen</button><button class="b gold" style="flex:2;opacity:.45" data-g="uebernehmen">Übernehmen …</button></div><p class="dim" style="font-size:11.5px">Übernehmen geht erst, wenn alles ✓ ist.</p></div>`;
  const items = [["Haus: Wohnhaus"], ["Weg, 3 Punkte"], ["Kirschbaum"], ["Laubbaum"], ["Bank"], ["Garten 6 × 5 · 3 Beete"]];
  const ck = s === "pruefung" ? [["bad", "Haus „Wohnhaus“: Tür ist vom Startplatz aus nicht erreichbar (Weg gelöscht)"], ["warn", "Zum Spielen noch nötig: Startplatz bestätigen"], ["ok", "Bild und Karte stimmen überein"]]
    : [["ok", "Alle Haustüren sind vom Startplatz aus erreichbar"], ["ok", "Bild und Karte stimmen überein"], ["ok", "Neues Haus: Tür, Innenbereich, Räume und Einrichtung werden angelegt"]];
  if (s === "pruefung") items.splice(1, 1, ["Weg, 3 Punkte gelöscht", true]);
  return `<div class="glass edpanel">${catalogG(S)}${draftList(items)}${checks(ck)}
    <div style="display:flex;gap:6px;margin-top:12px"><button class="b" style="flex:1">Speichern als …</button><button class="b gold" style="flex:1">Speichern <kbd>⌘S</kbd></button></div>
    <p class="dim" style="font-size:11.5px">Speichern schreibt den Entwurf in die Weltdatei; der Entwurf ist danach leer.</p></div>`;
}
function toolsG(inn) {
  if (inn) return `<div class="glass edtools"><div class="grp">Einrichten</div>${TOOLS_IN.map(([id, ic, l], i) => `<button class="tool ${GS.tab === id ? "on" : ""}" data-g-tab="${id}"><span>${ic}</span>${l}<kbd>${i + 1}</kbd></button>`).join("")}</div>`;
  const werk = !(GS.screen === "gott" || GS.screen === "uebernehmen"), cur = { haus: "haus", weg: "weg", see: "see", pruefung: "loeschen", gott: "haus", uebernehmen: "haus", karte: "karte" }[GS.screen];
  const list = TOOLS_G.filter((t) => werk || !t[3]);
  return `<div class="glass edtools">${list.map(([id, ic, l, w], i) => `${GROUPS[id] ? `<div class="grp">${GROUPS[id]}</div>` : ""}<button class="tool ${w ? "wonly" : ""} ${cur === id ? "on" : ""}"><span>${ic}</span>${l}<kbd>${(i + 1) % 10}</kbd></button>`).join("")}</div>`;
}
const viewG = `<span class="seg"><button>Tiefe</button><button class="on">Flach</button></span><label class="chip on">▦ Raster</label>`;
function topG(S) {
  if (S.screen === "gott" || S.screen === "uebernehmen") return `<div class="glass edtop"><b style="color:var(--acc2)">✎ Gestalten</b><span class="stat still">⏸ Die Zeit steht still · Tag 3, 07:53</span><span class="sp"></span>${viewG}<button class="b icon ghost">↶</button><button class="b icon ghost">↷</button><button class="b" data-g="fertig">Fertig <kbd>Esc</kbd></button></div>`;
  return `<div class="glass edtop"><button class="b ghost">← Welten <kbd>Esc</kbd></button><input class="wname" value="Mein Dorf"><span class="dirty">● ungespeichert · 6 Aktionen</span><span class="sp"></span>${viewG}<button class="b icon ghost">↶</button><button class="b icon ghost">↷</button><button class="b" style="${S.screen === "pruefung" ? "opacity:.45" : ""}" title="Gesperrt, solange die Prüfung ✗ zeigt">▶ Damit spielen …</button></div>`;
}
function innenView(S) {
  const T = 52, rooms = [{ n: "Küche", w: 6, tap: "#e3c27e", bod: "#c49a66" }, { n: "Wohnzimmer", w: 6, tap: "#d9a7a0", bod: "#b88a5a" }, { n: "Schlafzimmer", w: 5, tap: "#a7b8d9", bod: "#c9a875" }];
  const m = [[0, 0, 0, 1, 1, "Herd", "#7a5a4a"], [0, 1, 0, 1, 1, "Spüle", "#5f8fb0"], [0, 1, 1, 2, 2, "Tisch", "#8a5a3c"], [1, 1, 0, 2, 1, "Sofa", "#7f5fa0"], [1, 4, 0, 1, 1, "Kamin", "#9a5a4a"], [1, 5, 0, 1, 1, "Regal", "#6a4a3a"], [2, 0, 0, 1, 2, "Bett", "#4f78b0"], [2, 4, 0, 1, 1, "Truhe", "#9a6a3a"]];
  const neu = [[1, 2, 3, 1, 1, "Hocker", "#a8803c"], [0, 4, 0, 1, 1, "Kiste", "#9a6a3a"]];
  let x = 0, h = "";
  rooms.forEach((r, i) => {
    const bw = r.w * T, f = (a) => a.filter((q) => q[0] === i).map(([, tx, ty, w, hh, n, c]) => `<div class="moebel ${a === neu ? "neu" : ""}" style="left:${tx * T + 2}px;top:${ty * T + 2}px;width:${w * T - 4}px;height:${hh * T - 4}px;background:${c}">${n}</div>`).join("");
    const colour = S.tab === "farbe" && i === 1;
    h += `<div class="room" style="width:${bw}px"><div class="wand" style="background:${colour ? "#8fb5a0" : r.tap}"><span class="name">${r.n}</span>${i === 0 ? '<span class="wandstueck" style="left:150px;top:10px"></span>' : ""}${i === 1 && S.tab === "wand" ? '<span class="wandstueck" style="left:60px;top:10px;background:#d8b57a"></span>' : ""}${i === 2 ? '<span class="wandstueck" style="left:140px;top:10px"></span>' : ""}</div>
      <div class="boden" style="width:${bw}px;height:${5 * T}px;background-color:${colour ? "#a9a07a" : r.bod}">${f(m)}${f(neu)}
      ${i === 0 ? `<div class="freizone" style="left:${3 * T}px;top:${4 * T}px;width:${T}px;height:${T}px">Tür frei</div><span class="tuer" style="left:${3 * T}px"></span>` : ""}
      ${i === 0 && S.screen === "innen" && S.bad ? `<div class="moebel ghost bad" style="left:${3 * T + 2}px;top:${3 * T + 2}px;width:${2 * T - 4}px;height:${T - 4}px">Sofa</div><div class="tip bad" style="left:${3 * T + 110}px;top:${2.55 * T}px">✗ Vor der Tür bleibt es frei</div>` : ""}
      ${i === 1 && !S.bad && (!S.tab || S.tab === "moebel") ? `<div class="moebel ghost" style="left:${3 * T + 2}px;top:${3 * T + 2}px;width:${T - 4}px;height:${T - 4}px;background:#a8803c">Stuhl</div><div class="tip ok" style="left:${4 * T + 10}px;top:${3.5 * T}px">✓ Stuhl · sitzen · bleibt erreichbar</div>` : ""}
      ${i === 1 && S.tab === "farbe" ? "" : ""}</div></div>`;
  });
  const rail = S.tab === "farbe" ? `<div class="tip" style="position:absolute;left:${6 * T + 40}px;top:-30px">Wohnzimmer · Tapete geändert</div>` : "";
  return `<div class="innen"><div class="dach">Wohnhaus „Neues Haus“ · Räume im Querschnitt · Klick aufs Dach geht nach draußen ${rail}</div><div class="rooms">${h}</div></div>`;
}
function panelInnen(S) {
  const t = S.tab || "moebel";
  let cat = "";
  if (t === "moebel") cat = `<div class="sub">Möbel</div><div class="cat">${[["Bett", "schlafen"], ["Tisch", "Dinge ablegen"], ["Stuhl", "sitzen"], ["Sofa", "ausruhen"], ["Herd", "kochen"], ["Spüle", "Wasser holen"], ["Werkbank", "bauen"], ["Truhe", "verwahren"], ["Regal", "Bücher"], ["Kamin", "wärmen"], ["Kisten", "verwahren"], ["Hocker", "sitzen"]].map(([n, s], i) => `<button class="catit ${i === 0 ? "on" : ""}"><i style="background:#7a5a4a"></i><b>${n}</b><small>${s}</small></button>`).join("")}</div><p class="dim" style="font-size:12px"><kbd>R</kbd> dreht. Möbel sind echte Objekte: Die Bewohner nutzen sie wie alle anderen, sobald sie dastehen.</p>`;
  if (t === "wand") cat = `<div class="sub">Wandschmuck</div><div class="cat four">${["Fenster", "Rundfenster", "Bild", "Spiegel", "Regalbrett", "Uhr", "Geweih", "Kranz"].map((n, i) => `<button class="catit sm ${i === 2 ? "on" : ""}">${n}</button>`).join("")}</div><p class="dim" style="font-size:12px">Hängt an der Rückwand; Fenster zeigen den Himmel nach Tageszeit.</p>`;
  if (t === "farbe") cat = `<div class="sub">Wohnzimmer</div><div class="opt"><span>Tapete</span><span class="sw" style="margin:0">${["#d9a7a0", "#8fb5a0", "#e3c27e", "#a7b8d9", "#d0c4e6"].map((c, i) => `<span class="swatch ${i === 1 ? "on" : ""}" style="background:${c}"></span>`).join("")}</span></div><div class="opt"><span>Boden</span><span class="sw" style="margin:0">${["#b88a5a", "#a9a07a", "#8a7a6a", "#c9a875"].map((c, i) => `<span class="swatch ${i === 1 ? "on" : ""}" style="background:${c}"></span>`).join("")}</span></div><div class="opt"><span>Vorhang</span><span class="sw" style="margin:0">${["#b04a4a", "#4a7ab0", "#d6b04a", "#e8dccb"].map((c, i) => `<span class="swatch ${i === 0 ? "on" : ""}" style="background:${c}"></span>`).join("")}</span></div><div class="opt"><span>Teppich</span><span class="seg"><button class="on">keiner</button><button>klein</button><button>groß</button></span></div>`;
  const it = t === "farbe" ? [["Wohnzimmer: Tapete grün"], ["Wohnzimmer: Boden graubraun"]] : [["Hocker (Wohnzimmer)"], ["Kiste (Küche)"], ...(S.bad ? [["Sofa (Küche)", true, "blockiert"]] : [])];
  const ck = [["ok", "Haustür ist frei, alle Möbel sind erreichbar"], ["ok", "Küche hat einen Herd, Schlafzimmer ein Bett"], ...(S.bad ? [["bad", "Sofa (Küche) steht vor der Tür"]] : [])];
  return `<div class="glass edpanel">${cat}${draftList(it)}${checks(ck)}<p class="dim" style="font-size:11.5px">Teil des Entwurfs wie draußen: Übernehmen oder Speichern gilt für alles zusammen.</p></div>`;
}
function topInnen() { return `<div class="glass edtop"><button class="b ghost">← Nach draußen <kbd>Esc</kbd></button><b>Wohnhaus „Neues Haus“</b><span class="dim">Küche · Wohnzimmer · Schlafzimmer</span><span class="sp"></span><label class="chip on">▦ Raster</label><button class="b icon ghost">↶</button><button class="b icon ghost">↷</button><button class="b">Fertig <kbd>Esc</kbd></button></div>`; }
function dialog(S) {
  if (S.screen !== "uebernehmen") return "";
  return `<div class="dlgback"><div class="glass dlg"><h3>Entwurf übernehmen?</h3><p>Der ganze Entwurf (<b>4 Aktionen</b>) wird in die laufende Welt geschrieben, als <b>ein</b> Schritt.</p><ul><li>Vorher sichert das Spiel den Stand („Vor dem Gestalten“). Rückweg: Menü › Simulation laden.</li><li>Die Bewohner merken nichts: kein Hinweis in Wahrnehmung, Gedächtnis oder Prompt, nur ein Eintrag in deinem Tagebuch.</li><li>Wege, die dadurch ungültig werden, plant das Spiel still neu.</li><li>Danach läuft die Zeit weiter, wenn sie vorher lief.</li></ul><div class="row"><button class="b">Zurück zum Entwurf</button><button class="b gold">Übernehmen</button></div></div></div>`;
}
function orte() {
  return `<div class="glass compare"><h2>Ein Werkzeugkasten, zwei Orte</h2><p class="dim" style="margin:0">Gleich: dieselben Werkzeuge, derselbe Entwurf (Liste von Aktionen mit Rückgängig), dieselbe Prüfung, dieselben Fehler am Cursor, Tiefe und Flach, Raster. Verschieden: worauf sie wirken und was „fertig“ heißt.</p><table>
    <tr><th></th><th>Welt-Werkstatt (Menü › Editoren › Welten)</th><th>Gestalten im Spiel (Gott, Taste B)</th></tr>
    <tr><td>Wirkt auf</td><td>eine Weltdatei der Bibliothek (Wegwerf-Simulation im Speicher, keine Figuren)</td><td>die laufende Simulation (Figuren, Dinge, Gedächtnis)</td></tr>
    <tr><td>Zeit</td><td>gibt es nicht</td><td>steht still, solange das Werkzeug offen ist</td></tr>
    <tr><td>Fertig heißt</td><td><b>Speichern</b> schreibt die Datei; ✗ in der Prüfung sperrt nur „Damit spielen“</td><td><b>Übernehmen</b> mit Sicherung, ein Patch, ein Ereignis (nur im Tagebuch); ✗ sperrt Übernehmen</td></tr>
    <tr><td>Nur hier</td><td>Startplatz, Gebiet erzeugen (Generator), Löschen auch bewohnter Häuser (es wohnt niemand)</td><td>Belegung: Figuren und Dinge sperren Flächen; bewohnte Häuser lassen sich nicht löschen</td></tr>
    <tr><td>Karte</td><td>erweitern (Osten, Süden)</td><td>erweitern (ersetzt „Dorf anfügen“)</td></tr>
    <tr><td>Esc</td><td>erst Aktion/Auswahl, dann ← Welten (Rückfrage bei Entwurf)</td><td>erst Aktion/Auswahl, dann zurück ins Spiel (Rückfrage bei Entwurf)</td></tr>
    <tr><td>Schutz</td><td>immer erlaubt (eigene Dateien; Dorf am See nur als Kopie)</td><td>nur Spielart Gott; in Leben 403, die Taste B gibt es nicht</td></tr></table></div>`;
}
function render() {
  const S = GS, inn = S.screen === "innen";
  $("#bg").src = inn || S.screen === "gott" || S.screen === "uebernehmen" || S.screen === "karte" ? "rework/img/dorf-flach.jpg" : "rework/img/leer-flach.jpg";
  $("#bg").style.filter = inn || S.screen === "orte" ? "brightness(.35) blur(2px)" : "";
  $("#signs").innerHTML = inn || S.screen === "orte" ? "" : warte(S);
  $("#hud").innerHTML = S.screen === "orte" ? orte() : inn ? `${topInnen()}${toolsG(true)}${panelInnen(S)}<div id="innenwrap"></div>` : `${topG(S)}${toolsG(false)}${S.screen === "karte" ? `<div class="glass edpanel">${catalogG(S)}<div class="sub">Entwurf (1)</div><div class="draft"><div><span>Karte: Süden +16</span><button class="b icon ghost">✕</button></div></div></div>` : panelG(S)}${dialog(S)}`;
  if (inn) $("#hud").insertAdjacentHTML("beforeend", innenView(S));
  const cur = SCR.find(([, st]) => st.screen === S.screen && (st.tab || null) === (S.tab || null) && !!st.bad === !!S.bad) || SCR.find(([, st]) => st.screen === S.screen);
  $("#mockbar").innerHTML = SCR.map(([l, st]) => `<button data-scr="${l}" class="${cur && cur[0] === l ? "on" : ""}">${l}</button>`).join("") + `<span class="sep"></span><button data-note class="${S.note ? "on" : ""}">Erklärung</button>`;
  $("#note").className = S.note ? "show" : ""; $("#note").innerHTML = `<h4>${cur[2]}</h4>${cur[3]}`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#mocktab")) { $("#mockbar").classList.toggle("open"); return; }
  const m = e.target.closest("#mockbar button");
  if (m) { if (m.dataset.scr) { const st = SCR.find(([l]) => l === m.dataset.scr)[1]; for (const k of ["tab", "bad"]) delete GS[k]; Object.assign(GS, st); $("#mockbar").classList.remove("open"); } if ("note" in m.dataset) GS.note = !GS.note; return render(); }
  const t = e.target.closest("[data-g-tab]"); if (t) { GS.tab = t.dataset.gTab; return render(); }
  if (e.target.closest("[data-g=uebernehmen]")) { return; }
});
document.addEventListener("keydown", (e) => { if (e.key === "m" || e.key === "M") $("#mockbar").classList.toggle("open"); if (e.key === "Escape") $("#mockbar").classList.remove("open"); });
function fit() { document.documentElement.style.setProperty("--s", Math.max(innerWidth / 1440, innerHeight / 910)); }
addEventListener("resize", fit); fit();
const q = new URLSearchParams(location.search).get("s"); if (q) { const f = SCR.find(([l]) => l.startsWith(q + " ")); if (f) { Object.assign(GS, f[1]); } }
render();
