import { clockOf } from "../lib/clock";
import { api } from "../net/api";
import { useNames } from "../lib/useNames";
import { useDetail } from "../panels/useDetail";
import { useSimStore } from "../store/simStore";
import { accentOf } from "../world/draw/characters";

const when = (min: number | null | undefined) => (min == null ? "–" : `Tag ${clockOf(min).day}, ${clockOf(min).time}`);

/** „Was weiß der Agent?“ Personen, Orte und Gegenstände; Gegenstandswissen kann veraltet sein (zuletzt gesehener Zustand). */
export function KnowledgeView({ agent }: { agent: string }) {
  const names = useNames();
  const version = useSimStore((s) => s.memoryVersion);
  const { data } = useDetail(() => api.knowledge(agent), `${agent}/${Math.floor(version / 10)}`, 8000);
  if (!data) return <p className="p-4 text-dim">Lade …</p>;
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 pb-4" data-testid="knowledge">
      <section><h3 className="sub">Personen</h3>
        {data.persons.map((p) => (
          <div key={p.id} className="flex items-baseline gap-3 border-b border-line py-1.5 text-[13px]"><b style={{ color: accentOf(p.id) }}>{p.name}</b>
            <span className="text-dim">{p.last_seen_location ? `zuletzt gesehen: ${names.location(p.last_seen_location)}, ${when(p.last_seen_minute)}` : "noch nicht gesehen"}</span><span className="ml-auto text-dim">{p.memories} Erinnerungen</span></div>
        ))}
      </section>
      <section><h3 className="sub">Orte ({data.locations.length})</h3>
        {data.locations.map((l) => <div key={l.location_id} className="flex gap-3 border-b border-line py-1.5 text-[13px]"><span>{l.name}</span><span className="ml-auto text-dim">{l.visits} Besuche{l.last_visit != null ? ` · zuletzt ${when(l.last_visit)}` : ""}</span></div>)}
      </section>
      <section><h3 className="sub">Gegenstände ({data.objects.length}) <span className="normal-case tracking-normal text-faint">· zuletzt gesehener Zustand, kann veraltet sein</span></h3>
        {data.objects.map((o) => <div key={o.object_id} className="flex gap-3 border-b border-line py-1.5 text-[13px]"><span>{o.name}</span><span className="text-dim">{o.note}</span><span className="ml-auto text-dim">{o.location_name} · {when(o.seen_at)}</span></div>)}
      </section>
    </div>
  );
}
