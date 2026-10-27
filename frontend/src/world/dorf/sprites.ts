// Sprites der Deko wie wSpriteFor in Mockup A; die Zeichnungen selbst sind die 1:1-Übertragungen in art/.
import { bush, pine, reed, rock, sunflower, tomato, tree } from "../art/nature";
import { WP } from "../art/palette";
import { bBarn, bCrate, bHay, bHouse, bLogs, bShop, bStable, bStand, bWorkshop } from "../art/bausteine";
import { barrel, bench, board, boat, fence, house, lamp, mailbox, post, scarecrow, sign, well } from "../art/village";

const cache = new Map<string, HTMLCanvasElement>();

export function decorSprite(kind: string, extra: number, lit: boolean): HTMLCanvasElement | null {
  const e = extra || 0, key = `${kind}:${e % 7}:${lit ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let c: HTMLCanvasElement | null;
  switch (kind) {
    case "house": c = house(lit); break;
    case "tree": c = tree(0, (e % 7) + 1); break;
    case "treeF": c = tree(1, (e % 7) + 1); break;
    case "treeB": c = tree(2, (e % 7) + 1); break;
    case "pine": c = pine(e % 7); break;
    case "bush": c = bush(e + 3, null); break;
    case "bushP": c = bush(5, WP.fP); break;
    case "bushY": c = bush(6, WP.fY); break;
    case "bushW": c = bush(7, WP.fW); break;
    case "well": c = well(); break;
    case "bench": c = bench(); break;
    case "lamp": c = lamp(lit); break;
    case "board": c = board(); break;
    case "fence": c = fence(); break;
    case "post": c = post(); break;
    case "sun": c = sunflower(); break;
    case "tomato": c = tomato(e); break;
    case "scare": c = scarecrow(); break;
    case "scareDown": c = lying(scarecrow()); break;                         // AP15: vom Sturm umgeworfen
    case "sign": c = sign(); break;
    case "mailbox": c = mailbox(); break;
    case "rock": c = rock(e); break;
    case "reed": c = reed(); break;
    case "barrel": c = barrel(); break;
    case "boat": c = boat(); break;
    default: c = neu(kind, lit);
  }
  if (c) cache.set(key, c);
  return c;
}

/** Sprite um 90° gekippt, liegt auf dem Boden (Fuß bleibt unten). */
function lying(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.height; c.height = src.width;
  const g = c.getContext("2d")!;
  g.translate(0, c.height); g.rotate(-Math.PI / 2); g.drawImage(src, 0, 0);
  return c;
}

/** Bausteine von AP12 (freigegeben): `bh:Breite:Dach:Wand` Wohnhaus, `bw` Werkstatt, `bs` Laden, `bb` Scheune, `bt` Stall, `bm:N` Marktstand,
 *  `bhay`, `blog`, `bcr` Heu, Holz, Kiste. Unbekanntes bleibt null (wird nicht gezeichnet). */
function neu(kind: string, lit: boolean): HTMLCanvasElement | null {
  const [k, a, b, c] = kind.split(":");
  switch (k) {
    case "bh": return bHouse({ ww: Number(a) || 66, roof: b, wall: c, lit });
    case "bw": return bWorkshop(lit);
    case "bs": return bShop(lit);
    case "bb": return bBarn();
    case "bt": return bStable();
    case "bm": return bStand(Number(a) || 0);
    case "bhay": return bHay();
    case "blog": return bLogs();
    case "bcr": return bCrate();
    default: return null;
  }
}
