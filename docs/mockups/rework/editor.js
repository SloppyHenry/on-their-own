// Editor: dieselben Werkzeuge an zwei Orten – in der Welt-Werkstatt (Datei aus der Bibliothek, speichern) und im Spiel (Gott-Modus, Zeit steht still, übernehmen).
// Werkzeuge und Ablauf wie im abgenommenen Mockup AP16 (gestalten.html); hier geht es um Rahmen, Speichern und Rückweg.
// Freigestellte Sprites aus dem flachen Dorfbild (img/sprite-*.png), Größe in Bildpunkten wie im Spiel bei 1×.
const CROP = { house: [318, 330], cherry: [132, 166], tree: [130, 166], lantern: [52, 134], bench: [96, 62], well: [116, 134], board: [90, 92], garden: [308, 308] };
const TOOLS = [["zeiger", "⇱", "Zeiger"], ["weg", "〰", "Weg"], ["see", "◍", "See"], ["garten", "▦", "Garten"], ["haus", "⌂", "Haus"], ["natur", "♣", "Baum und Deko"], ["platz", "⚑", "Startplatz", "w"], ["gebiet", "✦", "Gebiet erzeugen", "w"], ["loeschen", "✕", "Löschen"]];
const ED0 = { tool: "haus", pick: "house", items: [{ t: "house", x: 470, y: 330 }, { t: "lake", x: 860, y: 560 }, { t: "tree", x: 230, y: 300 }, { t: "cherry", x: 700, y: 260 }, { t: "tree", x: 1240, y: 250 }, { t: "lantern", x: 640, y: 450 }, { t: "well", x: 600, y: 640 }, { t: "garden", x: 300, y: 800 }, { t: "bench", x: 520, y: 470 }] };

function stamp(it, ghost) {
  if (it.t === "lake") return `<div class="lake ${ghost ? "ghost" : ""}" style="left:${it.x}px;top:${it.y}px"></div>`;
  const [w, h] = CROP[it.t];
  return `<img class="stamp ${ghost ? "ghost" : ""}" src="rework/img/sprite-${it.t}.png" style="left:${it.x}px;top:${it.y}px;width:${w}px;height:${h}px" alt="">`;
}

function edWorld(S) {
  if (S.edCtx === "spiel") return `<div class="gridlines"></div>${stamp({ t: "cherry", x: 975, y: 880 })}${stamp({ t: "bench", x: 1045, y: 892 })}<div class="draftveil" style="left:895px;top:700px;width:195px;height:200px"><span>neu im Entwurf</span></div>`;
  const d = S.ed, path = `<svg class="paths" viewBox="0 0 1440 910"><path d="M470 340 C 520 420, 600 470, 700 560 S 760 760, 720 910" /><path d="M700 560 C 820 560, 900 600, 980 560" /></svg>`;
  return `<div class="gridlines"></div>${path}${d.items.map((it) => stamp(it)).join("")}<div class="draftveil" style="left:690px;top:440px;width:350px;height:250px"><span>neu im Entwurf</span></div>`;
}

function catalog(S) {
  const d = S.ed;
  if (d.tool === "haus") return `<div class="sub">Gebäude</div><div class="cat">${[["house", "Wohnhaus", "2 Zimmer · Küche", "#d65a40"], ["", "Kleines Haus", "1 Zimmer", "#5470c8"], ["", "Langhaus", "4 Zimmer", "#e0b440"], ["", "Laden", "Theke · Lager", "#3f7fd0"],
      ["", "Werkstatt", "Werkbank", "#8a5a3c"], ["", "Scheune", "Heu · Stroh", "#a8402f"], ["", "Stall", "2 Boxen", "#9a6a3a"]].map(([id, n, s, c], i) => `<button class="catit ${i === 0 ? "on" : ""}"><i style="background:${c}"></i><b>${n}</b><small>${s}</small></button>`).join("")}</div>
    <p class="dim" style="font-size:12px">Klick setzt das Haus mit Tür nach Süden; ein Weg zur nächsten Straße wird vorgeschlagen. Doppelklick auf ein Haus: <b>innen einrichten</b>.</p>`;
  if (d.tool === "natur") return `<div class="sub">Bäume und Deko</div><div class="cat four">${["🌳 Laubbaum", "🌸 Kirschbaum", "🌲 Tanne", "🍎 Apfelbaum", "🌿 Busch", "🪨 Stein", "🏮 Laterne", "🪑 Bank", "⛲ Brunnen", "📋 Brett", "📮 Briefkasten", "🌻 Sonnenblumen", "🛢 Regentonne", "🛶 Boot", "🎃 Vogelscheuche", "🪵 Zaun"].map((x, i) => `<button class="catit sm ${i === 0 ? "on" : ""}">${x}</button>`).join("")}</div>`;
  if (d.tool === "gebiet") return `<div class="sub">Gebiet erzeugen</div><p style="font-size:13px">Rechteck auf der Karte aufziehen: Darin legt der Generator ein Dorf an, mit denselben Stellgrößen wie bei „Welt erzeugen“. Danach ist alles einzeln änderbar.</p><button class="b">Stellgrößen …</button><p class="dim" style="font-size:12px">Nur in der Welt-Werkstatt. Im laufenden Spiel gibt es keinen Generator.</p>`;
  if (d.tool === "platz") return `<div class="sub">Startplatz</div><p style="font-size:13px">Wo neue Bewohner zu Beginn stehen und wo „Dorfplatz“ im Wissen der Bewohner liegt. Jede Welt braucht genau einen.</p>`;
  if (d.tool === "weg") return `<div class="sub">Weg</div><div class="gfield"><span>Breite</span><span class="seg"><button>schmal</button><button class="on">breit</button></span></div><div class="gfield"><span>Belag</span><span class="seg"><button class="on">Erde</button><button>Pflaster</button></span></div><p class="dim" style="font-size:12px">Klicken setzt Punkte, Doppelklick beendet den Weg.</p>`;
  return `<p class="dim" style="font-size:13px">Werkzeug wählen: Zahlentasten 1–9.</p>`;
}

function edPanel(S) {
  const spiel = S.edCtx === "spiel";
  return `<div class="glass edpanel">${catalog(S)}
    <div class="sub">Entwurf (5)</div><div class="draft">${["Haus: Wohnhaus", "Weg, 4 Punkte", "See 30 × 18", "Kirschbaum", "Laterne"].map((x) => `<div>${x}<button class="b icon ghost">✕</button></div>`).join("")}</div>
    <div class="sub">Prüfung</div><div class="checks"><div>✓ Alle Haustüren sind vom Startplatz aus erreichbar</div><div>✓ Bild und Karte stimmen überein</div>
      ${spiel ? "<div>✓ Niemand steht auf überbauter Fläche</div>" : '<div style="color:var(--warn)">! Noch kein Startplatz gesetzt – speichern geht, starten nicht</div>'}</div>
    ${spiel ? `<div style="display:flex;gap:6px;margin-top:12px"><button class="b" style="flex:1">Verwerfen</button><button class="b gold" style="flex:2">Übernehmen …</button></div><p class="dim" style="font-size:11.5px">Vorher wird der Stand gesichert. Die Bewohner merken nichts vom Umbau.</p>`
      : `<div style="display:flex;gap:6px;margin-top:12px"><button class="b" style="flex:1">Speichern als …</button><button class="b gold" style="flex:1">Speichern <kbd>⌘S</kbd></button></div>`}</div>`;
}

function renderEditor(S) {
  const spiel = S.edCtx === "spiel", tools = TOOLS.filter((t) => !(spiel && t[3]));
  const top = spiel
    ? `<div class="glass edtop"><b style="color:var(--acc2)">✎ Gestalten</b><span class="dim">Die Zeit steht still · Tag 3, 07:53</span><span class="sp"></span>${viewSeg()}<button class="b icon ghost">↶</button><button class="b icon ghost">↷</button><button class="b" data-act="go" data-id="spiel" title="Esc">Fertig <kbd>Esc</kbd></button></div>`
    : `<div class="glass edtop"><button class="b ghost" data-act="go" data-id="welten">← Welten <kbd>Esc</kbd></button><input class="wname" value="Mein Dorf"><span class="dirty">● ungespeichert</span><span class="sp"></span>${viewSeg()}
       <button class="b icon ghost" title="Rückgängig ⌘Z">↶</button><button class="b icon ghost" title="Wiederholen">↷</button><button class="b" title="Neue Simulation mit dieser Welt (Menü › Neue Simulation, Welt vorgewählt)">▶ Damit spielen …</button></div>`;
  return `${top}<div class="glass edtools">${tools.map(([id, ic, l], i) => `<button class="tool ${S.ed.tool === id ? "on" : ""}" data-act="tool" data-id="${id}"><span>${ic}</span>${l}<kbd>${i + 1}</kbd></button>`).join("")}</div>${edPanel(S)}`;
}
const viewSeg = () => `<span class="seg"><button>Tiefe</button><button class="on">Flach</button></span><label class="chip on" style="cursor:pointer">▦ Raster</label>`;
