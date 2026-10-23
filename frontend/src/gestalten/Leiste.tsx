// Werkzeugleiste des Gestaltens (AP16b, Mockup Bild 1): Gruppen Ansehen, Zeichnen, Setzen, Ändern, Welt; Tasten 1–9 und 0. Das Zeichen W bei Startplatz und Gebiet heißt „nur in der Werkstatt“.
import { useEffect } from "react";
import { isTyping } from "../world/player/PlayerController";
import { useGestalten } from "./gestaltenStore";
import { LEISTE } from "./werkzeug";

export function Leiste() {
  const ort = useGestalten((s) => s.ort), aktiv = useGestalten((s) => s.werkzeug), setW = useGestalten((s) => s.setWerkzeug);
  const liste = LEISTE.filter((t) => ort === "werkstatt" || !t.w);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as Element | null) || document.querySelector("[role=dialog]")) return;
      const i = e.key === "0" ? 9 : /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (i >= 0 && liste[i]) { e.preventDefault(); setW(liste[i].id); }
      else if (e.key === "Enter" && useGestalten.getState().werkzeug === "weg") { e.preventDefault(); useGestalten.getState().wegBeenden(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [liste, setW]);
  return (
    <div className="glas gs-leiste pointer-events-auto" role="toolbar" aria-label="Werkzeuge" data-testid="gestalten-leiste">
      {liste.map((t, i) => (
        <div key={t.id} className="contents">
          {t.gruppe && <div className="grp">{t.gruppe}</div>}
          <button type="button" className={`gs-tool ${aktiv === t.id ? "on" : ""} ${t.w ? "w" : ""}`} aria-pressed={aktiv === t.id} title={t.w ? `${t.name} (nur in der Werkstatt)` : t.name} onClick={() => setW(t.id)} data-testid={`werkzeug-${t.id}`}>
            <span aria-hidden="true">{t.zeichen}</span>{t.name}<kbd>{(i + 1) % 10}</kbd>
          </button>
        </div>
      ))}
    </div>
  );
}
