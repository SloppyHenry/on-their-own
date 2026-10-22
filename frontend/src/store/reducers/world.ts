import { applyLookOps, rawLook, type LookOp } from "../../world/dorf/look";
import type { EventDataMap, EventType, LocationInfo } from "../../types/generated";
import type { MapData, World } from "../types";
import { setObject, toObjectInfo, without } from "./helpers";
import type { Handler } from "./index";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const charOf = (w: World, type: string): string | undefined => Object.entries(w.map.legend).find(([, t]) => t === type)?.[0];

function paint(map: MapData, legend: World, changes: { x: number; y: number; type: string }[]): MapData {
  const rows = map.rows.slice();
  for (const c of changes) {
    const ch = charOf(legend, c.type);
    if (!ch || c.y < 0 || c.y >= rows.length || c.x < 0 || c.x >= rows[c.y].length) continue;
    rows[c.y] = rows[c.y].slice(0, c.x) + ch + rows[c.y].slice(c.x + 1);
  }
  return { ...map, rows };
}

const asLocation = (raw: Record<string, unknown>): LocationInfo => {
  const loc = raw as unknown as Partial<LocationInfo>;
  return { ...(loc as LocationInfo), entrances: loc.entrances ?? [], props: loc.props ?? {}, discovered_by: loc.discovered_by ?? [] };
};

export const worldHandlers: { [K in EventType]?: Handler<EventDataMap[K]> } = {
  "world.object_created": (w, d) => setObject(w, toObjectInfo(d.object)),
  "world.object_changed": (w, d) => setObject(w, toObjectInfo(d, w.objects[d.id])),
  "world.object_removed": (w, d) => ({ ...w, objects: without(w.objects, d.object.id) }),
  "world.object_discovered": (w, d) => setObject(w, toObjectInfo(d.object, w.objects[d.object.id])),
  "world.resource_changed": (w, d) => {
    const n = w.resources[d.node];
    return n ? { ...w, resources: { ...w.resources, [d.node]: { ...n, amount: d.amount } } } : w;
  },
  "world.resource_added": (w, d) => ({
    ...w,
    resources: { ...w.resources, [d.node]: { id: d.node, location_id: d.location_id ?? "", x: d.tile[0], y: d.tile[1], resource: d.resource, amount: d.amount, cap: d.cap, requires_tool: d.requires_tool ?? null, label: d.label ?? null } },
  }),
  "world.links_added": (w, d) => ({ ...w, links: [...(w.links ?? []), ...d.links] }),
  "world.look_added": (w, d) => {                                       // Ein Bewohner hat Weg, Beet, Baum, Laterne oder Brunnen gebaut: das Stück kommt an sein Gebiet (AP18g)
    if (!w.look) return w;
    const cur = rawLook(w.look as object);
    const regions = cur.regions.map((r) => {
      if (r.id !== d.region) return r;
      const S = r.shapes;
      return { ...r, shapes: { ...S, paths: [...S.paths, ...(d.paths as unknown as typeof S.paths)], gardens: [...S.gardens, ...(d.gardens as unknown as typeof S.gardens)] },
        decor: [...r.decor, ...(d.decor as unknown as typeof r.decor)], lights: [...r.lights, ...(d.lights as unknown as typeof r.lights)], place: { ...r.place, ...(d.place as unknown as typeof r.place) } };
    });
    return { ...w, look: { ...cur, regions } as unknown as typeof w.look };
  },
  "world.look_edited": (w, d) => {                                      // Gestalten (AP16a): Formen und Deko eintragen oder entfernen, Bildstellen setzen, Gebiete vergrößern
    if (!w.look) return w;
    return { ...w, look: applyLookOps(rawLook(w.look as object), d.ops as unknown as LookOp[]) as unknown as typeof w.look };
  },
  "world.location_removed": (w, d) => ({ ...w, locations: without(w.locations, d.id) }),
  "world.resource_removed": (w, d) => ({ ...w, resources: without(w.resources, d.node) }),
  "world.links_removed": (w, d) => ({ ...w, links: (w.links ?? []).filter((p) => !d.links.some((q) => (same(p[0], q[0]) && same(p[1], q[1])) || (same(p[0], q[1]) && same(p[1], q[0])))) }),
  "world.look_changed": (w, d) => {                                    // Gebiete und Landstraßen anhängen; alte Form vorher umwandeln (look.ts)
    if (!w.look) return w;
    const cur = rawLook(w.look as object);
    const look = { ...cur, regions: [...cur.regions, ...(d.regions as unknown as typeof cur.regions)], roads: [...cur.roads, ...(d.roads as unknown as typeof cur.roads)] };
    return { ...w, look: look as unknown as typeof w.look };
  },
  "world.weather_changed": (w, d, ev) => ({ ...w, weather: { kind: d.to, since: ev.sim_time.total, until: d.until } }),
  "world.tile_changed": (w, d) => ({ ...w, map: paint(w.map, w, [d]) }),
  "world.tiles_changed": (w, d) => ({ ...w, map: paint(w.map, w, d.changes), stale: w.stale || !!d.truncated }),
  "world.tile_type_added": (w, d) => {
    const used = new Set(Object.keys(w.map.legend));
    const ch = d.char && !used.has(d.char) ? d.char : [..."0123456789abcdefghijklmnopqrstuvwxyz"].find((c) => !used.has(c)) ?? "?";
    return {
      ...w,
      tileTypes: { ...w.tileTypes, [d.id]: { char: ch, walkable: d.walkable, cost: d.cost, color: d.color ?? null, label: d.label } },
      map: { ...w.map, legend: { ...w.map.legend, [ch]: d.id } },
    };
  },
  "world.map_extended": (w, d) => {
    const [width, height] = d.to;
    const fill = charOf(w, d.fill) ?? ".";
    const rows = w.map.rows.map((r) => r.padEnd(width, fill));
    while (rows.length < height) rows.push(fill.repeat(width));
    return { ...w, map: { ...w.map, width, height, rows } };
  },
  "world.location_added": (w, d) => {
    const loc = asLocation(d.location);
    return { ...w, locations: { ...w.locations, [loc.id]: loc } };
  },
  "world.location_updated": (w, d) => {
    const loc = asLocation(d.location);
    return { ...w, locations: { ...w.locations, [loc.id]: { ...w.locations[loc.id], ...loc } } };
  },
};
