import { useEffect, useRef } from "react";
import { accentOf, portrait } from "../world/draw/characters";

export function Portrait({ id, size = 44 }: { id: string; size?: number }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = portrait(id, size);
    c.style.imageRendering = "pixelated";
    c.style.borderRadius = "6px";
    c.style.border = `1px solid ${accentOf(id)}`;
    host.current?.replaceChildren(c);
  }, [id, size]);
  return <span ref={host} className="inline-block shrink-0" style={{ width: size, height: size }} />;
}
