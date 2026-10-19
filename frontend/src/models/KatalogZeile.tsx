// Eine Zeile der Modell-Listen (Empfohlen, Suche): Name, Passung, Größe, Lizenz, Schätzung und „Laden“ mit Bestätigung.
import { useState } from "react";
import { api } from "../net/api";
import type { CatalogItemOut, LlmStatusOut } from "../types/generated";
import { BestaetigungsDialog } from "./Dialog";
import { FIT_CLASS, bytesText, fileId, mbToBytes, secondsText, sizeText } from "./format";
import { Marke } from "./Karte";
import { useModelStore } from "./modelStore";

const busy = (s: LlmStatusOut) => !!s.transfer && ["preparing", "downloading", "verifying", "unpacking"].includes(s.transfer.phase);

export function KatalogZeile({ item, status, best }: { item: CatalogItemOut; status: LlmStatusOut; best?: boolean }) {
  const run = useModelStore((s) => s.run), hw = useModelStore((s) => s.hardware);
  const [pick, setPick] = useState(item.file.file), [ask, setAsk] = useState(false);
  const v = item.variants.find((x) => x.file === pick) ?? item.file;
  const installed = status.installed.some((m) => m.id === fileId(v.file));
  const free = hw ? mbToBytes(hw.free_disk_mb) : null, size = mbToBytes(v.size_mb);
  const noSpace = free !== null && free < size * 1.1;
  const reason = !item.downloadable ? "Anmeldung bei Hugging Face nötig, nicht unterstützt" : v.fit.level === "no" ? "Passt nicht in den Speicher dieses Rechners" : busy(status) ? "Es läuft schon eine Übertragung" : "";
  const testid = `modell-${item.repo.replace(/[^A-Za-z0-9]+/g, "-")}`;
  return (
    <div data-testid={testid} data-fit={v.fit.level} className={`grid grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-1 rounded-xl border bg-black/15 px-3 py-2.5 ${best && v.fit.level === "good" ? "border-ok/70" : "border-line"}`}>
      <div className="min-w-0">
        <div className="text-[15px] font-bold">{item.name} <span className="font-medium text-dim">{v.quant}</span>
          <Marke cls={FIT_CLASS[v.fit.level]} testid="fit">{v.fit.label}</Marke>
          {installed && <Marke cls="border-line text-dim">installiert</Marke>}
          {item.source === "curated" && <Marke cls="border-plan text-plan" title="Von uns ausgewählt und geprüft">empfohlen</Marke>}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-dim">
          <span>{sizeText(v)}</span><span>{item.publisher}</span><span>{item.license ?? "Lizenz unbekannt"}</span>
          {item.moe && <span title="Mixture of Experts: nur ein Teil der Gewichte arbeitet je Token">MoE</span>}
          <span title="Aus der Speicherbandbreite geschätzt, nicht gemessen">≈ {secondsText(v.estimate.seconds_per_decision)} je Entscheidung (Schätzung)</span>
          {item.multimodal && <span title="Das Modell kann auch Bilder verstehen; geladen wird nur der Textteil">mit Bildteil (nur Text)</span>}
          {item.uncensored && <span title="Nur ein Hinweis aus dem Namen, keine Wertung">unzensiert</span>}
          {item.gated && <span className="text-warn">Anmeldung nötig</span>}
        </div>
        {item.variants.length > 1 && !installed && (
          <select aria-label={`Datei für ${item.name}`} data-testid="variante" className="mt-1 rounded-md border border-line bg-bg px-1.5 py-0.5 text-[12px]" value={v.file} onChange={(e) => setPick(e.target.value)}>
            {item.variants.map((x) => <option key={x.file} value={x.file}>{x.quant} · {sizeText(x)} · {x.fit.label}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {!installed && <button className="btn on" data-testid="laden" disabled={!!reason} title={reason} onClick={() => setAsk(true)}>{v.fit.level === "no" ? "Zu groß" : "Laden"}</button>}
      </div>
      {ask && (
        <BestaetigungsDialog titel="Modell herunterladen?" ja="Herunterladen" jaGesperrt={noSpace} onNein={() => setAsk(false)} onJa={() => { setAsk(false); void run(() => api.downloadModel(item.repo, v.file)); }}
          zeilen={[["Datei", v.file], ["Quelle", item.url], ["Größe", bytesText(size)],
            ["Prüfung", status.mode === "builtin" && status.runtime.installed ? "SHA-256 gegen die Angabe von Hugging Face; danach ein Probelauf (10 Anfragen, ca. 1 Minute), den man überspringen kann" : "SHA-256 gegen die Angabe von Hugging Face"],
            ["Platz", free === null ? "unbekannt" : `${bytesText(free)} frei${noSpace ? ", reicht nicht" : ", reicht"}`]]}
          warnung={noSpace ? "Auf der Platte ist nicht genug Platz (Größe plus 10 %)." : v.fit.level === "tight" ? "Der Speicher ist knapp; das Modell läuft vielleicht nur langsam." : undefined} />
      )}
    </div>
  );
}
