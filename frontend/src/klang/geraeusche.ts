// Klang (AP17d): Geräusche der Figuren und Dinge aus Code (Mockup docs/mockups/klang/geraeusche.js, zweite Fassung, plus Nachschärfung 18.10.).
// Jeder Klang ist bei jedem Aufruf etwas anders (Tonhöhe, Dichte, Zeit), damit Wiederholungen nicht auffallen. Ziel ist ein Kanal oder ein Ort aus place().
import { R, burst, chain, clamp, env, filt, gain, grains, modes, noise, now, osc, panner, roughCurve, send } from "./kern";

export type Boden = "gras" | "weg" | "holz" | "stein";
let footSide = 0;

/** Rascheln: rosa Rauschen durch ein Band, Lautstärke als unruhige Kurve (Halme streifen aneinander, kein Klicken). */
function rustle(dest: AudioNode, t: number, len: number, f: number, peak: number, q = 0.6) {
  const n = noise("pink", { at: t, dur: len + 0.05 }), bp = filt("bandpass", f, q), hp = filt("highpass", 700, 0.5), g = gain(0);
  chain(n, bp, hp, g, dest);
  g.gain.setValueAtTime(0, t); g.gain.setValueCurveAtTime(roughCurve(36, (q2) => peak * Math.pow(Math.sin(Math.PI * Math.min(1, q2 * 1.15)), 0.6)), t + 0.002, len);
}
/** Metallriegel: kurzer Klick mit unharmonischen Obertönen. */
function latchClick(dest: AudioNode, t: number, k = 1) {
  burst(dest, t, { ft: "highpass", f: 4000, peak: 0.35 * k, d: 0.01 });
  modes(dest, t, R(2300, 2700), [1, 1.52, 2.31, 3.12], [0.06, 0.045, 0.03, 0.02], [0.12 * k, 0.09 * k, 0.06 * k, 0.03 * k]);
}
/** Knarren einer Angel: Sägezahn mit unruhiger Haftreibung durch drei Holzresonanzen. */
function creak(dest: AudioNode, s: number, len: number, level = 1) {
  const o = osc("sawtooth", 60), n = 48, curve = new Float32Array(n), amp = new Float32Array(n);
  let rate = R(45, 70);
  for (let i = 0; i < n; i++) { rate = clamp(rate + R(-9, 11), 28, 140); curve[i] = rate; amp[i] = level * (0.12 + 0.14 * Math.sin((Math.PI * i) / n) * R(0.5, 1.2)); }
  amp[n - 1] = 0;
  o.frequency.setValueCurveAtTime(curve, s, len);
  const body = gain(0), mix = gain(1); o.connect(body);
  for (const [f, q, a] of [[R(520, 640), 7, 1], [R(1150, 1350), 10, 0.7], [R(2400, 2800), 12, 0.35]]) chain(body, filt("bandpass", f, q), gain(a), mix);
  mix.connect(dest); body.gain.setValueAtTime(0, s); body.gain.setValueCurveAtTime(amp, s + 0.01, len - 0.02);
  o.start(s); o.stop(s + len + 0.05);
}
const drop = (dest: AudioNode, t: number, f: number, a: number, up = R(1.5, 2.4), d = 0.05) => {
  const o = osc("sine", f), g = gain(0); chain(o, g, dest); o.frequency.exponentialRampToValueAtTime(f * up, t + d); env(g, t, 0.003, a, d); o.start(t); o.stop(t + d + 0.03);
};

export const SFX = {
  /** Schritt: Ferse und Ballen, abwechselnd linker und rechter Fuß. */
  step(dest: AudioNode, surface: Boden = "gras") {
    const t = now() + 0.005, foot = (footSide ^= 1) ? 1 : 0.93, g = gain({ gras: 2.3, weg: 3.4, holz: 1, stein: 2.4 }[surface]); g.connect(dest);
    const toe = t + R(0.06, 0.09);
    if (surface === "gras") {
      // weiches Auftreten ohne Klick, dann streifen Halme am Schuh entlang (Ferse, Abrollen), selten knackt ein trockener Stängel
      burst(g, t, { type: "brown", ft: "lowpass", f: 180, a: 0.012, peak: 0.5, d: 0.09 });
      rustle(g, t + 0.004, R(0.2, 0.28), R(1900, 2600) * foot, 0.32);
      rustle(g, toe, R(0.12, 0.16), R(2800, 3600) * foot, 0.18, 0.8);
      grains(Math.floor(R(1, 4)), t + 0.02, 0.15, (s) => burst(g, s, { f: R(3000, 6000), q: 3, peak: R(0.03, 0.07), d: 0.006 }));
    } else if (surface === "weg") {
      // Erde und Sand: Knirschen vieler Körner und ein weiches Aufsetzen
      grains(Math.floor(R(9, 15)), t, 0.11, (s, i) => burst(g, s, { f: R(1800, 5200) * foot, q: R(1, 2.5), peak: R(0.08, 0.32) * (1 - i / 18), d: R(0.008, 0.025) }));
      burst(g, t, { type: "pink", ft: "lowpass", f: 700, peak: 0.35, a: 0.008, d: 0.07 });
      burst(g, toe - 0.03, { type: "pink", ft: "bandpass", f: 1400, q: 0.8, peak: 0.18, a: 0.01, d: 0.06 });
    } else if (surface === "holz") {
      // hohler Klopfer: Bohle schwingt mit, Ballen leiser; selten knarrt ein Brett
      for (const [s, k] of [[t, 1], [toe - 0.03, 0.45]]) {
        burst(g, s, { f: 2200, q: 0.8, peak: 0.35 * k, d: 0.006 });
        modes(g, s, R(150, 185) * foot, [1, 2.31, 3.93, 5.4], [0.11, 0.07, 0.045, 0.03], [0.55 * k, 0.28 * k, 0.14 * k, 0.07 * k]);
        burst(g, s, { type: "pink", ft: "lowpass", f: 400, peak: 0.3 * k, d: 0.05 });
      }
      if (Math.random() < 0.12) creak(g, t + 0.05, 0.25, 0.5);
    } else {
      // Stein: harter, heller Klick mit etwas Sand darunter
      for (const [s, k] of [[t, 1], [toe - 0.03, 0.6]]) {
        burst(g, s, { ft: "highpass", f: R(2600, 3400), peak: 0.45 * k, d: 0.012 });
        modes(g, s, R(1500, 2100) * foot, [1, 1.71, 2.93], [0.035, 0.025, 0.015], [0.12 * k, 0.07 * k, 0.04 * k]);
        burst(g, s, { type: "pink", ft: "lowpass", f: 260, peak: 0.4 * k, d: 0.035 });
        grains(4, s, 0.05, (q) => burst(g, q, { ft: "highpass", f: R(4500, 8000), peak: R(0.05, 0.14) * k, d: R(0.004, 0.01) }));
      }
    }
  },
  /** Tür auf: Riegel, dann knarrt die Angel (Haftreibung). */
  doorOpen(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2.8); g.connect(dest); send(g, 0.25);
    latchClick(g, t); creak(g, t + 0.1, R(0.55, 0.95));
  },
  /** Tür zu: kurzes Schwingen mit Luftzug, dann schlägt das Türblatt in den Rahmen (heller Schlag, kurzer Holzkörper, dumpfer Rahmen),
   *  sofort danach schnappt die Falle ein und klappert nach; der Raum hallt kurz. */
  doorClose(dest: AudioNode) {
    const t = now() + 0.005, g = gain(1.1); g.connect(dest); send(g, 0.35);
    creak(g, t, R(0.18, 0.26), 0.45);
    burst(g, t + 0.06, { type: "pink", ft: "bandpass", f: 250, f2: 700, q: 0.7, a: 0.12, peak: 0.1, d: 0.06 });
    const hit = t + R(0.26, 0.32);
    burst(g, hit, { f: R(1000, 1250), q: 0.9, a: 0.001, peak: 0.55, d: 0.035 });
    modes(g, hit, R(95, 115), [1, 1.73, 2.6, 3.9, 5.6], [0.16, 0.11, 0.08, 0.05, 0.035], [0.7, 0.5, 0.35, 0.2, 0.1]);
    burst(g, hit, { type: "brown", ft: "lowpass", f: 220, a: 0.002, peak: 0.5, d: 0.07 });
    latchClick(g, hit + 0.012, 0.9); latchClick(g, hit + R(0.045, 0.06), 0.4);
  },
  /** Topf: Metallklang mit Deckelklappern, danach Brutzeln. */
  pot(dest: AudioNode) {
    const t = now() + 0.005, g = gain(1.7); g.connect(dest); send(g, 0.2);
    const f0 = R(360, 430);
    modes(g, t, f0, [1, 2.32, 4.25, 6.63, 8.1], [0.9, 0.6, 0.42, 0.3, 0.2], [0.22, 0.16, 0.1, 0.06, 0.04]);
    burst(g, t, { ft: "highpass", f: 3000, peak: 0.3, d: 0.01 });
    let s = t + 0.08;
    for (const [dt, k] of [[0.1, 0.5], [0.075, 0.32], [0.055, 0.2], [0.04, 0.1]]) { s += dt * R(0.85, 1.15); modes(g, s, f0 * 1.9, [1, 2.1, 3.4], [0.12, 0.08, 0.05], [0.12 * k, 0.07 * k, 0.04 * k]); }
    const sz = t + 0.35, len = 2.4, hs = gain(0);
    chain(noise("white", { at: sz, dur: len + 0.1 }), filt("highpass", 3200, 0.6), filt("peaking", 6500, 1), hs, g);
    hs.gain.setValueAtTime(0, sz); hs.gain.linearRampToValueAtTime(0.09, sz + 0.4); hs.gain.setValueAtTime(0.09, sz + len - 0.9); hs.gain.linearRampToValueAtTime(0, sz + len);
    grains(90, sz, len - 0.3, (q) => burst(g, q, { ft: "highpass", f: R(2500, 7000), peak: R(0.03, 0.16), d: R(0.002, 0.008) }));
  },
  /** Münzen: mehrere kleine Metallscheiben, jede mit eigenen Teiltönen, leicht im Raum verteilt. */
  coins(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2.2); g.connect(dest);
    burst(g, t, { type: "pink", ft: "lowpass", f: 400, peak: 0.25, d: 0.04 });
    let s = t; const n = Math.floor(R(5, 8));
    for (let i = 0; i < n; i++) {
      const p = panner(R(-0.25, 0.25)); p.connect(g); const k = (1 - i / (n + 2)) * R(0.6, 1);
      modes(p, s, R(3000, 4700), [1, 1.47, 2.09, 2.56, 3.41], [R(0.1, 0.3), R(0.08, 0.2), 0.1, 0.07, 0.05], [0.12 * k, 0.09 * k, 0.07 * k, 0.05 * k, 0.03 * k]);
      burst(p, s, { ft: "highpass", f: 6000, peak: 0.12 * k, d: 0.006 });
      s += R(0.025, 0.09) * (1 + i * 0.15);
    }
  },
  /** Holz hacken: Schwung, Einschlag mit Holzkörper, Knacken; manchmal spaltet das Scheit. */
  chop(dest: AudioNode) {
    const t = now() + 0.14, g = gain(0.75); g.connect(dest); send(g, 0.12);
    burst(g, t - 0.13, { type: "pink", f: 500, f2: 2600, q: 1.2, a: 0.1, peak: 0.08, d: 0.03 });
    burst(g, t, { ft: "highpass", f: 2200, peak: 0.6, d: 0.006 });
    modes(g, t, R(250, 320), [1, 1.82, 2.71, 4.13], [0.13, 0.085, 0.055, 0.04], [0.5, 0.3, 0.18, 0.1]);
    burst(g, t, { f: R(1300, 1800), q: 1, peak: 0.35, d: 0.05 });
    const o = osc("sine", 115), og = gain(0); chain(o, og, g); o.frequency.exponentialRampToValueAtTime(55, t + 0.12); env(og, t, 0.002, 0.6, 0.13); o.start(t); o.stop(t + 0.2);
    if (Math.random() < 0.4) {
      burst(g, t + 0.07, { f: 2400, q: 0.9, peak: 0.28, d: 0.04 });
      for (const dt of [0.34, 0.48]) modes(g, t + dt + R(0, 0.05), R(520, 680), [1, 2.3, 3.6], [0.06, 0.04, 0.03], [0.18, 0.08, 0.04]);
    }
  },
  /** Buch: Seite wird umgeschlagen (Rascheln mit Flattern, dann leichtes Aufliegen). */
  book(dest: AudioNode) {
    const t = now() + 0.005, g = gain(1), len = R(0.22, 0.32); g.connect(dest);
    const n = noise("pink", { at: t, dur: len + 0.1 }), f = filt("bandpass", 1400, 0.9), ng = gain(0); chain(n, f, ng, g);
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(4200, t + len);
    ng.gain.setValueCurveAtTime(roughCurve(24, (q) => 0.4 * Math.sin(Math.PI * q), 0.4), t, len);
    burst(g, t + len, { type: "pink", ft: "lowpass", f: 1300, peak: 0.22, d: 0.035 });
  },
  /** Tuch, Bettdecke, Ernten: weiches Rascheln. */
  cloth(dest: AudioNode) {
    const t = now() + 0.005, g = gain(0.6), len = R(0.45, 0.7); g.connect(dest);
    const n = noise("pink", { at: t, dur: len + 0.1 }), f = filt("bandpass", R(900, 1400), 0.6), ng = gain(0); chain(n, f, ng, g);
    ng.gain.setValueCurveAtTime(roughCurve(32, (q) => 0.5 * Math.pow(Math.sin(Math.PI * q), 0.7), 0.3), t, len);
  },
  /** Schloss: Schlüssel, zwei Riegelklicks, Mechanik. */
  latch(dest: AudioNode) {
    const t = now() + 0.005, g = gain(3); g.connect(dest); send(g, 0.2);
    grains(3, t, 0.12, (s) => burst(g, s, { ft: "highpass", f: 5500, peak: 0.12, d: 0.008 }));
    latchClick(g, t + 0.18, 0.9); latchClick(g, t + 0.31, 0.7);
    burst(g, t + 0.31, { type: "brown", ft: "lowpass", f: 350, peak: 0.5, d: 0.06 });
  },
  /** Gießkanne: Anheben (Blech, Schwappen), dann ein dünner Strahl, der gluckert und auf Erde und Blätter tropft, zum Schluss
   *  einzelne Nachtropfen. Kein breites Rauschen mehr (das klang nach starkem Regen). */
  pour(dest: AudioNode) {
    const t = now() + 0.005, g = gain(1.4), len = R(2.2, 2.8), s = t + 0.35; g.connect(dest);
    modes(g, t, R(1700, 1950), [1, 2.4, 3.9], [0.12, 0.08, 0.05], [0.06, 0.03, 0.015]);
    burst(g, t + 0.05, { type: "brown", ft: "lowpass", f: 500, a: 0.12, peak: 0.25, d: 0.18 });
    const tr = noise("pink", { at: s, dur: len + 0.1 }), bp = filt("bandpass", 950, 2.5), tg = gain(0); chain(tr, bp, tg, g);
    tg.gain.setValueAtTime(0, s); tg.gain.linearRampToValueAtTime(0.11, s + 0.3); tg.gain.setValueAtTime(0.11, s + len - 0.5); tg.gain.linearRampToValueAtTime(0, s + len);
    for (let q = s; q < s + len; q += 0.07) bp.frequency.setTargetAtTime(R(700, 1300), q, 0.03);
    const body = (q: number) => Math.min(1, (q - s) / 0.3, (s + len - q) / 0.5);
    grains(Math.floor(len * 18), s, len, (q) => drop(g, q, R(250, 700), R(0.06, 0.14) * body(q), R(1.4, 2), R(0.04, 0.07)));
    grains(Math.floor(len * 25), s + 0.1, len - 0.2, (q) => burst(g, q, { f: R(1500, 2500), q: 1.2, peak: R(0.03, 0.06) * body(q), d: 0.015 }));
    let d = s + len + 0.1; for (let i = 0; i < Math.floor(R(3, 6)); i++) { drop(g, d, R(900, 1400), 0.08 * (1 - i * 0.15)); d += R(0.2, 0.5); }
  },
  /** Schlafen: zweimal ein- und ausatmen mit leisem Schnarchen. */
  snore(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2.5); g.connect(dest);
    for (const s of [t, t + 2.6]) {
      const n = noise("pink", { at: s, dur: 1.4 }), f = filt("bandpass", 420, 1.2), rattle = gain(0), am = gain(0);
      const lfo = osc("sawtooth", R(28, 36)), lg = gain(0.5); chain(lfo, lg); lg.connect(rattle.gain); chain(n, f, rattle, am, g);
      am.gain.setValueAtTime(0, s); am.gain.linearRampToValueAtTime(0.55, s + 0.6); am.gain.linearRampToValueAtTime(0, s + 1.2);
      lfo.start(s); lfo.stop(s + 1.3);
      burst(g, s + 1.35, { type: "pink", ft: "bandpass", f: 900, q: 0.6, a: 0.25, peak: 0.14, d: 0.7 });
    }
  },
  /** Hämmern (Bauen, Reparieren): drei bis vier Schläge, Metall auf Holz. */
  hammer(dest: AudioNode) {
    const g = gain(1.1); g.connect(dest); send(g, 0.15);
    let t = now() + 0.01;
    for (let i = 0; i < Math.floor(R(3, 5)); i++) {
      burst(g, t, { ft: "highpass", f: 2500, peak: 0.5, d: 0.008 });
      modes(g, t, R(2600, 3000), [1, 1.6, 2.4], [0.05, 0.035, 0.02], [0.08, 0.05, 0.03]);
      modes(g, t, R(330, 400), [1, 1.9, 2.8], [0.09, 0.06, 0.04], [0.4, 0.2, 0.1]);
      t += R(0.38, 0.5);
    }
  },
  /** Graben (Pflanzen): Spaten in die Erde, Erde rieselt. */
  dig(dest: AudioNode) {
    const t = now() + 0.005, g = gain(1.6); g.connect(dest);
    burst(g, t, { f: R(1800, 2400), q: 1.5, peak: 0.25, d: 0.02 });
    burst(g, t, { type: "brown", ft: "lowpass", f: 400, a: 0.01, peak: 0.6, d: 0.12 });
    grains(16, t + 0.25, 0.35, (s) => burst(g, s, { f: R(1200, 3500), q: 1.5, peak: R(0.04, 0.12), d: R(0.01, 0.02) }));
  },
  /** Anzünden: Streichholz reibt, flammt auf. */
  light(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2.2); g.connect(dest);
    burst(g, t, { f: 3000, f2: 5000, q: 1, a: 0.02, peak: 0.25, d: 0.1 });
    burst(g, t + 0.12, { type: "pink", ft: "bandpass", f: 900, q: 0.6, a: 0.04, peak: 0.35, d: 0.45 });
    grains(6, t + 0.15, 0.4, (s) => burst(g, s, { ft: "highpass", f: 3000, peak: R(0.04, 0.1), d: 0.004 }));
  },
  /** Ausblasen: kurzer Hauch. */
  blow(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2.4); g.connect(dest);
    burst(g, t, { type: "pink", ft: "bandpass", f: 1200, q: 0.5, a: 0.05, peak: 0.3, d: 0.3 });
  },
  /** Essen und Trinken: Löffel an Schale, Becher wird abgestellt. */
  clink(dest: AudioNode) {
    const g = gain(2); g.connect(dest); let t = now() + 0.005;
    for (let i = 0; i < 2; i++) { modes(g, t, R(1900, 2300), [1, 2.7, 5.1], [0.25, 0.12, 0.06], [0.07, 0.03, 0.015]); t += R(0.5, 0.8); }
    modes(g, t, R(600, 750), [1, 2.2, 3.7], [0.08, 0.05, 0.03], [0.15, 0.06, 0.03]);
  },
  /** Wasser: Paddel oder Angelschnur taucht ein. */
  splash(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2); g.connect(dest);
    burst(g, t, { type: "pink", ft: "bandpass", f: 1500, f2: 600, q: 0.7, a: 0.01, peak: 0.35, d: 0.25 });
    grains(10, t + 0.03, 0.4, (s) => drop(g, s, R(400, 1100), R(0.04, 0.1)));
  },
  /** Schreiben: Feder kratzt in kurzen Zügen. */
  write(dest: AudioNode) {
    const g = gain(4); g.connect(dest); let t = now() + 0.005;
    for (let i = 0; i < Math.floor(R(4, 7)); i++) { const len = R(0.08, 0.2); burst(g, t, { f: R(4000, 6000), q: 2, a: 0.01, peak: 0.08, d: len }); t += len + R(0.05, 0.15); }
  },
  /** Katze streicheln: Schnurren. */
  purr(dest: AudioNode) {
    const t = now() + 0.005, g = gain(2), len = 2.2; g.connect(dest);
    const n = noise("brown", { at: t, dur: len }), f = filt("lowpass", 300), am = gain(0), lfo = osc("sine", R(24, 28)), lg = gain(0.5), env2 = gain(0);
    chain(lfo, lg); lg.connect(am.gain); chain(n, f, am, env2, g);
    env2.gain.setValueAtTime(0, t); env2.gain.linearRampToValueAtTime(0.5, t + 0.4); env2.gain.setValueAtTime(0.5, t + len - 0.5); env2.gain.linearRampToValueAtTime(0, t + len);
    lfo.start(t); lfo.stop(t + len);
  },
};
export type Sfx = keyof typeof SFX;
