// Editoren › Welten › Welt erzeugen (AP18e): der Generator, nur beim Erschaffen. Seed, Seeufer und Gebäudemix, mit Vorschau unter dem Schleier; die Welt kommt ohne Bewohner in die Bibliothek.
import { useEffect, useState } from "react";
import { Vorschaufenster } from "../assistent/Vorschaufenster";
import { ApiError, api } from "../net/api";
import { applySnapshot } from "../store/reducers";
import { Plan } from "./Plaene";
import { StellgroessenFeld } from "./StellgroessenFeld";
import { VORGABE, anfrage, type Stil } from "./stellgroessen";
import type { World } from "../store/types";

type Lake = "auto" | "east" | "south";
const LAKES: [Lake, string][] = [["auto", "Nach Zufall"], ["east", "Osten"], ["south", "Süden"]];
const field = "rounded-md border border-line bg-bg px-2 py-1";
const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");

export function WeltErzeugen({ fertig }: { fertig: () => Promise<void> }) {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 99999)), [lake, setLake] = useState<Lake>("auto"), [name, setName] = useState(""), [stil, setStil] = useState<Stil>({ ...VORGABE });
  const [plaene, setPlaene] = useState<(World | null)[]>([null, null, null, null]);
  const style = anfrage(stil);
  const key = JSON.stringify([seed, lake, style]);
  const [vorschau, setVorschau] = useState<{ world: World; village: string; seed: number } | null>(null), [busy, setBusy] = useState<"vorschau" | "anlegen" | null>(null), [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let alt = false;
    setBusy("vorschau"); setFehler(null);
    const t = setTimeout(() => {
      api.generate({ kind: "new", seed, lake, mix: null, ...(style ? { style } : {}) }).then((p) => {
        if (alt) return;
        if (!p.ok || !p.snapshot) { setVorschau(null); setFehler(p.error ?? p.report.errors[0] ?? "Kein gültiges Dorf."); return; }
        setVorschau({ world: applySnapshot(p.snapshot), village: p.village ?? "", seed: p.seed ?? seed });
      }).catch((e) => { if (!alt) setFehler(detail(e)); }).finally(() => { if (!alt) setBusy(null); });
    }, 400);
    return () => { alt = true; clearTimeout(t); };
  }, [key]);                                                                      // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {                                                                // vier schnelle Pläne anderer Seeds, nach der Hauptvorschau
    let alt = false;
    setPlaene([null, null, null, null]);
    const t = setTimeout(() => {
      [1, 2, 3, 4].forEach((d, i) => api.generate({ kind: "new", seed: seed + d, lake, mix: null, ...(style ? { style } : {}) }).then((p) => {
        if (!alt && p.ok && p.snapshot) setPlaene((l) => l.map((x, j) => (j === i ? applySnapshot(p.snapshot!) : x)));
      }).catch(() => undefined));
    }, 1200);
    return () => { alt = true; clearTimeout(t); };
  }, [key]);                                                                      // eslint-disable-line react-hooks/exhaustive-deps
  const anlegen = async () => {
    setBusy("anlegen"); setFehler(null);
    try { await api.generateWorld({ seed, lake, ...(style ? { style } : {}), ...(name.trim() ? { name: name.trim() } : {}) }); await fertig(); } catch (e) { setFehler(detail(e)); setBusy(null); }
  };
  return (
    <div className="grid grid-cols-2 gap-4 text-[13px] max-[900px]:grid-cols-1" data-testid="welt-erzeugen-form">
      <form className="grid content-start gap-3" onSubmit={(e) => { e.preventDefault(); void anlegen(); }}>
        <p className="text-dim">Der Generator legt ein Dorf mit See, Garten und Wald an. Gleicher Seed, gleiche Welt. Mit den Stellgrößen bestimmst du Dorfform, Seen, Wasserlauf, Wald, Gärten und Felder.</p>
        <label className="grid gap-1">Seed
          <span className="flex gap-2"><input className={`${field} w-28 font-mono`} type="number" min={0} max={2000000000} value={seed} data-testid="erzeugen-seed" onChange={(e) => setSeed(Math.max(0, Math.min(2_000_000_000, Math.floor(Number(e.target.value) || 0))))} />
            <button type="button" className="btn" onClick={() => setSeed(1 + Math.floor(Math.random() * 99999))} data-testid="erzeugen-wuerfeln">Würfeln</button></span></label>
        <div className="flex items-center gap-3"><span className="text-dim">Ufer des Sees</span>
          <span className="segment" role="group">{LAKES.map(([v, l]) => <button key={v} type="button" className={lake === v ? "on" : ""} aria-pressed={lake === v} onClick={() => setLake(v)} data-testid={`erzeugen-ufer-${v}`}>{l}</button>)}</span></div>
        <StellgroessenFeld stil={stil} onChange={setStil} />
        <label className="grid gap-1">Name der Welt (leer: der Dorfname)<input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={vorschau?.village} data-testid="erzeugen-name" /></label>
        {fehler && <p role="alert" className="text-warn" data-testid="erzeugen-fehler">{fehler}</p>}
        <div><button type="submit" className="btn on" disabled={!vorschau || busy !== null} data-testid="erzeugen-anlegen">{busy === "anlegen" ? "Wird angelegt …" : "In die Bibliothek legen"}</button></div>
      </form>
      <div>
        {vorschau ? <Vorschaufenster world={vorschau.world} level={0.5} caption={<>{vorschau.village}{vorschau.seed !== seed ? ` (Seed ${vorschau.seed}: der gewünschte bestand die Prüfung nicht)` : ""}</>} />
          : <div className="grid h-[300px] place-items-center rounded-xl border-2 border-dashed border-plan/60 p-4 text-center text-dim" data-testid="erzeugen-leer">{busy === "vorschau" ? "Vorschau wird erstellt …" : "Die Vorschau erscheint hier."}</div>}
        <div className="mt-3 grid grid-cols-4 gap-2" data-testid="plaene">
          {plaene.map((w, i) => <Plan key={i} world={w} label={String(seed + i + 1)} aktiv={false} tid={`plan-${i}`} onClick={() => setSeed(seed + i + 1)} />)}
        </div>
      </div>
    </div>
  );
}
