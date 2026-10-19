// Anzeigehilfen der Modellverwaltung (AP17c-4): Größen, Zeiten, Passung und Siegel.
import type { InstalledOut, TransferOut, VariantOut } from "../types/generated";

const de = (x: number, digits = 1) => x.toFixed(digits).replace(".", ",");

/** Bytes als „5,0 GB“ (dezimal, wie auf Hugging Face). */
export const bytesText = (b: number): string => (b >= 1e9 ? `${de(b / 1e9)} GB` : `${de(b / 1e6, 0)} MB`);
/** Mebibyte (so liefert das Backend die Größen im Katalog) als Bytes. */
export const mbToBytes = (mb: number): number => mb * 1048576;
export const sizeText = (v: Pick<VariantOut, "size_mb">): string => bytesText(mbToBytes(v.size_mb));

export const speedText = (bps: number): string => (bps >= 1e6 ? `${de(bps / 1e6, 0)} MB/s` : bps > 0 ? `${de(bps / 1e3, 0)} kB/s` : "");
export const etaText = (s: number | null): string => (s === null ? "" : s >= 90 ? `noch ${Math.round(s / 60)} min` : `noch ${Math.max(1, Math.round(s))} s`);
export const secondsText = (s: number | null | undefined): string => (s == null ? "–" : `${de(s)} s`);

export const PHASE_TEXT: Record<TransferOut["phase"], string> = {
  preparing: "Wird vorbereitet …", downloading: "Wird geladen", verifying: "Prüfsumme wird geprüft …", unpacking: "Wird entpackt …",
  done: "Fertig", failed: "Fehlgeschlagen", cancelled: "Abgebrochen",
};

/** Fortschritt 0 bis 1; 0 bei unbekannter Größe. */
export const fraction = (t: Pick<TransferOut, "done" | "total">): number => (t.total > 0 ? Math.min(1, t.done / t.total) : 0);

/** Tailwind-Klassen der Passungs-Marke („passt gut“ … „zu groß“). */
export const FIT_CLASS: Record<string, string> = {
  good: "border-ok text-ok", ok: "border-world text-world", tight: "border-alex text-alex", no: "border-warn text-warn",
};
/** Siegel nach dem Probelauf. */
export const SEAL_CLASS: Record<string, string> = { checked: "border-plan text-plan", limited: "border-alex text-alex", unfit: "border-warn text-warn" };

export function sealText(p: NonNullable<InstalledOut["probe"]>): string {
  const base = `${p.seal_label} · ${de(p.valid_pct, 0)} % gültig`;
  return p.seal === "unfit" || p.avg_s == null ? base : `${base} · ${de(p.avg_s)} s`;
}

/** Ist die Datei dieses Katalogeintrags schon installiert? Die Kennung eines Modells ist der Dateiname ohne „.gguf“. */
export const fileId = (file: string): string => file.replace(/\.gguf$/i, "");
