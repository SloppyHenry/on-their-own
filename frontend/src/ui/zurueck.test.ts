// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EBENE, anmelden, anzahlEbenen, starteEsc, zurueck } from "./zurueck";

const offs: (() => void)[] = [];
const an = (ebene: number, fn: () => boolean | void) => { const off = anmelden(ebene, fn); offs.push(off); return off; };
afterEach(() => { offs.splice(0).forEach((o) => o()); });

describe("Rückweg-Stapel", () => {
  it("ruft nur die oberste Ebene auf, höhere Ebenen gehen vor", () => {
    const log: string[] = [];
    an(EBENE.Menue, () => { log.push("menü"); });
    an(EBENE.Dialog, () => { log.push("dialog"); });
    an(EBENE.Innenansicht, () => { log.push("innen"); });
    expect(zurueck()).toBe(true);
    expect(log).toEqual(["dialog"]);
  });

  it("bei gleicher Ebene kommt die zuletzt angemeldete zuerst", () => {
    const log: string[] = [];
    an(EBENE.MenueUnter, () => { log.push("a"); });
    an(EBENE.MenueUnter, () => { log.push("b"); });
    zurueck();
    expect(log).toEqual(["b"]);
  });

  it("false heißt „nicht zuständig“: die nächste Ebene ist dran", () => {
    const log: string[] = [];
    an(EBENE.Menue, () => { log.push("menü"); });
    an(EBENE.Innenansicht, () => { log.push("innen"); });
    an(EBENE.Popover, () => { log.push("leer"); return false; });
    expect(zurueck()).toBe(true);
    expect(log).toEqual(["leer", "menü"]);
  });

  it("Ebene für Ebene: jedes Esc schließt genau eine Ebene, zuletzt ist nichts mehr zu tun", () => {
    const log: string[] = [];
    const offen = (name: string, ebene: number) => { const off = an(ebene, () => { log.push(name); off(); }); };      // schließt sich beim Zurückgehen selbst
    offen("menü", EBENE.Menue); offen("assistent", EBENE.MenueUnter); offen("dialog", EBENE.Dialog);
    expect([zurueck(), zurueck(), zurueck(), zurueck()]).toEqual([true, true, true, false]);
    expect(log).toEqual(["dialog", "assistent", "menü"]);
  });

  it("Abmelden nimmt die Ebene weg", () => {
    const off = an(EBENE.Dialog, () => {});
    expect(anzahlEbenen()).toBe(1);
    off();
    expect(anzahlEbenen()).toBe(0);
    expect(zurueck()).toBe(false);
  });
});

describe("Esc-Taste", () => {
  const press = (target: EventTarget = window) => {
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
  };

  it("verbraucht die Taste nur, wenn eine Ebene zuständig war", () => {
    const stop = starteEsc();
    try {
      expect(press().defaultPrevented).toBe(false);
      an(EBENE.Menue, () => {});
      expect(press().defaultPrevented).toBe(true);
    } finally { stop(); }
  });

  it("im Feld mit Text nimmt das erste Esc den Fokus, das zweite geht zurück; ein leeres Feld lässt Esc gleich durch", () => {
    const stop = starteEsc();
    const input = document.createElement("input");
    document.body.append(input);
    let n = 0;
    an(EBENE.Menue, () => { n++; });
    try {
      input.focus(); input.value = "abc";
      press(input);
      expect(n).toBe(0);
      expect(document.activeElement).not.toBe(input);
      press();
      expect(n).toBe(1);
      input.focus(); input.value = "";
      press(input);
      expect(n).toBe(2);
    } finally { stop(); input.remove(); }
  });
});
