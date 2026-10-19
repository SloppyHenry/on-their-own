import { describe, expect, it } from "vitest";
import { bytesText, etaText, fileId, fraction, sealText, secondsText, sizeText, speedText } from "./format";

describe("Anzeige der Modellverwaltung", () => {
  it("Größen dezimal mit Komma", () => {
    expect(bytesText(5_027_783_488)).toBe("5,0 GB");
    expect(bytesText(300_000_000)).toBe("300 MB");
    expect(sizeText({ size_mb: 4795 })).toBe("5,0 GB");
  });
  it("Geschwindigkeit und Restzeit", () => {
    expect(speedText(38_400_000)).toBe("38 MB/s");
    expect(speedText(512_000)).toBe("512 kB/s");
    expect(speedText(0)).toBe("");
    expect(etaText(null)).toBe("");
    expect(etaText(40)).toBe("noch 40 s");
    expect(etaText(0.2)).toBe("noch 1 s");
    expect(etaText(300)).toBe("noch 5 min");
    expect(secondsText(5.46)).toBe("5,5 s");
    expect(secondsText(null)).toBe("–");
  });
  it("Fortschritt bleibt in 0 bis 1", () => {
    expect(fraction({ done: 50, total: 200 })).toBe(0.25);
    expect(fraction({ done: 500, total: 200 })).toBe(1);
    expect(fraction({ done: 5, total: 0 })).toBe(0);
  });
  it("Siegeltext nennt Messwerte; „ungeeignet“ ohne Zeit", () => {
    const base = { n: 10, valid: 10, errors: 0, tokens_per_s: 40, at: 0, hardware: null, runtime: null } as const;
    expect(sealText({ ...base, valid_pct: 100, avg_s: 5.5, seal: "checked", seal_label: "geprüft" })).toBe("geprüft · 100 % gültig · 5,5 s");
    expect(sealText({ ...base, valid_pct: 80, avg_s: 5.5, seal: "unfit", seal_label: "ungeeignet" })).toBe("ungeeignet · 80 % gültig");
    expect(sealText({ ...base, valid_pct: 90, avg_s: 25, seal: "limited", seal_label: "mit Einschränkung" })).toBe("mit Einschränkung · 90 % gültig · 25,0 s");
  });
  it("Kennung aus dem Dateinamen", () => {
    expect(fileId("Qwen3-8B-Q4_K_M.gguf")).toBe("Qwen3-8B-Q4_K_M");
  });
});
