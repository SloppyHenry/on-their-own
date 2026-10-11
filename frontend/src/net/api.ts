// REST-Zugriff. Verändernde Aufrufe tragen einen Idempotency-Key, damit Wiederholungen nichts doppelt tun.
import type { AgentDetail, EventDetail, EventsPage, Knowledge, LocationDetail, MemoriesPage, MemoryDetail, MemoryStats, RetrievalOut, SimCommandResult, StateSnapshot } from "../types/generated";

export class ApiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`HTTP ${status}: ${detail}`);
  }
}

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method === "POST") {
    headers["Idempotency-Key"] = key();
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* Antwort ohne JSON */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export interface EventQuery {
  after_seq?: number;
  before_seq?: number;
  type_prefix?: string;
  agent?: string;
  category?: string;
  location?: string;
  limit?: number;
  order?: "asc" | "desc";
}

const qs = (q: EventQuery) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
  return p.size ? `?${p}` : "";
};

export interface MemoryQuery {
  kind?: string;
  status?: string;
  q?: string;
  person?: string;
  location?: string;
  sort?: string;
  limit?: number;
  cursor?: string;
}

const mqs = (q: MemoryQuery) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
  return p.size ? `?${p}` : "";
};

export const api = {
  state: () => request<StateSnapshot>("GET", "/api/state"),
  events: (q: EventQuery = {}) => request<EventsPage>("GET", `/api/events${qs(q)}`),
  event: (ref: string | number) => request<EventDetail>("GET", `/api/events/${ref}`),
  agent: (id: string) => request<AgentDetail>("GET", `/api/agents/${id}`),
  location: (id: string) => request<LocationDetail>("GET", `/api/locations/${id}`),
  memories: (agent: string, q: MemoryQuery = {}) => request<MemoriesPage>("GET", `/api/agents/${agent}/memories${mqs(q)}`),
  memory: (agent: string, id: string) => request<MemoryDetail>("GET", `/api/agents/${agent}/memories/${id}`),
  knowledge: (agent: string) => request<Knowledge>("GET", `/api/agents/${agent}/knowledge`),
  retrievals: (agent: string, limit = 30) => request<RetrievalOut[]>("GET", `/api/agents/${agent}/retrievals?limit=${limit}`),
  memoryStats: (agent: string) => request<MemoryStats>("GET", `/api/agents/${agent}/memory-stats`),
  start: () => request<SimCommandResult>("POST", "/api/sim/start", {}),
  pause: () => request<SimCommandResult>("POST", "/api/sim/pause"),
  resume: () => request<SimCommandResult>("POST", "/api/sim/resume"),
  step: (n = 1) => request<SimCommandResult>("POST", "/api/sim/step", { n }),
  reset: () => request<SimCommandResult>("POST", "/api/sim/reset", { confirm: true }),
  speed: (level: string) => request<SimCommandResult>("POST", "/api/sim/speed", { level }),
};
