/* Klang-Mockup AP17d: Umgebung aus Code (Dauerklänge). Jede Funktion liefert { stop() } und blendet weich ein und aus.
   Stereo: Schichten liegen links und rechts verschieden, einzelne Ereignisse (Vogel, Tropfen, Knacken) bekommen einen zufälligen Ort. */
const spot = (dest, x = R(.1, .9), d = R(0, .6)) => place(dest, x, d);
/* feste Orte für dichte Körner (Tropfen, Blasen), damit nicht für jedes Korn neue Knoten entstehen */
const spots = (dest, n, d) => Array.from({ length: n }, (_, i) => place(dest, (i + .5) / n, d * R(.5, 1)));
const AMB = {
  /* Regen: breites Rauschen in zwei Kanälen, nahe Tropfen, Plätschern in Pfützen, tiefes Grollen der Masse */
  rain(dest = bus.amb, k = 1) {
    const L = loopShell(dest, .5 * k);
    for (const pan of [-.6, .6]) {
      const n = L.add(noise('pink', { loop: true })), p = ctx.createStereoPanner(); p.pan.value = pan;
      chain(n, filt('highpass', 450, .5), filt('lowpass', 5200, .5), gain(.9), p, L.g);
    }
    const low = L.add(noise('brown', { loop: true })); chain(low, filt('lowpass', 200), gain(.35), L.g);
    const near = spots(L.g, 6, .4), far = spots(L.g, 4, .7);
    L.every(.012, .04, t => burst(pick(near), t, { f: R(2500, 7500), q: R(2, 4), peak: R(.02, .11), d: R(.004, .012) }));
    L.every(.12, .55, t => { const f = R(1500, 3200), o = osc('sine', f), g = gain(0); chain(o, g, pick(far)); o.frequency.exponentialRampToValueAtTime(f * .55, t + .05); env(g, t, .002, R(.02, .06), .05); o.start(t); o.stop(t + .08); });
    return L;
  },
  /* Wind: zwei Bänder, deren Tonlage und Stärke langsam und unregelmäßig wandern (Böen), leises Pfeifen in den Böen */
  wind(dest = bus.amb, k = 1) {
    const L = loopShell(dest, .45 * k, 2);
    for (const [pan, f, type] of [[-.5, 420, 'pink'], [.5, 650, 'brown']]) {
      const n = L.add(noise(type, { loop: true })), bp = filt('bandpass', f, .9), g = gain(.6), p = ctx.createStereoPanner(); p.pan.value = pan;
      chain(n, bp, g, p, L.g); L.lfo(bp.frequency, 2.5, f * .45, f); L.lfo(g.gain, 3, .4 * k, .55);
    }
    const w = L.add(noise('pink', { loop: true })), wf = filt('bandpass', 900, 22), wg = gain(0);
    chain(w, wf, wg, L.g); L.lfo(wf.frequency, 2, 220, 950); L.lfo(wg.gain, 3.5, .5 * k, .35 * k);
    return L;
  },
  /* Vögel: mehrere Arten, jeder Vogel hat sein eigenes Lied und wiederholt es, an seinem eigenen Ort */
  birds(dest = bus.amb, dense = 1, { dove = false } = {}) {
    const L = loopShell(dest, 1.3, .8);
    const flock = Array.from({ length: Math.round(3 + dense * 3) }, () => makeBird(L.g));
    L.every(3.2 / dense, 7 / dense, t => pick(flock).sing(t), { first: .3 });
    if (dove) L.every(9, 16, t => coo(L.g, t), { first: 2 });
    return L;
  },
  /* Grillen: gleichmäßiges Zirpen in festen Takten, jede Grille mit eigener Tonlage */
  crickets(dest = bus.amb, k = 1) {
    const L = loopShell(dest, .12 * k, 2);
    for (let c = 0; c < 3; c++) {
      const f = R(4200, 4900), per = R(.55, .95), x = R(.15, .85), d = R(.2, .8), o = spot(L.g, x, d);
      L.every(per, per * 1.04, t => { for (let i = 0; i < 3; i++) { const s = t + i * .032, os = osc('sine', f), g = gain(0); chain(os, g, o); env(g, s, .004, .5, .02); os.start(s); os.stop(s + .03); } }, { first: R(0, 1) });
    }
    return L;
  },
  /* Eule: selten, fern, mit Hall */
  owl(dest = bus.amb) {
    const L = loopShell(dest, .5, .5); send(L.g, .6);
    L.every(11, 22, t => {
      const o = spot(L.g, R(.1, .9), .6);
      for (const [dt, len, f] of [[0, .35, 375], [.75, .18, 395], [1.05, .7, 370]]) {
        const s = t + dt, os = osc('sine', f), g = gain(0), lp = filt('lowpass', 900); chain(os, lp, g, o);
        os.frequency.setValueAtTime(f * .96, s); os.frequency.linearRampToValueAtTime(f, s + .08); os.frequency.linearRampToValueAtTime(f * .93, s + len);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.35, s + .07); g.gain.setTargetAtTime(0, s + len - .1, .06); os.start(s); os.stop(s + len + .4);
      }
    }, { first: 3 });
    return L;
  },
  /* Bienen: ab und zu summt eine vorbei (von einer Seite zur anderen) */
  bees(dest = bus.amb) {
    const L = loopShell(dest, .7, .5);
    L.every(7, 15, t => {
      const len = R(2.5, 4), o = osc('sawtooth', R(190, 240)), vib = osc('sine', R(9, 14)), vg = gain(R(8, 15)), bp = filt('bandpass', 900, 1.2), g = gain(0), p = ctx.createStereoPanner();
      chain(vib, vg, o.frequency); chain(o, bp, g, p, L.g); const a = R(-1, 1) > 0 ? -.8 : .8;
      p.pan.setValueAtTime(a, t); p.pan.linearRampToValueAtTime(-a, t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + len / 2); g.gain.linearRampToValueAtTime(0, t + len);
      o.start(t); vib.start(t); o.stop(t + len + .05); vib.stop(t + len + .05);
    }, { first: 2 });
    return L;
  },
  /* Bach: dunkles Rauschen und viele kleine Blasen (Ton steigt beim Platzen) */
  water(dest = bus.amb, k = 1) {
    const L = loopShell(dest, .55 * k);
    for (const pan of [-.4, .4]) { const n = L.add(noise('pink', { loop: true })), p = ctx.createStereoPanner(); p.pan.value = pan; chain(n, filt('lowpass', 1100, .5), filt('highpass', 120), gain(.6), p, L.g); }
    const bub = spots(L.g, 5, .3);
    L.every(.02, .07, t => { const f = R(380, 1300), o = osc('sine', f), g = gain(0); chain(o, g, pick(bub)); o.frequency.exponentialRampToValueAtTime(f * R(1.5, 2.6), t + R(.03, .07)); env(g, t, .003, R(.02, .09), R(.04, .07)); o.start(t); o.stop(t + .1); });
    return L;
  },
  /* Feuer: dumpfes Fauchen, unregelmäßiges Knistern (viele leise, wenige laute) und ab und zu ein Knacken */
  fire(dest = bus.amb, k = 1) {
    const L = loopShell(dest, .5 * k);
    const roar = L.add(noise('brown', { loop: true })), rl = filt('lowpass', 320), rg = gain(.6); chain(roar, rl, rg, L.g); L.lfo(rg.gain, .4, .25, .6); L.lfo(rl.frequency, .6, 120, 320);
    const hiss = L.add(noise('pink', { loop: true })); chain(hiss, filt('highpass', 2600), gain(.05), L.g);
    L.every(.02, .12, t => burst(L.g, t, { ft: 'highpass', f: R(900, 5000), peak: Math.pow(Math.random(), 3) * .7 + .03, d: R(.002, .012) }));
    L.every(1.8, 5, t => { burst(L.g, t, { ft: 'highpass', f: 1500, peak: .8, d: .015 }); modes(L.g, t, R(500, 800), [1, 2.2], [.05, .03], [.15, .06]); grains(5, t + .02, .25, s => burst(L.g, s, { ft: 'highpass', f: 3000, peak: R(.05, .2), d: .004 })); });
    return L;
  },
  /* Gewitter in der Ferne: selten, tiefes Rollen */
  thunder(dest = bus.amb) {
    const L = loopShell(dest, .8, .3);
    L.every(18, 34, t => {
      const len = R(3, 5), n = noise('brown', { at: t, dur: len + .2 }), lp = filt('lowpass', 160, .7), g = gain(0); chain(n, lp, g, spot(L.g, R(.2, .8), .5));
      const pts = 30, c = new Float32Array(pts); for (let i = 0; i < pts; i++) c[i] = Math.pow(1 - i / pts, 1.6) * (.6 + .4 * Math.sin(i * R(.8, 1.4))) * .9;
      c[pts - 1] = 0; g.gain.setValueCurveAtTime(c, t, len); lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(70, t + len);
    }, { first: 6 });
    return L;
  },
};

/* Ein Vogel mit eigenem Lied: Art, Tonlage und Notenfolge werden einmal festgelegt und dann wiederholt (wie echte Vögel) */
function makeBird(dest) {
  const kind = pick(['pfeifer', 'pfeifer', 'triller', 'zwitscherer']), base = R(2600, 4300), x = R(.08, .92), d = R(.1, .8), o = place(dest, x, d);
  const song = Array.from({ length: Math.floor(R(3, 7)) }, () => ({ f: base * pick([1, 1.12, 1.26, 1.33, .89, 1.5]), len: R(.05, .16), up: R(-.25, .35), gap: R(.03, .1) }));
  const tone = (t, f, len, up, a = .14) => { const os = osc('sine', f), g = gain(0); chain(os, g, o); os.frequency.setValueAtTime(f, t); os.frequency.exponentialRampToValueAtTime(f * (1 + up), t + len); env(g, t, .008, a, len); os.start(t); os.stop(t + len + .05); };
  return {
    sing(t) {
      if (kind === 'pfeifer') { let s = t; for (const n of song) { tone(s, n.f, n.len, n.up); s += n.len + n.gap; } }
      else if (kind === 'triller') {
        const len = R(.5, 1), os = osc('sine', base), fm = osc('sine', R(22, 34)), fg = gain(base * .12), g = gain(0); chain(fm, fg, os.frequency); chain(os, g, o);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .05); g.gain.setValueAtTime(.09, t + len - .1); g.gain.linearRampToValueAtTime(0, t + len);
        os.start(t); fm.start(t); os.stop(t + len + .02); fm.stop(t + len + .02);
      } else { let s = t; for (let i = 0; i < Math.floor(R(4, 9)); i++) { tone(s, base * R(.9, 1.4), R(.025, .05), R(.3, .9), .1); s += R(.05, .09); } }
    },
  };
}
/* Taube am Morgen: weiches „hu-huu-hu“ */
function coo(dest, t) {
  const o = place(dest, R(.1, .9), .5);
  for (const [dt, len, f] of [[0, .25, 520], [.35, .55, 560], [1.0, .3, 500]]) {
    const s = t + dt, os = osc('sine', f), g = gain(0); chain(os, filt('lowpass', 1000), g, o);
    os.frequency.setValueAtTime(f * .95, s); os.frequency.linearRampToValueAtTime(f, s + .08); os.frequency.linearRampToValueAtTime(f * .9, s + len);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.18, s + .06); g.gain.setTargetAtTime(0, s + len - .08, .05); os.start(s); os.stop(s + len + .3);
  }
}
