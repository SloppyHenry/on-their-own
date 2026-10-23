// Gemeinsame Teile der oberen Leiste (AP16b): Ansicht Tiefe/Flach, Raster, Rückgängig und Wiederholen (Strg+Z, Strg+Umschalt+Z).
import { useEffect } from "react";
import { AnsichtWahl } from "../settings/Darstellung";
import { isTyping } from "../world/player/PlayerController";
import { useGestalten } from "./gestaltenStore";

export function Werkzeugteile() {
  const g = useGestalten();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "z" || isTyping(e.target as Element | null)) return;
      e.preventDefault();
      if (e.shiftKey) useGestalten.getState().wiederhole(); else useGestalten.getState().zurueck();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return (
    <>
      <span data-testid="view-menu"><AnsichtWahl /></span>
      <label className={`chip pille cursor-pointer border text-[12px] ${g.raster ? "on" : ""}`} style={{ borderColor: "rgba(255,236,210,.24)", padding: "3px 10px" }}>
        <input type="checkbox" className="sr-only" checked={g.raster} onChange={(e) => g.setRaster(e.target.checked)} data-testid="raster" />▦ Raster
      </label>
      <button type="button" className="btn rund leise" disabled={g.aktionen.length === 0} onClick={g.zurueck} title="Rückgängig (Strg+Z)" aria-label="Rückgängig" data-testid="rueckgaengig">↶</button>
      <button type="button" className="btn rund leise" disabled={g.wieder.length === 0} onClick={g.wiederhole} title="Wiederholen (Strg+Umschalt+Z)" aria-label="Wiederholen" data-testid="wiederholen">↷</button>
    </>
  );
}
