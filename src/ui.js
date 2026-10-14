// DOM UI: menus, settings (generated from the schema), key rebinding, HUD, subtitles, notes, choices, confirmations.
import { SCHEMA, BIND_LABELS, DEFAULT_BINDS } from './settings.js';
const $ = id => document.getElementById(id);

export class UI {
  constructor(game) {
    this.g = game; this.cur = null; this.prev = 'main'; this.settingsFrom = 'main'; this.modal = null; this.chain = Promise.resolve();
    this.skipFn = null; this.cardRes = null; this.tab = 'Game'; this.dmgT = 0; this.subEpoch = 0;
    document.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { game.audio.init(); game.audio.ui(); game.action(b.dataset.a); }; });
    $('cdBtn').onclick = () => this.endCard();
    addEventListener('keydown', e => { if (e.code === 'Enter' && this.cardRes) this.endCard(); });
    this.buildCompass(); this.applySubSize(); this.buildSettings();
  }
  show(name) { document.querySelectorAll('.scr').forEach(e => e.classList.toggle('on', e.id === 's-' + name)); this.cur = name; $('boot').hidden = true; }
  hide() { document.querySelectorAll('.scr').forEach(e => e.classList.remove('on')); this.cur = null; }
  hud(on) { $('hud').hidden = !on; }
  refreshMenu() { const has = this.g.hasAnySave(); $('btnContinue').style.display = has ? '' : 'none'; $('btnLoad').style.display = has ? '' : 'none'; }
  applySubSize() { document.documentElement.style.setProperty('--subs', this.g.settings.subSize); }

  // ---- HUD ------------------------------------------------------------------------------------------------------
  setHealth(hp) { const h = Math.max(0, Math.round(hp)); $('hpf').style.width = h + '%'; $('hpn').textContent = h; $('hpf').classList.toggle('low', h < 30); }
  setAmmo(name, mag, res, reloading) { $('wname').textContent = name; $('mag').textContent = mag; $('res').textContent = '/ ' + res; $('rl').textContent = reloading ? 'RELOADING' : (mag === 0 ? (res ? 'PRESS R' : 'NO AMMO') : ''); $('mag').classList.toggle('low', mag <= 3); }
  setObjective(t) { $('objt').textContent = t; $('obj').classList.remove('pulse'); void $('obj').offsetWidth; $('obj').classList.add('pulse'); }
  prompt(t) { const p = $('prompt'); if (p.textContent !== (t || '')) p.textContent = t || ''; p.style.opacity = t ? 1 : 0; }
  toast(t) { const e = $('toast'); e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  fps(t) { $('fps').textContent = t; }
  buildJournal(entries, chapters) {
    const box = $('jlist'); box.textContent = ''; if (!entries.length) { const e = document.createElement('p'); e.className = 't'; e.textContent = 'Nothing recorded yet. Read documents and make decisions to fill your journal.'; box.append(e); return; }
    let last = -1;
    for (const j of entries) {
      if (j.ch !== last) { last = j.ch; const h = document.createElement('h4'); h.textContent = (chapters[j.ch] ? chapters[j.ch].num + ' · ' + chapters[j.ch].title : 'Chapter'); box.append(h); }
      const d = document.createElement('div'); d.className = 'je' + (j.title.startsWith('Decision:') ? ' dec' : ''); const t = document.createElement('b'), x = document.createElement('pre'); t.textContent = j.title; x.textContent = j.text; d.append(t, x); box.append(d);
    }
  }
  buildCompass() {
    const st = $('cstrip'); if (!st || !st.append) return; const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -180; d <= 540; d += 15) { const t = document.createElement('i'), m = ((d % 360) + 360) % 360; t.style.left = d * 4 + 'px'; t.textContent = names[m] || '·'; if (names[m]) t.className = m % 90 === 0 ? 'c4' : 'c8'; st.append(t); }
  }
  // Heading strip (north = 0 deg, east = 90). The marker only appears when the story has set one.
  compass(yaw, marker, px, pz, on) {
    const box = $('compass'); box.style.opacity = on === false ? 0 : 1; if (on === false) return;
    const heading = (((-yaw * 180 / Math.PI) % 360) + 360) % 360, hr = Math.round(heading * 4) / 4;
    if (hr !== this.lastHeading) { this.lastHeading = hr; $('cstrip').style.transform = `translateX(${-hr * 4}px)`; }
    const mk = $('cmark'), ds = $('cdist');
    if (!marker) { if (this.hadMarker) { mk.style.opacity = 0; ds.textContent = ''; this.hadMarker = false; } return; }
    const dx = marker.x - px, dz = marker.z - pz, bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, rel = ((bearing - heading + 540) % 360) - 180, c = Math.max(-86, Math.min(86, rel));
    mk.style.opacity = Math.abs(rel) > 86 ? 0.55 : 1; mk.style.transform = `translateX(${Math.round(c * 4)}px)`; this.hadMarker = true;
    const t = `${Math.round(Math.hypot(dx, dz))} m`; if (t !== ds.textContent) ds.textContent = (marker.label ? marker.label + ' · ' : '') + t;
  }
  crosshair(gap, on) { const c = $('cross'); c.style.setProperty('--gap', gap.toFixed(1) + 'px'); c.style.opacity = on ? 0.9 : 0; }
  hit(head) { const m = $('hm'); m.style.setProperty('--hc', head ? '#ff4a3a' : '#fff'); m.style.opacity = 1; clearTimeout(this.hmT); this.hmT = setTimeout(() => { m.style.opacity = 0; }, 130); }
  damage(hp, ang) {
    const v = $('vig'); v.style.opacity = Math.min(1, 0.45 + (100 - hp) / 120); clearTimeout(this.vT); this.vT = setTimeout(() => { v.style.opacity = 0; }, 260);
    if (ang !== null) { const d = $('dmg'); d.firstElementChild.style.transform = `rotate(${-ang}rad)`; d.style.opacity = 1; clearTimeout(this.dT); this.dT = setTimeout(() => { d.style.opacity = 0; }, 900); }
  }
  clearSubs() { this.subEpoch++; this.chain = Promise.resolve(); this.skipFn = null; $('sub').style.opacity = 0; }

  // ---- dialogue (queued; Enter skips the current line) ---------------------------------------------------------------
  say(speaker, text) {
    const ep = this.subEpoch;
    this.chain = this.chain.then(() => new Promise(res => {
      if (ep !== this.subEpoch) return res();
      const el = $('sub'); el.textContent = '';
      if (this.g.settings.subs) { const sp = document.createElement('b'); sp.textContent = speaker.toUpperCase(); sp.className = 'sp s-' + speaker.toLowerCase(); el.append(sp, ' ', document.createTextNode(text)); el.style.opacity = 1; }
      if (speaker !== 'Recording') this.g.audio.radio();
      const done = () => { clearTimeout(t); this.skipFn = null; el.style.opacity = 0; setTimeout(res, 180); };
      const t = setTimeout(done, Math.max(2600, text.length * 55)); this.skipFn = done;
    }));
    return this.chain;
  }
  skipLine() { if (this.skipFn) this.skipFn(); }

  // ---- modals (keyboard driven so pointer lock is kept) ----------------------------------------------------------------
  note(title, text) {
    return new Promise(res => { $('noteT').textContent = title; $('noteB').textContent = text; $('note').hidden = false; this.modal = { type: 'note', res }; });
  }
  choice(def) {
    return new Promise(res => {
      $('chT').textContent = def.title; $('chB').textContent = def.body; const o = $('chO'); o.textContent = '';
      def.opts.forEach((op, i) => { const d = document.createElement('div'); d.className = 'opt'; const k = document.createElement('b'); k.textContent = i + 1; d.append(k, document.createTextNode(op.t)); d.onclick = () => this.closeModal(i); o.append(d); });
      $('choice').hidden = false; this.modal = { type: 'choice', res, n: def.opts.length };
    });
  }
  closeModal(v) { const m = this.modal; if (!m) return; this.modal = null; $('note').hidden = true; $('choice').hidden = true; m.res(v); }

  // ---- full-screen cards (chapter titles, endings) -----------------------------------------------------------------------
  card({ kicker = '', title = '', sub = '', lines = [], btn = 'CONTINUE' }) {
    return new Promise(res => {
      $('cdK').textContent = kicker; $('cdT').textContent = title; $('cdS').textContent = sub; const l = $('cdL'); l.textContent = '';
      lines.forEach(t => { const p = document.createElement('p'); p.textContent = t; l.append(p); }); $('cdBtn').textContent = btn; this.cardRes = res; this.show('card');
    });
  }
  endCard() { const r = this.cardRes; if (r) { this.cardRes = null; r(); } }
  confirm(msg) {
    return new Promise(res => {
      const back = this.cur; $('cfMsg').textContent = msg; this.show('confirm');
      $('cfYes').onclick = () => { this.show(back || 'main'); res(true); }; $('cfNo').onclick = () => { this.show(back || 'main'); res(false); };
    });
  }

  // ---- load list -----------------------------------------------------------------------------------------------------
  buildSlots() {
    const box = $('slots'); box.textContent = '';
    for (const s of this.g.slotList()) {
      const b = document.createElement('button'); b.textContent = s.label; const sm = document.createElement('small'); sm.textContent = s.info; b.append(sm);
      b.onclick = () => { this.g.audio.ui(); this.g.loadSlot(s.id); }; box.append(b);
    }
  }

  buildSaveSlots() {
    const box = $('saveSlots'); box.textContent = '';
    for (let i = 1; i <= 5; i++) {
      const existing = this.g.save.read('manual' + i);
      const b = document.createElement('button'); b.textContent = `Manual Slot ${i}`;
      const sm = document.createElement('small');
      sm.textContent = existing ? `${(this.g.ci >= 0 ? (existing.data.chapter + 1) : existing.data.chapter)} · ${new Date(existing.t).toLocaleString()} — overwrite` : 'Empty slot';
      b.append(sm); b.onclick = () => {
        const save = () => { this.g.saveManual('manual' + i); this.show('pause'); };
        if (existing) this.g.ui.confirm(`Overwrite manual save slot ${i}?`).then(ok => ok && save()); else save();
      };
      box.append(b);
    }
  }

  // ---- settings (generated from SCHEMA) ---------------------------------------------------------------------------------------
  buildSettings() {
    const tabs = ['Game', 'Controls', 'Audio', 'Video', 'Keys'], tb = $('tabs'); tb.textContent = '';
    tabs.forEach(t => { const b = document.createElement('button'); b.textContent = t; b.className = t === this.tab ? 'on' : ''; b.onclick = () => { this.tab = t; this.buildSettings(); }; tb.append(b); });
    const rows = $('rows'); rows.textContent = ''; const S = this.g.settings;
    if (this.tab === 'Keys') {
      for (const a of Object.keys(DEFAULT_BINDS)) {
        const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.textContent = BIND_LABELS[a];
        const b = document.createElement('button'); b.className = 'key'; b.textContent = S.binds[a].replace(/^Key|^Digit/, '');
        b.onclick = () => {
          b.textContent = 'press a key...'; this.g.input.onRawKey = e => {
            this.g.input.onRawKey = null; if (e.code !== 'Escape') { for (const o in S.binds) if (S.binds[o] === e.code) S.binds[o] = S.binds[a]; S.binds[a] = e.code; this.g.saveSettings(); }
            this.buildSettings();
          };
        };
        r.append(l, b); rows.append(r);
      }
      const r = document.createElement('div'); r.className = 'row'; r.append(document.createElement('span'));
      const rb = document.createElement('button'); rb.className = 'key'; rb.textContent = 'Reset keys'; rb.onclick = () => { S.binds = { ...DEFAULT_BINDS }; this.g.saveSettings(); this.buildSettings(); }; r.append(rb); rows.append(r); return;
    }
    for (const f of SCHEMA.filter(f => f.tab === this.tab)) {
      const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.textContent = f.label; r.append(l); let c;
      if (f.type === 'toggle') { c = document.createElement('button'); c.className = 'key'; c.textContent = S[f.k] ? 'ON' : 'OFF'; c.onclick = () => { S[f.k] = !S[f.k]; c.textContent = S[f.k] ? 'ON' : 'OFF'; this.g.applySettings(f.k); }; }
      else if (f.type === 'select') {
        c = document.createElement('div'); c.className = 'q';
        f.options.forEach(o => { const b = document.createElement('button'); b.textContent = o === 0 ? 'Unlimited' : String(o); b.className = S[f.k] === o ? 'on' : ''; b.onclick = () => { S[f.k] = o; [...c.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); this.g.applySettings(f.k); }; c.append(b); });
      } else {
        c = document.createElement('div'); c.className = 'sl'; const i = document.createElement('input'); i.type = 'range'; i.min = f.min; i.max = f.max; i.step = f.step; i.value = S[f.k];
        const v = document.createElement('em'); v.textContent = (+S[f.k]).toFixed(f.step < 1 ? 2 : 0); i.oninput = () => { S[f.k] = +i.value; v.textContent = (+i.value).toFixed(f.step < 1 ? 2 : 0); this.g.applySettings(f.k); }; c.append(i, v);
      }
      r.append(c); rows.append(r);
    }
  }
}
