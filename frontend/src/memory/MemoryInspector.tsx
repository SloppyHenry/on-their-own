import { useState } from "react";
import { Portrait } from "../lib/Portrait";
import { useNames } from "../lib/useNames";
import { api } from "../net/api";
import { useDetail } from "../panels/useDetail";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/draw/characters";
import { KnowledgeView } from "./KnowledgeView";
import { KIND_COLOR, KIND_LABEL, KINDS, SORTS } from "./labels";
import { MemoryDetail } from "./MemoryDetail";
import { MemoryList } from "./MemoryList";
import { RetrievalLog } from "./RetrievalLog";
import { useMemories } from "./useMemories";

type Tab = "memories" | "knowledge" | "retrievals";

function Column({ agent, filters, selected, onSelect }: { agent: string; filters: Filters; selected: string | null; onSelect: (agent: string, id: string) => void }) {
  const list = useMemories(agent, { kind: filters.kind, status: filters.status, q: filters.q, person: filters.person, location: filters.location, sort: filters.sort });
  return <MemoryList {...list} more={() => void list.more()} selected={selected} onSelect={(m) => onSelect(agent, m.id)} />;
}

interface Filters { kind: string; status: string; q: string; person: string; location: string; sort: string }
const EMPTY: Filters = { kind: "", status: "active", q: "", person: "", location: "", sort: "time" };

export function MemoryInspector() {
  const world = useSimStore((s) => s.world!);
  const names = useNames();
  const stored = useUiStore((s) => s.memoryAgent);
  const openMemory = useUiStore((s) => s.openMemory);
  const agents = world.agentOrder;
  const agent = stored && agents.includes(stored) ? stored : agents[0];
  const [tab, setTab] = useState<Tab>("memories");
  const [f, setF] = useState<Filters>(EMPTY);
  const [pick, setPick] = useState<{ agent: string; id: string } | null>(null);
  const [side, setSide] = useState(false);
  const version = useSimStore((s) => s.memoryVersion);
  const { data: stats } = useDetail(() => api.memoryStats(agent), `${agent}/${version}`, 5000);
  const set = (p: Partial<Filters>) => setF((o) => ({ ...o, ...p }));
  const chip = (on: boolean, color = "var(--color-sys)") => ({ borderColor: on ? color : "var(--color-line)", color: on ? "var(--color-text)" : "var(--color-dim)", background: on ? "#ffffff0a" : undefined });
  const others = agents.filter((a) => a !== agent);
  const locations = Object.values(world.locations).filter((l) => !l.props.fallback);

  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_1fr] bg-bg" data-testid="memory-inspector">
      <div className="min-h-0 space-y-4 overflow-auto border-r border-line bg-panel p-4">
        <div className="flex gap-2">{agents.map((a) => (
          <button key={a} data-testid={`memory-agent-${a}`} onClick={() => openMemory(a)} aria-pressed={a === agent} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1" style={{ borderColor: a === agent ? accentOf(a) : "var(--color-line)", opacity: a === agent ? 1 : 0.6 }}>
            <Portrait id={a} size={28} /><b style={{ color: accentOf(a) }}>{names.agent(a)}</b></button>))}</div>
        {stats && <div className="text-xs text-dim">{stats.active} aktiv · {stats.archived} archiviert<br />Seit der letzten Reflexion: Wichtigkeit {stats.importance_since_reflection}</div>}
        <div className="flex flex-wrap gap-1">{(["memories", "knowledge", "retrievals"] as Tab[]).map((t) => (
          <button key={t} className="cursor-pointer rounded-full border px-2.5 py-0.5 text-xs" style={chip(tab === t, "var(--color-alex)")} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {{ memories: "Erinnerungen", knowledge: "Was ich weiß", retrievals: "Abrufe" }[t]}</button>))}</div>
        {tab === "memories" && (<>
          <div><div className="sub !mt-0">Art</div><div className="flex flex-wrap gap-1">
            <button className="cursor-pointer rounded-full border px-2 py-0.5 text-xs" style={chip(f.kind === "")} onClick={() => set({ kind: "" })}>Alle</button>
            {KINDS.map((k) => <button key={k} data-testid={`kind-${k}`} className="cursor-pointer rounded-full border px-2 py-0.5 text-xs" style={chip(f.kind === k, KIND_COLOR[k])} onClick={() => set({ kind: f.kind === k ? "" : k })}>{KIND_LABEL[k]}</button>)}</div></div>
          <label className="block text-xs text-dim">Status
            <select className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-text" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="active">aktiv</option><option value="archived">archiviert</option><option value="">alle</option></select></label>
          <label className="block text-xs text-dim">Person
            <select className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-text" value={f.person} onChange={(e) => set({ person: e.target.value })}><option value="">alle</option>{others.map((o) => <option key={o} value={o}>{names.agent(o)}</option>)}</select></label>
          <label className="block text-xs text-dim">Ort
            <select className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-text" value={f.location} onChange={(e) => set({ location: e.target.value })}><option value="">alle</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="block text-xs text-dim">Sortierung
            <select className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-text" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <input className="w-full rounded-md border border-line bg-bg px-2 py-1 text-xs" placeholder="Suchen …" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Erinnerungen durchsuchen" />
          {agents.length > 1 && <label className="flex cursor-pointer items-center gap-2 text-xs text-dim"><input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} /> Alle nebeneinander</label>}
        </>)}
      </div>
      <div className={`grid min-h-0 ${pick ? "grid-cols-[1fr_420px]" : "grid-cols-1"}`}>
        <div className="flex min-h-0 flex-col pt-3">
          {tab === "memories" && (side ? (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">{agents.map((a) => <div key={a} className="flex min-h-0 flex-col"><h3 className="px-3 pb-1 font-semibold" style={{ color: accentOf(a) }}>{names.agent(a)}</h3>
              <Column agent={a} filters={f} selected={pick?.agent === a ? pick.id : null} onSelect={(ag, id) => setPick({ agent: ag, id })} /></div>)}</div>
          ) : <Column agent={agent} filters={f} selected={pick?.agent === agent ? pick.id : null} onSelect={(ag, id) => setPick({ agent: ag, id })} />)}
          {tab === "knowledge" && <KnowledgeView agent={agent} />}
          {tab === "retrievals" && <RetrievalLog agent={agent} onPick={(id) => { setTab("memories"); setF({ ...EMPTY, status: "" }); setPick({ agent, id }); }} />}
        </div>
        {pick && <MemoryDetail agent={pick.agent} id={pick.id} onPick={(id) => setPick({ agent: pick.agent, id })} onClose={() => setPick(null)} />}
      </div>
    </div>
  );
}
