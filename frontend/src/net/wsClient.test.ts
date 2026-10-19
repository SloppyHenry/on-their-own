import { beforeEach, describe, expect, it } from "vitest";
import { ev, makeSnapshot, resetSeq } from "../test/fixtures";
import type { EventOut } from "../types/generated";
import type { Conn } from "../store/types";
import { type SocketLike, WsClient } from "./wsClient";

class FakeSocket implements SocketLike {
  sent: Record<string, unknown>[] = [];
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.onclose?.({}); }
  open() { this.onopen?.({}); }
  recv(o: unknown) { this.onmessage?.({ data: JSON.stringify(o) }); }
}

function setup(initialSeq: number | null = null) {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number; id: number; live: boolean }[] = [];
  const got = { snaps: 0, events: [] as EventOut[], live: [] as boolean[], status: [] as Conn[], clock: [] as number[], models: [] as unknown[] };
  const client = new WsClient(
    {
      url: "ws://x", initialSeq, backoffMs: [100, 200],
      socketFactory: () => { const s = new FakeSocket(); sockets.push(s); return s; },
      timers: { set: (fn, ms) => { const t = { fn, ms, id: timers.length, live: true }; timers.push(t); return t.id; }, clear: (id) => { const t = timers[id as number]; if (t) t.live = false; } },
    },
    { onSnapshot: () => { got.snaps += 1; }, onEvents: (i, l) => { got.events.push(...i); got.live.push(l); }, onStatus: (c) => got.status.push(c), onClock: (m) => got.clock.push(m), onModels: (m) => got.models.push(m) },
  );
  const fire = (ms: number) => timers.filter((t) => t.live && t.ms === ms).forEach((t) => { t.live = false; t.fn(); });
  return { client, sockets, got, fire, timers };
}

beforeEach(() => resetSeq(11));

describe("WsClient", () => {
  it("sendet hello mit last_seq und meldet verbunden", () => {
    const { client, sockets, got } = setup(7);
    client.start();
    sockets[0].open();
    expect(sockets[0].sent[0]).toEqual({ type: "hello", last_seq: 7 });
    expect(got.status).toEqual(["connecting", "open"]);
  });

  it("Snapshot setzt die Nummer, Ereignisse laufen lückenlos weiter", () => {
    const { client, sockets, got } = setup();
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "snapshot", seq: 10, state: makeSnapshot() });
    sockets[0].recv({ type: "event", event: ev("agent.moved", {}, { seq: 11 }) });
    sockets[0].recv({ type: "event", event: ev("agent.moved", {}, { seq: 12 }) });
    expect(got.snaps).toBe(1);
    expect(got.events.map((e) => e.seq)).toEqual([11, 12]);
    expect(got.live).toEqual([true, true]);
  });

  it("Uhrtakt geht an den Store, berührt aber die Nummernfolge nicht", () => {
    const { client, sockets, got } = setup();
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "snapshot", seq: 10, state: makeSnapshot() });
    sockets[0].recv({ type: "clock", minute: 431 });
    sockets[0].recv({ type: "event", event: ev("agent.walking", {}, { seq: 11 }) });
    expect(got.clock).toEqual([431]);
    expect(client.seq).toBe(11);
    expect(sockets[0].sent.filter((m) => m.type === "resync")).toEqual([]);
  });

  it("Zustand der Modellverwaltung geht weiter, ohne die Nummernfolge zu berühren", () => {
    const { client, sockets, got } = setup();
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "snapshot", seq: 10, state: makeSnapshot() });
    sockets[0].recv({ type: "models", status: { mode: "builtin" } });
    sockets[0].recv({ type: "event", event: ev("agent.walking", {}, { seq: 11 }) });
    expect(got.models).toEqual([{ mode: "builtin" }]);
    expect(client.seq).toBe(11);
    expect(sockets[0].sent.filter((m) => m.type === "resync")).toEqual([]);
  });

  it("verwirft Doppelte", () => {
    const { client, sockets, got } = setup(11);
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "events", items: [ev("a", {}, { seq: 10 }), ev("a", {}, { seq: 11 }), ev("a", {}, { seq: 12 })] });
    expect(got.events.map((e) => e.seq)).toEqual([12]);
    expect(got.live).toEqual([false]);
  });

  it("erkennt eine Lücke, fordert Resync an und liefert die Lückenwerte nicht aus", () => {
    const { client, sockets, got } = setup(10);
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "event", event: ev("a", {}, { seq: 14 }) });
    expect(got.events).toEqual([]);
    expect(sockets[0].sent.at(-1)).toEqual({ type: "resync", last_seq: 10 });
  });

  it("antwortet auf ping und resync_required", () => {
    const { client, sockets } = setup(3);
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "ping" });
    sockets[0].recv({ type: "resync_required", reason: "x" });
    expect(sockets[0].sent.slice(1)).toEqual([{ type: "pong" }, { type: "resync", last_seq: 3 }]);
  });

  it("verbindet nach Abbruch mit Backoff neu und nutzt die letzte Nummer", () => {
    const { client, sockets, got, fire } = setup(10);
    client.start(); sockets[0].open();
    sockets[0].recv({ type: "event", event: ev("a", {}, { seq: 11 }) });
    sockets[0].close();
    expect(got.status.at(-1)).toBe("reconnecting");
    fire(100);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].sent[0]).toEqual({ type: "hello", last_seq: 11 });
    sockets[1].close();
    fire(200);
    expect(sockets).toHaveLength(3);
  });

  it("Wächter schließt eine stumme Verbindung", () => {
    const { client, sockets, got, fire } = setup();
    client.start(); sockets[0].open();
    fire(45000);
    expect(got.status.at(-1)).toBe("reconnecting");
    fire(100);
    expect(sockets).toHaveLength(2);
  });

  it("stop beendet ohne Neuverbindung", () => {
    const { client, sockets, got, fire } = setup();
    client.start(); sockets[0].open();
    client.stop();
    fire(100);
    expect(sockets).toHaveLength(1);
    expect(got.status.at(-1)).toBe("closed");
  });
});
