// Kamera: Mausrad-Zoom um den Mauszeiger, Ziehen zum Verschieben, Folgen eines Agenten, Gesamtansicht.
import Phaser from "phaser";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 5;
export const ZOOM_STEPS = [1, 2, 3];

export class CameraRig {
  private drag: { x: number; y: number; moved: boolean } | null = null;
  followed: { x: number; y: number } | null = null;

  constructor(private scene: Phaser.Scene, private mapW: number, private mapH: number, private onUserMove: () => void) {
    const cam = scene.cameras.main;
    cam.setRoundPixels(true);
    scene.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(p.x, p.y, Math.exp(-dy * 0.0015)));
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => { this.drag = { x: p.x, y: p.y, moved: false }; });
    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!this.drag.moved) this.onUserMove();
      this.drag.moved = true;
      cam.scrollX -= (p.x - this.drag.x) / cam.zoom;
      cam.scrollY -= (p.y - this.drag.y) / cam.zoom;
      this.drag.x = p.x;
      this.drag.y = p.y;
    });
  }

  /** Wurde der Zeiger seit dem Drücken gezogen? Dann ist es kein Klick. */
  wasDrag(): boolean {
    return this.drag?.moved ?? false;
  }

  setMap(w: number, h: number) {
    this.mapW = w;
    this.mapH = h;
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const cam = this.scene.cameras.main, before = cam.getWorldPoint(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  fit() {
    const cam = this.scene.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(Math.min(cam.width / this.mapW, cam.height / this.mapH), MIN_ZOOM, MAX_ZOOM));
    cam.centerOn(this.mapW / 2, this.mapH / 2);
  }

  focus(x: number, y: number, zoom: number) {
    const cam = this.scene.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(x, y);
  }

  /** Weiches Nachführen auf ein Ziel (Weltpixel). */
  follow(x: number, y: number, dt: number) {
    const cam = this.scene.cameras.main, k = 1 - Math.exp(-dt * 6);
    cam.scrollX += (x - cam.width / 2 - cam.scrollX) * k;
    cam.scrollY += (y - cam.height / 2 - cam.scrollY) * k;
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    const cam = this.scene.cameras.main, cx = cam.width / 2, cy = cam.height / 2;
    return { x: (wx - cam.scrollX - cx) * cam.zoom + cx, y: (wy - cam.scrollY - cy) * cam.zoom + cy };
  }
}
