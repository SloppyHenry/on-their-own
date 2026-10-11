// WebSocket-Client: hello mit last_seq, Lückenprüfung, Resync, Wiederverbindung mit Backoff, Wächter gegen tote Verbindungen.
import type { EventOut, StateSnapshot } from "../types/generated";
import type { Conn } from "../store/types";
import { checkSeq } from "./gap";

export interface SocketLike {
  send(data: string): void;
  close(code?: number): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface WsHandlers {
  onSnapshot(s: StateSnapshot): void;
  onEvents(items: EventOut[], live: boolean): void;
  onStatus(c: Conn): void;
  /** Uhrtakt ohne Nummer; geht nicht in die Lückenprüfung ein. */
  onClock?(minute: number): void;
}

export interface WsOptions {
  url: string;
  initialSeq?: number | null;
  socketFactory?: (url: string) => SocketLike;
  backoffMs?: number[];
  staleMs?: number;
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void };
}

export function defaultUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export class WsClient {
  seq: number | null;
  private sock: SocketLike | null = null;
  private stopped = true;
  private attempt = 0;
  private retry: unknown = null;
  private watchdog: unknown = null;
  private readonly backoff: number[];
  private readonly staleMs: number;
  private readonly timers: NonNullable<WsOptions["timers"]>;

  constructor(private readonly opt: WsOptions, private readonly h: WsHandlers) {
    this.seq = opt.initialSeq ?? null;
    this.backoff = opt.backoffMs ?? [500, 1000, 2000, 4000, 8000];
    this.staleMs = opt.staleMs ?? 45000;
    this.timers = opt.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  }

  start(): void {
    this.stopped = false;
    this.h.onStatus("connecting");
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retry !== null) this.timers.clear(this.retry);
    if (this.watchdog !== null) this.timers.clear(this.watchdog);
    this.retry = this.watchdog = null;
    this.sock?.close(1000);
    this.sock = null;
    this.h.onStatus("closed");
  }

  private connect(): void {
    const s = (this.opt.socketFactory ?? ((u) => new WebSocket(u) as unknown as SocketLike))(this.opt.url);
    this.sock = s;
    s.onopen = () => {
      this.h.onStatus("open");
      s.send(JSON.stringify({ type: "hello", last_seq: this.seq }));
      this.touch();
    };
    s.onmessage = (m) => {
      this.touch();
      this.attempt = 0;
      this.handle(m.data);
    };
    s.onerror = () => undefined;
    s.onclose = () => {
      if (this.sock !== s) return;
      this.sock = null;
      this.lost();
    };
  }

  private lost(): void {
    if (this.watchdog !== null) this.timers.clear(this.watchdog);
    this.watchdog = null;
    if (this.stopped) return;
    this.h.onStatus("reconnecting");
    const wait = this.backoff[Math.min(this.attempt, this.backoff.length - 1)];
    this.attempt += 1;
    this.retry = this.timers.set(() => this.connect(), wait);
  }

  private touch(): void {
    if (this.watchdog !== null) this.timers.clear(this.watchdog);
    this.watchdog = this.timers.set(() => this.sock?.close(4000), this.staleMs);
  }

  private send(obj: unknown): void {
    this.sock?.send(JSON.stringify(obj));
  }

  private resync(): void {
    this.send({ type: "resync", last_seq: this.seq });
  }

  private accept(items: EventOut[], live: boolean): void {
    const out: EventOut[] = [];
    for (const ev of items) {
      const c = checkSeq(this.seq, ev.seq);
      if (c === "duplicate") continue;
      if (c === "gap") {
        this.resync();
        break;
      }
      this.seq = ev.seq;
      out.push(ev);
    }
    if (out.length) this.h.onEvents(out, live);
  }

  private handle(raw: string): void {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "snapshot":
        this.seq = msg.seq as number;
        this.h.onSnapshot(msg.state as StateSnapshot);
        break;
      case "events":
        this.accept(msg.items as EventOut[], false);
        break;
      case "event":
        this.accept([msg.event as EventOut], true);
        break;
      case "ping":
        this.send({ type: "pong" });
        break;
      case "clock":
        this.h.onClock?.(msg.minute as number);
        break;
      case "resync_required":
        this.resync();
        break;
    }
  }
}
