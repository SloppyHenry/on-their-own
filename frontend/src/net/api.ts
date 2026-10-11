// REST-Zugriff. Verändernde Aufrufe tragen einen Idempotency-Key, damit Wiederholungen nichts doppelt tun.
import type { AgentDetail, AgentNeeds, AgentOverview, DecisionOut, FactorRegistry, FailureOut, GoalOut, RelationOut, EventDetail, EventsPage, Knowledge, LocationDetail, MemoriesPage, MemoryDetail, MemoryStats, RetrievalOut, SimCommandResult, StateSnapshot, ParamPatchOut, ParamSchema, ParamValues, PresetBrief, PresetLoadOut, PresetOut, PresetPreview, StatusOut, InjectProposal, ScheduledOut } from "../types/generated";

export class ApiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`HTTP ${status}: ${detail}`);
  }
}

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
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
  overview: () => request<AgentOverview[]>("GET", "/api/overview"),
  needs: (agent: string) => request<AgentNeeds>("GET", `/api/agents/${agent}/needs`),
  goals: (agent: string, limit = 20) => request<GoalOut[]>("GET", `/api/agents/${agent}/goals?limit=${limit}`),
  relations: (agent: string) => request<RelationOut[]>("GET", `/api/agents/${agent}/relations`),
  failures: (agent: string, limit = 20) => request<FailureOut[]>("GET", `/api/agents/${agent}/failures?limit=${limit}`),
  decisions: (agent: string, limit = 10) => request<DecisionOut[]>("GET", `/api/agents/${agent}/decisions?limit=${limit}`),
  decision: (id: number) => request<DecisionOut>("GET", `/api/decisions/${id}`),
  factors: () => request<FactorRegistry>("GET", "/api/factors"),
  start: () => request<SimCommandResult>("POST", "/api/sim/start", {}),
  pause: () => request<SimCommandResult>("POST", "/api/sim/pause"),
  resume: () => request<SimCommandResult>("POST", "/api/sim/resume"),
  step: (n = 1) => request<SimCommandResult>("POST", "/api/sim/step", { n }),
  reset: (model?: string) => request<SimCommandResult>("POST", "/api/sim/reset", { confirm: true, ...(model ? { model } : {}) }),
  speed: (level: string) => request<SimCommandResult>("POST", "/api/sim/speed", { level }),
  paramSchema: () => request<ParamSchema>("GET", "/api/params/schema"),
  params: () => request<ParamValues>("GET", "/api/params"),
  patchParams: (changes: { key: string; value: unknown; agent?: string | null }[]) => request<ParamPatchOut>("PATCH", "/api/params", { changes }),
  resetParams: (body: { keys?: string[]; group?: string; agent?: string } = {}) => request<ParamPatchOut>("POST", "/api/params/reset", body),
  presets: () => request<PresetBrief[]>("GET", "/api/presets"),
  presetPreview: (id: string) => request<PresetPreview>("GET", `/api/presets/${id}/preview`),
  loadPreset: (id: string) => request<PresetLoadOut>("POST", `/api/presets/${id}/load`, { confirm: true }),
  savePreset: (name: string, description: string, groups: string[] | null) => request<PresetOut>("POST", "/api/presets", { name, description, groups }),
  duplicatePreset: (id: string) => request<PresetOut>("POST", `/api/presets/${id}/duplicate`, {}),
  renamePreset: (id: string, name: string) => request<PresetOut>("PATCH", `/api/presets/${id}`, { name }),
  deletePreset: (id: string) => request<PresetBrief>("DELETE", `/api/presets/${id}?confirm=true`),
  status: () => request<StatusOut>("GET", "/api/status"),
  injectParse: (body: { text?: string; agents?: string[] | null; at?: number | null; answer_to?: string; answer?: string | number }) => request<InjectProposal>("POST", "/api/inject/parse", body),
  injectConfirm: (proposal_id: string) => request<InjectProposal>("POST", "/api/inject/confirm", { proposal_id }),
  injectHistory: (limit = 30) => request<InjectProposal[]>("GET", `/api/inject/history?limit=${limit}`),
  scheduled: () => request<ScheduledOut[]>("GET", "/api/scheduled"),
  cancelScheduled: (id: string) => request<ScheduledOut>("DELETE", `/api/scheduled/${id}`),
};
