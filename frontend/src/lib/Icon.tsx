import type { CSSProperties } from "react";
import { iconUrl } from "./px";

/** Einfarbiges Pixel-Icon; nimmt die Textfarbe an. */
export function Icon({ name, className = "", size = 16 }: { name: string; className?: string; size?: number }) {
  const style = { "--m": `url(${iconUrl(name)})`, width: size, height: size } as CSSProperties;
  return <i className={`px-icon ${className}`} style={style} aria-hidden />;
}
