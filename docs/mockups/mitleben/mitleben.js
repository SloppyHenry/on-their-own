// Mockup Mitleben (AP18h Schritt 0): Leben mit eigener Figur. Ein Zustand S, alles wird daraus gezeichnet. Nutzt figuren.js und spiel.js des Rework-Mockups (HUD, Bewohnerleiste, Einblicke).
FACES.kim = { hair: "#8a5a3a", hair2: "#6d452c", skin: "#f1c6a0", shirt: "#74aadc", eyes: "#2b2233" };
PEOPLE.unshift({ id: "kim", name: "Kim", c: "var(--sky)", age: "29 · weiblich", st: "🧍", where: "Platz", doing: "wartet", mood: 76, needs: { Energie: 80, Sattheit: 60, Wasser: 70, Gesellschaft: 50, Ruhe: 72 } });

const SPOT = { platz: [840, 745], ufer: [1035, 716] };            // Fußpunkt der Figur im Bild (1440 × 910)
const S = { screen: "gehen", pos: "platz", pop: null, takt: "weiter", drawer: null, note: true, reply: false, hover: "angeln" };
const SCREENS = [
  ["1 Gehen", { screen: "gehen", pos: "platz", pop: null }, "Gehen: Klick in die Welt",
    "Deine Figur <b>Kim</b> steht auf dem Platz. <b>Klick auf eine Kachel</b> schickt sie hin: gepunkteter Weg, Zielmarke mit Namen und Dauer, im Band unten „Kim geht zum See · noch 6 Min.“ mit <b>Abbrechen</b> (die Engine kann Handlungen unterbrechen). Das ist <code>move_to</code> über dieselbe Schnittstelle wie bei Alex und Mira. Die Kamera folgt Kim (<kbd>F</kbd> schaltet um). Der <b>Ring</b> unter den Füßen gibt es nur bei dir. Schild und Name sehen die anderen genauso wie bei jedem Bewohner."],
  ["2 Benutzen", { screen: "benutzen", pos: "ufer", pop: "benutzen" }, "Benutzen: dieselben Möglichkeiten wie die KI",
    "<kbd>U</kbd> oder ein Klick auf ein Ding öffnet die Liste dessen, was Kim <b>hier gerade tun könnte</b>, gruppiert nach Ding. Es ist exakt die Optionsliste, die der Optionsgenerator auch einem Bewohner anbieten würde (<code>GET /api/player/choices</code>), mit Dauer und Kosten. Was nicht geht, bleibt sichtbar und nennt den Grund („braucht Angelrute“). Ob eine Handlung gelingt, entscheidet die Welt, nicht die Leiste."],
  ["3 Abgelehnt", { screen: "abgelehnt", pos: "platz", pop: null }, "Wenn die Welt nein sagt",
    "Kim soll am See angeln, steht aber auf dem Platz. Die Engine lehnt ab, und <b>ihr Ablehnungstext</b> erscheint 3 Sekunden als kleine rote Blase über Kim (kein Dialog, nichts blockiert). Dieselben Texte lesen auch die Bewohner im Prompt („Zuletzt erlebt“)."],
  ["4 Sagen", { screen: "sagen", pos: "ufer", pop: null, reply: true }, "Sagen und Antworten",
    "Alex spricht Kim an. Seine Blase steht über ihm wie immer; unten erscheint die <b>Antwortzeile</b> mit Zähler. Kim antwortet mit <kbd>Enter</kbd> (höchstens 500 Zeichen), das Gesagte erscheint als <b>ganz normale Sprechblase</b> über Kim, ohne Kennzeichnung. Schweigst du, endet das Gespräch nach der Frist wie bei einem schweigenden Bewohner (<code>ConversationManager.expire</code>). <kbd>T</kbd> öffnet die Zeile auch ohne Ansprache, mit Empfänger aus der Nähe."],
  ["5 Takt", { screen: "takt", pos: "platz", pop: "takt" }, "Takt: die Zeit läuft, deine Figur wartet",
    "Standard: <b>Die Welt läuft weiter, Kim steht da</b> und wartet wie ein Bewohner, der nichts vorhat (kleine Plakette). Zwei Schalter (Einstellungen › Spielart) ändern das: <b>„Anhalten, wenn ich dran bin“</b> (rundenweise, die Zeit steht, bis du etwas tust) und <b>„Autopilot“</b> (nach 30 Spielminuten ohne Eingabe entscheidet das Modell für Kim wie für jeden Bewohner; „Übernehmen“ holt dich zurück). Oben im Mockup-Menü „Takt“ zeigt alle drei Zustände."],
  ["6 Gepäck", { screen: "gepaeck", pos: "ufer", pop: "gepaeck" }, "Gepäck und Bauen",
    "<kbd>I</kbd> öffnet das Gepäck: was Kim in den Händen hält und im Rucksack trägt, mit <b>Ablegen</b>, <b>Geben an …</b> (nur wer in Reichweite ist), Essen und Trinken. <kbd>B</kbd> zeigt die Bauvorlagen aus AP18g, die gerade gehen, mit Kosten (Bild 4 im Rework-Mockup). Alles sind normale Handlungen (<code>take</code>, <code>drop</code>, <code>give</code>, <code>build</code>)."],
  ["7 Was die anderen sehen", { screen: "sicht", pos: "ufer", pop: null, drawer: "tagebuch" }, "Kein Hinweis für die anderen",
    "Links ein Ausschnitt aus <b>Miras Gedächtnis-Einblick</b> und aus ihrem Prompt: Kim steht dort wie jeder Nachbar, „In deiner Nähe: Kim (See, angelt)“. Nichts verrät, wer Kim steuert. Rechts <b>dein Tagebuch</b>: Kims Handlungen stehen wie die der anderen, nur ohne „Warum“, denn es gab keine Optionsliste. Sagst du „Ich bin der Spieler“, erfährt Mira genau diesen Satz, nicht mehr (kein Filter, Hinweis in der Anleitung)."],
  ["8 Einrichten", { screen: "einrichten", pos: "platz", pop: null }, "Einrichten und Wechseln",
    "Links der Assistent, Schritt <b>Bewohner</b>: Bei höchstens einer Figur steht <b>„Das bist du“</b> (Profilmaske wie bei allen, dazu das Aussehen aus AP19, wenn vorhanden). Rechts <b>Einstellungen › Spielart</b>: die beiden Schalter und „Eigene Figur wechseln“ (mit Bestätigung; die bisherige Figur wird ein normaler Bewohner mit Autopilot)."],
];

const $ = (q) => document.querySelector(q);
function fit() { document.documentElement.style.setProperty("--s", Math.max(innerWidth / 1440, innerHeight / 910)); }
function toast(t) { const el = $("#toast"); el.innerHTML = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1700); }

/** Kleine Pixelfigur (16 × 24) für Kim. */
function sprite() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 24; const g = c.getContext("2d"), f = FACES.kim, px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(4, 1, 8, 3, f.hair); px(3, 3, 1, 6, f.hair); px(12, 3, 1, 6, f.hair); px(4, 4, 8, 6, f.skin); px(5, 6, 1, 1, f.eyes); px(10, 6, 1, 1, f.eyes); px(7, 8, 2, 1, "#c98a7a");
  px(4, 10, 8, 7, f.shirt); px(2, 11, 2, 6, f.shirt); px(12, 11, 2, 6, f.shirt); px(2, 17, 2, 1, f.skin); px(12, 17, 2, 1, f.skin);
  px(5, 17, 6, 4, "#4a4a68"); px(5, 21, 2, 2, "#3a2d3a"); px(9, 21, 2, 2, "#3a2d3a"); px(4, 2, 8, 1, f.hair2);
  c.className = "spr"; return c;
}

function figure() {
  const [x, y] = SPOT[S.pos], idle = S.screen !== "gehen";
  return `<div class="me-fig ${idle ? "idle" : ""}" style="left:${x}px;top:${y}px"><div class="ring"></div><canvas class="spr-ph" width="16" height="24"></canvas></div>
    <div class="tag" style="left:${x}px;top:${y + 4}px;--c:var(--sky)"><i></i>Kim</div>`;
}

function worldLayer() {
  let h = figure();
  const [x, y] = SPOT[S.pos];
  if (S.screen === "gehen") {
    const [gx, gy] = SPOT.ufer;
    h += `<svg class="pathsvg" viewBox="0 0 1440 910"><path class="o" d="M${x} ${y} C 880 770, 960 745, ${gx} ${gy}"/><path d="M${x} ${y} C 880 770, 960 745, ${gx} ${gy}"/></svg>
      <div class="goal" style="left:${gx}px;top:${gy - 8}px">⌖</div><div class="goal-l" style="left:${gx}px;top:${gy + 12}px">Ufer am See · etwa 6 Min.</div>`;
  }
  if (S.screen === "abgelehnt") h += `<div class="reject" style="left:${x}px;top:${y - 82}px"><b>Nicht möglich</b>Zu weit weg: Der See ist 14 Schritte entfernt.</div>`;
  const alexSay = S.screen === "sagen" ? `<div class="say" style="left:1121px;top:506px;--c2:var(--alex)"><b>Alex</b>Hey Kim! Zwei kleine Barsche bisher. Probier es doch auch, das Wasser ist ganz ruhig.</div>`
    : `<div class="think" style="left:1121px;top:490px"><span class="what">angelt · überlegt</span>Mira mag Äpfel. Ich könnte ihr dafür einen Fisch abgeben.</div>`;
  h += `<div class="tag" style="left:1121px;top:612px;--c:var(--alex)"><i></i>Alex</div>${alexSay}`;
  h += `<div class="tag" style="left:741px;top:420px;--c:var(--mira)"><i></i>Mira</div>`;
  if (S.screen === "sagen" && S.said) h += `<div class="say" style="left:${x}px;top:${y - 70}px;--c2:var(--sky)"><b>Kim</b>${S.said}</div>`;
  h += `<div class="roof" style="left:487px;top:258px;--c:var(--hanne)"><canvas data-face="hanne"></canvas>Hanne schläft</div>`;
  return h;
}

function peopleBar() {
  return `<div class="glass people">${PEOPLE.map((p) => `<button class="person ${p.id === "kim" ? "me on" : ""}" style="--c:${p.c}" data-act="none"><canvas data-face="${p.id}"></canvas><b>${p.name}</b><span class="bar mood"><i style="width:${p.mood}%"></i></span><span class="st">${p.st}</span>
    <span class="glass tip">${p.name} · ${p.id === "kim" ? (S.screen === "gehen" ? "geht zum See" : "wartet") : p.doing}</span></button>`).join("")}</div>`;
}

function bar() {
  const on = (id) => (S.pop === id ? "on" : "");
  return `<div class="glass tools">
    <button class="b ${S.reply ? "on" : ""}" data-act="say">💬 Sagen <kbd>T</kbd></button><button class="b ${on("benutzen")}" data-act="pop" data-id="benutzen">✋ Benutzen <kbd>U</kbd></button>
    <button class="b ${on("bauen")}" data-act="pop" data-id="bauen">🔨 Bauen <kbd>B</kbd></button><button class="b" data-act="scr" data-id="0">🧭 Gehen <small>Klick in die Welt</small></button>
    <button class="b ${on("gepaeck")}" data-act="pop" data-id="gepaeck">🎒 Gepäck <small>6</small> <kbd>I</kbd></button></div>`;
}

const opt = (ic, name, hint, extra = "") => `<button class="opt ${extra}"><span class="ic">${ic}</span><b>${name}</b><small>${hint}</small></button>`;
function pops() {
  if (S.pop === "benutzen") return `<div class="glass pop narrow"><h4>✋ Benutzen <small>· hier, jetzt, für Kim</small></h4>
    <div class="grp">💧 See</div>${opt("🎣", "Angeln", "etwa 25 Min. · Energie −8", "sel")}${opt("🥛", "Wasser trinken", "2 Min.")}${opt("🪣", "Wasser schöpfen", "braucht Eimer", "no")}
    <div class="grp">🛶 Boot</div>${opt("🛶", "Boot nehmen", "braucht Ruder (hat Alex)", "no")}
    <div class="grp">🧑 Alex</div>${opt("💬", "Ansprechen", "sofort")}${opt("🎁", "Etwas geben …", "2 Äpfel · 3 Holz")}
    <div class="foot"><span>Genau diese Liste bekäme auch ein Bewohner angeboten.</span><span style="margin-left:auto"><kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> tun · <kbd>Esc</kbd> zu</span></div></div>`;
  if (S.pop === "gepaeck") return `<div class="glass pop narrow"><h4>🎒 Gepäck <small>· was Kim trägt</small></h4>
    <div class="grp">In den Händen</div>${opt("🎣", "Angelrute", "Ablegen · Geben")}
    <div class="grp">Im Rucksack</div>${opt("🪵", "3 Holz", "Ablegen · Geben an Alex")}${opt("🪨", "1 Stein", "Ablegen · Geben")}${opt("🍎", "2 Äpfel", "Essen · Geben an Alex")}
    <div class="foot"><span>Geben geht nur, wer in Reichweite steht: Alex ist 4 Schritte entfernt.</span></div></div>`;
  if (S.pop === "bauen") return `<div class="glass pop wide"><h4>🔨 Bauen <small>· Bauvorlagen, die hier gerade gehen</small></h4><div class="items">${[["🪑", "Bank", "3 Holz"], ["🔥", "Feuerstelle", "2 Holz · 3 Stein"], ["🪵", "Gartenzaun", "2 Holz"], ["🟫", "Weg anlegen", "1 Stein je Feld"], ["🌱", "Beet anlegen", "2 Saatgut", 1], ["🌳", "Baum pflanzen", "1 Saatgut", 1], ["🏮", "Laterne", "2 Holz · 1 Stein"], ["⛲", "Brunnen", "8 Stein", 1]]
    .map(([i, n, k, no]) => `<button class="item ${no ? "no" : ""}"><span>${i}</span><b>${n}</b><small>${no ? "es fehlt: " : ""}${k}</small></button>`).join("")}</div></div>`;
  if (S.pop === "takt") return `<div class="glass pop wide" style="bottom:auto;top:96px;left:auto;right:16px;transform:none;width:430px"><h4>Einstellungen › Spielart <small>· eigene Figur</small></h4>
    <div class="sw"><div class="tx"><b>Anhalten, wenn ich dran bin</b><small>Ist Kim frei und spricht jemand sie an (oder ihre Handlung ist zu Ende), steht die Zeit, bis du etwas tust. Rundenweise spielen.</small></div><button class="tog ${S.takt === "anhalten" ? "on" : ""}" data-act="takt" data-id="anhalten"></button></div>
    <div class="sw"><div class="tx"><b>Autopilot, wenn ich nichts tue</b><small>Danach entscheidet das Modell für Kim wie für jeden Bewohner, bis du wieder eingreifst.</small><div class="min">nach <input value="30" size="3"> Spielminuten</div></div><button class="tog ${S.takt === "auto" ? "on" : ""}" data-act="takt" data-id="auto"></button></div>
    <div class="sw"><div class="tx"><b>Sicht</b><small>Du siehst die ganze Welt wie sonst. „Nur sehen, was Kim sieht“ kommt später.</small></div><span class="chip">ganze Welt</span></div>
    <div class="sw"><div class="tx"><b>Eigene Figur wechseln …</b><small>Mit Bestätigung. Kim wird ein normaler Bewohner.</small></div><button class="b">Wechseln</button></div></div>`;
  return "";
}

function replyBar() {
  if (!S.reply) return "";
  return `<div class="glass reply"><canvas data-face="alex"></canvas><div class="col"><small><b>Alex</b> wartet auf deine Antwort</small>
    <input id="say" placeholder="Antwort an Alex …" value="${S.said ? "" : "Danke! Ich hole nur schnell eine Rute."}" maxlength="500"></div>
    <div class="timer"><span>bleibt noch</span><b>22 Min.</b><span class="bar"><i style="width:70%"></i></span></div>
    <button class="b gold" data-act="send">Sagen <kbd style="color:var(--ink)">Enter</kbd></button></div>`;
}

function statusBand() {
  if (S.pop || S.reply) return "";
  if (S.screen === "gehen") return `<div class="glass doing"><span>🚶 <b>Kim</b> geht zum See · noch 6 Min.</span><span class="bar"><i style="width:18%"></i></span><button class="b">Abbrechen <kbd>Esc</kbd></button></div>`;
  if (S.screen === "abgelehnt") return `<div class="glass doing"><span>✖ <b>Angeln</b> abgelehnt · du kannst es gleich neu versuchen</span></div>`;
  return "";
}

function follow() {
  const t = S.takt, wait = `<div class="glass pill"><b>◎</b> Kamera folgt Kim <kbd>F</kbd></div>`;
  if (t === "auto") return `<div class="follow">${wait}<div class="glass pill auto"><b>⚙ Autopilot</b> Kim entscheidet selbst · seit 31 Min. <button class="b" style="padding:2px 9px">Übernehmen</button></div></div>`;
  if (t === "anhalten") return `<div class="follow">${wait}</div>`;
  return `<div class="follow">${wait}<div class="glass pill"><b>◐</b> Kim wartet <small>· frei seit 07:52</small></div></div>`;
}

function drawerSicht() {
  const e = (face, t, txt) => `<div class="entry"><canvas data-face="${face}"></canvas><div><span class="t">${t}</span>${txt}</div></div>`;
  return `<div class="glass drawer"><header><h3>📖 Tagebuch</h3><button class="b">Alles · Ausfuhr</button><button class="b icon ghost" data-act="close">✕</button></header>
    <div class="filters"><span class="chip on">Gespräche</span><span class="chip on">Handlungen</span><span class="chip on">Pläne</span><span class="chip">Erinnerungen</span><span class="chip">System</span></div>
    <div class="list"><div class="day">MITTWOCH · TAG 3</div>
      ${e("kim", "07:58 · See", "angelt <span class='me-note'>kein „Warum“: du hast gewählt</span>")}
      ${e("kim", "07:57 · See", "<q>„Danke! Ich hole nur schnell eine Rute.“</q>")}
      ${e("alex", "07:56 · See", "<q>„Hey Kim! Zwei kleine Barsche bisher. Probier es doch auch.“</q>")}
      ${e("kim", "07:51 · Platz", "geht zum See <small>(6 Min.)</small>")}
      ${e("alex", "07:40 · See", "plant: <b>Steg verlängern</b> <small>· braucht 4 Holz, hat 1</small>")}
      ${e("mira", "07:22 · Küche", "merkt sich: <i>Kim ist heute früh am Platz angekommen</i>")}
    </div></div>`;
}

function sidePanel() {
  return `<div class="glass side"><h4>🧠 Mira · Gedächtnis <small>(Einblick)</small></h4><small>Erinnerungen, wie bei jedem Bewohner</small>
    <div class="mem">Kim hat am See einen Barsch geschenkt bekommen.<small>07:58 · Beobachtung</small></div><div class="mem">Kim sagte: „Danke! Ich hole nur schnell eine Rute.“<small>07:57 · Gespräch</small></div>
    <div class="mem">Kim ist am Platz angekommen.<small>07:51 · Beobachtung</small></div>
    <div class="snip">In deiner Nähe: Alex (See, angelt); <mark>Kim (See, angelt)</mark>.</div>
    <div class="okbox">Kein „Spieler“, kein „Mensch“, kein „Autopilot“ in irgendeinem Prompt. Ein Test sucht danach in allen Prompts eines Laufs.</div></div>`;
}

function einrichten() {
  const r = (id, n, sub, me) => `<div class="res ${me ? "me" : ""}"><canvas data-face="${id}"></canvas><div><b>${n}</b><small>${sub}</small></div><span class="rad">${me ? "● Das bist du" : "○ Das bin ich"}</span></div>`;
  return `<div class="glass setup"><div><span class="crumb">Neue Simulation › Selbst definieren › Bewohner</span><h3>Wer lebt im Dorf?</h3><small>Spielart <b>Leben mit eigener Figur</b>: Du steuerst genau eine Figur, alle anderen entscheiden selbst.</small>
      ${r("alex", "Alex", "34 · Angler · Vorlage", 0)}${r("mira", "Mira", "31 · Gärtnerin · Vorlage", 0)}${r("kim", "Kim", "29 · Tischlerin · <span class='tpl'>Vorlage Kim</span>", 1)}
      <div class="okbox" style="border-color:var(--me);color:#d6e6f7">Kim steuerst du. Für Alex und Mira ist Kim ein Bewohner wie jeder andere: gleicher Körper, gleiche Regeln, nirgends ein Vermerk. Profil und Persönlichkeit bearbeitest du wie bei allen (Wortprüfung warnt vor „Spieler“ im Text).</div></div>
    <div><span class="crumb">Einstellungen › Spielart</span><h3>Eigene Figur</h3><small>Gilt für diesen Spielstand.</small>
      <div class="sw"><div class="tx"><b>Anhalten, wenn ich dran bin</b><small>Rundenweise spielen.</small></div><button class="tog"></button></div>
      <div class="sw"><div class="tx"><b>Autopilot, wenn ich nichts tue</b><small>Nach 30 Spielminuten ohne Eingabe.</small></div><button class="tog"></button></div>
      <div class="sw"><div class="tx"><b>Eigene Figur wechseln …</b><small>Kim wird ein normaler Bewohner mit Autopilot.</small></div><button class="b">Wechseln</button></div></div></div>`;
}

function render() {
  const bg = $("#bg"); bg.src = "rework/img/dorf-tiefe.jpg";
  let h = hudTop({ mode: "figur" }) + peopleBar() + dock(S);
  if (S.screen === "einrichten") { $("#signs").innerHTML = ""; $("#hud").innerHTML = hudTop({ mode: "figur" }) + einrichten(); $("#hud").insertAdjacentHTML("afterbegin", `<div style="position:absolute;inset:0;background:#0009;pointer-events:none"></div>`); }
  else {
    h += follow() + statusBand() + (S.drawer === "tagebuch" ? drawerSicht() + sidePanel() : "") + pops() + replyBar();
    if (S.takt === "anhalten" && S.screen !== "einrichten") h += `<div class="glass banner"><span>⏸</span><span><b>Die Zeit steht: Kim ist dran.</b> Sag oder tu etwas, dann läuft sie weiter.</span></div>`;
    h += bar();
    $("#hud").innerHTML = h; $("#signs").innerHTML = worldLayer();
    const ph = $("#signs .spr-ph"); if (ph) ph.replaceWith(Object.assign(sprite(), { style: "position:absolute;left:-24px;top:-72px;width:48px;height:72px;image-rendering:pixelated" }));
  }
  faces($("#hud")); faces($("#signs"));
  const cur = SCREENS.find(([, st]) => st.screen === S.screen);
  $("#mockbar").innerHTML = SCREENS.map(([l, st]) => `<button data-scr="${SCREENS.findIndex((x) => x[0] === l)}" class="${cur && cur[0] === l ? "on" : ""}">${l}</button>`).join("")
    + `<span class="sep"></span>Takt ${[["weiter", "Wartet"], ["anhalten", "Anhalten"], ["auto", "Autopilot"]].map(([v, l]) => `<button data-takt="${v}" class="${S.takt === v ? "on" : ""}">${l}</button>`).join("")}<span class="sep"></span><button data-note class="${S.note ? "on" : ""}">Erklärung</button>`;
  $("#note").className = S.note && cur ? "show" : ""; if (cur) $("#note").innerHTML = `<h4>${cur[2]}</h4>${cur[3]}`;
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#mocktab")) { $("#mockbar").classList.toggle("open"); return; }
  const m = e.target.closest("#mockbar button");
  if (m) { if (m.dataset.scr) { const sc = SCREENS[m.dataset.scr]; Object.assign(S, { pop: null, reply: false, drawer: null, said: null, hover: null }, sc[1]); $("#mockbar").classList.remove("open"); }
    if (m.dataset.takt) S.takt = m.dataset.takt; if ("note" in m.dataset) S.note = !S.note; return render(); }
  const a = e.target.closest("[data-act]"); if (!a) return; const act = a.dataset.act, id = a.dataset.id;
  if (act === "pop") S.pop = S.pop === id ? null : id, S.reply = false;
  else if (act === "say") S.reply = !S.reply, S.pop = null;
  else if (act === "send") { S.said = ($("#say").value || "Danke!"), S.reply = false; toast("Gesagt · Alex hört es wie jede andere Rede"); }
  else if (act === "takt") S.takt = S.takt === id ? "weiter" : id;
  else if (act === "close") S.drawer = null;
  else if (act === "scr") Object.assign(S, { pop: null, reply: false }, SCREENS[Number(id)][1]);
  else return;
  render();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) { if (e.key === "Escape") e.target.blur(); if (e.key === "Enter") document.querySelector("[data-act=send]")?.click(); return; }
  const k = e.key.toLowerCase();
  if (k === "m") return $("#mockbar").classList.toggle("open");
  if (k === "escape") { if (S.pop) S.pop = null; else if (S.reply) S.reply = false; else if (S.drawer) S.drawer = null; else return toast("<kbd>Esc</kbd> sonst: Menü · die Welt läuft dahinter weiter"); }
  else if (k === "u") S.pop = S.pop === "benutzen" ? null : "benutzen"; else if (k === "b") S.pop = S.pop === "bauen" ? null : "bauen"; else if (k === "i") S.pop = S.pop === "gepaeck" ? null : "gepaeck";
  else if (k === "t") { S.reply = !S.reply; S.pop = null; } else return;
  render();
});
addEventListener("resize", fit); fit(); render();
