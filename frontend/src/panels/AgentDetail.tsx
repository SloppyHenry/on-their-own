// Bewohner-Karte (AP18b, Mockup Bild 2): rechts als Glas, mit Reitern Überblick, Ziele, Beziehungen, Entscheidungen, Fehlschläge. Knöpfe: Kamera folgt, Gedächtnis, Stimme.
import { useState } from "react";
import { formatTime } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { DIRECTIONS, resourceName } from "../lib/names";
import { api } from "../net/api";
import { useOverview } from "../net/useOverview";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/art/people";
import { KIND_LABEL } from "../memory/labels";
import { DecisionDetail } from "../timeline/DecisionDetail";
import { activityOf } from "./AgentPanel";
import { Drawer } from "./Drawer";
import { FailureList } from "./FailureList";
import { GoalProgress, GoalView } from "./GoalView";
import { NeedsBars } from "./NeedsBars";
import { RelationView } from "./RelationView";
import { useDetail } from "./useDetail";

const TABS = [["ueberblick", "Überblick"], ["ziele", "Ziele"], ["beziehungen", "Beziehungen"], ["entscheidungen", "Entscheidungen"], ["fehlschlaege", "Fehlschläge"]] as const;
type Tab = (typeof TABS)[number][0];

export function AgentDetail({ id }: { id: string }) {
  const w = useSimStore((s) => s.world!);
  const follow = useUiStore((s) => s.follow), setFollow = useUiStore((s) => s.setFollow), openMemory = useUiStore((s) => s.openMemory), openSettings = useUiStore((s) => s.openSettings);
  const { data } = useDetail(() => api.agent(id), id);
  const ov = useOverview()[id];
  const [tab, setTab] = useState<Tab>("ueberblick");
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
    <Drawer head={<Portrait id={id} size={56} />} title={<span style={{ color: c }}>{a.name}</span>} sub={prof ? `${prof.age} · ${prof.gender}` : <span title="Nebenfigur: ohne eigenes Gedächtnis und ohne Ziele">Nebenfigur</span>}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]"><Icon name={icon} /> <span>{text}</span><span className="text-dim">· {w.locations[a.location_id]?.name ?? "unterwegs"}</span></div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button className={`btn ${follow === id ? "on" : ""}`} onClick={() => setFollow(follow === id ? null : id)} aria-pressed={follow === id}>◎ Kamera folgt <kbd className="kbd">F</kbd></button>
        {prof && <button className="btn" onClick={() => openMemory(id, "memories")} data-testid="karte-gedaechtnis">🧠 Gedächtnis</button>}
        <button className="btn" onClick={() => openSettings("ton")} title="Stimme und Klang dieser Figur: Einstellungen › Ton">🗣 Stimme</button>
      </div>
      <div className="-mx-4 mb-1 flex gap-0.5 border-b border-line px-3" role="tablist" aria-label="Karte">
        {TABS.filter(([t]) => prof || t === "ueberblick").map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`karte-${t}`}
            className={`-mb-px cursor-pointer border-b-2 bg-transparent px-1.5 py-2 text-[11.5px] font-bold ${tab === t ? "border-alex text-text" : "border-transparent text-dim hover:text-text"}`}>{label}</button>
        ))}
      </div>
      {tab === "ueberblick" && (<>
        <dl className="my-2.5 grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
          {ov?.goal && (<><dt className="text-dim">Ziel</dt><dd data-testid={`goal-line-${id}`} title={ov.goal.text}>{ov.goal.text}<GoalProgress g={ov.goal} /></dd></>)}
          <dt className="text-dim">Position</dt><dd className="font-mono text-xs">({a.x}, {a.y}) · blickt nach {DIRECTIONS[a.facing] ?? a.facing}</dd>
          <dt className="text-dim">Trägt</dt><dd>{[...inv, ...held].join(", ") || "nichts"}</dd>
          {data?.mood && (<><dt className="text-dim">Stimmung</dt><dd>{data.mood}</dd></>)}
        </dl>
        {ov && (<><div className="sub">Bedürfnisse und Stimmung</div>
          <div className="mb-1 text-[13px]" data-testid="mood-detail">Stimmung: <b data-testid={`mood-${id}`} title="Stimmung">{ov.mood.word}</b> <span className="font-mono text-xs text-dim">({ov.mood.value > 0 ? "+" : ""}{ov.mood.value})</span>{ov.resting && <span className="text-warn"> · Ruhemodus</span>}</div>
          <div className="mb-1.5 flex flex-wrap gap-x-2 text-[11px] text-dim">{ov.mood.reasons.map(([n, v]) => <span key={String(n)}>{String(n)} {Number(v) > 0 ? "+" : ""}{String(v)}</span>)}</div>
          <NeedsBars needs={ov.needs} /></>)}
        <div className="sub">Erinnerungen{mem ? ` (${mem.total})` : ""}</div>
        {mem?.items.map((m) => <div key={m.id} className="border-b border-line py-1 text-xs"><span className="text-dim">{KIND_LABEL[m.kind]} · ★ {m.importance} ·</span> {m.text}</div>)}
        {mem && !mem.items.length && <div className="text-dim">Noch nichts gemerkt.</div>}
      </>)}
      {tab === "ziele" && <GoalView agent={id} />}
      {tab === "beziehungen" && <RelationView agent={id} />}
      {tab === "fehlschlaege" && <FailureList agent={id} />}
      {tab === "entscheidungen" && (<>
        <div className="sub">Letzte Entscheidungen</div>
        {(data?.decisions ?? []).slice(0, 12).map((d) => (
          <div key={d.id} className="border-b border-line py-1 text-xs">
            <button className="flex w-full cursor-pointer gap-2 bg-transparent text-left" onClick={() => setOpenDec(openDec === d.id ? null : d.id)} aria-expanded={openDec === d.id}>
              <span className="font-mono text-faint">{formatTime(d.sim_minute)}</span><span className="flex-1">{d.intent || d.chosen || d.action}</span>
              <span className={d.outcome === "accepted" ? "text-ok" : d.outcome ? "text-warn" : "text-dim"}>{d.outcome_text ?? d.status}</span><span className="text-plan underline">Warum?</span></button>
            {openDec === d.id && <div className="mt-1 rounded-md bg-panel2 p-2"><DecisionDetail id={d.id} /></div>}
          </div>
        ))}
        {data && !data.decisions.length && <div className="text-dim">Noch keine Entscheidung.</div>}
      </>)}
    </Drawer>
  );
}
