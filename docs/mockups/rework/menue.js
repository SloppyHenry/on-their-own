// Menü-Bildschirme: Neue Simulation (mit Spielart und Weltwahl) und Editoren › Welten (Weltenbibliothek).
// Rückweg: Jede Ebene liegt auf einem Stapel (S.path); Esc nimmt die oberste herunter, der Pfad steht oben als Brotkrumen.
const IMG = "../../frontend/public/menue/";
const LABEL = { neu: "Neue Simulation", editoren: "Editoren", laden: "Simulation laden", einstellungen: "Einstellungen",
  spielart: "Spielart", welt: "Welt", erzeugen: "Welt erzeugen", bewohner: "Bewohner", welten: "Welten", leer: "Leere Welt" };
const WORLDS = [
  { id: "see", name: "Dorf am See", img: "rework/img/dorf-tiefe.jpg", meta: ["mitgeliefert", "1 Haus · 5 Räume", "1 See", "64 × 40"], ro: true, live: true },
  { id: "ahorn", name: "Ahornthal", img: "rework/img/dorf-seed-58-mittag.jpg", meta: ["erzeugt · Seed 58", "4 Häuser · Laden", "1 See · Bach", "96 × 60"] },
  { id: "birk", name: "Birkenau", img: "rework/img/dorf-seed-12-abend.jpg", meta: ["erzeugt · Seed 12", "3 Häuser · Werkstatt", "2 Seen", "96 × 60"] },
  { id: "mein", name: "Mein Dorf", img: "rework/img/dorf-seed-7-mittag.jpg", meta: ["selbst gebaut", "5 Häuser · Stall", "1 See", "geändert heute 18:20"] },
  { id: "nacht", name: "Moorhain", img: "rework/img/dorf-seed-31-nacht.jpg", meta: ["erzeugt · Seed 31", "6 Häuser", "Fluss", "128 × 80"] },
];
const LOGO = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#ffd36e" d="M1 4h1v3H1zM2 3h1v1H2zM3 2h2v1H3zM5 3h1v1H5zM6 4h1v3H6z"/><path fill="#fff8ec" d="M2 4h4v3H2z"/><path fill="#8a5a3c" d="M3 5h1v2H3z"/></svg>';

function menuList(S) {
  const it = (id, ic, l, hint) => `<button class="mitem ${S.menuSel === id ? "on" : ""}" data-act="msel" data-id="${id}"><i>${ic}</i><span>${l}</span><small>${hint}</small></button>`;
  return `<div><div class="logo">${LOGO}SIMULACRA</div><div class="lead">Ein Dorf, in dem sich Menschen von selbst entwickeln.</div>
    <button class="resume" data-act="go" data-id="spiel"><b>▶ Fortsetzen</b><small>Dorf am See · Tag 3, 07:53 · Alex, Mira, Hanne · ◐ Leben</small>
      <span class="live"><span>Alex: angelt am Steg</span><span>Mira: spricht mit Alex</span></span></button>
    ${it("neu", "✦", "Neue Simulation", "Spielart, Welt, Bewohner")}${it("laden", "⤓", "Simulation laden", "Spielstände")}<div class="msep"></div>
    ${it("editoren", "✎", "Editoren", "Welten · Figuren · Bausteine")}${it("einstellungen", "⚙", "Einstellungen", "Darstellung, Ton, Modell, Regler")}</div>`;
}

function crumbs(S) {
  const parts = [S.menuSel, ...S.path];
  return `<div class="crumbs">${parts.map((p, i) => i === parts.length - 1 ? `<b>${LABEL[p]}</b>` : `<a data-act="crumb" data-n="${i}">${LABEL[p]}</a> ›`).join(" ")}
    <span class="esc"><kbd>Esc</kbd> ${parts.length > 1 ? `zurück zu ${LABEL[parts[parts.length - 2]]}` : "zurück zur Liste"}</span></div>`;
}

const tile = (img, title, text, act, id, extra = "") => `<button class="tile ${extra}" data-act="${act}" data-id="${id}"><div class="img" style="background-image:url(${img})"></div><div class="tx"><b>${title}</b><small>${text}</small></div></button>`;
const worldTile = (w, sel, actions) => `<div class="tile ${sel ? "on" : ""}" data-act="wsel" data-id="${w.id}" style="position:relative;cursor:pointer"><div class="img" style="background-image:url(${w.img})"></div>
  <div class="tx"><b>${w.name}</b>${w.live ? ' <small style="display:inline;color:var(--ok)">· läuft gerade</small>' : ""}<div class="meta">${w.meta.map((m) => `<span>${m}</span>`).join("")}</div></div>
  ${actions ? `<div class="wmenu"><button class="b" data-act="go" data-id="editor">${w.ro ? "Kopie bearbeiten" : "Öffnen"}</button><button class="b" title="Duplizieren, Umbenennen, Exportieren, Löschen">⋯</button></div>` : ""}</div>`;

const STEPS = ["Spielart", "Welt", "Bewohner", "Regeln", "Modell", "Start"];
const stepper = (n) => `<div class="steps">${STEPS.map((s, i) => `<span class="${i === n ? "on" : i < n ? "done" : ""}">${i < n ? "✓ " : ""}${s}</span>`).join("")}</div>`;

function paneNeu(S) {
  const top = S.path[S.path.length - 1];
  if (!top) return `<div class="pbody"><p class="dim" style="margin:4px 0 14px">Der bisherige Stand wird vorher als Spielstand gesichert, nicht gelöscht.</p><div class="tiles">
    ${tile(IMG + "start.jpg", "▶ Schnellstart", "Dorf am See mit Alex und Mira, Spielart Leben. Ein Klick, los geht’s.", "noop", "")}
    ${tile(IMG + "figuren.jpg", "✦ Neue Simulation einrichten", "Spielart, Welt, Bewohner, Regeln und Modell – Schritt für Schritt.", "push", "spielart")}
    ${tile(IMG + "haus.jpg", "⤓ Aus Spielstand", "Einen gespeicherten Stand laden und weiterspielen.", "msel", "laden")}</div></div>`;
  if (top === "spielart") return `<div class="pbody">${stepper(0)}<div class="modes">
    <button class="modecard ${S.pick !== "gott" ? "on" : ""}" data-act="pick" data-id="leben"><div class="img" style="background-image:url(rework/img/dorf-tiefe.jpg)"><em style="color:var(--mira)">◐ Leben</em></div><div class="tx">
      Die Welt verändert sich <b>nur durch ihre Bewohner</b> – mit dem, was das Spiel hergibt: bauen, pflanzen, Wege anlegen, Dinge benutzen.
      <ul><li>zuschauen, Zeit steuern, alle Einblicke</li><li>mit eigener Figur: gehen, sprechen, benutzen, bauen</li><li class="no">keine Ereignisse von außen</li><li class="no">kein Gestalten von außen</li></ul>
      <label class="opt" onclick="event.stopPropagation()"><input type="checkbox" ${S.figur ? "checked" : ""} data-act="figur"><span><b>Mit eigener Figur mitleben</b><br><small>Du bist ein Bewohner unter Bewohnern. Die anderen halten dich für ihresgleichen.</small></span></label></div></button>
    <button class="modecard ${S.pick === "gott" ? "on" : ""}" data-act="pick" data-id="gott"><div class="img" style="background-image:url(rework/img/dorf-flach.jpg)"><em style="color:var(--acc2)">✦ Gott</em></div><div class="tx">
      Du stehst <b>außerhalb der Welt</b> und kannst sie jederzeit verändern. Die Bewohner merken nichts von dir.
      <ul><li>zuschauen, Zeit steuern, alle Einblicke</li><li>Ereignisse geschehen lassen (Gewitter, ein Fremder kommt …)</li><li>Gestalten: Wege, Seen, Häuser, Einrichtung (Zeit steht still)</li><li>Bewohner hinzufügen und bearbeiten</li></ul></div></button></div>
    <details style="margin-top:12px;font-size:12.5px"><summary class="dim">Erweitert: Was wissen die Bewohner über ihre Welt?</summary><div class="opt"><select><option>Nichts von einer äußeren Instanz (Standard)</option><option>Sie ahnen, dass es einen Schöpfer gibt (Text einstellbar)</option></select></div></details>
    <div class="foot"><button class="b" data-act="back">← Zurück</button><span class="sp"></span><small>Die Spielart gehört zum Spielstand. Wechseln später nur über Menü › Einstellungen › Spielart.</small><button class="b gold" data-act="push" data-id="welt">Weiter →</button></div></div>`;
  if (top === "welt") return `<div class="pbody">${stepper(1)}<div class="wtools"><b style="flex:1">Wähle eine Welt aus deiner Bibliothek</b><button class="b" data-act="push" data-id="erzeugen">✦ Neue Welt erzeugen</button><button class="b">＋ Leere Welt</button></div>
    <div class="tiles">${WORLDS.map((w) => worldTile(w, (S.wsel || "see") === w.id)).join("")}</div>
    <div class="foot"><button class="b" data-act="back">← Spielart</button><span class="sp"></span><small>Die Welt wird kopiert; die Bibliothek bleibt unverändert.</small><button class="b gold" data-act="push" data-id="bewohner">Weiter →</button></div></div>`;
  if (top === "erzeugen") return generatorPane(S, true);
  return `<div class="pbody">${stepper(2)}<p class="dim">Ab hier wie der Assistent aus AP17b (Bewohner, Beziehungen, Regeln, Modell, Start), nur im neuen Stil. Esc führt Schritt für Schritt zurück.</p>
    <div class="foot"><button class="b" data-act="back">← Welt</button><span class="sp"></span><button class="b gold">Weiter →</button></div></div>`;
}

function paneEditoren(S) {
  const top = S.path[S.path.length - 1];
  if (!top) return `<div class="pbody"><p class="dim" style="margin:4px 0 14px">Alles zum Gestalten an einem Ort. Editoren arbeiten an Dateien in deiner Bibliothek, nicht an der laufenden Simulation.</p><div class="tiles" style="grid-template-columns:1fr 1fr">
    ${tile(IMG + "welt.jpg", "▦ Welten", "Welten bauen, erzeugen, speichern und als Startwelt einer Simulation nutzen.", "push", "welten")}
    ${tile(IMG + "figuren.jpg", "☺ Figuren", "Vorlagen für Bewohner anlegen, bearbeiten, exportieren.", "noop", "")}
    ${tile(IMG + "haus.jpg", "⌂ Häuser und Gebäude <small style='display:inline;color:var(--plan)'>später</small>", "Eigene Häuser entwerfen: Form, Räume, Aussehen.", "noop", "", "")}
    ${tile(IMG + "ding.jpg", "◆ Dinge und Assets <small style='display:inline;color:var(--plan)'>später</small>", "Eigene Objekte zeichnen, mit Wirkungen.", "noop", "")}</div></div>`;
  if (top === "welten") return `<div class="pbody"><div class="wtools"><span class="dim" style="flex:1">${WORLDS.length} Welten · gespeichert als Dateien, unabhängig von Spielständen</span><button class="b">⤒ Importieren</button></div>
    <div class="tiles"><button class="tile add" data-act="push" data-id="leer"><span>＋</span><b>Leere Welt</b><small>Nur Wiese – alles selbst setzen.</small></button>
      <button class="tile add" data-act="push" data-id="erzeugen"><span>✦</span><b>Welt erzeugen</b><small>Mit Seed und Stellgrößen, danach frei weiterbauen.</small></button>
      ${WORLDS.map((w) => worldTile(w, false, true)).join("")}</div></div>`;
  if (top === "leer") return `<div class="pbody"><div class="form"><label>Name<input value="Neue Welt"></label>
      <label>Größe<span class="seg" style="width:max-content"><button>Klein · 48 × 32</button><button class="on">Mittel · 96 × 60</button><button>Groß · 128 × 80</button></span></label>
      <label>Rand<select><option>Wald ringsum (wie im Startdorf)</option><option>Offene Wiese</option><option>Am Wasser (Seeufer im Osten)</option></select></label>
      <small>Eine leere Welt hat noch keinen Startplatz. Den setzt du im Editor mit „Dorfplatz“; ohne ihn lässt sie sich speichern, aber nicht als Simulation starten.</small></div>
    <div class="foot"><button class="b" data-act="back">← Welten</button><span class="sp"></span><button class="b gold" data-act="go" data-id="editor">Anlegen und öffnen</button></div></div>`;
  if (top === "erzeugen") return generatorPane(S, false);
  return "";
}

function renderMenu(S) {
  const body = S.menuSel === "neu" ? paneNeu(S) : S.menuSel === "editoren" ? paneEditoren(S)
    : `<div class="pbody"><p class="dim">Wie bisher (${LABEL[S.menuSel]}). ${S.menuSel === "einstellungen" ? "Neu: Bereich „Darstellung“ mit Tiefe/Flach (Taste V) und „Spielart“; die Einstellungen öffnen sich nur noch hier, nicht mehr als Schublade im Spiel." : ""}</p></div>`;
  const wide = S.path.includes("erzeugen");
  return `<div class="menu" style="${wide ? "grid-template-columns:300px minmax(0,1fr)" : ""}">${menuList(S)}<div style="min-width:0"><section class="pane">${crumbs(S)}${body}</section></div>
    <div class="keys"><span><kbd>↑</kbd> <kbd>↓</kbd> wählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> eine Ebene zurück</span></div></div>`;
}
