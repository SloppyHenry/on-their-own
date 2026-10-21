// Regler aus dem Schema als Zeilen einer Seite (aufbau.ts): einzelne Regler, Bedürfnisse (an/aus und Rate in einer Zeile) und alle Abschnitte einer Seite.
import type { ReactNode } from "react";
import { useSimStore } from "../store/simStore";
import type { ParamValues } from "../types/generated";
import { zeilenKeys, type Seite, type Zeile as ZeileDef } from "./aufbau";
import { ParamControl, StatusMark, type Als } from "./ParamControl";
import { idOf, useParamStore } from "./paramStore";
import { Abschnitt, Feinheiten, Zeile } from "./Zeile";

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Wie viele Werte von `keys` vom Standard abweichen (Werte je Bewohner zählen einzeln, mit `agent` nur dessen). */
export function geaendert(values: ParamValues | null, keys: string[], agent?: string): number {
  if (!values) return 0;
  let n = 0;
  for (const k of keys) {
    const v = values.values[k], d = values.defaults[k];
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const vv = v as Record<string, unknown>, dd = (d ?? {}) as Record<string, unknown>;
      for (const a of agent ? [agent] : Object.keys(vv)) if (!gleich(vv[a], dd[a])) n++;
    } else if (!gleich(v, d)) n++;
  }
  return n;
}

/** Ein Regler aus dem Schema. Ohne Schema-Eintrag (ältere Welt) bleibt die Zeile weg. */
export function ParamZeile({ k, als, null: nullText, agent, knapp, ort }: { k: string; als?: Als; null?: string; agent?: string; knapp?: boolean; ort?: ReactNode }) {
  const spec = useParamStore((s) => s.specs.find((x) => x.key === k));
  const values = useParamStore((s) => s.values), status = useParamStore((s) => s.status);
  const set = useParamStore((s) => s.set), reset = useParamStore((s) => s.reset);
  if (!spec || !values || !(k in values.values)) return null;
  const cur = agent ? (values.values[k] as Record<string, unknown>)?.[agent] : values.values[k];
  const def = agent ? (values.defaults[k] as Record<string, unknown>)?.[agent] : values.defaults[k];
  return <ParamControl spec={spec} value={cur} def={def} status={status[idOf(k, agent)]} agent={agent} als={als} null={nullText} knapp={knapp} ort={ort}
    onChange={(v) => set(k, v, agent)} onReset={() => void reset({ keys: [k], agent })} />;
}

/** Ein Bedürfnis: Schalter und (wo es eine gibt) die Rate in einer Zeile. */
export function BeduerfnisZeile({ need, ort }: { need: string; ort?: ReactNode }) {
  const specs = useParamStore((s) => s.specs), values = useParamStore((s) => s.values), status = useParamStore((s) => s.status);
  const set = useParamStore((s) => s.set), reset = useParamStore((s) => s.reset);
  const an = specs.find((x) => x.key === `needs.${need}.enabled`), rate = specs.find((x) => x.key === `needs.${need}.rate`);
  if (!an || !values) return null;
  const keys = [an.key, ...(rate ? [rate.key] : [])];
  const ein = values.values[an.key] === true, r = rate ? Number(values.values[rate.key]) : 0;
  const name = an.label.split(":")[0];
  return (
    <Zeile name={<>{name}<StatusMark status={status[an.key] ?? (rate && status[rate.key])} /></>} geaendert={geaendert(values, keys) > 0} ort={ort} zeile={an.key} testid={`param-${an.key}`}
      aufStandard={{ label: `${name} auf Standard zurücksetzen`, onClick: () => void reset({ keys }) }}>
      <input type="checkbox" role="switch" className="schalter" checked={ein} aria-checked={ein} aria-label={`${name} an`} onChange={(e) => set(an.key, e.target.checked)} />
      {rate ? (
        <>
          <input type="range" min={rate.min ?? 0} max={rate.max ?? 300} step={rate.step ?? 5} value={r} disabled={!ein} title="Wie schnell es steigt" aria-label={`${name}: Rate`} onChange={(e) => set(rate.key, Number(e.target.value))} />
          <span className="einst-wert" data-testid="param-value">{r} %</span>
        </>
      ) : <><span className="flex-1" /><span className="einst-wert font-medium text-faint">fest</span></>}
    </Zeile>
  );
}

export function ZeileAus({ z, ort }: { z: ZeileDef; ort?: ReactNode }) {
  return "beduerfnis" in z ? <BeduerfnisZeile need={z.beduerfnis} ort={ort} /> : <ParamZeile k={z.key} als={z.als} null={z.null} ort={ort} />;
}

/** Alle Abschnitte einer Seite aus dem Aufbau. */
export function SeitenRegler({ seite }: { seite: Seite }) {
  const values = useParamStore((s) => s.values);
  const gott = useSimStore((s) => (s.world?.playMode ?? "gott") === "gott");
  if (!values) return <p className="mt-4 text-dim">Lade Einstellungen …</p>;
  return (
    <>
      {seite.abschnitte.map((a) => {
        if (a.nurGott && !gott) return <Abschnitt key={a.titel} titel={a.titel}><div className="einst-zeile breit einst-hilfe" data-testid="nur-gott">Gibt es nur in der Spielart Gott – in der Spielart Leben greift niemand ein.</div></Abschnitt>;
        const zeilen = a.zeilen.filter((z) => "beduerfnis" in z || !z.wenn || z.wenn(values.values));
        const inhalt = zeilen.map((z) => <ZeileAus key={zeilenKeys(z)[0]} z={z} />);
        return a.fein
          ? <Feinheiten key={a.titel} anzahl={zeilen.length} geaendert={geaendert(values, zeilen.flatMap(zeilenKeys))}>{inhalt}</Feinheiten>
          : <Abschnitt key={a.titel} titel={a.titel} notiz={a.notiz}>{inhalt}</Abschnitt>;
      })}
    </>
  );
}
