import { describe, expect, it } from "vitest";
import type { LocationInfo } from "../../store/types";
import { findBuildings, isOccupied } from "./roof";

const legend = { "#": "wall", _: "floor", "+": "door", ".": "grass", "~": "water" };
const rows = [
  "..........",
  ".#######..",
  ".#__#__#..",
  ".#__+__#..",
  ".###+###..",
  "..........",
  "......_...",
];
const room = (id: string, rect: number[]): LocationInfo => ({ id, name: id, rect, entrances: [], props: { style: { floor: "planks" } }, discovered_by: [] });
const locs = [room("a", [2, 2, 2, 2]), room("b", [5, 2, 2, 2]), { ...room("paths", [0, 0, 10, 7]), props: { fallback: true } }];

describe("findBuildings", () => {
  const [b, ...rest] = findBuildings(rows, legend, locs);

  it("findet genau ein Gebäude aus zusammenhängenden Räumen", () => {
    expect(rest).toHaveLength(0);
    expect(b.rooms.sort()).toEqual(["a", "b"]);
    expect(b.tiles.has("1,1")).toBe(true);
  });

  it("freistehender Boden (z. B. ein Steg) ist kein Gebäude", () => expect(b.tiles.has("6,6")).toBe(false));

  it("die Südfassade bleibt vom Dach frei, der Rest ist bedeckt", () => {
    const roof = new Set(b.roof.map(([x, y]) => `${x},${y}`));
    expect(roof.has("1,4")).toBe(false);
    expect(roof.has("4,4")).toBe(false);     // Tür in der Südwand
    expect(roof.has("1,1")).toBe(true);
    expect(roof.has("2,2")).toBe(true);
  });

  it("belegt, wenn jemand auf einer Gebäudekachel oder in einem Raum ist oder ein Raum gewählt wurde", () => {
    expect(isOccupied(b, [{ x: 8, y: 6, location_id: "paths" }], null)).toBe(false);
    expect(isOccupied(b, [{ x: 2, y: 2, location_id: "a" }], null)).toBe(true);
    expect(isOccupied(b, [{ x: 4, y: 4, location_id: "paths" }], null)).toBe(true);
    expect(isOccupied(b, [], "b")).toBe(true);
  });
});
