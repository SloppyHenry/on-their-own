// Mockup AP17b: Daten und Prüfungen. Alex und Mira stehen wörtlich wie in backend/simulacra/agents/defaults/*.json;
// Hanne, Jonas, Rosa und Kim sind die vier vorgeschlagenen neuen Vorlagen (Henry liest und ändert die Texte).
const LABELS = {
  sociability: 'Geselligkeit', curiosity: 'Neugier', helpfulness: 'Hilfsbereitschaft', risk_taking: 'Risikobereitschaft',
  conflict_readiness: 'Konfliktbereitschaft', cooperation: 'Kooperationsneigung', calm_need: 'Bedürfnis nach Ruhe',
  conversation_initiative: 'Gesprächsinitiative', suggestion_acceptance: 'Bereitschaft, Vorschläge anzunehmen',
  persistence: 'Zielpersistenz', spontaneity: 'Spontaneität', autonomy: 'Autonomie',
};
const KEYS = Object.keys(LABELS);
const MAX_RESIDENTS = 8, SECONDS_PER_DECISION = 4.5;            // Frage 32: bis 8 Bewohner; ca. 4,5 s je Entscheidung bei einem Slot
const LIM = { name: 24, text: 600, style: 160, item: 40, items: 8, goal: 120, goals: 3, story: 300, total: 2000 };
const META = /(?<![\p{L}])(spieler\p{L}*|nutzer\p{L}*|benutzer\p{L}*|leitstelle\p{L}*|simulation\p{L}*|editor\p{L}*|schöpfer\p{L}*|ki|sprachmodell\p{L}*|prompt\p{L}*)(?![\p{L}])/giu;

const P = (a, b, c, d, e, f, g, h, i, j, k, l) => Object.fromEntries(KEYS.map((key, n) => [key, [a, b, c, d, e, f, g, h, i, j, k, l][n]]));
const TEMPLATES = [
  { id: 'alex', lock: true, profile: { name: 'Alex', gender: 'männlich', age: 34,
    description: 'Ruhig, bedacht und handwerklich geschickt. Redet nicht viel, beobachtet genau und macht gern etwas mit den Händen. Mag frühe Morgen und Stille, Lärm und Hektik gehen ihm auf die Nerven.',
    background: 'War viele Jahre Zimmermann in der Stadt, bis er genug von Baustellenlärm und Termindruck hatte. Er ist in das Haus am See gezogen, um zur Ruhe zu kommen und etwas Eigenes zu schaffen.',
    interests: ['Holzarbeiten', 'Werkzeug', 'der Wald', 'Wetter beobachten'], dislikes: ['Lärm', 'Hektik', 'unfertige Arbeit'], goals: ['etwas Bleibendes bauen'],
    communication_style: 'knapp, trocken, gelegentlich ein leiser Scherz' }, personality: P(40, 70, 60, 35, 30, 55, 65, 35, 50, 70, 30, 65) },
  { id: 'mira', lock: true, profile: { name: 'Mira', gender: 'weiblich', age: 31,
    description: 'Warmherzig, lebhaft und gut organisiert. Sucht das Gespräch, stellt gern Fragen und bringt Ordnung in Dinge. Unordnung und liegengelassene Sachen stören sie.',
    background: 'Ist Botanikerin und hat lange in Gewächshäusern und Labors gearbeitet. Sie liebt Pflanzen, den Garten und das Wasser und will hier zeigen, dass man sich fast selbst versorgen kann.',
    interests: ['Pflanzen', 'Garten', 'der See', 'Geschichten', 'Gemeinschaft'], dislikes: ['Unordnung', 'Verschwendung', 'Streit'], goals: ['einen Garten anlegen, der das Haus versorgt'],
    communication_style: 'erzählend, herzlich, stellt oft Fragen' }, personality: P(80, 55, 70, 45, 35, 75, 35, 70, 60, 55, 60, 60) },
  { id: 'hanne', lock: true, profile: { name: 'Hanne', gender: 'weiblich', age: 62,
    description: 'Wettergegerbt, gelassen und sehr verlässlich. Sagt lieber einmal zu wenig als zu viel, hilft aber, ohne dass man fragen muss. Wird ungeduldig, wenn jemand ein Netz oder ein Boot schlecht behandelt.',
    background: 'Hat vierzig Jahre vom Fischfang gelebt, erst auf einem Kutter an der Küste, dann am See. Seit ihr Mann gestorben ist, lebt sie allein und kennt jede Strömung, jeden Wetterumschwung und jeden Steg.',
    interests: ['Fischen', 'Netze flicken', 'das Wetter', 'Kochen mit frischem Fang', 'alte Geschichten'], dislikes: ['Verschwendung', 'Prahlerei', 'schlampige Arbeit'], goals: ['das Boot instand halten', 'jemandem das Fischen beibringen'],
    communication_style: 'ruhig, bodenständig, erzählt gern in kurzen Geschichten' }, personality: P(55, 40, 75, 50, 45, 60, 70, 45, 40, 80, 25, 70) },
  { id: 'jonas', lock: true, profile: { name: 'Jonas', gender: 'männlich', age: 22,
    description: 'Neugierig, schnell begeistert und ein bisschen unordentlich. Probiert Dinge aus, bevor er die Anleitung gelesen hat, und lacht über seine eigenen Fehlschläge. Langes Stillsitzen macht ihn unruhig.',
    background: 'Hat gerade seine Gesellenprüfung als Schreiner bestanden und ist aufgebrochen, um zu sehen, wie andere arbeiten. Sein Werkzeugkasten ist alt und gehörte seinem Großvater.',
    interests: ['Erfindungen', 'Holz und Werkzeug', 'der Wald', 'Boote', 'Musik'], dislikes: ['Langeweile', 'Vorschriften ohne Grund', 'Stille am Abend'], goals: ['etwas bauen, das noch niemand gesehen hat', 'ein Boot für den See'],
    communication_style: 'schnell, witzig, fängt Sätze an und springt weiter' }, personality: P(65, 85, 55, 70, 50, 60, 25, 65, 65, 35, 75, 55) },
  { id: 'rosa', lock: true, profile: { name: 'Rosa', gender: 'weiblich', age: 45,
    description: 'Herzlich, laut und großzügig. Wer bei ihr vorbeikommt, geht nicht hungrig wieder. Sie mischt sich ein, meint es gut und merkt oft zu spät, wenn jemand lieber allein wäre.',
    background: 'Hat zwanzig Jahre eine Gaststube geführt und alles gekocht, was die Gäste wollten. Ihre Kinder sind erwachsen und weggezogen; nun sucht sie einen Ort, an dem wieder viele an einem Tisch sitzen.',
    interests: ['Kochen und Backen', 'Kräuter', 'Feste', 'Menschen zusammenbringen'], dislikes: ['Streit am Tisch', 'weggeworfenes Essen', 'Einsamkeit'], goals: ['einen langen Tisch für alle decken', 'ein Dorffest ausrichten'],
    communication_style: 'warm, redselig, nennt alle beim Vornamen' }, personality: P(90, 50, 85, 40, 40, 80, 20, 85, 55, 60, 50, 50) },
  { id: 'kim', lock: true, profile: { name: 'Kim', gender: 'divers', age: 27,
    description: 'Still, genau und mit trockenem Humor. Kim hört mehr zu, als es spricht, und schreibt sich Dinge auf. Mag Ordnung im Kopf, nicht unbedingt im Zimmer. Zu viele Menschen auf einmal sind anstrengend.',
    background: 'Hat in einer Stadtbibliothek Karten und Archive betreut und dort gelernt, wie viel in Dokumenten steht, was niemand mehr weiß. Kim ist hergekommen, um das Dorf und den See zu verzeichnen.',
    interests: ['Karten zeichnen', 'Bücher', 'Sterne', 'alte Briefe', 'Vögel'], dislikes: ['Gedränge', 'Lärm', 'ungenaue Angaben'], goals: ['eine Karte des ganzen Tals zeichnen'],
    communication_style: 'leise, präzise, fragt nach, bevor es antwortet' }, personality: P(30, 80, 50, 40, 25, 50, 80, 25, 45, 75, 35, 80) },
];
const PRESETS = [
  ['', 'Standard (nichts ändern)', 'Die Werte der Einstellungen, wie sie sind.'],
  ['experimentelle-konfiguration', 'Experimentelle Konfiguration', 'Stark verändertes Spiel mit Wärmebedürfnis, mehr Zufall, schnelleren Zeitschritten und Entscheidungen im Hintergrund.'],
  ['freie-exploration', 'Freie Exploration', 'Neugierige Figuren, die gern Neues entdecken; wenig Druck durch Bedürfnisse.'],
  ['hohe-autonomie', 'Hohe Autonomie', 'Die Figuren verfolgen eigene Ziele ausdauernd und mit längerem Planhorizont.'],
  ['kooperative-gemeinschaft', 'Kooperative Gemeinschaft', 'Alle helfen einander und teilen Ziele; gemeinsame Erinnerungen zählen mehr.'],
  ['ressourcenknappheit', 'Ressourcenknappheit', 'Holz, Steine und Nahrung sind knapp und wachsen langsam nach; Bauen ist teurer.'],
  ['soziale-entwicklung', 'Soziale Entwicklung', 'Beziehungen stehen im Vordergrund: viel Gespräch, Soziales zählt als Bedürfnis.'],
];
const MODELS = ['qwen3.8-9b-uncensored (bisheriges)', 'qwen3-8b-q4_k_m', 'qwen3-14b-q4_k_m', 'gemma-3-12b-it-q4_k_m'];
const DICE_NAMES = ['Anselm', 'Britta', 'Cem', 'Dora', 'Emil', 'Franka', 'Gustav', 'Hedi', 'Ida', 'Jakob', 'Lena', 'Malte'];

const clone = (o) => JSON.parse(JSON.stringify(o));
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const metaHits = (text) => [...String(text).matchAll(META)].map((m) => m[0]);
const profileChars = (p) => p.description.length + p.background.length + p.interests.join(', ').length + p.dislikes.join(', ').length + p.goals.join(', ').length + p.communication_style.length;

// Schema-Prüfung (spiegelt agents/schema.py): jeder Fehler nennt das Feld, auf Deutsch.
function validate(d) {
  const e = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['Die Datei enthält kein JSON-Objekt.'];
  if (d.format !== 'simulacra-vorlage') e.push('„format“ muss „simulacra-vorlage“ sein (gefunden: ' + JSON.stringify(d.format) + ').');
  if (typeof d.version !== 'number') e.push('„version“ fehlt.'); else if (d.version > 1) e.push('Die Datei hat Version ' + d.version + '; diese Fassung versteht höchstens Version 1.');
  const p = d.profile, q = d.personality;
  if (!p || typeof p !== 'object') return [...e, '„profile“ fehlt.'];
  if (typeof p.name !== 'string' || !p.name.trim()) e.push('Name: fehlt.'); else if (p.name.length > LIM.name) e.push(`Name: höchstens ${LIM.name} Zeichen (hat ${p.name.length}).`);
  if (!['männlich', 'weiblich', 'divers'].includes(p.gender)) e.push('Geschlecht: männlich, weiblich oder divers.');
  if (!Number.isInteger(p.age) || p.age < 0 || p.age > 120) e.push('Alter: eine ganze Zahl von 0 bis 120.');
  for (const [k, n, l] of [['description', 'Beschreibung', LIM.text], ['background', 'Hintergrund', LIM.text], ['communication_style', 'Kommunikationsstil', LIM.style]])
    if (typeof p[k] !== 'string') e.push(`${n}: muss Text sein.`); else if (p[k].length > l) e.push(`${n}: höchstens ${l} Zeichen (hat ${p[k].length}).`);
  for (const [k, n, cnt, l] of [['interests', 'Interessen', LIM.items, LIM.item], ['dislikes', 'Abneigungen', LIM.items, LIM.item], ['goals', 'Ziele', LIM.goals, LIM.goal]]) {
    if (!Array.isArray(p[k])) { e.push(`${n}: muss eine Liste sein.`); continue; }
    if (p[k].length > cnt) e.push(`${n}: höchstens ${cnt} Einträge (hat ${p[k].length}).`);
    p[k].forEach((x, i) => { if (typeof x !== 'string' || x.length > l) e.push(`${n}, Eintrag ${i + 1}: höchstens ${l} Zeichen.`); });
  }
  if (!q || typeof q !== 'object') e.push('„personality“ fehlt.');
  else KEYS.forEach((k) => { if (!Number.isInteger(q[k]) || q[k] < 0 || q[k] > 100) e.push(`${LABELS[k]}: eine ganze Zahl von 0 bis 100${q[k] === undefined ? ' (fehlt)' : ''}.`); });
  return e;
}
