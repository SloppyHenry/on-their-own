import { describe, expect, it } from "vitest";
import type { LocationInfo } from "../../store/types";
import { buildingAt, findBuildings } from "./buildings";

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

describe("Gebäude", () => {
  const [b, ...rest] = findBuildings(rows, legend, locs);

  it("findet genau ein Gebäude aus zusammenhängenden Räumen", () => {
    expect(rest).toHaveLength(0);
    expect(b.rooms.sort()).toEqual(["a", "b"]);
    expect(b.bbox).toEqual({ x0: 1, y0: 1, x1: 7, y1: 4 });
  });

  it("freistehender Boden (z. B. ein Steg) ist kein Gebäude", () => expect(buildingAt([b], 6, 6)).toBeNull());

  it("Haustür ist die Tür in der Südwand mit freiem Feld davor, nicht die Innentür", () => expect(b.door).toEqual({ x: 4, y: 4 }));

  it("ohne Tür nach draußen steht das Haus mittig an der Südkante", () => {
    const closed = rows.map((r) => r.replace("###+###", "#######"));
    expect(findBuildings(closed, legend, locs)[0].door).toEqual({ x: 4, y: 4 });
    const wide = ["#########", "#___+___#", "#########", "........."];
    expect(findBuildings(wide, legend, [room("w", [1, 1, 3, 1])])[0].door).toEqual({ x: 4, y: 2 });
  });
});
