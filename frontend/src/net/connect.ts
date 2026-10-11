// Verbindet WebSocket, REST und Store. Ereignisse werden gebündelt, damit bei höchstem Tempo nicht jedes einzeln rendert.
import { useSimStore } from "../store/simStore";
import type { EventOut } from "../types/generated";
import { api } from "./api";
import { defaultUrl, WsClient } from "./wsClient";

const HISTORY = 400;
const STATUS_POLL_MS = 10000;

export function startLive(url = defaultUrl()): () => void {
  const st = useSimStore.getState;
  let queue: { items: EventOut[]; live: boolean }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let clock: number | null = null;

  const flush = () => {
    timer = null;
    const q = queue;
    queue = [];
    for (const live of [false, true]) {
      const items = q.filter((b) => b.live === live).flatMap((b) => b.items);
      if (items.length) st().pushEvents(items, live);
    }
    if (clock !== null) st().setClock(clock);                // nach den Ereignissen derselben Runde
    clock = null;
    if (st().world?.stale) void reload();
  };

  const reload = async () => {
    const snap = await api.state();
    st().setSnapshot(snap);
    client.seq = snap.seq;
    await loadHistory(snap.seq);
  };

  const loadHistory = async (upTo: number) => {
    try {
      const page = await api.events({ before_seq: upTo + 1, order: "desc", limit: HISTORY });
      st().setHistory([...page.items].reverse());
    } catch {
      /* Verlauf ist nachrangig; Live-Ereignisse kommen trotzdem */
    }
  };

  const client = new WsClient(
    { url },
    {
      onSnapshot: (s) => {
        queue = [];
        clock = null;
        st().setSnapshot(s);
        void loadHistory(s.seq);
      },
      onEvents: (items, live) => {
        queue.push({ items, live });
        timer ??= setTimeout(flush, 40);
      },
      onClock: (minute) => {
        clock = Math.max(clock ?? 0, minute);
        timer ??= setTimeout(flush, 40);
      },
      onStatus: (c) => st().setConn(c),
    },
  );
  client.start();

  const poll = setInterval(() => {
    api.state().then((s) => st().mergeSimulation(s)).catch(() => undefined);
  }, STATUS_POLL_MS);

  return () => {
    clearInterval(poll);
    if (timer) clearTimeout(timer);
    client.stop();
  };
}
