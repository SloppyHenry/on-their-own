import { useModelStore } from "./modelStore";
import { Karte } from "./Karte";
import { bytesText, mbToBytes } from "./format";

const ICON: Record<string, string> = { metal: "▣", nvidia: "▤", amd: "▤", vulkan: "▥", cpu: "▥" };

/** Erkannte Hardware und wie viel vom nutzbaren Speicher die installierten Modelle belegen. */
export function HardwareKarte() {
  const hw = useModelStore((s) => s.hardware), status = useModelStore((s) => s.status);
  if (!hw) return <Karte titel="Dieser Rechner" testid="hardware"><p className="text-dim">Hardware wird erkannt …</p></Karte>;
  const used = (status?.installed ?? []).reduce((a, m) => a + m.size_bytes, 0), usable = mbToBytes(hw.usable_mb);
  return (
    <Karte titel="Dieser Rechner" testid="hardware">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
        <div className="text-3xl text-dim" aria-hidden="true">{ICON[hw.kind] ?? "▥"}</div>
        <div><b data-testid="hardware-name">{hw.name}</b><div className="text-[13px] text-dim" data-testid="hardware-summary">{hw.summary}</div>
          {!hw.bandwidth_known && <div className="text-[12px] text-faint">Die Speicherbandbreite dieser Karte ist unbekannt; die Zeiten sind grobe Schätzungen.</div>}</div>
        <div className="min-w-[170px]">
          <small className="text-dim" data-testid="hardware-usable">{bytesText(mbToBytes(hw.usable_mb))} nutzbar für Modelle</small>
          <div className="mt-0.5 h-2 overflow-hidden rounded bg-line" title={`Installierte Modelle: ${bytesText(used)}`}><i className="block h-full bg-ok" style={{ width: `${Math.min(100, usable > 0 ? (used / usable) * 100 : 0)}%` }} /></div>
        </div>
      </div>
    </Karte>
  );
}
