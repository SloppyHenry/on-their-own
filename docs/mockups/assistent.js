// Mockup AP17b: Assistent „Neue Simulation“ und Charaktereditor. Nur Beispielverhalten im Browser, nichts davon läuft im Spiel.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STEPS = ['Welt', 'Bewohner', 'Regeln', 'Modell', 'Start'];
const DEF_REL = { trust: 50, sympathy: 50, tension: 10, familiarity: 30 }, REL_LABEL = { trust: 'Vertrauen', sympathy: 'Sympathie', tension: 'Spannung', familiarity: 'Vertrautheit' };
const CREATOR = 'Du weißt, dass diese Welt und ihre Bewohner von jemandem außerhalb geschaffen wurden, der gelegentlich zusieht und die Welt verändern kann. Du darfst darüber nachdenken oder davon erzählen, musst es aber nicht.';
const PLACES = [['square', 'Dorfplatz', 1], ['garden', 'Garten', 1], ['rooms', 'Gemeinschaftsräume (Werkstatt, Küche)', 1], ['lake', 'See', 0], ['forest', 'Wald', 0]];
const S = { step: 0, world: { kind: 'start', seed: 31, lake: 'auto', houses: null, shop: 1, workshop: 1, barn: 0, stable: 0 }, n: 2, sel: 0, residents: [], pair: null, dice: { seed: 7, n: 0 },
  preset: '', autonomy: 50, scarcity: 0, rules: '', mode: 'observer', ctext: CREATOR, model: MODELS[0], run: 'paused', rulesPreview: null };
const blank = (name) => ({ tpl: '', home: '', known: Object.fromEntries(PLACES.map(([k, , v]) => [k, !!v])), profile: { name, gender: 'divers', age: 30, description: '', background: '', interests: [], dislikes: [], goals: [], communication_style: '' }, personality: Object.fromEntries(KEYS.map((k) => [k, 50])) });
const fromTpl = (t) => ({ ...blank(''), tpl: t.id, profile: clone(t.profile), personality: clone(t.personality) });
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (el.style.display = 'none'), 3200); };
const houseCount = () => S.world.houses ?? Math.ceil(S.n / 2);
const world = () => S.world;

function setN(n) {
  S.n = Math.max(1, Math.min(world().kind === 'start' ? 2 : MAX_RESIDENTS, n));
  while (S.residents.length < S.n) { const t = TEMPLATES[S.residents.length]; S.residents.push(t ? fromTpl(t) : blank('Neu ' + (S.residents.length + 1))); }
  S.residents.length = S.n; S.sel = Math.min(S.sel, S.n - 1); S.pair = null;
}
const resident = (i) => S.residents[i];
const key = (i, j) => i + '>' + j;
S.rel = {}; S.story = {};
const rel = (i, j) => (S.rel[key(i, j)] ??= { ...DEF_REL });

// ---- Maske (gleich im Assistenten und im Charaktereditor) ------------------------------------------------------------------
function field(label, inner, k, limit) {
  return `<label class="f">${label}${limit ? ` <span class="cnt" data-c="${k}" data-l="${limit}"></span>` : ''}${inner}</label>`;
}
function maskHTML(r, { home } = {}) {
  const p = r.profile, v = (k) => esc(p[k]), list = (k) => esc(p[k].join(', '));
  return `<div class="mask">
    <div class="g3">${field('Name', `<input data-k="name" value="${v('name')}">`, 'name', LIM.name)}
      <label class="f">Geschlecht<select data-k="gender">${['männlich', 'weiblich', 'divers'].map((g) => `<option${g === p.gender ? ' selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="f">Alter<input type="number" min="0" max="120" data-k="age" value="${p.age}"></label></div>
    ${field('Beschreibung (wie die Figur ist)', `<textarea data-k="description" rows="3">${v('description')}</textarea>`, 'description', LIM.text)}
    ${field('Hintergrund (Vorgeschichte der Figur)', `<textarea data-k="background" rows="3">${v('background')}</textarea>`, 'background', LIM.text)}
    <div class="g2">${field('Interessen (mit Komma trennen)', `<input data-l="interests" value="${list('interests')}">`, 'interests', 0)}
      ${field('Abneigungen', `<input data-l="dislikes" value="${list('dislikes')}">`, 'dislikes', 0)}</div>
    <div class="g2">${field('Ziele (höchstens 3)', `<input data-l="goals" value="${list('goals')}">`, 'goals', 0)}
      ${field('Kommunikationsstil', `<input data-k="communication_style" value="${v('communication_style')}">`, 'communication_style', LIM.style)}</div>
    <div class="warn" data-warn></div>
    <h4>Persönlichkeit <small>0 = gar nicht, 100 = sehr</small></h4>
    <div class="sliders">${KEYS.map((k) => `<label class="sl"><span>${LABELS[k]}</span><input type="range" min="0" max="100" data-p="${k}" value="${r.personality[k]}"><b data-pv="${k}">${r.personality[k]}</b></label>`).join('')}</div>
    <div class="g2 sub"><div><h4>Bekannte Orte zu Beginn</h4><div class="chips">${PLACES.map(([k, n]) => `<label class="chip"><input type="checkbox" data-known="${k}"${r.known[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div>
      <small>Was nicht angehakt ist, erkunden die Bewohner selbst.</small></div>
      <div><h4>Stimme und Aussehen</h4><div class="chips"><span class="chip">♪ Stimme: aus AP17d <button class="mini" type="button">einstellen …</button></span><span class="chip look"><i style="background:${hue(r.profile.name, 55)}"></i><i style="background:${hue(r.profile.name + 'x', 70)}"></i> Aussehen: automatisch aus der Kennung</span></div>
      <small>Der Avatar-Editor folgt später und hängt sich hier ein.</small></div></div>
    ${home ? `<div class="live"><h4>Wohnen</h4><label class="f">Wohnt schon in<select data-home>${home}</select></label>
      <small>Ohne Angabe sucht sich der Bewohner selbst eine Bleibe: Wer sich in ein freies Bett legt, dem gehört es. Es gibt keine Zuteilung von außen.</small></div>` : ''}
  </div>`;
}
const hue = (s, l) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 45% ${l}%)`; };

function refresh(root, r) {
  const p = r.profile;
  $$('[data-c]', root).forEach((el) => { const k = el.dataset.c, n = k === 'name' || k === 'communication_style' || k === 'description' || k === 'background' ? p[k].length : 0; el.textContent = `${n}/${el.dataset.l}`; el.className = 'cnt' + (n > +el.dataset.l ? ' bad' : ''); });
  $$('[data-pv]', root).forEach((el) => (el.textContent = r.personality[el.dataset.pv]));
  const hits = [['Beschreibung', p.description], ['Hintergrund', p.background], ['Ziele', p.goals.join(' ')], ['Stil', p.communication_style], ['Interessen', p.interests.join(' ')], ['Abneigungen', p.dislikes.join(' ')]].flatMap(([n, t]) => metaHits(t).map((w) => `„${w}“ in ${n}`));
  const over = profileChars(p) > LIM.total ? [`Alle Texte zusammen: ${profileChars(p)} von ${LIM.total} Zeichen (Token-Budget des festen Prompt-Teils).`] : [];
  const w = $('[data-warn]', root);
  w.innerHTML = [...hits.map((h) => `<div>⚠ ${esc(h)}: Bewohner kennen keine Spieler, Leitstelle oder Simulation. Bitte umformulieren, wenn es nicht Teil der Figur ist.</div>`), ...over.map((o) => `<div>⚠ ${esc(o)}</div>`)].join('');
  w.style.display = w.innerHTML ? 'block' : 'none';
}
function bindMask(root, r, onChange) {
  const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  root.oninput = root.onchange = (e) => {
    const t = e.target, p = r.profile;
    if (t.dataset.k) p[t.dataset.k] = t.type === 'number' ? Math.max(0, Math.min(120, +t.value || 0)) : t.value;
    else if (t.dataset.l) p[t.dataset.l] = split(t.value);
    else if (t.dataset.p) r.personality[t.dataset.p] = +t.value;
    else if (t.dataset.known) r.known[t.dataset.known] = t.checked;
    else if (t.hasAttribute('data-home')) r.home = t.value;
    refresh(root, r); onChange?.(t);
  };
  refresh(root, r);
}
const dice = (r, kind = 'all') => {
  S.dice.n += 1; const R = rng(S.dice.seed * 1000 + S.dice.n), mid = 35 + Math.floor(R() * 30);
  r.profile.name = DICE_NAMES[Math.floor(R() * DICE_NAMES.length)]; r.profile.age = 20 + Math.floor(R() * 50);
  KEYS.forEach((k) => (r.personality[k] = Math.max(5, Math.min(95, mid - 35 + Math.floor(R() * 70)))));
  return r;
};

// ---- Assistent ------------------------------------------------------------------------------------------------------------------
const stepper = () => `<ol class="steps">${STEPS.map((s, i) => `<li class="${i === S.step ? 'on' : i < S.step ? 'done' : ''}"><button data-go="${i}"><i>${i < S.step ? '✓' : i + 1}</i>${s}</button></li>`).join('')}</ol>`;
const stepWorld = () => {
  const w = world(), g = w.kind === 'gen', h = houseCount(), beds = h * 2;
  const mixRow = ([k, n]) => `<label class="f inl">${n}<span class="num"><button class="mini" data-mix="${k}-">−</button><b>${w[k]}</b><button class="mini" data-mix="${k}+">+</button></span></label>`;
  return `<h2>Welt</h2><p class="lead">Wo die Simulation spielt. Für die Bewohner ist das Dorf „schon immer da“.</p>
  <div class="modes3">
    <div class="mode" role="button" tabindex="0" data-world="start" aria-pressed="${!g}"><b>Startwelt</b><small>Das bekannte Dorf am See mit Heimhaus: Zimmer Alex, Zimmer Mira, Werkstatt, Küche, Wohnzimmer. Nur mit Alex und Mira (1–2 Bewohner).</small></div>
    <div class="mode" role="button" tabindex="0" data-world="gen" aria-pressed="${g}"><b>Neues Dorf erzeugen</b><small>Seed, Seeufer, Gebäudemix; Häuser wachsen mit den Bewohnern. Für 1 bis 8 Bewohner und alle Vorlagen.</small></div>
    <div class="mode off" aria-disabled="true"><b>Selbst gestalten <span class="tag">später</span></b><small>Eigenes Dorf bauen (Paket Gestalten, AP16).</small></div>
  </div>
  <div class="split">
    <div>${g ? `<div class="card"><h3>Wunsch</h3>
      <div class="row"><label class="f">Seed (gleicher Seed, gleiches Dorf)<input data-seed type="number" value="${w.seed}"></label><button data-seedroll>Würfeln</button></div>
      <div class="row"><span class="dim">Ufer des Sees</span><span class="seg">${[['auto', 'Nach Zufall'], ['east', 'Osten'], ['south', 'Süden']].map(([k, n]) => `<button data-lake="${k}" class="${w.lake === k ? 'on' : ''}">${n}</button>`).join('')}</span></div>
      <h3 style="margin-top:12px">Gebäude</h3>
      <label class="f inl">Wohnhäuser<span class="num"><button class="mini" data-mix="houses-">−</button><b>${h}</b><button class="mini" data-mix="houses+">+</button></span><span class="dim">${w.houses == null ? 'automatisch: ' + S.n + ' Bewohner ÷ 2, aufgerundet' : 'von Hand'} ${w.houses != null ? '<button class="mini" data-mix="auto">automatisch</button>' : ''}</span></label>
      ${[['shop', 'Läden'], ['workshop', 'Werkstätten'], ['barn', 'Scheunen'], ['stable', 'Ställe']].map(mixRow).join('')}
      <small>Höchstens 2 Personen je Haus, jedes Haus mit 2 Betten ohne Besitzer. Das größere Haus mit mehr Zimmern kommt als eigener Baustein später.</small></div>
      <div class="card"><h3>Häuser und Betten (Vorschau)</h3><div class="chips">${Array.from({ length: h }, (_, i) => `<span class="chip">⌂ Haus ${i + 1} · 2 Betten</span>`).join('')}</div>
      <p class="${beds < S.n ? 'bad' : 'dim'}" style="margin:8px 0 0">${beds} Betten für ${S.n} Bewohner${beds < S.n ? ': zu wenig, bitte ein Haus mehr.' : '. Wer wo wohnt, entscheiden die Bewohner selbst.'}</p></div>`
      : `<div class="card"><h3>Startwelt</h3><p class="dim" style="margin:0">Die Startwelt bleibt, wie sie ist (Heimhaus, feste Zimmer, Goldbild). Mit mehr als zwei Bewohnern oder anderen Vorlagen als Alex und Mira bitte „Neues Dorf erzeugen“ wählen.</p></div>`}</div>
    <div class="prev"><img src="${g ? '../../frontend/public/menue/dorf.jpg' : '../../frontend/public/menue/start.jpg'}" alt="Vorschau"><div class="veil"></div>
      <div class="cap">${g ? 'Vorschau unter dem Schleier wie in AP12c (Bild: Seed 31). ' + h + (h === 1 ? ' Wohnhaus, ' : ' Wohnhäuser, ') + (w.shop + w.workshop + w.barn + w.stable) + ' Sondergebäude.' : 'Startwelt: Dorf am See'}<br><small>Prüfbericht: 15 von 15 bestanden · die Welt wird erst beim Start angelegt</small></div></div>
  </div>`;
};
const homeOptions = (i) => {
  const h = houseCount(), taken = (k) => S.residents.filter((r, j) => j !== i && r.home === String(k)).length;
  if (world().kind === 'start') return '<option value="">offen: sucht sich selbst eine Bleibe</option><option value="heim">Heimhaus (Zimmer Alex / Zimmer Mira)</option>';
  return '<option value="">offen: sucht sich selbst eine Bleibe</option>' + Array.from({ length: h }, (_, k) => `<option value="${k + 1}" ${taken(k + 1) >= 2 ? 'disabled' : ''}${resident(i).home === String(k + 1) ? ' selected' : ''}>Haus ${k + 1}${taken(k + 1) >= 2 ? ' (voll)' : ''}</option>`).join('');
};
const stepResidents = () => {
  const sec = S.n * SECONDS_PER_DECISION, bad = world().kind === 'start' && S.residents.some((r) => !['alex', 'mira'].includes(r.tpl));
  return `<h2>Bewohner</h2><p class="lead">Wer im Dorf lebt. Jede Figur ist ein gewöhnlicher Bewohner; die Maske ist dieselbe wie im Charaktereditor.</p>
  <div class="card"><div class="row" style="margin:0"><span>Anzahl</span><span class="num"><button class="mini" data-n="-1">−</button><b id="nn">${S.n}</b><button class="mini" data-n="1">+</button></span><small class="dim">1 bis ${MAX_RESIDENTS}${world().kind === 'start' ? ' (Startwelt: 2)' : ''}</small>
    <span class="sp"></span><span class="tempo ${S.n > 4 ? 'slow' : ''}">⏱ Eine Runde (jeder entscheidet einmal): etwa <b>${sec.toFixed(1).replace('.', ',')} s</b> bei einem Modell-Slot</span></div>
    <div class="bar"><i style="width:${(S.n / MAX_RESIDENTS) * 100}%"></i></div>
    <small class="dim">Jeder Bewohner kostet Modellzeit (heute ca. ${SECONDS_PER_DECISION.toString().replace('.', ',')} s je Entscheidung). Mit mehr Bewohnern läuft die Welt entsprechend langsamer.</small>
    ${bad ? '<p class="bad" style="margin:8px 0 0">Die Startwelt hat Zimmer nur für Alex und Mira. Für andere Vorlagen bitte „Neues Dorf erzeugen“ wählen.</p>' : ''}</div>
  <div class="tabs">${S.residents.map((r, i) => `<button data-sel="${i}" class="${i === S.sel ? 'on' : ''}">${esc(r.profile.name || 'Neu')}</button>`).join('')}</div>
  <div class="card"><div class="row"><label class="f inl">Vorlage<select data-tpl>${'<option value="">Leer (selbst schreiben)</option>' + TEMPLATES.concat(CUSTOM).map((t) => `<option value="${t.id}"${resident(S.sel).tpl === t.id ? ' selected' : ''}>${esc(t.profile.name)}${t.lock ? '' : ' (eigene)'}</option>`).join('')}</select></label>
    <button data-dice>🎲 Würfeln (Name, Alter, Werte)</button><label class="f inl">Seed<input type="number" data-dseed value="${S.dice.seed}" style="width:80px"></label><small class="dim">Wurf ${S.dice.n}: derselbe Seed und dieselbe Nummer ergeben dasselbe.</small><span class="sp"></span><button data-savetpl>Als Vorlage speichern</button></div>
    <div id="mask"></div></div>
  <div class="card"><h3>Beziehungen zueinander</h3>${S.n < 2 ? '<p class="dim">Mit einem Bewohner gibt es keine Beziehungen.</p>' : `<p class="dim" style="margin-top:0">Startwerte je Richtung (Standard 50 · 50 · 10 · 30). Ein Klick öffnet das Paar. Die Vorgeschichte wird beim Start bei beiden zu einer gewöhnlichen Erinnerung.</p>${matrix()}<div id="pair"></div>`}</div>`;
};
function matrix() {
  const n = S.n;
  return `<table class="mx"><tr><th></th>${S.residents.map((r) => `<th>${esc(r.profile.name)}</th>`).join('')}</tr>${S.residents.map((a, i) => `<tr><th>${esc(a.profile.name)}</th>${S.residents.map((b, j) => {
    if (i === j) return '<td class="self">·</td>';
    const x = rel(i, j), ch = KEYS_R.some((k) => x[k] !== DEF_REL[k]) || S.story[pairKey(i, j)];
    return `<td><button data-pair="${i},${j}" class="${ch ? 'chg' : ''} ${S.pair && ((S.pair[0] === i && S.pair[1] === j) || (S.pair[0] === j && S.pair[1] === i)) ? 'on' : ''}" style="--s:${x.sympathy}"><span>S ${x.sympathy}</span><small>V ${x.trust} · Sp ${x.tension} · Vt ${x.familiarity}</small></button></td>`;
  }).join('')}</tr>`).join('')}</table><small class="dim">S Sympathie · V Vertrauen · Sp Spannung · Vt Vertrautheit (Zeile → Spalte)</small>`;
}
const KEYS_R = Object.keys(DEF_REL), pairKey = (i, j) => Math.min(i, j) + '-' + Math.max(i, j);
function pairPanel() {
  if (!S.pair) return '';
  const [i, j] = S.pair, a = resident(i).profile.name, b = resident(j).profile.name, k = pairKey(i, j), st = S.story[k] || '';
  const dir = (x, y, nx, ny) => `<div><h4>${esc(nx)} → ${esc(ny)}</h4>${KEYS_R.map((m) => `<label class="sl"><span>${REL_LABEL[m]}</span><input type="range" min="0" max="100" data-rel="${x},${y},${m}" value="${rel(x, y)[m]}"><b>${rel(x, y)[m]}</b></label>`).join('')}</div>`;
  const hits = metaHits(st);
  return `<div class="pairbox"><div class="g2">${dir(i, j, a, b)}${dir(j, i, b, a)}</div>
    <label class="f">Vorgeschichte von ${esc(a)} und ${esc(b)} <span class="cnt ${st.length > LIM.story ? 'bad' : ''}">${st.length}/${LIM.story}</span><textarea data-story="${k}" rows="2" placeholder="z. B. Wir kennen uns seit dem letzten Frühling, als …">${esc(st)}</textarea></label>
    <div class="row"><button data-suggest>Formulierung vorschlagen</button><button data-reldice>🎲 Würfeln (±20)</button><button data-relreset>Auf Standard</button>
    <small class="dim">Wird zu einer Erinnerung der Art Fakt bei beiden, geschrieben wie gelebtes Wissen.</small></div>
    ${hits.length ? `<div class="warn" style="display:block">⚠ ${hits.map((h) => `„${esc(h)}“`).join(', ')}: Bewohner kennen keine Spieler, Leitstelle oder Simulation.</div>` : ''}</div>`;
}
const stepRules = () => {
  const m = [['observer', 'Beobachter', 'Die Bewohner erfahren nichts von außen. Standard.'], ['creator', 'Schöpfer', 'Die Bewohner wissen, dass jemand die Welt geschaffen hat und zusieht.'], ['intervention', 'Eingriff', 'Wie Beobachter; direkte Nachrichten an einzelne Bewohner sind möglich.']];
  return `<h2>Regeln</h2><p class="lead">Wie sich die Welt verhält. Alles hier lässt sich im Spiel in den Einstellungen wieder ändern, nur der Beobachtungsmodus nicht.</p>
  <div class="card"><h3>Preset</h3><div class="presets">${PRESETS.map(([id, n, d]) => `<div class="mode" role="button" tabindex="0" data-preset="${id}" aria-pressed="${S.preset === id}"><b>${n}</b><small>${d}</small></div>`).join('')}</div></div>
  <div class="card"><h3>Feineinstellung</h3><label class="sl wide"><span>Autonomie (50 = unverändert)</span><input type="range" min="0" max="100" data-g="autonomy" value="${S.autonomy}"><b>${S.autonomy}</b></label>
    <label class="sl wide"><span>Knappheit der Ressourcen</span><input type="range" min="0" max="100" data-g="scarcity" value="${S.scarcity}"><b>${S.scarcity} %</b></label></div>
  <div class="card"><h3>Weltregeln als Text <small>(werden zu Startereignissen)</small></h3>
    <textarea data-rules rows="3" placeholder="z. B. Es herrscht Dürre. Ein Fremder zieht in der ersten Woche ins Dorf.">${esc(S.rules)}</textarea>
    <div class="row"><button data-prev>Vorschau erstellen</button><small class="dim">Dieselbe Ereigniseingabe wie im Spiel (AP08): Vorschau und Klärfragen; ausgeführt wird erst beim Start.</small></div>${S.rulesPreview || ''}</div>
  <div class="card"><h3>Beobachtungsmodus</h3><div class="modes3">${m.map(([k, n, d]) => `<div class="mode" role="button" tabindex="0" data-mode="${k}" aria-pressed="${S.mode === k}"><b>${n}</b><small>${d}</small></div>`).join('')}</div>
    ${S.mode === 'creator' ? `<label class="f">Text für den Schöpfermodus <span class="cnt">${S.ctext.length}/600</span><textarea data-ctext rows="3">${esc(S.ctext)}</textarea></label>` : ''}
    <small class="dim">Im Spiel nur im Editor-Modus änderbar (die Zeit steht still). Eine Änderung gilt ab der nächsten Entscheidung und hinterlässt keine Erinnerung.</small></div>`;
};
function previewRules() {
  const t = S.rules.toLowerCase(), ops = [];
  if (!S.rules.trim()) return '<p class="dim">Nichts eingegeben.</p>';
  if (/dürre|trocken/.test(t)) ops.push('Wetter: klar, 5 Tage', 'Quellen: Nachwuchs × 0,5, 5 Tage (wird danach genau zurückgenommen)');
  if (/regen/.test(t)) ops.push('Wetter: Regen, am ersten Tag');
  if (/fremde/.test(t)) ops.push('Nebenfigur zieht ein: erscheint am Dorfplatz, bleibt 2 Tage');
  const ask = /im haus/.test(t);
  return `<div class="pv"><b>Vorschau</b>${ops.length ? `<ul>${ops.map((o) => `<li>${o}</li>`).join('')}</ul>` : '<p class="dim">Keine sichere Regel erkannt. Das Sprachmodell deutet den Satz, und die Vorschau bleibt Pflicht.</p>'}
    ${ask ? `<div class="ask"><b>Rückfrage:</b> Welches Haus meinst du? ${Array.from({ length: houseCount() }, (_, i) => `<button class="mini">Haus ${i + 1}</button>`).join(' ')}</div>` : ''}
    <small class="dim">Die Bewohner erleben das als natürliche Vorgänge, nicht als Regel.</small></div>`;
}
const stepModel = () => `<h2>Modell</h2><p class="lead">Das Sprachmodell der Bewohner. Es gilt fest für diese Simulation (Frage 10); wer ein anderes will, legt eine neue an.</p>
  <div class="card"><label class="f">Modell<select data-model>${MODELS.map((m) => `<option${m === S.model ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
  <p class="dim" style="margin:8px 0 0">Die Modellverwaltung (Hardware, Katalog, Download) folgt mit AP17c-4 an dieser Stelle. Bis dahin steht hier die Modellliste des Servers wie im Dialog „Zurücksetzen“.</p></div>`;
const stepStart = () => {
  const names = S.residents.map((r) => r.profile.name).join(', '), warns = S.residents.flatMap((r) => [r.profile.description, r.profile.background, r.profile.goals.join(' ')].flatMap(metaHits)), edited = Object.keys(S.story).filter((k) => S.story[k]).length + Object.entries(S.rel).filter(([, v]) => KEYS_R.some((m) => v[m] !== DEF_REL[m])).length;
  const row = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`, preset = PRESETS.find((p) => p[0] === S.preset)[1];
  return `<h2>Start</h2><p class="lead">Alles auf einen Blick. Die bisherige Welt wird vorher als Spielstand „Vor der neuen Simulation“ gesichert, nicht gelöscht.</p>
  <div class="card"><dl class="sum">${row('Welt', world().kind === 'start' ? 'Startwelt (Dorf am See, Heimhaus)' : `Neues Dorf, Seed ${world().seed}, ${houseCount()} Wohnhäuser mit ${houseCount() * 2} Betten`)}
    ${row('Bewohner', `${S.n}: ${esc(names)}`)}${row('Beziehungen', edited ? `${edited} Angaben geändert` : 'alle auf Standard')}${row('Wohnen', S.residents.filter((r) => r.home).length ? S.residents.filter((r) => r.home).map((r) => `${esc(r.profile.name)} in ${r.home === 'heim' ? 'Heimhaus' : 'Haus ' + r.home}`).join(', ') + '; die übrigen suchen sich selbst eine Bleibe' : 'alle suchen sich selbst eine Bleibe')}
    ${row('Regeln', `${preset}, Autonomie ${S.autonomy}, Knappheit ${S.scarcity} %${S.rules.trim() ? ', Weltregeln als Startereignisse' : ''}`)}${row('Modus', { observer: 'Beobachter', creator: 'Schöpfer', intervention: 'Eingriff' }[S.mode])}${row('Modell', esc(S.model))}
    ${row('Tempo', `etwa ${(S.n * SECONDS_PER_DECISION).toFixed(1).replace('.', ',')} s je Runde`)}</dl></div>
  ${warns.length ? `<div class="warn" style="display:block">⚠ ${warns.length} Treffer der Wortprüfung (${[...new Set(warns)].map((w) => `„${esc(w)}“`).join(', ')}). Der Start ist trotzdem möglich.</div>` : ''}
  <div class="card"><label class="chip"><input type="radio" name="run" data-run="paused" ${S.run === 'paused' ? 'checked' : ''}> angehalten beginnen</label> <label class="chip"><input type="radio" name="run" data-run="running" ${S.run === 'running' ? 'checked' : ''}> sofort laufen lassen</label></div>`;
};
function renderWizard() {
  const body = [stepWorld, stepResidents, stepRules, stepModel, stepStart][S.step]();
  const last = S.step === STEPS.length - 1;
  $('#wizard').innerHTML = stepper() + `<div class="body">${body}</div><div class="nav"><button data-back ${S.step === 0 ? 'disabled' : ''}>← Zurück</button><span class="sp"></span><small class="dim">Der Entwurf bleibt in diesem Browser, bis er angelegt oder verworfen wird.</small><button data-discard>Entwurf verwerfen</button>
    ${last ? '<button class="on" data-create>Simulation anlegen …</button>' : '<button class="on" data-next>Weiter →</button>'}</div>`;
  if (S.step === 1) { const m = $('#mask'), r = resident(S.sel); m.innerHTML = maskHTML(r, { home: homeOptions(S.sel) }); bindMask(m, r, (t) => { if (t.dataset.k === 'name') $$('[data-sel]')[S.sel].textContent = r.profile.name || 'Neu'; if (t.hasAttribute('data-home')) renderWizard(); }); if (S.n > 1) $('#pair').innerHTML = pairPanel(); }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-world], [data-preset], [data-mode]'); if (!t || !$('#wizard').contains(t)) return;
  const d = t.dataset, w = world();
  if (d.go !== undefined) S.step = +d.go; else if (t.hasAttribute('data-next')) S.step++; else if (t.hasAttribute('data-back')) S.step--;
  else if (d.world) { w.kind = d.world; setN(w.kind === 'start' && S.n > 2 ? 2 : S.n); if (w.kind === 'start') S.residents.forEach((r, i) => i < 2 && !['alex', 'mira'].includes(r.tpl) && (S.residents[i] = fromTpl(TEMPLATES[i]))); }
  else if (d.lake) w.lake = d.lake; else if (d.mix) { const [k, op] = d.mix === 'auto' ? ['houses', 'auto'] : [d.mix.slice(0, -1), d.mix.slice(-1)]; if (op === 'auto') w.houses = null; else { const cur = k === 'houses' ? houseCount() : w[k], nv = Math.max(k === 'houses' ? 1 : 0, Math.min(6, cur + (op === '+' ? 1 : -1))); if (k === 'houses') w.houses = nv; else w[k] = nv; } }
  else if (t.hasAttribute('data-seedroll')) w.seed = 1 + Math.floor(Math.random() * 99999);
  else if (d.n) { setN(S.n + +d.n); } else if (d.sel !== undefined) { S.sel = +d.sel; S.pair = null; }
  else if (t.hasAttribute('data-dice')) dice(resident(S.sel)); else if (d.pair) S.pair = d.pair.split(',').map(Number);
  else if (t.hasAttribute('data-suggest')) { const [i, j] = S.pair; S.story[pairKey(i, j)] = `${resident(i).profile.name} und ${resident(j).profile.name} kennen sich seit dem letzten Frühling.`; }
  else if (t.hasAttribute('data-reldice')) { const [i, j] = S.pair, R = rng(S.dice.seed + i * 10 + j + (S.dice.n += 1)); [[i, j], [j, i]].forEach(([x, y]) => KEYS_R.forEach((m) => (rel(x, y)[m] = Math.max(0, Math.min(100, DEF_REL[m] + Math.floor(R() * 41) - 20))))); }
  else if (t.hasAttribute('data-relreset')) { const [i, j] = S.pair; delete S.rel[key(i, j)]; delete S.rel[key(j, i)]; delete S.story[pairKey(i, j)]; }
  else if (d.preset !== undefined) S.preset = d.preset; else if (d.mode) S.mode = d.mode;
  else if (t.hasAttribute('data-prev')) S.rulesPreview = previewRules();
  else if (t.hasAttribute('data-savetpl')) { const r = resident(S.sel), id = 'eigene-' + (CUSTOM.length + 1); CUSTOM.push({ id, lock: false, profile: clone(r.profile), personality: clone(r.personality) }); toast(`„${r.profile.name}“ als Vorlage gespeichert (im Charaktereditor zu finden).`); }
  else if (t.hasAttribute('data-discard')) { location.reload(); return; } else if (t.hasAttribute('data-create')) { $('#ask').classList.add('on'); return; }
  else return;
  renderWizard();
});
document.addEventListener('input', (e) => {
  const t = e.target, d = t.dataset; if (!$('#wizard').contains(t)) return;
  if (d.seed !== undefined) { world().seed = +t.value || 0; $('.cap')?.classList.add('stale'); }
  else if (d.dseed !== undefined) S.dice.seed = +t.value || 0;
  else if (d.rel) { const [i, j, m] = d.rel.split(','); rel(+i, +j)[m] = +t.value; t.nextElementSibling.textContent = t.value; $('#wizard .mx').outerHTML = matrix(); }
  else if (d.story) { S.story[d.story] = t.value; $('#pair').innerHTML = pairPanel(); const a = $('[data-story]'); a.focus(); a.setSelectionRange(a.value.length, a.value.length); }
  else if (d.g) { S[d.g] = +t.value; t.nextElementSibling.textContent = t.value + (d.g === 'scarcity' ? ' %' : ''); }
  else if (d.rules !== undefined) S.rules = t.value; else if (d.ctext !== undefined) S.ctext = t.value; else if (d.model !== undefined) S.model = t.value;
  else if (d.run) S.run = d.run;
});
document.addEventListener('change', (e) => {
  const t = e.target; if (!$('#wizard').contains(t)) return;
  if (t.hasAttribute('data-tpl')) { const tp = TEMPLATES.concat(CUSTOM).find((x) => x.id === t.value); S.residents[S.sel] = tp ? fromTpl(tp) : blank('Neu'); S.residents[S.sel].home = ''; renderWizard(); }
  if (t.dataset.run) S.run = t.dataset.run;
});
$('#a-no').onclick = () => $('#ask').classList.remove('on');
$('#a-word').oninput = (e) => ($('#a-yes').disabled = e.target.value.trim().toLowerCase() !== 'neu starten');
$('#a-yes').onclick = () => { $('#ask').classList.remove('on'); toast('Mockup: hier würde die Simulation angelegt (alte Welt gesichert, ' + (S.run === 'paused' ? 'angehalten' : 'laufend') + ').'); };

// ---- Charaktereditor ---------------------------------------------------------------------------------------------------------
const CUSTOM = []; let edSel = 'alex', edDraft = null;
const edList = () => TEMPLATES.concat(CUSTOM);
function renderEditor() {
  const cur = edList().find((t) => t.id === edSel) || TEMPLATES[0], ro = cur.lock;
  edDraft = { ...fromTpl(cur) };
  $('#ed-list').innerHTML = edList().map((t) => `<button data-ed="${t.id}" class="${t.id === cur.id ? 'on' : ''}"><b>${esc(t.profile.name)}</b><small>${t.profile.age} · ${t.profile.gender}</small>${t.lock ? '<span class="tag">mitgeliefert</span>' : '<span class="tag good">eigene</span>'}</button>`).join('');
  $('#ed-head').innerHTML = `<h2>${esc(cur.profile.name)} ${ro ? '<span class="tag">schreibgeschützt</span>' : ''}</h2><div class="row"><button data-act="dup">Duplizieren</button><button data-act="export">Exportieren (Datei)</button>${ro ? '' : '<button class="on" data-act="save">Speichern</button><button data-act="del">Löschen</button>'}</div>`;
  const m = $('#ed-mask'); m.innerHTML = maskHTML(edDraft); bindMask(m, edDraft);
  if (ro) $$('input, textarea, select, button', m).forEach((x) => (x.disabled = true));
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('#v-editor button'); if (!t) return;
  const a = t.dataset.act;
  if (t.dataset.ed) { edSel = t.dataset.ed; renderEditor(); }
  else if (t.id === 'ed-new') { const id = 'eigene-' + (CUSTOM.length + 1); CUSTOM.push({ id, lock: false, profile: blank('Neu').profile, personality: blank('').personality }); edSel = id; renderEditor(); }
  else if (a === 'dup') { const src = edList().find((x) => x.id === edSel), id = 'eigene-' + (CUSTOM.length + 1); CUSTOM.push({ id, lock: false, profile: { ...clone(src.profile), name: src.profile.name + ' (Kopie)' }, personality: clone(src.personality) }); edSel = id; renderEditor(); toast('Kopie angelegt.'); }
  else if (a === 'save') { const c = CUSTOM.find((x) => x.id === edSel); c.profile = edDraft.profile; c.personality = edDraft.personality; renderEditor(); toast('Vorlage gespeichert.'); }
  else if (a === 'del') { CUSTOM.splice(CUSTOM.findIndex((x) => x.id === edSel), 1); edSel = 'alex'; renderEditor(); }
  else if (a === 'export') { const d = { format: 'simulacra-vorlage', version: 1, profile: edDraft.profile, personality: edDraft.personality }, u = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })), l = Object.assign(document.createElement('a'), { href: u, download: `vorlage-${edDraft.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json` }); l.click(); URL.revokeObjectURL(u); }
  else if (t.id === 'ed-import-bad') showImport(validate({ format: 'simulacra-vorlage', version: 2, profile: { name: 'Ein sehr langer Name, der nicht in das Feld passt', gender: 'unbekannt', age: 150, description: 'x'.repeat(700), background: '', interests: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], dislikes: [], goals: [], communication_style: '' }, personality: { sociability: 120 } }), 'Beispieldatei mit Fehlern');
});
$('#ed-file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 20000) return showImport(['Die Datei ist größer als 20 KB.'], f.name);
  let d; try { d = JSON.parse(await f.text()); } catch (x) { return showImport(['Die Datei ist kein gültiges JSON: ' + x.message], f.name); }
  const errs = validate(d); showImport(errs, f.name);
  if (!errs.length) { const id = 'eigene-' + (CUSTOM.length + 1); CUSTOM.push({ id, lock: false, profile: d.profile, personality: d.personality }); edSel = id; renderEditor(); }
  e.target.value = '';
};
function showImport(errs, name) { $('#ed-imp').innerHTML = errs.length ? `<div class="warn bad" style="display:block"><b>${esc(name)}: nicht importiert (${errs.length} ${errs.length === 1 ? 'Fehler' : 'Fehler'})</b><ul>${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : `<div class="ok">✓ ${esc(name)} importiert (nie über eine bestehende Vorlage geschrieben).</div>`; }

// ---- Reiter ------------------------------------------------------------------------------------------------------------------------
$$('#tabs button').forEach((b) => (b.onclick = () => { $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + b.dataset.v)); if (b.dataset.v === 'editor') renderEditor(); else renderWizard(); }));
setN(2); renderWizard();
