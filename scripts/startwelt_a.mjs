// Erzeugt die Startwelt nach Mockup A (backend/simulacra/data/world_default.json) aus docs/mockups/welt-optik/world.js.
// Draußen: Kachelarten aus den Bodenregeln von A (wTexel), Bäume aus A als Hindernisse, Haus aus A mit Tür als Übergang.
// Drinnen: die fünf Räume der bisherigen Startwelt als eigener Innenbereich rechts neben dem Dorf.
// Formen, Bäume und Deko kommen als `look` in die Weltdatei; die App zeichnet daraus Bild A.
// Aufruf: node scripts/startwelt_a.mjs  (liest die alte Startwelt aus den Testdaten, damit Räume, Möbel und Werte gleich bleiben)
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname;
const ctx = vm.createContext({ Math, document: {} });
vm.runInContext(readFileSync(ROOT + "docs/mockups/welt-optik/world.js", "utf8"), ctx);
const A = (expr) => vm.runInContext(expr, ctx);
const old = JSON.parse(readFileSync(ROOT + "backend/tests/fixtures/world_mechanik.json", "utf8"));   // Startwelt bis AP13

// Dorfkoordinaten (A) → Weltpixel: so verschoben, dass Gartenzaun und Beete auf Kachelgrenzen liegen.
const OX = A("W_OX"), OY = A("W_OY"), SX = 2, SY = 8, VX = OX + SX, VY = OY + SY;   // Dorf (0, 0) liegt bei Weltpixel (66, 104)
const T = 16, OW = 25, OH = 19;                                                     // Dorfkarte 25 × 19 Kacheln
const tileOf = (vx, vy) => [Math.floor((vx + VX) / T), Math.floor((vy + VY) / T)];

// 1. Kachelarten draußen nach Mehrheit der Bodentexel
const rows = Array.from({ length: OH }, () => Array(OW).fill("T"));
for (let ty = 0; ty < OH; ty++) for (let tx = 0; tx < OW; tx++) {
  const n = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const px = tx * T + x - SX, py = ty * T + y - SY;
    n[px < 0 || py < 0 || px >= A("W_TW") || py >= A("W_TH") ? 7 : A(`wTexel(${px}, ${py})[1]`)]++;
  }
  const best = n.indexOf(Math.max(...n));
  rows[ty][tx] = n[2] > 128 ? "~" : n[5] >= 64 ? "_" : best === 7 ? "T" : best === 6 ? "s" : best === 1 || best === 3 ? "," : ".";
}
// Bäume im Dorf (die 13 einzelnen aus A) stehen auf ihrer Kachel im Weg
for (const [vx, vy] of A("[[20,30],[104,32],[118,58],[176,40],[246,36],[8,150],[244,170],[176,152],[182,64],[30,100],[234,186],[8,186],[150,36]]")) {
  const [tx, ty] = tileOf(vx, vy - 2);
  if (rows[ty]?.[tx] && rows[ty][tx] !== "~") rows[ty][tx] = "T";
}
// Haus aus A: Grundfläche gesperrt, Tür als Übergang ins Innere
const [hx0, hy0] = tileOf(22, 28), [hx1, hy1] = tileOf(98, 59), door = tileOf(60, 58);
for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) rows[y][x] = "#";
rows[door[1]][door[0]] = "+";
// Gartenzaun aus A: Pfosten und Latten sperren, Lücke rechts ist der Eingang
const G = A("W_GARDEN"), [gx0, gy0] = tileOf(G.x0, G.y0), [gx1, gy1] = tileOf(G.x1, G.y1);
for (let x = gx0; x <= gx1; x++) { rows[gy0 - 1][x] = "f"; rows[gy1][x] = "f"; }
for (let y = gy0; y < gy1; y++) { rows[y][gx0 - 1] = "f"; if (y !== tileOf(0, 146)[1]) rows[y][gx1] = "f"; }
const gardenGate = [gx1, tileOf(0, 146)[1]];

// 2. Innenbereich: das alte Haus (Zeilen 4–16, Spalten 4–27) rechts daneben, ohne Hintertür
const IX = 26, IY = 3, DX = IX - 4, DY = IY - 4, W = IX + 24 + 1, H = OH;
const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x < OW && y < OH ? rows[y][x] : "T")));
for (let y = 4; y <= 16; y++) for (let x = 4; x <= 27; x++) grid[y + DY][x + DX] = old.tiles[y][x];
grid[7 + DY][27 + DX] = "#";
const inDoor = [20 + DX, 16 + DY];

// 3. Orte
const bbox = (pred) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (pred(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
};
const sq = A("W_SQ"), [sqx, sqy] = tileOf(sq.x, sq.y), lk = A("W_LAKE");
const square = bbox((x, y) => rows[y][x] === "," && Math.hypot(x - sqx, y - sqy) <= 2.2);
const lake = bbox((x, y) => Math.hypot((x * T + 8 - VX - lk.x) / lk.rx, (y * T + 8 - VY - lk.y) / lk.ry) < 1.3 && rows[y][x] !== "T");   // Wasser mit Ufer und Steg
const shift = (l) => ({ ...l, rect: [l.rect[0] + DX, l.rect[1] + DY, l.rect[2], l.rect[3]], entrances: l.entrances.filter(([x, y]) => !(x === 27 && y === 7)).map(([x, y]) => [x + DX, y + DY]), extra_tiles: l.extra_tiles.filter(([x, y]) => !(x === 27 && y === 7)).map(([x, y]) => [x + DX, y + DY]) });
const byId = Object.fromEntries(old.locations.map((l) => [l.id, l]));
const locations = [
  ...old.locations.filter((l) => l.id.startsWith("house.")).map(shift),
  { ...byId.garden, rect: [gx0, gy0, gx1 - gx0, gy1 - gy0], entrances: [gardenGate], extra_tiles: [], props: { ...byId.garden.props } },
  { ...byId.square, rect: square, entrances: [], extra_tiles: [], props: { ...byId.square.props, market_area: square } },
  { ...byId.lake, rect: lake, entrances: [], extra_tiles: [], props: { ...byId.lake.props } },
  { ...byId.forest, rect: [0, 0, OW, 7], entrances: [], extra_tiles: [], props: { ...byId.forest.props, clearing: [4, 6, 17, 1] } },
  { ...byId.paths, rect: [0, 0, W, H] },
];

// 4. Objekte, Rohstoffe, Figuren: drinnen verschoben, draußen an den Stellen aus A
const at = (vx, vy) => tileOf(vx, vy - 1);
const OUT = {
  seedbed_1: tileOf(42, 131), seedbed_2: tileOf(56, 131), seedbed_3: tileOf(70, 131),
  seedbed_4: tileOf(42, 159), seedbed_5: tileOf(56, 159), seedbed_6: tileOf(70, 159),
  well_square: at(sq.x, sq.y + 3), bench_square: at(92, 112), board_square: at(152, 86), fishing_spot: tileOf(200, 92), old_key: [3, 6],
};
const DROP = new Set(["well_garden", "bench_garden", "door_back", "well_garden_water"]);
const objects = old.objects.filter((o) => !DROP.has(o.id)).map((o) => ({ ...o, tile: OUT[o.id] ?? [o.tile[0] + DX, o.tile[1] + DY] }));
const RES = { well_square_water: OUT.well_square, lake_water: tileOf(186, 92), shore_rocks: tileOf(210, 150), forest_wood: [8, 5], forest_mushrooms: [14, 5], forest_seeds: [19, 5] };
const resource_nodes = old.resource_nodes.filter((n) => !DROP.has(n.id)).map((n) => ({ ...n, tile: RES[n.id] ?? [n.tile[0] + DX, n.tile[1] + DY] }));
const agents = old.agents.map((a) => ({ ...a, tile: a.id === "alex" ? tileOf(50, 140) : tileOf(110, 121) }));

// 5. Darstellung: Formen und Deko aus A in Dorfkoordinaten, Lage der Zustandsdinge im Bild
const pos = (id, vx, vy, sprite) => [id, sprite ? { at: [vx, vy], sprite } : { at: [vx, vy] }];
const look = {
  style: "mockup-a",
  origin: [VX, VY],                                    // Weltpixel von Dorf (0, 0)
  texture: { offset: [OX, OY], size: [A("W_TW"), A("W_TH")] },
  shapes: { paths: A("W_PATHS"), square: sq, lake: lk, garden: G, beds: A("W_BEDS"), house: A("W_HOUSE"), dock: A("W_DOCK") },
  decor: A(`wObjects()`).filter((o) => !["alex", "mira", "well", "bench", "board"].includes(o.kind)).map((o) => [o.kind, o.vx, o.vy, o.extra ?? 0]),
  lights: A("W_LIGHTS"),
  place: Object.fromEntries([
    pos("well_square", sq.x, sq.y + 3), pos("bench_square", 92, 112), pos("board_square", 152, 86), pos("fishing_spot", 200, 92, "none"),
    pos("seedbed_1", 42, 131, "none"), pos("seedbed_2", 56, 131, "none"), pos("seedbed_3", 70, 131, "none"),
    pos("seedbed_4", 42, 159, "none"), pos("seedbed_5", 56, 159, "none"), pos("seedbed_6", 70, 159, "none"),
    pos("shore_rocks", 210, 150, "rock"), pos("well_square_water", sq.x, sq.y + 3, "none"), pos("lake_water", 186, 92, "none"),
    pos("forest_wood", 0, 0, "none"), pos("forest_mushrooms", 0, 0, "none"), pos("forest_seeds", 0, 0, "none"),
  ]),
  door: { outside: door, inside: inDoor, at: [A("W_HOUSE").x, A("W_HOUSE").y] },
  interior: {
    rect: [IX, IY, 24, 13],
    // Einrichtung nach dem Mockup docs/mockups/welt-optik/innen2.html (Frage 23): Tapete, Boden, Vorhang je Raum; Wanddeko
    // [Art, Kachel-x, Raum, Abstand von oben]; Möbel [Art, x, y] (Kacheln); Teppiche
    rooms: {
      "house.bedroom_a": { paper: "streifen", floor: "dielen", curtain: "#5d7fb0" }, "house.bedroom_b": { paper: "blumen", floor: "dielenHell", curtain: "#d97a92" },
      "house.workshop": { paper: "bretter", floor: "werkstatt", curtain: "#a9884e" }, "house.kitchen": { paper: "kacheln", floor: "fliesen", curtain: "#e0a458" },
      "house.living": { paper: "ranken", floor: "parkett", curtain: "#b04a4a" },
    },
    wall: [["fenster", 29.4, "house.bedroom_a", 6], ["bild:see", 27.3, "house.bedroom_a", 12], ["fenster", 36.4, "house.bedroom_b", 6], ["bild:blume", 34.4, "house.bedroom_b", 11],
      ["wandregal:buecher", 38.3, "house.bedroom_b", 12], ["fenster", 44.3, "house.workshop", 6], ["werkzeugwand", 41.4, "house.workshop", 9], ["fenster", 46.6, "house.workshop", 6],
      ["toepfe", 27.4, "house.kitchen", 8], ["wandregal:glaeser", 32.6, "house.kitchen", 10], ["uhr", 34.9, "house.kitchen", 9], ["bild:portrait", 38.6, "house.living", 10],
      ["spiegel", 41.2, "house.living", 9], ["wandregal:deko", 45.4, "house.living", 12]],
    decor: [["nachttisch", 29, 5], ["schrank", 32, 4], ["pflanze", 27, 8], ["stehlampe", 39, 4], ["katze", 34, 8], ["pflanze:gross", 39, 8], ["saegebock", 44, 7], ["kiste", 41, 8], ["kiste", 42, 8],
      ["kuechenzeile", 33, 10], ["objekt:table", 30, 12], ["stehlampe", 37, 11], ["sessel:#5d8fb0", 45, 13], ["pflanze:gross", 37, 14], ["kerze", 44, 12]],
    rugs: [["oval", 30, 7.3, 26, 11, "#5d7fb0", "#86a6d0", "#3f5f8c"], ["oval", 37, 7.3, 22, 11, "#d97a92", "#f2b0c0", "#b05a72"], ["teppich", 40, 11, 46, 14], ["laeufer", 29, 12.4, 34]],
  },
};
// Große Möbel sperren ihre Kachel (sonst liefe man hindurch)
const MOEBEL = [[29, 5], [32, 4], [27, 8], [39, 4], [39, 8], [44, 7], [41, 8], [42, 8], [32, 10], [33, 10], [34, 10], [30, 12], [37, 11], [45, 13], [37, 14]];
for (const [x, y] of MOEBEL) grid[y][x] = "m";
look.decor = look.decor.filter(([k, vx, vy]) => !(k === "rock" && vx === 210 && vy === 150));   // dieser Stein ist die Quelle „shore_rocks“

// 6. Dinge im Dorf (AP15): Deko aus A und innen2 wird zu Objekten und Quellen. Bildstelle und Sprite bleiben (look.place),
//    die Kachel ist die Stelle für Wege und Wahrnehmung (Dinge auf Mauer oder Zaun rücken auf die nächste freie Kachel davor).
const locAt = ([x, y]) => (locations.find((l) => !l.props.fallback && x >= l.rect[0] && y >= l.rect[1] && x < l.rect[0] + l.rect[2] && y < l.rect[1] + l.rect[3]) ?? locations.at(-1)).id;
const take = (kind) => { const out = look.decor.filter((d) => d[0] === kind); look.decor = look.decor.filter((d) => d[0] !== kind); return out; };
const thing = (id, kind, name, tile, [k, vx, vy, e], state) => {
  objects.push({ id, kind, name, tile, ...(state ? { state } : {}) });
  look.place[id] = { at: [vx, vy], sprite: k, e };
};
const source = (id, resource, label, tile, ds, { amount, cap, regen, tool = null, minutes = 3, weather = null }) => {
  resource_nodes.push({ id, location_id: locAt(tile), tile, resource, label, amount, cap, regen_per_hour: regen, requires_tool: tool, gather_minutes: minutes, regen_weather: weather });
  look.place[id] = { at: [ds[0][1], ds[0][2]], sprite: ds[0][0], e: ds[0][3], more: ds.slice(1).map((d) => [d[1], d[2], d[3]]) };
};
take("lamp").forEach((d, i) => thing(`lantern_${i + 1}`, "lantern", "Laterne", [[10, 11], [13, 14], [16, 11]][i], d));
thing("mailbox", "mailbox", "Briefkasten", [9, 11], take("mailbox")[0]);
thing("signpost", "signpost", "Wegweiser", [12, 15], take("sign")[0]);
thing("scarecrow", "scarecrow", "Vogelscheuche", [8, 14], take("scare")[0]);
thing("boat", "boat", "Boot", [18, 13], take("boat")[0]);
source("rain_barrels", "water", "Regentonnen", [5, 15], take("barrel"), { amount: 6, cap: 10, regen: 2, minutes: 2, weather: "rain,storm" });
source("sunflowers", "seeds", "Sonnenblumen", [6, 14], take("sun"), { amount: 3, cap: 4, regen: 0.05 });
source("tomatoes", "food", "Tomaten", [7, 14], take("tomato"), { amount: 4, cap: 6, regen: 0.1 });
source("reeds", "reed", "Schilf", [15, 12], take("reed"), { amount: 6, cap: 8, regen: 0.1, minutes: 4 });
source("apple_trees", "food", "Apfelbäume", [12, 10], take("treeF"), { amount: 4, cap: 6, regen: 0.1, minutes: 4 });
source("field_rocks", "stone", "Steine", [12, 16], take("rock"), { amount: 6, cap: 6, regen: 0.05, tool: "pickaxe", minutes: 10 });
const inner = (kind) => { const out = look.interior.decor.filter((d) => d[0].split(":")[0] === kind); look.interior.decor = look.interior.decor.filter((d) => d[0].split(":")[0] !== kind); return out; };
const [[, cx, cy]] = inner("katze");
objects.push({ id: "cat", kind: "cat", name: "Katze", tile: [cx, cy], state: { spots: [[47, 13], [cx, cy], [30, 13], [29, 7]], spot: 1 } });
inner("stehlampe").forEach(([, x, y], i) => objects.push({ id: `floor_lamp_${i + 1}`, kind: "floor_lamp", name: "Stehlampe", tile: [x, y] }));
inner("kerze").forEach(([, x, y]) => objects.push({ id: "candle", kind: "candle", name: "Kerze", tile: [x, y] }));
inner("sessel").forEach(([, x, y]) => objects.push({ id: "armchair", kind: "armchair", name: "Sessel", tile: [x, y] }));
inner("schrank").forEach(([, x, y]) => objects.push({ id: "wardrobe", kind: "wardrobe", name: "Schrank", tile: [x, y] }));
inner("kiste").forEach(([, x, y], i) => objects.push({ id: `crate_${i + 1}`, kind: "crate", name: "Kiste", tile: [x, y] }));

const types = { ...old.tile_types, fence: { char: "f", walkable: false, cost: 0, color: "#a96f42", label: "Zaun" }, furniture: { char: "m", walkable: false, cost: 0, color: "#a96f42", label: "Möbel" } };
const world = {
  ...old, name: "Dorf am See", size: [W, H], home: door, tile_types: types, tiles: grid.map((r) => r.join("")),
  links: [[door, inDoor]], locations, objects, resource_nodes, agents, look,
};
writeFileSync(ROOT + "backend/simulacra/data/world_default.json", JSON.stringify(world, null, 1) + "\n");
console.log(world.tiles.join("\n"));
console.log({ door, inDoor, garden: locations.find((l) => l.id === "garden").rect, square, lake, alex: agents[0].tile, mira: agents[1].tile, gardenGate });
