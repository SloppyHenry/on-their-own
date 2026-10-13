// Kamerabewegungen als reine Funktionen auf der eigenen Kamera: Zoom um den Mauszeiger, Ziehen, Folgen, Gesamtansicht.
// Die Abbildung ist in Weltkoordinaten eine reine Verschiebung des Fokus; darum sind Zoom und Ziehen in einem Schritt exakt.
import { bottomY, FOCUS_T, horizon, unproject, type Camera, type ViewMode, type Viewport } from "./projection";

export const ZOOM: Record<ViewMode, [number, number]> = { tiefe: [0.3, 3], flach: [0.12, 2.5] };
const clampZoom = (mode: ViewMode, z: number) => Math.min(ZOOM[mode][1], Math.max(ZOOM[mode][0], z));

/** Bodenpunkt unter einem Bildpunkt; im Himmel der Punkt knapp unter dem Horizont derselben Spalte. */
function groundAt(cam: Camera, vp: Viewport, x: number, y: number) {
  return unproject(cam, vp, x, y) ?? unproject(cam, vp, x, horizon(vp, x) + 1)!;
}

/** Zoomt so, dass der Bodenpunkt unter (x, y) an derselben Bildstelle bleibt. */
export function zoomAt(cam: Camera, vp: Viewport, x: number, y: number, factor: number): Camera {
  const before = groundAt(cam, vp, x, y), next = { ...cam, zoom: clampZoom(cam.mode, cam.zoom * factor) };
  const after = groundAt(next, vp, x, y);
  return { ...next, fx: next.fx + before.x - after.x, fy: next.fy + before.y - after.y };
}

/** Verschiebt so, dass der gegriffene Bodenpunkt dem Zeiger folgt. */
export function dragBy(cam: Camera, vp: Viewport, from: { x: number; y: number }, to: { x: number; y: number }): Camera {
  const a = groundAt(cam, vp, from.x, from.y), b = groundAt(cam, vp, to.x, to.y);
  return { ...cam, fx: cam.fx + a.x - b.x, fy: cam.fy + a.y - b.y };
}

/** Weiches Nachführen auf einen Weltpunkt. */
export function followTo(cam: Camera, x: number, y: number, dt: number): Camera {
  const k = 1 - Math.exp(-dt * 6);
  return { ...cam, fx: cam.fx + (x - cam.fx) * k, fy: cam.fy + (y - cam.fy) * k };
}

export function focusOn(cam: Camera, x: number, y: number, zoom = cam.zoom): Camera {
  return { ...cam, fx: x, fy: y, zoom: clampZoom(cam.mode, zoom) };
}

/** Gesamtansicht: Flach zeigt die ganze Karte; Tiefe legt den Südrand an den unteren Rand und den Nordrand vor den Horizont. */
export function fit(cam: Camera, vp: Viewport, mapW: number, mapH: number): Camera {
  if (cam.mode === "flach") return { ...cam, fx: mapW / 2, fy: mapH / 2, zoom: clampZoom("flach", Math.min(vp.w / mapW, vp.h / mapH)) };
  const byDepth = (vp.h * 1.44) / (mapH * 1.08), byWidth = (vp.w * 1.07) / mapW, zoom = clampZoom("tiefe", Math.min(byDepth, byWidth));
  const next = { ...cam, zoom, fx: mapW / 2, fy: 0 };
  return { ...next, fy: mapH + 8 - (bottomY(next, vp) - next.fy) };
}

/** Hält den Fokus in der Nähe der Karte, damit man sich nicht ins Leere zieht. */
export function clampToMap(cam: Camera, mapW: number, mapH: number, margin = 160): Camera {
  return { ...cam, fx: Math.min(mapW + margin, Math.max(-margin, cam.fx)), fy: Math.min(mapH + margin, Math.max(-margin, cam.fy)) };
}

/** Wechsel der Ansicht: derselbe Fokuspunkt, ein Zoom mit ähnlichem Bildausschnitt. */
export function switchMode(cam: Camera, mode: ViewMode): Camera {
  if (mode === cam.mode) return cam;
  const zoom = mode === "flach" ? cam.zoom * 0.75 : cam.zoom / 0.75;
  return { ...cam, mode, zoom: clampZoom(mode, zoom) };
}

/** Bild-y der Fokustiefe (Tiefe) bzw. Bildmitte (Flach): dort steht eine verfolgte Figur. */
export function focusRow(cam: Camera, vp: Viewport): number {
  if (cam.mode === "flach") return vp.h / 2;
  return vp.h - FOCUS_T * (vp.h - horizon(vp, vp.w / 2));
}
