// Einstellungen im Menü (neu geordnet nach docs/mockups/einstellungen.html): links eine Liste in drei Gruppen (Dieses Spiel, Dieses Gerät, KI) und die
// Voreinstellungen, rechts die Seite. Der Bereich steht in `settingsTab` als „seite“ oder „seite/unterseite“ (Bewohner › Name, Modell › verwalten).
// Esc nimmt eine Ebene zurück: Suche leeren, Unterseite schließen, dann zurück ins Spiel.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Portrait } from "../lib/Portrait";
import { useNames } from "../lib/useNames";
import { ModelleSeite } from "../models/ModelleSeite";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { Brotkrumen, type Krume } from "../ui/Brotkrumen";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { accentOf } from "../world/art/people";
import { GRUPPEN, SEITEN, seitenKeys, seiteVon, zeilenKeys, type Seite, type SeiteId } from "./aufbau";
import { Darstellung } from "./Darstellung";
import type { Spec } from "./labels";
import { useParamStore } from "./paramStore";
import { PresetManager } from "./PresetManager";
import { geaendert, ParamZeile, SeitenRegler, ZeileAus } from "./Regler";
import { SpielartSeite } from "./SpielartSeite";
import { ModellZustand } from "./StatusPanels";
import { TonSettings } from "./TonSettings";
import { Abschnitt, SeitenKopf, Zeile } from "./Zeile";

/** Alte Bereichsnamen (vor der Neuordnung) führen an die neue Stelle. */
const ALT: Record<string, string> = { autonomy: "bewohner", agents: "bewohner", memory: "denken", world: "welt", llm: "modell", sim: "zeit", mode: "spielart", models: "modell/verwalten", status: "modell" };

/** Einstellungen, die nicht im Schema stehen (Gerät, Ton, Modellverwaltung): in der Suche als Verweis auf ihre Seite. */
const VERWEISE: { seite: SeiteId; abschnitt: string; name: string; unter?: string }[] = [
  { seite: "spielart", abschnitt: "Wer verändert die Welt", name: "Spielart Leben oder Gott" },
  { seite: "darstellung", abschnitt: "Welt", name: "Ansicht Tiefe oder Flach (Taste V)" },
  { seite: "darstellung", abschnitt: "Welt", name: "Gedanken und Rede über den Köpfen (wenig Text)" },
  { seite: "darstellung", abschnitt: "Beim Öffnen", name: "Titelbild zeigen" },
  { seite: "darstellung", abschnitt: "Beim Öffnen", name: "Hilfe mit allen Tasten" },
  { seite: "darstellung", abschnitt: "Vorschau", name: "Mitspieler-Steuerung" },
  { seite: "ton", abschnitt: "Allgemein", name: "Ton an oder aus, Lautstärke" },
  { seite: "ton", abschnitt: "Mischpult", name: "Musik, Umgebung, Figuren, Stimmen" },
  { seite: "ton", abschnitt: "Musik anhören", name: "Musikstücke anhören" },
  { seite: "ton", abschnitt: "Stimmen der Bewohner", name: "Stimme je Bewohner" },
  { seite: "modell", abschnitt: "Zustand", name: "Modellstatus und Last" },
  { seite: "modell", abschnitt: "Zustand", name: "Modelle verwalten, herunterladen, Betriebsart", unter: "verwalten" },
  { seite: "presets", abschnitt: "Gespeichert", name: "Voreinstellungen (Presets) laden und speichern" },
];

const PERS = "personality", CHAR = "persona";

export function SettingsContent() {
  const tab = useUiStore((s) => s.settingsTab), openSettings = useUiStore((s) => s.openSettings), menu = useUiStore((s) => s.menu);
  const { specs, values, error, load, refresh, reset } = useParamStore();
  const version = useSimStore((s) => s.paramVersion);
  const world = useSimStore((s) => s.world);
  const names = useNames();
  const [query, setQuery] = useState("");
  const [treffer, setTreffer] = useState<string | null>(null);
  const main = useRef<HTMLElement>(null);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (specs.length) void refresh(); }, [version]);               // eslint-disable-line react-hooks/exhaustive-deps

  const [seiteId, unterRoh] = (ALT[tab] ?? tab).split("/");
  const seite = seiteVon(seiteId);
  const unter = seite.id === "bewohner" ? (unterRoh && world?.agents[unterRoh] ? unterRoh : null) : seite.id === "modell" && unterRoh === "verwalten" ? "verwalten" : null;
  const q = query.trim().toLowerCase();
  const gehe = (id: string) => { setQuery(""); openSettings(id); main.current?.scrollTo({ top: 0 }); };

  useRueckweg(q !== "", EBENE.MenueUnter, () => setQuery(""));
  useRueckweg(!q && !!unter, EBENE.MenueUnter, () => gehe(seite.id));

  // Sprung aus der Suche: Zeile zeigen (eingeklappte Feinheiten öffnen) und kurz hervorheben.
  useEffect(() => {
    if (!treffer || q) return;
    const el = main.current?.querySelector<HTMLElement>(`[data-zeile="${CSS.escape(treffer)}"]`);
    if (el) { const d = el.closest("details"); if (d) d.open = true; el.scrollIntoView({ block: "center" }); el.classList.add("treffer"); }
    setTreffer(null);
  }, [treffer, q, tab]);

  const jeBewohner = useMemo(() => specs.filter((s) => s.group === PERS || s.group === CHAR), [specs]);
  const zahl = (s: Seite) => geaendert(values, [...seitenKeys(s), ...(s.id === "bewohner" ? jeBewohner.map((x) => x.key) : [])]);

  const pfad: Krume[] = [{ label: "Einstellungen", onClick: () => gehe(seite.id) }];
  if (q) pfad.push({ label: "Suche" });
  else if (unter) pfad.push({ label: seite.titel, onClick: () => gehe(seite.id) }, { label: unter === "verwalten" ? "Modelle verwalten" : names.agent(unter) });
  else pfad.push({ label: seite.titel });
  const escZu = q ? "Suche leeren" : unter ? `zurück zu ${seite.titel}` : menu === "pause" ? "zurück zum Spiel" : undefined;

  const reiter = (s: Seite) => {
    const n = zahl(s);
    return (
      <button key={s.id} type="button" role="tab" aria-selected={!q && s.id === seite.id} aria-label={s.titel} className="einst-nav" onClick={() => gehe(s.id)} data-testid={`einst-${s.id}`}>
        <i aria-hidden="true">{s.icon}</i>{s.titel}{n ? <em aria-hidden="true" title={`${n} geändert`}>{n}</em> : <span />}
      </button>
    );
  };

  let inhalt: ReactNode;
  if (q) inhalt = <Suche q={q} roh={query} specs={specs} springe={(id, k) => { gehe(id); setTreffer(k); }} />;
  else if (seite.id === "bewohner" && unter) inhalt = <BewohnerSeite id={unter} />;
  else if (seite.id === "modell" && unter) inhalt = <><SeitenKopf titel="Modelle verwalten" lead="Betriebsart, dieser Rechner, herunterladen und löschen. Gilt für alle Spielstände." /><div className="mt-4"><ModelleSeite /></div></>;
  else {
    const n = zahl(seite), alle = [...seitenKeys(seite), ...(seite.id === "bewohner" ? jeBewohner.map((x) => x.key) : [])];
    inhalt = (
      <>
        <SeitenKopf titel={seite.titel} lead={seite.lead} geltung={seite.gruppe === "geraet" ? "geraet" : seite.gruppe ? "spiel" : null}>
          {n > 0 && <button type="button" className="btn" onClick={() => void reset({ keys: alle })} data-testid="seite-standard">Seite auf Standard</button>}
        </SeitenKopf>
        {seite.id === "spielart" && <SpielartSeite />}
        {seite.id === "modell" && <ModellZustand onVerwalten={() => gehe("modell/verwalten")} />}
        {seite.id === "darstellung" && <Darstellung />}
        {seite.id === "ton" && <TonSettings />}
        {seite.id === "presets" && <PresetManager />}
        {seite.abschnitte.length > 0 && <SeitenRegler seite={seite} />}
        {seite.id === "bewohner" && <BewohnerKarten />}
      </>
    );
  }

  return (
    <div className="einst" data-testid="settings">
      <Brotkrumen pfad={pfad} escZu={escZu} />
      <div className="einst-cols">
        <nav className="einst-side" aria-label="Bereiche">
          <input type="search" placeholder="Einstellung suchen …" aria-label="Einstellungen durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div role="tablist" aria-orientation="vertical" aria-label="Bereiche" className="flex flex-1 flex-col gap-0.5">
            {GRUPPEN.map((g) => (
              <div key={g.id} role="presentation" className="contents">
                <div className="einst-grp" role="presentation">{g.titel}</div>
                {SEITEN.filter((s) => s.gruppe === g.id).map(reiter)}
              </div>
            ))}
            <div className="flex-1" role="presentation" />
            <div className="mx-2 my-2.5 h-px bg-line/70" role="presentation" />
            {SEITEN.filter((s) => !s.gruppe).map(reiter)}
          </div>
        </nav>
        <main className="einst-main" ref={main}>
          {error && <p role="alert" className="mb-2 text-[13px] text-warn">{error}</p>}
          {inhalt}
        </main>
      </div>
    </div>
  );
}

/** Suche über alle Seiten: Regler gleich bedienbar, mit Fundort; Einstellungen je Bewohner und solche außerhalb des Schemas als Verweis. */
function Suche({ q, roh, specs, springe }: { q: string; roh: string; specs: Spec[]; springe: (seite: string, key: string) => void }) {
  const passt = (...t: (string | undefined)[]) => t.join(" ").toLowerCase().includes(q);
  const byKey = new Map(specs.map((s) => [s.key, s]));
  const regler = SEITEN.flatMap((s) => s.abschnitte.flatMap((a) => a.zeilen.map((z) => ({ s, a, z }))))
    .filter(({ s, a, z }) => zeilenKeys(z).some((k) => { const sp = byKey.get(k); return sp && passt(sp.label, sp.help, sp.key, a.titel, s.titel); }));
  const jeBewohner = specs.filter((sp) => (sp.group === PERS || sp.group === CHAR) && passt(sp.label, sp.help, sp.key, "Bewohner Persönlichkeit Charakter"));
  const verweise = VERWEISE.filter((v) => passt(v.name, v.abschnitt, seiteVon(v.seite).titel));
  const anzahl = regler.length + jeBewohner.length + verweise.length;
  const ort = (seite: Seite, abschnitt: string, key: string, unter?: string) => <button type="button" onClick={() => springe(unter ? `${seite.id}/${unter}` : seite.id, key)}>{seite.titel} › {abschnitt}</button>;
  return (
    <>
      <SeitenKopf titel="Suche" lead={`${anzahl} Treffer für „${roh.trim()}“. Klick auf den Fundort springt an die Stelle.`} />
      {anzahl === 0 ? <p className="mt-6 text-dim">Nichts gefunden für „{roh.trim()}“.</p> : (
        <section className="einst-sec"><div className="einst-karte">
          {regler.map(({ s, a, z }) => <ZeileAus key={zeilenKeys(z)[0]} z={z} ort={ort(s, a.titel, zeilenKeys(z)[0])} />)}
          {jeBewohner.map((sp) => (
            <Zeile key={sp.key} name={sp.label} hilfe={sp.help} ort={ort(seiteVon("bewohner"), "Einzeln", "einzeln")}>
              <button type="button" className="btn" onClick={() => springe("bewohner", "einzeln")}>Je Bewohner ›</button>
            </Zeile>
          ))}
          {verweise.map((v) => (
            <Zeile key={v.name} name={v.name} ort={ort(seiteVon(v.seite), v.abschnitt, v.abschnitt, v.unter)}>
              <button type="button" className="btn" onClick={() => springe(v.unter ? `${v.seite}/${v.unter}` : v.seite, v.abschnitt)}>Öffnen ›</button>
            </Zeile>
          ))}
        </div></section>
      )}
    </>
  );
}

/** Die drei Züge mit den höchsten Werten, als kurze Beschreibung eines Bewohners. */
function useKurz() {
  const specs = useParamStore((s) => s.specs), values = useParamStore((s) => s.values);
  return (id: string) => specs.filter((s) => s.group === PERS)
    .map((s) => ({ l: s.label, v: Number((values?.values[s.key] as Record<string, unknown> | undefined)?.[id] ?? 0) }))
    .sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.l).join(" · ");
}

function BewohnerKarten() {
  const world = useSimStore((s) => s.world), openSettings = useUiStore((s) => s.openSettings);
  const specs = useParamStore((s) => s.specs), values = useParamStore((s) => s.values);
  const kurz = useKurz();
  if (!world) return null;
  const keys = specs.filter((s) => s.group === PERS || s.group === CHAR).map((s) => s.key);
  return (
    <section className="einst-sec" aria-label="Einzeln" data-zeile="einzeln">
      <h4>Einzeln</h4>
      <p className="einst-notiz">Persönlichkeit und Charakter je Bewohner.</p>
      <div className="einst-karte"><div className="einst-leute">
        {world.agentOrder.map((id) => {
          const n = geaendert(values, keys, id);
          return (
            <button key={id} type="button" className="einst-person" onClick={() => openSettings(`bewohner/${id}`)} data-testid={`einst-bewohner-${id}`}>
              <span className="rounded-xl" style={{ boxShadow: `0 0 0 2px ${accentOf(id)}` }}><Portrait id={id} size={46} /></span>
              <span className="min-w-0"><b>{world.agents[id].name}</b><small>{kurz(id)}</small>{n > 0 && <small className="!text-[#ffd36e]">● {n} geändert</small>}</span>
              <span className="text-dim">›</span>
            </button>
          );
        })}
      </div></div>
    </section>
  );
}

/** Unterseite Bewohner › Name: Persönlichkeit in zwei Spalten, darunter der Charakter. Ersetzt die Spalten je Bewohner nebeneinander. */
function BewohnerSeite({ id }: { id: string }) {
  const world = useSimStore((s) => s.world);
  const specs = useParamStore((s) => s.specs), values = useParamStore((s) => s.values), reset = useParamStore((s) => s.reset);
  const kurz = useKurz();
  const pers = specs.filter((s) => s.group === PERS), char = specs.filter((s) => s.group === CHAR);
  const n = geaendert(values, [...pers, ...char].map((s) => s.key), id);
  return (
    <div data-testid={`bewohner-seite-${id}`}>
      <SeitenKopf titel={world?.agents[id]?.name ?? id} geltung="spiel" lead={`${kurz(id)}. Änderungen gelten ab der nächsten Entscheidung und ändern keine Erinnerungen.`}
        bild={<span className="shrink-0 rounded-xl" style={{ boxShadow: `0 0 0 2px ${accentOf(id)}` }}><Portrait id={id} size={52} /></span>}>
        {n > 0 && <button type="button" className="btn" onClick={() => void reset({ keys: [...pers, ...char].map((s) => s.key), agent: id })} data-testid="seite-standard">Auf Standard</button>}
      </SeitenKopf>
      <Abschnitt titel="Persönlichkeit"><div className="einst-zwei">{pers.map((s) => <ParamZeile key={s.key} k={s.key} agent={id} knapp />)}</div></Abschnitt>
      <Abschnitt titel="Charakter">{char.map((s) => <ParamZeile key={s.key} k={s.key} agent={id} als={s.key === "profile.description" || s.key === "profile.background" ? "area" : undefined} />)}</Abschnitt>
    </div>
  );
}
