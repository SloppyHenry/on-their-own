// Einstellungen › Darstellung (AP18b, neu geordnet nach docs/mockups/einstellungen.html): Ansicht Tiefe/Flach (auch Taste V) und Blasen als Bildwahl,
// Titelbild beim Öffnen, Hilfe. Alles gilt je Gerät.
import { useUiStore } from "../store/uiStore";
import { Abschnitt, Zeile } from "./Zeile";

/** Tiefe oder Flach als Schalter (im Welteditor und in der Werkstatt, wo es kein Menü gibt). */
export function AnsichtWahl() {
  const mode = useUiStore((s) => s.worldMode), setMode = useUiStore((s) => s.setWorldMode);
  return (
    <span className="segment" role="group" aria-label="Ansicht">
      <button type="button" className={mode === "tiefe" ? "on" : ""} aria-pressed={mode === "tiefe"} onClick={() => setMode("tiefe")}>Tiefe</button>
      <button type="button" className={mode === "flach" ? "on" : ""} aria-pressed={mode === "flach"} onClick={() => setMode("flach")}>Flach</button>
    </span>
  );
}

function Bild({ name, text, img, an, onClick, pos }: { name: string; text: string; img: string; an: boolean; onClick: () => void; pos?: string }) {
  return (
    <button type="button" className="einst-bild" aria-pressed={an} aria-label={name} onClick={onClick}>
      <div className="img" style={{ backgroundImage: `url(/einstellungen/${img}.jpg)`, backgroundPosition: pos }} />
      <div className="tx"><b>{name}</b>{text}</div>
    </button>
  );
}

export function Darstellung() {
  const mode = useUiStore((s) => s.worldMode), setMode = useUiStore((s) => s.setWorldMode);
  const title = useUiStore((s) => s.titleOnStart), setTitle = useUiStore((s) => s.setTitleOnStart);
  const wenig = useUiStore((s) => s.wenigText), setWenig = useUiStore((s) => s.setWenigText);
  return (
    <div data-testid="view-menu">
      <Abschnitt titel="Welt">
        <Zeile breit name={<>Ansicht <kbd className="kbd">V</kbd></>} hilfe="Wechselt sofort, auch im Spiel mit der Taste V." />
        <div className="einst-bilder !pt-0" role="group" aria-label="Ansicht">
          <Bild name="Tiefe" text="Gebogener Horizont, Licht und Schatten." img="tiefe" an={mode === "tiefe"} onClick={() => setMode("tiefe")} />
          <Bild name="Flach" text="Von oben, klar und ruhig." img="flach" an={mode === "flach"} onClick={() => setMode("flach")} />
        </div>
        <Zeile breit name="Gedanken und Rede über den Köpfen" hilfe="Was über den Bewohnern steht, solange du nicht auf sie zeigst." />
        <div className="einst-bilder !pt-0" role="group" aria-label="Blasen" data-testid="wenig-text-wahl">
          <Bild name="Ausführlich" text="Wolke mit dem Gedanken, Rede als Sprechblase." img="blasen-a" pos="center 35%" an={!wenig} onClick={() => setWenig(false)} />
          <Bild name="Wenig Text" text="Nur ein Zeichen über dem Kopf; der Gedanke erscheint beim Daraufzeigen." img="blasen-b" pos="center 35%" an={wenig} onClick={() => setWenig(true)} />
        </div>
      </Abschnitt>
      <Abschnitt titel="Beim Öffnen">
        <Zeile name="Titelbild zeigen" hilfe="Sonst geht es direkt ins Spiel." fuer="titelbild">
          <input id="titelbild" type="checkbox" role="switch" className="schalter" checked={title} onChange={(e) => setTitle(e.target.checked)} data-testid="title-on-start" />
        </Zeile>
        <Zeile name="Hilfe mit allen Tasten" hilfe="Beim allerersten Start blendet sie sich einmal ein."><kbd className="kbd">?</kbd></Zeile>
      </Abschnitt>
    </div>
  );
}
