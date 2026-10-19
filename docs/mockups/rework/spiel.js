// Spiel-Bildschirme: HUD in den Ecken, Bewohner unten links, Einblicke unten rechts, Werkzeuge je Spielart unten in der Mitte.
const SUN = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#ffd36e" d="M3 1h3v1H3zM2 2h5v5H2zM3 7h3v1H3zM1 3h1v3H1zM7 3h1v3H7z"/><path fill="#ffb347" d="M3 3h3v3H3z"/></svg>');

function hudTop(S) {
  const speeds = ["½", "1×", "2×", "4×", "Max"];
  return `
  <div class="hud-tl">
    <div class="glass pill clock" title="Dorf am See"><img class="sun" src="${SUN}" alt=""><div><b>Tag 3 · 07:53</b><small>Mittwoch · klar · Dorf am See</small></div></div>
    <div class="glass pill time"><button class="b icon on" title="Pause (Leertaste)">❚❚</button><button class="b icon" title="Ein Schritt (.)">⏭</button>
      <div class="seg">${speeds.map((s) => `<button class="${s === "1×" ? "on" : ""}">${s}</button>`).join("")}</div></div>
    <div class="glass pill mode ${S.mode === "gott" ? "gott" : "leben"}" title="Spielart dieser Simulation (beim Anlegen gewählt)">${S.mode === "gott" ? "✦ Gott" : S.mode === "figur" ? "◐ Leben · als Kim" : "◐ Leben"}</div>
  </div>
  <div class="hud-tr">
    <div class="glass pill status" title="Modell: qwen3.8-9b · Ø 4,5 s · verbunden — Klick: Einstellungen › Modell"><i></i> Modell bereit</div>
    <button class="glass b icon" title="Ton">🔊</button>
    <button class="glass b icon" title="Hilfe (?)" data-act="help">?</button>
    <button class="glass b" data-act="menu" title="Menü (Esc)">☰ Menü</button>
  </div>`;
}

function people(S) {
  return `<div class="glass people">${PEOPLE.map((p) => `
    <button class="person ${S.card === p.id ? "on" : ""}" style="--c:${p.c}" data-act="card" data-id="${p.id}">
      <canvas data-face="${p.id}"></canvas><b>${p.name}</b><span class="bar mood"><i style="width:${p.mood}%"></i></span><span class="st">${p.st}</span>
      <span class="glass tip">${p.name} · ${p.doing}</span></button>`).join("")}
    <button class="person" style="--c:var(--faint)" title="Im Leben-Modus ziehen neue Bewohner nur über das Spiel zu; im Gott-Modus: Bewohner hinzufügen"><span style="width:46px;height:46px;border-radius:12px;border:1px dashed var(--edge2);display:grid;place-items:center;color:var(--dim);font-size:20px">＋</span><b style="color:var(--dim)">&nbsp;</b></button>
  </div>`;
}

function dock(S) {
  const it = [["tagebuch", "📖", "Tagebuch", "T"], ["gedaechtnis", "🧠", "Gedächtnis", "G"], ["statistik", "📊", "Statistik", ""], ["wissen", "🔎", "Wissen", ""]];
  const tick = S.drawer ? "" : `<div class="ticker"><div><b style="color:var(--mira)">Mira</b> erntet zwei Äpfel im Garten.</div><div><b style="color:var(--alex)">Alex</b> fängt einen kleinen Barsch.</div><div><b style="color:var(--mira)">Mira</b>: „Alex, hast du heute schon Fische gesehen?“</div></div>`;
  return `${tick}<div class="glass dock">${it.map(([id, ic, l, k]) => `<button class="b ${S.drawer === id ? "on" : ""}" data-act="drawer" data-id="${id}" title="${l}${k ? ` (${k})` : ""}"><span>${ic}</span>${l}</button>`).join("")}</div>`;
}

function drawer() {
  const e = (face, t, txt) => `<div class="entry"><canvas data-face="${face}"></canvas><div><span class="t">${t}</span>${txt}</div></div>`;
  return `<div class="glass drawer"><header><h3>📖 Tagebuch</h3><button class="b">Alles · Ausfuhr</button><button class="b icon ghost" data-act="close">✕</button></header>
    <div class="filters"><span class="chip on">Gespräche</span><span class="chip on">Handlungen</span><span class="chip on">Pläne</span><span class="chip">Erinnerungen</span><span class="chip">System</span><span class="chip">nur Fehlschläge</span><span class="chip">🔍 Suchen</span></div>
    <div class="list"><div class="day">MITTWOCH · TAG 3</div>
      ${e("mira", "07:53 · Wald", "<q>„Alex, hast du heute schon Fische gesehen? Ich wollte nachher noch Äpfel ernten.“</q>")}
      ${e("alex", "07:51 · See", "fängt einen kleinen Barsch <small>(2 im Korb)</small>")}
      ${e("mira", "07:48 · Garten", "erntet zwei Äpfel")}
      ${e("alex", "07:40 · See", "plant: <b>Steg verlängern</b> <small>· braucht 4 Holz, hat 1</small>")}
      ${e("hanne", "07:31 · Wohnzimmer", "legt sich aufs Sofa: <small>Energie 22 %</small>")}
      ${e("mira", "07:22 · Küche", "merkt sich: <i>Hanne war heute früh müde</i>")}
      <div class="day">DIENSTAG · TAG 2</div>
      ${e("alex", "21:10 · Zimmer Alex", "denkt nach: <i>„Ich will etwas Bleibendes bauen, vielleicht einen Steg für alle.“</i>")}
    </div></div>`;
}

function card(id) {
  const p = PEOPLE.find((x) => x.id === id);
  const rel = (o, s, v) => `<div class="rel"><canvas data-face="${o}"></canvas><div><b style="color:var(--${o})">${PEOPLE.find((x) => x.id === o).name}</b> <small>· ${s}</small>
    <div class="minis"><span>Vertrauen ${v[0]}</span><span>Sympathie ${v[1]}</span><span>Spannung ${v[2]}</span><span>Vertrautheit ${v[3]}</span></div></div></div>`;
  return `<div class="glass card"><div class="head"><canvas data-face="${p.id}" style="box-shadow:0 0 0 3px ${p.c}"></canvas>
      <div><h3 style="color:${p.c}">${p.name}</h3><small>${p.age} · wohnt im Heimhaus</small><div class="now">${p.st} ${p.doing} · <small>${p.where}</small></div></div>
      <button class="b icon ghost" data-act="close" title="Schließen (Esc)">✕</button></div>
    <div style="display:flex;gap:6px;padding:0 16px 12px"><button class="b on">◎ Kamera folgt <kbd>F</kbd></button><button class="b">🧠 Gedächtnis</button><button class="b">🗣 Stimme</button></div>
    <div class="tabs"><button class="on">Überblick</button><button>Ziele</button><button>Beziehungen</button><button>Entscheidungen</button><button>Fehlschläge</button></div>
    <section><div class="sub">Gerade</div><div style="font-size:13px">Will den Steg verlängern, damit man vom Boot bequemer an Land kommt. <small>· Ziel seit Tag 2</small></div>
      <div class="sub">Stimmung · zufrieden</div><div class="bar" style="height:8px"><i style="width:${p.mood}%;background:${p.c}"></i></div>
      <div class="sub">Bedürfnisse</div>${Object.entries(p.needs).map(([k, v]) => `<div class="need"><span>${k}</span><span class="bar"><i style="width:${v}%;background:${v < 35 ? "var(--warn)" : "var(--ok)"}"></i></span><span>${v} %</span></div>`).join("")}
      <div class="sub">Beziehungen</div>${rel("mira", "Freundin", [62, 70, 8, 41])}${rel("hanne", "Nachbarin", [50, 54, 12, 22])}
      <div class="sub">Letzte Entscheidung · 07:40</div><div style="font-size:13px">„Steg verlängern“ vor „Mira suchen“ und „frühstücken“. <small>Ausschlag: Ziel 0,42 · Laune 0,18 · Holz fehlt −0,30</small> <a style="color:var(--acc)">Warum? ›</a></div>
    </section></div>`;
}

function godTools(S) {
  const pop = S.pop === "ereignis" ? `<div class="glass pop"><h4>✦ Ereignis <small>· die Bewohner erleben es als Teil ihrer Welt</small></h4>
      <textarea placeholder="Was soll in der Welt passieren?">Am Nachmittag zieht ein Gewitter auf.</textarea>
      <div class="row"><small>Wer merkt es:</small><span class="chip on">alle, die draußen sind</span><span class="chip">Alex</span><span class="chip">Mira</span><span class="chip">Hanne</span></div>
      <div class="row"><small>Wann:</small><span class="chip">sofort</span><span class="chip">in 30 Min.</span><span class="chip">in 2 Std.</span><span class="chip on">heute 15:00</span><span style="flex:1"></span><button class="b">Vorschau</button><button class="b gold">Geschehen lassen</button></div></div>` : "";
  return `${pop}<div class="glass tools"><button class="b ${S.pop === "ereignis" ? "on" : ""}" data-act="pop" data-id="ereignis">✦ Ereignis <kbd>E</kbd></button>
    <button class="b" data-act="go" data-id="editor-spiel">✎ Gestalten <kbd>B</kbd></button><button class="b" title="Bewohner bearbeiten, hinzufügen, wegziehen lassen">☺ Bewohner</button><button class="b" title="Regeln der Welt: Wetter, Kosten, Tageslänge">⚖ Weltregeln</button></div>`;
}

function playerTools(S) {
  const pop = S.pop === "bauen" ? `<div class="glass pop" style="width:640px"><h4>🔨 Bauen <small>· was Kim mit dem Vorhandenen bauen kann (dieselben Bauvorlagen wie die Bewohner)</small></h4>
      <div class="items">${[["🪑", "Bank", "3 Holz"], ["🔥", "Feuerstelle", "2 Holz · 3 Stein"], ["🪵", "Gartenzaun", "2 Holz"], ["🛶", "Steg-Stück", "4 Holz"], ["🧺", "Korb", "2 Schilf"], ["🐦", "Vogelhaus", "2 Holz"],
        ["🟫", "Weg anlegen", "1 Stein je Feld", "neu"], ["🌱", "Beet anlegen", "2 Saatgut", "neu"], ["🌳", "Baum pflanzen", "1 Saatgut", "neu"], ["🏮", "Laterne", "2 Holz · 1 Stein", "neu"], ["⛲", "Brunnen", "8 Stein", "neu"], ["🛖", "Hütte", "20 Holz · 6 Stein", "neu"]]
        .map(([i, n, k, neu]) => `<button class="item ${n === "Steg-Stück" || n === "Brunnen" || n === "Hütte" ? "no" : ""}"><span>${i}</span><b>${n}${neu ? ' <small style="color:var(--plan)">neu</small>' : ""}</b><small>${k}</small></button>`).join("")}</div></div>` : "";
  return `${pop}<div class="glass tools"><span class="inv">🎒 3 Holz · 1 Stein · 2 Äpfel</span><button class="b">💬 Sagen <kbd>Enter</kbd></button><button class="b">✋ Benutzen</button>
    <button class="b ${S.pop === "bauen" ? "on" : ""}" data-act="pop" data-id="bauen">🔨 Bauen <kbd>B</kbd></button><button class="b">🧭 Gehen zu …</button></div>`;
}

function help() {
  const k = [["Klick auf Bewohner", "Karte öffnen"], ["Doppelklick", "folgen"], ["Klick auf ein Haus", "hineinschauen"], ["Esc", "eine Ebene zurück"], ["Mausrad, + −", "Zoom ¼× bis 3×"], ["Ziehen, WASD", "Kamera fahren"],
    ["F", "folgen an/aus"], ["0", "Gesamtansicht"], ["Leertaste", "Pause"], [".", "ein Schritt"], ["T · G", "Tagebuch · Gedächtnis"], ["V", "Tiefe ↔ Flach"], ["E · B", "Ereignis · Gestalten (Gott)"], ["?", "diese Hilfe"]];
  return `<div class="glass help"><h3>Steuerung</h3><div class="grid">${k.map(([a, b]) => `<div><span>${a}</span><small>${b}</small></div>`).join("")}</div>
    <p class="dim" style="font-size:12px;margin:12px 0 0">Die Hilfe ersetzt die Hinweiszeile über der Welt. Beim ersten Start blendet sie sich einmal ein, danach nur auf <kbd>?</kbd>.</p></div>`;
}

/** Schilder und Blasen der Variante v (A Wolke, B leise, C Karte) für den Takt beat. */
function worldSigns(v, beat) {
  const B = BEATS[beat % BEATS.length], out = [];
  for (const id of ["mira", "alex"]) {
    const p = PEOPLE.find((x) => x.id === id), s = SPOTS[id], b = B[id] || {}, [hx, hy] = s.head, [fx, fy] = s.foot;
    const say = b.say && `<div class="say" style="left:${hx}px;top:${hy - 8}px;--c2:${p.c}"><b>${p.name}</b>${b.say}</div>`;
    if (v === "A") {
      out.push(`<div class="tag" style="left:${fx}px;top:${fy + 2}px;--c:${p.c}"><i></i>${p.name}</div>`);
      out.push(say || `<div class="think" style="left:${hx}px;top:${hy - 26}px"><span class="what">${b.what}</span>${b.think}</div>`);
    } else if (v === "B") {
      out.push(say || `<div class="vb"><div class="mark" style="left:${hx}px;top:${hy - 6}px"><span><i>•</i><i>•</i><i>•</i></span></div><div class="think" style="left:${hx}px;top:${hy - 40}px"><span class="what">${p.name} · ${b.what}</span>${b.think}</div></div>`);
    } else {
      out.push(say || `<div class="mini" style="left:${hx}px;top:${hy - 12}px;--c:${p.c}"><div class="l1"><b>${p.name}</b><span>${b.what}</span></div><div class="l2">${b.think}</div></div>`);
    }
    const m = b.memo || b.recall;
    if (m) out.push(`<div class="memo ${b.recall ? "recall" : ""}" style="left:${hx + 120}px;top:${hy + 30}px"><span>${b.recall ? "↺" : "＋"}</span>${m}</div>`);
  }
  out.push(`<div class="roof" style="left:${SPOTS.roof[0]}px;top:${SPOTS.roof[1]}px;--c:var(--hanne)"><canvas data-face="hanne"></canvas>Hanne schläft</div>`);
  return out.join("");
}

function renderGame(S) {
  let h = hudTop(S) + people(S) + dock(S);
  if (S.drawer === "tagebuch") h += drawer();
  if (S.card) h += card(S.card);
  if (S.mode === "gott") h += godTools(S);
  if (S.mode === "figur") h += playerTools(S);
  if (S.help) h += help();
  return h;
}
