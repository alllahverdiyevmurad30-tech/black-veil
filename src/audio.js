// All audio is synthesised with the Web Audio API (no asset files). Four independent buses:
// music, effects, dialogue (radio), ambience. Positional sounds use PannerNodes.
export class AudioSys {
  constructor(settings) { this.s = settings; this.ctx = null; this.amb = []; this.pad = null; this.tension = 0; this.pulseT = 0; this.creakT = 8; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.out = c.createGain(); this.out.connect(c.destination);
    const mk = () => { const g = c.createGain(); g.connect(this.out); return g; };
    this.bus = { music: mk(), sfx: mk(), dlg: mk(), amb: mk() };
    const len = c.sampleRate * 2; this.nb = c.createBuffer(1, len, c.sampleRate);
    const d = this.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
  }
  apply() {
    if (!this.ctx) return; const s = this.s;
    this.out.gain.value = s.master; this.bus.music.gain.value = s.music * 0.6; this.bus.sfx.gain.value = s.sfx;
    this.bus.dlg.gain.value = s.dialogue; this.bus.amb.gain.value = s.sfx * 0.5;
  }
  node(dst, pos) {
    if (!pos) return dst; const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 1.3; p.maxDistance = 120;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.5; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1.5, pos.z);
    p.connect(dst); return p;
  }
  noise(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const { f = 1000, type = 'lowpass', q = 1, v = 0.5, bus = 'sfx', delay = 0, pos = null } = o;
    const s = c.createBufferSource(); s.buffer = this.nb; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(), t = c.currentTime + delay;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.node(this.bus[bus], pos)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(f, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const { type = 'sine', v = 0.3, bus = 'sfx', f2 = f, delay = 0, pos = null } = o;
    const os = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    os.type = type; os.frequency.setValueAtTime(f, t); os.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    os.connect(g); g.connect(this.node(this.bus[bus], pos)); os.start(t); os.stop(t + dur + 0.05);
  }
  shot(id, pos = null, v = 1) {
    if (!this.ctx) return;
    if (id === 'pistol') { this.noise(0.14, { f: 2600, type: 'bandpass', q: 0.7, v: 0.7 * v, pos }); this.tone(130, 0.12, { f2: 55, v: 0.5 * v, pos }); }
    else if (id === 'rifle') { this.noise(0.18, { f: 1900, v: 0.8 * v, pos }); this.noise(0.05, { f: 4000, type: 'highpass', v: 0.4 * v, pos }); this.tone(85, 0.16, { f2: 38, v: 0.6 * v, pos }); }
    else if (id === 'shotgun') { this.noise(0.4, { f: 1000, v: 1 * v, pos }); this.noise(0.08, { f: 3500, type: 'highpass', v: 0.5 * v, pos }); this.tone(60, 0.3, { f2: 28, v: 0.8 * v, pos }); }
    else { this.noise(0.15, { f: 2000, type: 'bandpass', v: 0.5 * v, pos }); this.tone(100, 0.1, { f2: 50, v: 0.35 * v, pos }); } // enemy rifle
  }
  click(f = 700, v = 0.25, delay = 0) { this.noise(0.04, { f: 3200, type: 'bandpass', q: 2, v, delay }); this.tone(f, 0.04, { type: 'square', v: v * 0.5, delay }); }
  reloadPhase(p) { if (p === 0) this.click(500, 0.3); else if (p === 1) { this.click(380, 0.35); this.noise(0.08, { f: 900, v: 0.2 }); } else this.click(900, 0.4); }
  empty() { this.click(300, 0.3); }
  swap() { this.noise(0.1, { f: 1200, type: 'bandpass', v: 0.2 }); this.click(450, 0.2, 0.06); }
  step(surface, v = 1) {
    if (surface === 'snow') { this.noise(0.14, { f: 650, v: 0.28 * v }); this.noise(0.07, { f: 2800, type: 'highpass', v: 0.1 * v }); }
    else if (surface === 'wood') { this.noise(0.09, { f: 500, v: 0.3 * v }); this.tone(115, 0.08, { f2: 80, v: 0.12 * v }); }
    else { this.noise(0.08, { f: 1300, type: 'bandpass', q: 3, v: 0.3 * v }); this.tone(190, 0.06, { type: 'triangle', f2: 140, v: 0.08 * v }); }
  }
  impact(kind, pos) {
    if (kind === 'metal' || kind === 'tech' || kind === 'wreck') { this.noise(0.1, { f: 3000, type: 'bandpass', q: 3, v: 0.35, pos }); this.tone(1700, 0.12, { f2: 1100, v: 0.1, pos }); }
    else if (kind === 'crate') { this.noise(0.12, { f: 700, v: 0.35, pos }); this.tone(160, 0.08, { f2: 90, v: 0.15, pos }); }
    else this.noise(0.1, { f: 2200, type: 'bandpass', q: 1, v: 0.3, pos });
  }
  hit(zone) { if (zone === 'head') { this.tone(1700, 0.1, { v: 0.2 }); this.tone(2400, 0.08, { v: 0.12, delay: 0.03 }); } else this.tone(950, 0.06, { type: 'square', v: 0.1 }); }
  hurt() { this.noise(0.25, { f: 300, v: 0.5 }); this.tone(75, 0.3, { f2: 40, v: 0.5 }); }
  pickup() { this.tone(660, 0.08, { v: 0.12 }); this.tone(990, 0.1, { v: 0.12, delay: 0.07 }); }
  ui() { this.tone(520, 0.04, { type: 'triangle', v: 0.08, bus: 'dlg' }); }
  radio() { this.noise(0.12, { f: 1800, type: 'bandpass', q: 2, v: 0.25, bus: 'dlg' }); this.tone(1100, 0.05, { type: 'square', v: 0.05, bus: 'dlg', delay: 0.1 }); }
  stinger() { this.tone(46, 2.2, { f2: 28, v: 0.6, bus: 'music' }); this.noise(1.6, { f: 220, v: 0.4, bus: 'music' }); }
  creak() { this.tone(70 + Math.random() * 40, 1.2, { type: 'sawtooth', f2: 45, v: 0.05, bus: 'amb' }); this.noise(0.9, { f: 400, type: 'bandpass', q: 6, v: 0.06, bus: 'amb' }); }

  stopAmb() { for (const n of this.amb) { try { n.stop(); } catch {} } this.amb = []; if (this.pad) { for (const o of this.pad.oscs) { try { o.stop(); } catch {} } this.pad = null; } }
  ambience(env, chapter) {
    const c = this.ctx; if (!c) return; this.stopAmb();
    const src = (hz) => { const s = c.createBufferSource(); s.buffer = this.nb; s.loop = true; this.amb.push(s); return s; };
    if (env === 'indoor') {
      const hum = [50, 100.5].map(f => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; this.amb.push(o); return o; });
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const g = c.createGain(); g.gain.value = 0.16;
      hum.forEach(o => { o.connect(lp); o.start(); }); lp.connect(g); g.connect(this.bus.amb);
      const n = src(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; const g2 = c.createGain(); g2.gain.value = 0.25; n.connect(f); f.connect(g2); g2.connect(this.bus.amb); n.start();
    } else {
      const n = src(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.8;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 200; lfo.connect(lg); lg.connect(f.frequency); this.amb.push(lfo); lfo.start();
      const g = c.createGain(); g.gain.value = env === 'dusk' ? 0.7 : 0.55; n.connect(f); f.connect(g); g.connect(this.bus.amb); n.start();
    }
    // Music: a slow minor pad whose brightness follows combat tension.
    const roots = [55, 49, 46.25, 41.2], r = roots[chapter % 4], oscs = [];
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; const mg = c.createGain(); mg.gain.value = 0.35;
    for (const [m, det] of [[1, 0], [1.5, 4], [1.19, -5], [2, 3]]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = r * m; o.detune.value = det; o.connect(lp); o.start(); oscs.push(o); }
    lp.connect(mg); mg.connect(this.bus.music); this.pad = { oscs, lp, mg };
  }
  update(dt, cam, tension) {
    const c = this.ctx; if (!c) return;
    const l = c.listener, p = cam.position, fw = { x: -Math.sin(cam.rotation.y), z: -Math.cos(cam.rotation.y) };
    if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = fw.x; l.forwardY.value = 0; l.forwardZ.value = fw.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fw.x, 0, fw.z, 0, 1, 0); }
    this.tension += (tension - this.tension) * Math.min(1, dt * 0.8);
    if (this.pad) { this.pad.lp.frequency.value = 280 + this.tension * 900; this.pad.mg.gain.value = 0.3 + this.tension * 0.25; }
    if (this.tension > 0.5) { this.pulseT -= dt; if (this.pulseT <= 0) { this.pulseT = 0.75; this.tone(60, 0.22, { f2: 35, v: 0.3 * this.tension, bus: 'music' }); } }
    this.creakT -= dt; if (this.creakT <= 0) { this.creakT = 10 + Math.random() * 18; this.creak(); }
  }
}
