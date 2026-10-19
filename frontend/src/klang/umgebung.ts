// Klang (AP17d): Umgebung aus Code (Dauerklänge, Mockup docs/mockups/klang/umgebung.js). Jede Funktion liefert { stop() } und blendet weich ein und aus.
// Stereo: Schichten liegen links und rechts verschieden, einzelne Ereignisse (Vogel, Tropfen, Knacken) bekommen einen zufälligen Ort.
import { R, burst, chain, env, filt, gain, grains, loopShell, modes, noise, osc, panner, pick, place, send, type Loop } from "./kern";

const spot = (dest: AudioNode, x = R(0.1, 0.9), d = R(0, 0.6)) => place(dest, x, d);
/** feste Orte für dichte Körner (Tropfen, Blasen), damit nicht für jedes Korn neue Knoten entstehen */
const spots = (dest: AudioNode, n: number, d: number) => Array.from({ length: n }, (_, i) => place(dest, (i + 0.5) / n, d * R(0.5, 1)));
const tone = (dest: AudioNode, t: number, f: number, len: number, up: number, a: number) => {
  const os = osc("sine", f), g = gain(0); chain(os, g, dest); os.frequency.setValueAtTime(f, t); os.frequency.exponentialRampToValueAtTime(f * (1 + up), t + len); env(g, t, 0.008, a, len); os.start(t); os.stop(t + len + 0.05);
};

export const AMB = {
  /** Regen: breites Rauschen in zwei Kanälen, nahe Tropfen, Plätschern in Pfützen, tiefes Grollen der Masse. */
  rain(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 0.5 * k);
    for (const pan of [-0.6, 0.6]) chain(L.add(noise("pink", { loop: true })), filt("highpass", 450, 0.5), filt("lowpass", 5200, 0.5), gain(0.9), panner(pan), L.g);
    chain(L.add(noise("brown", { loop: true })), filt("lowpass", 200), gain(0.35), L.g);
    const near = spots(L.g, 6, 0.4), far = spots(L.g, 4, 0.7);
    L.every(0.012, 0.04, (t) => burst(pick(near), t, { f: R(2500, 7500), q: R(2, 4), peak: R(0.02, 0.11), d: R(0.004, 0.012) }));
    L.every(0.12, 0.55, (t) => { const f = R(1500, 3200), o = osc("sine", f), g = gain(0); chain(o, g, pick(far)); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05); env(g, t, 0.002, R(0.02, 0.06), 0.05); o.start(t); o.stop(t + 0.08); });
    return L;
  },
  /** Regen aufs Dach (drinnen): dumpfes Trommeln, einzelne schwere Tropfen, kein Zischen. */
  roofRain(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 0.55 * k);
    chain(L.add(noise("brown", { loop: true })), filt("lowpass", 420, 0.6), gain(0.7), L.g);
    chain(L.add(noise("pink", { loop: true })), filt("bandpass", 900, 0.8), gain(0.08), L.g);
    const roof = spots(L.g, 4, 0.3);
    L.every(0.03, 0.09, (t) => burst(pick(roof), t, { type: "pink", ft: "lowpass", f: R(500, 1100), peak: R(0.05, 0.16), d: R(0.02, 0.05) }));
    return L;
  },
  /** Wind: zwei Bänder, deren Tonlage und Stärke langsam und unregelmäßig wandern (Böen), leises Pfeifen in den Böen. */
  wind(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 0.45 * k, 2);
    for (const [pan, f, type] of [[-0.5, 420, "pink"], [0.5, 650, "brown"]] as const) {
      const bp = filt("bandpass", f, 0.9), g = gain(0.6);
      chain(L.add(noise(type, { loop: true })), bp, g, panner(pan), L.g); L.lfo(bp.frequency, 2.5, f * 0.45, f); L.lfo(g.gain, 3, 0.4 * k, 0.55);
    }
    const wf = filt("bandpass", 900, 22), wg = gain(0);
    chain(L.add(noise("pink", { loop: true })), wf, wg, L.g); L.lfo(wf.frequency, 2, 220, 950); L.lfo(wg.gain, 3.5, 0.5 * k, 0.35 * k);
    return L;
  },
  /** Vögel: mehrere Arten, jeder Vogel hat sein eigenes Lied und wiederholt es, an seinem eigenen Ort. */
  birds(dest: AudioNode, dense = 1, { dove = false } = {}): Loop {
    const L = loopShell(dest, 1.3, 0.8);
    const flock = Array.from({ length: Math.round(3 + dense * 3) }, () => makeBird(L.g));
    L.every(3.2 / dense, 7 / dense, (t) => pick(flock)(t), { first: 0.3 });
    if (dove) L.every(9, 16, (t) => coo(L.g, t), { first: 2 });
    return L;
  },
  /** Grillen: gleichmäßiges Zirpen in festen Takten, jede Grille mit eigener Tonlage. */
  crickets(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 0.12 * k, 2);
    for (let c = 0; c < 3; c++) {
      const f = R(4200, 4900), per = R(0.55, 0.95), o = spot(L.g, R(0.15, 0.85), R(0.2, 0.8));
      L.every(per, per * 1.04, (t) => { for (let i = 0; i < 3; i++) { const s = t + i * 0.032, os = osc("sine", f), g = gain(0); chain(os, g, o); env(g, s, 0.004, 0.5, 0.02); os.start(s); os.stop(s + 0.03); } }, { first: R(0, 1) });
    }
    return L;
  },
  /** Eule: selten, fern, mit Hall. */
  owl(dest: AudioNode): Loop {
    const L = loopShell(dest, 0.5, 0.5); send(L.g, 0.6);
    L.every(11, 22, (t) => {
      const o = spot(L.g, R(0.1, 0.9), 0.6);
      for (const [dt, len, f] of [[0, 0.35, 375], [0.75, 0.18, 395], [1.05, 0.7, 370]]) {
        const s = t + dt, os = osc("sine", f), g = gain(0); chain(os, filt("lowpass", 900), g, o);
        os.frequency.setValueAtTime(f * 0.96, s); os.frequency.linearRampToValueAtTime(f, s + 0.08); os.frequency.linearRampToValueAtTime(f * 0.93, s + len);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.35, s + 0.07); g.gain.setTargetAtTime(0, s + len - 0.1, 0.06); os.start(s); os.stop(s + len + 0.4);
      }
    }, { first: 3 });
    return L;
  },
  /** Bienen: ab und zu summt eine vorbei (von einer Seite zur anderen). */
  bees(dest: AudioNode): Loop {
    const L = loopShell(dest, 0.7, 0.5);
    L.every(7, 15, (t) => {
      const len = R(2.5, 4), o = osc("sawtooth", R(190, 240)), vib = osc("sine", R(9, 14)), vg = gain(R(8, 15)), g = gain(0), p = panner();
      chain(vib, vg); vg.connect(o.frequency); chain(o, filt("bandpass", 900, 1.2), g, p, L.g); const a = Math.random() < 0.5 ? -0.8 : 0.8;
      p.pan.setValueAtTime(a, t); p.pan.linearRampToValueAtTime(-a, t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + len / 2); g.gain.linearRampToValueAtTime(0, t + len);
      o.start(t); vib.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05);
    }, { first: 2 });
    return L;
  },
  /** Bach: Murmeln statt Rauschen. Wenige Töne springen in kurzen Abständen auf neue Höhen und gleiten dorthin (das Gluckern über Steinen),
   *  jeder an seinem Ort und mit eigener Lautstärke; darunter nur ein leises, langsam wanderndes Band (vorher klang die laute Rauschwand
   *  wie ein Wasserfall). */
  water(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 1.5 * k, 1.5);
    const bed = filt("bandpass", 600, 0.7), bg = gain(0.12);
    chain(L.add(noise("pink", { loop: true })), bed, bg, L.g); L.lfo(bed.frequency, 1.8, 180, 600); L.lfo(bg.gain, 2.2, 0.05, 0.12);
    chain(L.add(noise("pink", { loop: true })), filt("highpass", 2500), gain(0.015), L.g);
    for (let i = 0; i < 5; i++) {
      const o = L.add(osc("sine", R(300, 900))), g = gain(0), lo = R(260, 420), hi = lo * R(2.2, 3);
      chain(o, g, place(L.g, (i + 0.5) / 5, R(0.1, 0.5))); o.start();
      L.every(0.03, 0.09, (t) => {
        o.frequency.setTargetAtTime(R(lo, hi), t, 0.008);
        if (Math.random() < 0.55) { g.gain.setTargetAtTime(R(0.02, 0.07), t, 0.004); g.gain.setTargetAtTime(0, t + R(0.015, 0.04), 0.03); }
      }, { first: R(0, 0.3) });
    }
    const gb = filt("bandpass", 600, 6), gg = gain(0.05);
    chain(L.add(noise("pink", { loop: true })), gb, gg, L.g);
    L.every(0.1, 0.18, (t) => gb.frequency.setTargetAtTime(R(400, 900), t, 0.03));
    return L;
  },
  /** Feuer: dumpfes Fauchen, unregelmäßiges Knistern (viele leise, wenige laute) und ab und zu ein Knacken. */
  fire(dest: AudioNode, k = 1): Loop {
    const L = loopShell(dest, 0.5 * k);
    const rl = filt("lowpass", 320), rg = gain(0.6); chain(L.add(noise("brown", { loop: true })), rl, rg, L.g); L.lfo(rg.gain, 0.4, 0.25, 0.6); L.lfo(rl.frequency, 0.6, 120, 320);
    chain(L.add(noise("pink", { loop: true })), filt("highpass", 2600), gain(0.05), L.g);
    L.every(0.02, 0.12, (t) => burst(L.g, t, { ft: "highpass", f: R(900, 5000), peak: Math.pow(Math.random(), 3) * 0.7 + 0.03, d: R(0.002, 0.012) }));
    L.every(1.8, 5, (t) => { burst(L.g, t, { ft: "highpass", f: 1500, peak: 0.8, d: 0.015 }); modes(L.g, t, R(500, 800), [1, 2.2], [0.05, 0.03], [0.15, 0.06]); grains(5, t + 0.02, 0.25, (s) => burst(L.g, s, { ft: "highpass", f: 3000, peak: R(0.05, 0.2), d: 0.004 })); });
    return L;
  },
  /** Gewitter in der Ferne: selten, tiefes Rollen. */
  thunder(dest: AudioNode): Loop {
    const L = loopShell(dest, 0.8, 0.3);
    L.every(18, 34, (t) => {
      const len = R(3, 5), lp = filt("lowpass", 160, 0.7), g = gain(0); chain(noise("brown", { at: t, dur: len + 0.2 }), lp, g, spot(L.g, R(0.2, 0.8), 0.5));
      const pts = 30, c = new Float32Array(pts); for (let i = 0; i < pts; i++) c[i] = Math.pow(1 - i / pts, 1.6) * (0.6 + 0.4 * Math.sin(i * R(0.8, 1.4))) * 0.9;
      c[pts - 1] = 0; g.gain.setValueCurveAtTime(c, t, len); lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(70, t + len);
    }, { first: 6 });
    return L;
  },
};
export type Amb = keyof typeof AMB;

/** Ein Vogel mit eigenem Lied: Art, Tonlage und Notenfolge werden einmal festgelegt und dann wiederholt (wie echte Vögel). */
function makeBird(dest: AudioNode): (t: number) => void {
  const kind = pick(["pfeifer", "pfeifer", "triller", "zwitscherer"]), base = R(2600, 4300), o = place(dest, R(0.08, 0.92), R(0.1, 0.8));
  const song = Array.from({ length: Math.floor(R(3, 7)) }, () => ({ f: base * pick([1, 1.12, 1.26, 1.33, 0.89, 1.5]), len: R(0.05, 0.16), up: R(-0.25, 0.35), gap: R(0.03, 0.1) }));
  return (t) => {
    if (kind === "pfeifer") { let s = t; for (const n of song) { tone(o, s, n.f, n.len, n.up, 0.14); s += n.len + n.gap; } }
    else if (kind === "triller") {
      const len = R(0.5, 1), os = osc("sine", base), fm = osc("sine", R(22, 34)), fg = gain(base * 0.12), g = gain(0); chain(fm, fg); fg.connect(os.frequency); chain(os, g, o);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.05); g.gain.setValueAtTime(0.09, t + len - 0.1); g.gain.linearRampToValueAtTime(0, t + len);
      os.start(t); fm.start(t); os.stop(t + len + 0.02); fm.stop(t + len + 0.02);
    } else { let s = t; for (let i = 0; i < Math.floor(R(4, 9)); i++) { tone(o, s, base * R(0.9, 1.4), R(0.025, 0.05), R(0.3, 0.9), 0.1); s += R(0.05, 0.09); } }
  };
}
/** Taube am Morgen: weiches „hu-huu-hu“. */
function coo(dest: AudioNode, t: number) {
  const o = place(dest, R(0.1, 0.9), 0.5);
  for (const [dt, len, f] of [[0, 0.25, 520], [0.35, 0.55, 560], [1.0, 0.3, 500]]) {
    const s = t + dt, os = osc("sine", f), g = gain(0); chain(os, filt("lowpass", 1000), g, o);
    os.frequency.setValueAtTime(f * 0.95, s); os.frequency.linearRampToValueAtTime(f, s + 0.08); os.frequency.linearRampToValueAtTime(f * 0.9, s + len);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.18, s + 0.06); g.gain.setTargetAtTime(0, s + len - 0.08, 0.05); os.start(s); os.stop(s + len + 0.3);
  }
}
/** Mehrere Dauerklänge als einer. */
export const together = (...ls: Loop[]): Loop => ({ g: ls[0]?.g, stop: () => ls.forEach((l) => l.stop()) }) as Loop;
