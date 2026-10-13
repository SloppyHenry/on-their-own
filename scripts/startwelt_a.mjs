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
  interior: { rect: [IX, IY, 24, 13] },
};
look.decor = look.decor.filter(([k, vx, vy]) => !(k === "rock" && vx === 210 && vy === 150));   // dieser Stein ist die Quelle „shore_rocks“

const types = { ...old.tile_types, fence: { char: "f", walkable: false, cost: 0, color: "#a96f42", label: "Zaun" } };
const world = {
  ...old, name: "Dorf am See", size: [W, H], home: door, tile_types: types, tiles: grid.map((r) => r.join("")),
  links: [[door, inDoor]], locations, objects, resource_nodes, agents, look,
};
writeFileSync(ROOT + "backend/simulacra/data/world_default.json", JSON.stringify(world, null, 1) + "\n");
console.log(world.tiles.join("\n"));
console.log({ door, inDoor, garden: locations.find((l) => l.id === "garden").rect, square, lake, alex: agents[0].tile, mira: agents[1].tile, gardenGate });
