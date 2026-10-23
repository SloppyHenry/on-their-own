// REST-Zugriff. Verändernde Aufrufe tragen einen Idempotency-Key, damit Wiederholungen nichts doppelt tun.
import type { AgentDetail, AgentNeeds, AgentOverview, DecisionOut, FactorRegistry, FailureOut, GoalOut, RelationOut, EventDetail, EventsPage, Knowledge, LocationDetail, MemoriesPage, MemoryDetail, MemoryStats, RetrievalOut, SimCommandResult, StateSnapshot, ParamPatchOut, ParamSchema, ParamValues, PresetBrief, PresetLoadOut, PresetOut, PresetPreview, StatusOut, InjectProposal, ScheduledOut, SaveOut, StatsOut, AuthStatus, GenerateRequest, GeneratePreview, GenerateApplyRequest, GenerateApplied, PatchPreview, Voice, VoiceOut, NewSimApplied, NewSimLimits, NewSimPreview, NewSimRequest, RulesPreviewRequest, TemplateImported, TemplateOut, CatalogOut, HardwareOut, ExternalTestOut, LlmStatusOut, ModeSet, WorldInfoOut, WorldDoc, AddAreaOut } from "../types/generated";

import type { Aktion, DraftApplied, DraftPreview, FileDraft, Katalog } from "../gestalten/typen";

export class ApiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`HTTP ${status}: ${detail}`);
  }
}

export const AUTH_REQUIRED = "sim:auth-required";

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

async function request<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
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
    if (res.status === 401 && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event(AUTH_REQUIRED));   // Anmeldung abgelaufen
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface EventQuery {
  from_minute?: number;
  to_minute?: number;
  q?: string;
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

export const exportUrl = (id: string) => `/api/saves/${id}/export`;
export const eventsExportUrl = (format: "csv" | "json", q: EventQuery & { from_minute?: number; to_minute?: number; q?: string }) => {
  const p = new URLSearchParams({ format });
  Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
  return `/api/events/export?${p}`;
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
  setVoice: (agent: string, voice: Voice | null) => request<VoiceOut>("PUT", `/api/agents/${encodeURIComponent(agent)}/voice`, { voice }),
  reset: (model?: string, keepProfiles = false, playMode?: "leben" | "gott") => request<SimCommandResult>("POST", "/api/sim/reset", { confirm: true, keep_profiles: keepProfiles, ...(model ? { model } : {}), ...(playMode ? { play_mode: playMode } : {}) }),
  /** Spielart wechseln (Menü › Einstellungen › Spielart, mit Bestätigung). */
  setPlayMode: (playMode: "leben" | "gott") => request<SimCommandResult>("PUT", "/api/sim/play-mode", { play_mode: playMode, confirm: true }),
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
  saves: () => request<SaveOut[]>("GET", "/api/saves"),
  save: (name: string, description: string, overwrite = false) => request<SaveOut>("POST", "/api/saves", { name, description, overwrite }),
  loadSave: (id: string) => request<SaveOut>("POST", `/api/saves/${id}/load`, { confirm: true }),
  deleteSave: (id: string) => request<SaveOut>("DELETE", `/api/saves/${id}?confirm=true`),
  importSave: async (file: Blob): Promise<SaveOut> => {
    const res = await fetch("/api/saves/import", { method: "POST", headers: { "Idempotency-Key": key(), "Content-Type": "application/zip" }, body: file });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new ApiError(res.status, typeof j.detail === "string" ? j.detail : res.statusText);
    }
    return (await res.json()) as SaveOut;
  },
  generate: (body: GenerateRequest) => request<GeneratePreview>("POST", "/api/world/generate", body),
  applyGenerated: (body: GenerateApplyRequest) => request<GenerateApplied>("POST", "/api/world/generate/apply", { ...body, confirm: true }),
  // Weltenbibliothek und Werkstatt (AP18e)
  worlds: () => request<WorldInfoOut[]>("GET", "/api/worlds"),
  world: (id: string) => request<WorldDoc>("GET", `/api/worlds/${encodeURIComponent(id)}`),
  blankWorld: (name: string, size: "klein" | "mittel" | "gross", edge: "wald" | "offen") => request<WorldInfoOut>("POST", "/api/worlds/blank", { name, size, edge }),
  generateWorld: (body: { name?: string; seed: number; lake: "auto" | "east" | "south"; mix?: Record<string, number> | null }) => request<WorldInfoOut>("POST", "/api/worlds/generate", body),
  saveWorld: (id: string, world: object) => request<WorldInfoOut>("PUT", `/api/worlds/${encodeURIComponent(id)}`, { world }),
  renameWorld: (id: string, name: string) => request<WorldInfoOut>("PATCH", `/api/worlds/${encodeURIComponent(id)}`, { name }),
  deleteWorld: (id: string) => request<void>("DELETE", `/api/worlds/${encodeURIComponent(id)}`),
  duplicateWorld: (id: string) => request<WorldInfoOut>("POST", `/api/worlds/${encodeURIComponent(id)}/duplicate`, {}),
  createWorld: (world: object, name: string) => request<WorldInfoOut>("POST", "/api/worlds", { world, name }),
  worldFromSim: (name: string) => request<WorldInfoOut>("POST", "/api/worlds/from-sim", { name }),
  previewWorld: (world: object) => request<NewSimPreview>("POST", "/api/worlds/preview", { world }),
  addArea: (world: object, at: [number, number], seed: number, lake: "auto" | "east" | "south") => request<AddAreaOut>("POST", "/api/worlds/add-area", { world, at, seed, lake }),
  gestaltenKatalog: () => request<Katalog>("GET", "/api/gestalten/katalog"),
  entwurfVorschau: (actions: Aktion[]) => request<DraftPreview>("POST", "/api/world/draft/preview", { actions }),
  entwurfUebernehmen: (actions: Aktion[], digest: string) => request<DraftApplied>("POST", "/api/world/draft/apply", { actions, digest, confirm: true }),
  entwurfDatei: (world: object, actions: Aktion[], snapshot: boolean) => request<FileDraft>("POST", "/api/worlds/draft", { world, actions, snapshot }),
  worldExportUrl: (id: string) => `/api/worlds/${encodeURIComponent(id)}/export`,
  /** Eine Weltdatei (Text) als neue Welt importieren; Fehler stehen in ApiError.detail. */
  importWorld: async (text: string): Promise<WorldInfoOut> => {
    const res = await fetch("/api/worlds/import", { method: "POST", headers: { "Idempotency-Key": key(), "Content-Type": "application/json" }, body: text });
    if (!res.ok) { let d = res.statusText; try { const j = await res.json(); d = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j); } catch { /* keine JSON-Antwort */ } throw new ApiError(res.status, d); }
    return (await res.json()) as WorldInfoOut;
  },
  newSimLimits: () => request<NewSimLimits>("GET", "/api/sim/new/limits"),
  newSimPreview: (body: NewSimRequest) => request<NewSimPreview>("POST", "/api/sim/new/preview", body),
  newSimApply: (body: NewSimRequest, digest: string) => request<NewSimApplied>("POST", "/api/sim/new", { ...body, digest, confirm: true }),
  /** Ein Satz der Weltregeln durch die Ereigniseingabe, auf der Welt des Entwurfs (ändert nichts). */
  newSimRules: (body: RulesPreviewRequest) => request<InjectProposal>("POST", "/api/sim/new/rules/preview", body),
  templates: () => request<TemplateOut[]>("GET", "/api/templates"),
  createTemplate: (profile: object, personality: object) => request<TemplateOut>("POST", "/api/templates", { profile, personality }),
  updateTemplate: (id: string, profile: object, personality: object) => request<TemplateOut>("PUT", `/api/templates/${encodeURIComponent(id)}`, { profile, personality }),
  deleteTemplate: (id: string) => request<{ deleted: string }>("DELETE", `/api/templates/${encodeURIComponent(id)}`),
  duplicateTemplate: (id: string) => request<TemplateOut>("POST", `/api/templates/${encodeURIComponent(id)}/duplicate`, {}),
  /** Importiert den Text einer Vorlagendatei als neue Vorlage; Fehler kommen alle auf einmal (ApiError.detail, eine Zeile je Fehler). */
  importTemplate: async (text: string): Promise<TemplateImported> => {
    const res = await fetch("/api/templates/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, typeof j.detail === "string" ? j.detail : res.statusText);
    return j as TemplateImported;
  },
  exportTemplate: async (id: string): Promise<string> => {
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}/export`);
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.text();
  },
  patchPreview: (patch: object) => request<PatchPreview>("POST", "/api/world/patch/preview", { patch }),
  stats: (q: { agent?: string; from_minute?: number; to_minute?: number } = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    return request<StatsOut>("GET", `/api/stats${p.size ? `?${p}` : ""}`);
  },
  status: () => request<StatusOut>("GET", "/api/status"),
  injectParse: (body: { text?: string; agents?: string[] | null; at?: number | null; answer_to?: string; answer?: string | number }) => request<InjectProposal>("POST", "/api/inject/parse", body),
  injectConfirm: (proposal_id: string) => request<InjectProposal>("POST", "/api/inject/confirm", { proposal_id }),
  injectHistory: (limit = 30) => request<InjectProposal[]>("GET", `/api/inject/history?limit=${limit}`),
  authStatus: () => request<AuthStatus>("GET", "/api/auth/status"),
  login: (token: string) => request<AuthStatus>("POST", "/api/auth/login", { token }),
  /** Modellverwaltung (AP17c): jeder verändernde Aufruf liefert den neuen Gesamtzustand. */
  hardware: () => request<HardwareOut>("GET", "/api/hardware"),
  catalog: (q: { q?: string; only_fit?: boolean; publishers?: "trusted" | "all"; refresh?: boolean; limit?: number }) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return request<CatalogOut>("GET", `/api/models/catalog${p.size ? `?${p}` : ""}`);
  },
  llm: () => request<LlmStatusOut>("GET", "/api/llm"),
  setLlmMode: (body: ModeSet) => request<LlmStatusOut>("PUT", "/api/llm", body),
  testLlm: (url?: string, key?: string) => request<ExternalTestOut>("POST", "/api/llm/test", { url: url || null, key: key || null }),
  installRuntime: () => request<LlmStatusOut>("POST", "/api/llm/runtime/install", { confirm: true }),
  startModel: (model_id: string) => request<LlmStatusOut>("POST", "/api/llm/start", { model_id }),
  stopModel: () => request<LlmStatusOut>("POST", "/api/llm/stop"),
  setDefaultModel: (model_id: string) => request<LlmStatusOut>("PUT", "/api/llm/default", { model_id }),
  downloadModel: (repo: string, file: string) => request<LlmStatusOut>("POST", "/api/models/downloads", { repo, file, confirm: true }),
  cancelTransfer: () => request<LlmStatusOut>("DELETE", "/api/models/downloads/current"),
  deleteModel: (id: string) => request<LlmStatusOut>("DELETE", `/api/models/installed/${encodeURIComponent(id)}?confirm=true`),
  probeModel: (id: string) => request<LlmStatusOut>("POST", `/api/models/installed/${encodeURIComponent(id)}/probe`),
  cancelProbe: () => request<LlmStatusOut>("DELETE", "/api/models/probe"),
  scheduled: () => request<ScheduledOut[]>("GET", "/api/scheduled"),
  cancelScheduled: (id: string) => request<ScheduledOut>("DELETE", `/api/scheduled/${id}`),
};
