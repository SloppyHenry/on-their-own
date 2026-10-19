/* Klang-Mockup AP17d: Geräusche der Figuren und Dinge aus Code.
   Jeder Klang ist bei jedem Aufruf etwas anders (Zufall in Tonhöhe, Dichte, Zeit), damit Wiederholungen nicht auffallen.
   Aufruf: SFX.name(ziel, ...) – ziel ist ein Kanal oder ein Ort aus place(). */
let footSide = 0;
const SFX = {
  /* Schritt: Ferse und Ballen, abwechselnd linker und rechter Fuß */
  step(dest = bus.fig, surface = 'gras') {
    const t = now() + .005, foot = (footSide ^= 1) ? 1 : .93, g = gain({ gras: 2.8, holz: 1, stein: 2.4 }[surface]); g.connect(dest);
    const toe = t + R(.03, .05);
    if (surface === 'gras') {
      // Knirschen vieler Halme und ein weiches Aufsetzen
      grains(Math.floor(R(9, 15)), t, .11, (s, i) => burst(g, s, { f: R(1800, 5200) * foot, q: R(1, 2.5), peak: R(.08, .32) * (1 - i / 18), d: R(.008, .025) }));
      burst(g, t, { type: 'pink', ft: 'lowpass', f: 700, peak: .35, a: .008, d: .07 });
      burst(g, toe, { type: 'pink', ft: 'bandpass', f: 1400, q: .8, peak: .18, a: .01, d: .06 });
    } else if (surface === 'holz') {
      // hohler Klopfer: Bohle schwingt mit, Ballen leiser; selten knarrt ein Brett
      for (const [s, k] of [[t, 1], [toe, .45]]) {
        burst(g, s, { f: 2200, q: .8, peak: .35 * k, d: .006 });
        modes(g, s, R(150, 185) * foot, [1, 2.31, 3.93, 5.4], [.11, .07, .045, .03], [.55 * k, .28 * k, .14 * k, .07 * k]);
        burst(g, s, { type: 'pink', ft: 'lowpass', f: 400, peak: .3 * k, d: .05 });
      }
      if (Math.random() < .12) { const o = osc('sawtooth', R(70, 110)), f = filt('bandpass', R(800, 1200), 9), cg = gain(0); chain(o, f, cg, g); o.frequency.linearRampToValueAtTime(R(120, 180), t + .25); env(cg, t + .05, .03, .12, .22); o.start(t); o.stop(t + .35); }
    } else {
      // Stein: harter, heller Klick mit etwas Sand darunter
      for (const [s, k] of [[t, 1], [toe, .6]]) {
        burst(g, s, { ft: 'highpass', f: R(2600, 3400), peak: .45 * k, d: .012 });
        modes(g, s, R(1500, 2100) * foot, [1, 1.71, 2.93], [.035, .025, .015], [.12 * k, .07 * k, .04 * k]);
        burst(g, s, { type: 'pink', ft: 'lowpass', f: 260, peak: .4 * k, d: .035 });
        grains(4, s, .05, q => burst(g, q, { ft: 'highpass', f: R(4500, 8000), peak: R(.05, .14) * k, d: R(.004, .01) }));
      }
    }
  },
  /* Metallriegel: kurzer Klick mit unharmonischen Obertönen */
  latchClick(dest, t, k = 1) {
    burst(dest, t, { ft: 'highpass', f: 4000, peak: .35 * k, d: .01 });
    modes(dest, t, R(2300, 2700), [1, 1.52, 2.31, 3.12], [.06, .045, .03, .02], [.12 * k, .09 * k, .06 * k, .03 * k]);
  },
  /* Tür: auf = Riegel und Knarren (Haftreibung der Angel), zu = Luftzug, Schlag, Riegel, Raumhall */
  door(dest = bus.fig, open = true) {
    const t = now() + .005, g = gain(open ? 2.8 : .85); g.connect(dest); send(g, open ? .25 : .45);
    if (open) {
      SFX.latchClick(g, t);
      const len = R(.55, .95), s = t + .1, o = osc('sawtooth', 60), n = 48, curve = new Float32Array(n), amp = new Float32Array(n);
      let rate = R(45, 70);
      for (let i = 0; i < n; i++) { rate = clamp(rate + R(-9, 11), 28, 140); curve[i] = rate; amp[i] = .12 + .14 * Math.sin(Math.PI * i / n) * R(.5, 1.2); }
      o.frequency.setValueCurveAtTime(curve, s, len);
      const body = gain(0), mix = gain(1); o.connect(body);
      for (const [f, q, a] of [[R(520, 640), 7, 1], [R(1150, 1350), 10, .7], [R(2400, 2800), 12, .35]]) chain(body, filt('bandpass', f, q), gain(a), mix);
      mix.connect(g); body.gain.setValueAtTime(0, s); body.gain.setValueCurveAtTime(amp, s + .01, len - .02); body.gain.setValueAtTime(0, s + len);
      o.start(s); o.stop(s + len + .05);
    } else {
      burst(g, t, { type: 'pink', ft: 'bandpass', f: 300, f2: 900, q: .7, a: .08, peak: .12, d: .08 });
      const hit = t + .16;
      modes(g, hit, R(65, 78), [1, 1.58, 2.41, 3.3], [.28, .16, .09, .05], [.9, .45, .25, .1]);
      burst(g, hit, { type: 'brown', ft: 'lowpass', f: 500, peak: .7, d: .1 });
      burst(g, hit, { f: 1800, q: .7, peak: .25, d: .02 });
      SFX.latchClick(g, hit + .03, .8);
    }
  },
  /* Topf: Metallklang mit Deckelklappern, danach Brutzeln */
  pot(dest = bus.fig) {
    const t = now() + .005, g = gain(1.7); g.connect(dest); send(g, .2);
    const f0 = R(360, 430);
    modes(g, t, f0, [1, 2.32, 4.25, 6.63, 8.1], [.9, .6, .42, .3, .2], [.22, .16, .1, .06, .04]);
    burst(g, t, { ft: 'highpass', f: 3000, peak: .3, d: .01 });
    let s = t + .08;
    for (const [dt, k] of [[.1, .5], [.075, .32], [.055, .2], [.04, .1]]) { s += dt * R(.85, 1.15); modes(g, s, f0 * 1.9, [1, 2.1, 3.4], [.12, .08, .05], [.12 * k, .07 * k, .04 * k]); }
    // Brutzeln: Zischen und dichtes, feines Knistern
    const sz = t + .35, len = 2.4, hs = gain(0);
    chain(noise('white', { at: sz, dur: len + .1 }), filt('highpass', 3200, .6), filt('peaking', 6500, 1), hs, g);
    hs.gain.setValueAtTime(0, sz); hs.gain.linearRampToValueAtTime(.09, sz + .4); hs.gain.setValueAtTime(.09, sz + len - .9); hs.gain.linearRampToValueAtTime(0, sz + len);
    grains(90, sz, len - .3, q => burst(g, q, { ft: 'highpass', f: R(2500, 7000), peak: R(.03, .16), d: R(.002, .008) }));
  },
  /* Münzen: mehrere kleine Metallscheiben, jede mit eigenen Teiltönen, leicht im Raum verteilt */
  coins(dest = bus.fig) {
    const t = now() + .005, g = gain(2.2); g.connect(dest);
    burst(g, t, { type: 'pink', ft: 'lowpass', f: 400, peak: .25, d: .04 });
    let s = t; const n = Math.floor(R(5, 8));
    for (let i = 0; i < n; i++) {
      const p = ctx.createStereoPanner(); p.pan.value = R(-.25, .25); p.connect(g); const k = (1 - i / (n + 2)) * R(.6, 1);
      modes(p, s, R(3000, 4700), [1, 1.47, 2.09, 2.56, 3.41], [R(.1, .3), R(.08, .2), .1, .07, .05], [.12 * k, .09 * k, .07 * k, .05 * k, .03 * k]);
      burst(p, s, { ft: 'highpass', f: 6000, peak: .12 * k, d: .006 });
      s += R(.025, .09) * (1 + i * .15);
    }
  },
  /* Holz hacken: Schwung, Einschlag mit Holzkörper, Knacken; manchmal spaltet das Scheit */
  chop(dest = bus.fig) {
    const t = now() + .14, g = gain(.75); g.connect(dest); send(g, .12);
    burst(g, t - .13, { type: 'pink', f: 500, f2: 2600, q: 1.2, a: .1, peak: .08, d: .03 });
    burst(g, t, { ft: 'highpass', f: 2200, peak: .6, d: .006 });
    modes(g, t, R(250, 320), [1, 1.82, 2.71, 4.13], [.13, .085, .055, .04], [.5, .3, .18, .1]);
    burst(g, t, { f: R(1300, 1800), q: 1, peak: .35, d: .05 });
    const o = osc('sine', 115), og = gain(0); chain(o, og, g); o.frequency.exponentialRampToValueAtTime(55, t + .12); env(og, t, .002, .6, .13); o.start(t); o.stop(t + .2);
    if (Math.random() < .4) {
      burst(g, t + .07, { f: 2400, q: .9, peak: .28, d: .04 });
      for (const dt of [.34, .48]) modes(g, t + dt + R(0, .05), R(520, 680), [1, 2.3, 3.6], [.06, .04, .03], [.18, .08, .04]);
    }
  },
  /* Buch: Seite wird umgeschlagen (Rascheln mit Flattern, dann leichtes Aufliegen) */
  book(dest = bus.fig) {
    const t = now() + .005, g = gain(1), len = R(.22, .32); g.connect(dest);
    const n = noise('pink', { at: t, dur: len + .1 }), f = filt('bandpass', 1400, .9), ng = gain(0); chain(n, f, ng, g);
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(4200, t + len);
    const curve = new Float32Array(24); for (let i = 0; i < 24; i++) curve[i] = .4 * Math.sin(Math.PI * i / 23) * R(.4, 1);
    ng.gain.setValueCurveAtTime(curve, t, len);
    burst(g, t + len, { type: 'pink', ft: 'lowpass', f: 1300, peak: .22, d: .035 });
  },
  /* Tuch, Bettdecke: weiches Rascheln */
  cloth(dest = bus.fig) {
    const t = now() + .005, g = gain(.6), len = R(.45, .7); g.connect(dest);
    const n = noise('pink', { at: t, dur: len + .1 }), f = filt('bandpass', R(900, 1400), .6), ng = gain(0); chain(n, f, ng, g);
    const curve = new Float32Array(32); for (let i = 0; i < 32; i++) curve[i] = .5 * Math.pow(Math.sin(Math.PI * i / 31), .7) * R(.3, 1);
    ng.gain.setValueCurveAtTime(curve, t, len);
  },
  /* Schloss: Schlüssel, zwei Riegelklicks, Mechanik */
  latch(dest = bus.fig) {
    const t = now() + .005, g = gain(3); g.connect(dest); send(g, .2);
    grains(3, t, .12, s => burst(g, s, { ft: 'highpass', f: 5500, peak: .12, d: .008 }));
    SFX.latchClick(g, t + .18, .9); SFX.latchClick(g, t + .31, .7);
    burst(g, t + .31, { type: 'brown', ft: 'lowpass', f: 350, peak: .5, d: .06 });
  },
  /* Gießkanne: Strahl, darunter blubbernde Tropfen */
  pour(dest = bus.fig) {
    const t = now() + .005, g = gain(1), len = R(1.6, 2.2); g.connect(dest);
    const ng = gain(0); chain(noise('pink', { at: t, dur: len + .2 }), filt('bandpass', R(1100, 1500), .7), ng, g);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(.35, t + .15); ng.gain.setValueAtTime(.35, t + len - .3); ng.gain.linearRampToValueAtTime(0, t + len);
    grains(Math.floor(len * 26), t + .1, len - .2, s => { const f = R(500, 1300), o = osc('sine', f), og = gain(0); chain(o, og, g); o.frequency.exponentialRampToValueAtTime(f * R(1.6, 2.4), s + .05); env(og, s, .003, R(.03, .09), .05); o.start(s); o.stop(s + .07); });
  },
  /* Schlafen: zweimal ein- und ausatmen mit leisem Schnarchen */
  snore(dest = bus.fig) {
    const t = now() + .005, g = gain(2.5); g.connect(dest);
    for (const s of [t, t + 2.6]) {
      const n = noise('pink', { at: s, dur: 1.4 }), f = filt('bandpass', 420, 1.2), rattle = gain(0), am = gain(0);
      const lfo = osc('sawtooth', R(28, 36)), lg = gain(.5); chain(lfo, lg, rattle.gain); chain(n, f, rattle, am, g);
      am.gain.setValueAtTime(0, s); am.gain.linearRampToValueAtTime(.55, s + .6); am.gain.linearRampToValueAtTime(0, s + 1.2);
      lfo.start(s); lfo.stop(s + 1.3);
      burst(g, s + 1.35, { type: 'pink', ft: 'bandpass', f: 900, q: .6, a: .25, peak: .14, d: .7 });
    }
  },
};
