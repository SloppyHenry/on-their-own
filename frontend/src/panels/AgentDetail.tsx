import { formatTime } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { DIRECTIONS, resourceName } from "../lib/names";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/art/people";
import { KIND_LABEL } from "../memory/labels";
import { activityOf } from "./AgentPanel";
import { Drawer } from "./Drawer";
import { FailureList } from "./FailureList";
import { GoalView } from "./GoalView";
import { NeedsBars } from "./NeedsBars";
import { RelationView } from "./RelationView";
import { DecisionDetail } from "../timeline/DecisionDetail";
import { useOverview } from "../net/useOverview";
import { useState } from "react";
import { useDetail } from "./useDetail";


export function AgentDetail({ id }: { id: string }) {
  const w = useSimStore((s) => s.world!);
  const select = useUiStore((s) => s.select);
  const follow = useUiStore((s) => s.follow);
  const setFollow = useUiStore((s) => s.setFollow);
  const { data } = useDetail(() => api.agent(id), id);
  const openMemory = useUiStore((s) => s.openMemory);
  const ov = useOverview()[id];
  const [openDec, setOpenDec] = useState<number | null>(null);
  const memVersion = useSimStore((s) => s.memoryVersion);
  const { data: mem } = useDetail(() => api.memories(id, { limit: 5, sort: "time", status: "active" }), `${id}/mem/${memVersion}`, 0);
  const a = w.agents[id];
  if (!a) return null;
  const c = accentOf(id);
  const { text, icon } = activityOf(a, w);
  const held = Object.values(w.objects).filter((o) => o.holder === id).map((o) => o.name);
  const inv = Object.entries(a.inventory).map(([k, v]) => `${resourceName(k)} ×${v}`);
  const prof = a.profile;

  return (
    <Drawer head={<Portrait id={id} size={56} />} title={<span style={{ color: c }}>{a.name}</span>} sub={prof ? `${prof.age} · ${prof.gender}` : undefined}>
      <dl className="my-2.5 grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
        <dt className="text-dim">Status</dt><dd><Icon name={icon} /> {text}</dd>
        <dt className="text-dim">Position</dt><dd className="font-mono text-xs">({a.x}, {a.y}) · {w.locations[a.location_id]?.name ?? "—"} · blickt nach {DIRECTIONS[a.facing] ?? a.facing}</dd>
        <dt className="text-dim">Trägt</dt><dd>{[...inv, ...held].join(", ") || "nichts"}</dd>
        {data?.mood && (<><dt className="text-dim">Stimmung</dt><dd>{data.mood}</dd></>)}
      </dl>
      <button className={`btn ${follow === id ? "on" : ""}`} onClick={() => setFollow(follow === id ? null : id)}>Kamera folgt</button>
      {ov && (<><div className="sub">Bedürfnisse und Stimmung</div>
        <div className="mb-1 text-[13px]" data-testid="mood-detail">Stimmung: <b>{ov.mood.word}</b> <span className="font-mono text-xs text-dim">({ov.mood.value > 0 ? "+" : ""}{ov.mood.value})</span>{ov.resting && <span className="text-warn"> · Ruhemodus</span>}</div>
        <div className="mb-1.5 flex flex-wrap gap-x-2 text-[11px] text-dim">{ov.mood.reasons.map(([n, v]) => <span key={String(n)}>{String(n)} {Number(v) > 0 ? "+" : ""}{String(v)}</span>)}</div>
        <NeedsBars needs={ov.needs} /></>)}
      <GoalView agent={id} />
      <RelationView agent={id} />
      <FailureList agent={id} />
      <div className="sub">Letzte Entscheidungen</div>
      {(data?.decisions ?? []).slice(0, 8).map((d) => (
        <div key={d.id} className="border-b border-line py-1 text-xs">
          <button className="flex w-full cursor-pointer gap-2 text-left" onClick={() => setOpenDec(openDec === d.id ? null : d.id)} aria-expanded={openDec === d.id}>
            <span className="font-mono text-faint">{formatTime(d.sim_minute)}</span><span className="flex-1">{d.intent || d.chosen || d.action}</span>
            <span className={d.outcome === "accepted" ? "text-ok" : d.outcome ? "text-warn" : "text-dim"}>{d.outcome_text ?? d.status}</span><span className="text-plan underline">Warum?</span></button>
          {openDec === d.id && <div className="mt-1 rounded-md bg-panel2 p-2"><DecisionDetail id={d.id} /></div>}
        </div>
      ))}
      <div className="sub">Erinnerungen{mem ? ` (${mem.total})` : ""}</div>
      {mem?.items.map((m) => <div key={m.id} className="border-b border-line py-1 text-xs"><span className="text-dim">{KIND_LABEL[m.kind]} · ★ {m.importance} ·</span> {m.text}</div>)}
      {mem && !mem.items.length && <div className="text-dim">Noch nichts gemerkt.</div>}
      <button className="btn mt-2 text-xs" onClick={() => openMemory(id)}>Gedächtnis öffnen</button>
      <button className="btn mt-4" onClick={() => select(null)}>Schließen</button>
    </Drawer>
  );
}
