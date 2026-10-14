// Game orchestrator: state machine (menu / card / lockwait / play / pause / dead), story action runner, checkpoints + saves,
// hit resolution (player and enemies), pickups, render loop with a viewmodel pass and a measured FPS counter.
import { loadSettings, saveSettings as persist, sanitize, QUALITY, DIFFICULTY } from './settings.js';
import { SaveManager } from './core/save.js';
import { rayWorld, clamp } from './core/math.js';
import { computeDamage } from './core/damage.js';
import { LEVELS } from './data/levels.js';
import { WEAPONS } from './data/weapons.js';
import { STORY, CHAPTERS, ENDINGS, CREDITS, chooseEnding } from './data/story.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Player } from './player.js';
import { Weapons } from './weapons.js';
import { Effects } from './effects.js';
import { Level } from './level.js';
import { Enemy } from './enemy.js';
import { UI } from './ui.js';
const T = window.THREE;
const $ = id => document.getElementById(id);

function safeStorage() {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; }
  catch { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
}
function boxNormal(b, p, terrain) {
  if (b.terrain) return terrain ? terrain.normalAt(p.x, p.z) : { x: 0, y: 1, z: 0 };
  const dx = (p.x - b.x) / (b.w / 2), dz = (p.z - b.z) / (b.d / 2), dy = (p.y - b.h / 2) / (b.h / 2), ax = Math.abs(dx), az = Math.abs(dz), ay = Math.abs(dy);
  if (ay >= ax && ay >= az) return { x: 0, y: Math.sign(dy), z: 0 };
  return ax > az ? { x: Math.sign(dx), y: 0, z: 0 } : { x: 0, y: 0, z: Math.sign(dz) };
}

export class Game {
  constructor() {
    this.store = safeStorage(); this.settings = loadSettings(this.store); this.save = new SaveManager(this.store, 'blackveil.save.', LEVELS.map(l => l.id));
    const canvas = $('view');
    this.ren = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.ren.autoClear = false; this.ren.outputEncoding = T.sRGBEncoding; this.ren.toneMapping = T.ACESFilmicToneMapping; this.ren.toneMappingExposure = 1.1; this.ren.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(80, 1, 0.05, 140); this.cam.rotation.order = 'YXZ'; this.scene.add(this.cam);
    this.input = new Input(canvas, this.settings); this.audio = new AudioSys(this.settings);
    this.player = new Player(this); this.weapons = new Weapons(this); this.fx = new Effects(this.scene);
    this.flashLight = new T.PointLight(0xffc880, 0, 10); this.scene.add(this.flashLight); this.enemyGrenades = []; this.grenadeLight = new T.PointLight(0xff8b45, 0, 9); this.scene.add(this.grenadeLight);
    this.ray = new T.Raycaster(); this.ui = new UI(this);
    Object.assign(this, { state: 'menu', time: 0, menuT: 0, ci: 0, cp: 0, done: new Set(), running: new Set(), choices: {}, level: null, enemies: [], corpses: [], hitMeshes: [], epoch: 0, lastPlayerHurt: -99, lastData: null, objText: '', lastT: performance.now(), ft: [], fpsT: 0, errs: 0, gfxKey: '', marker: null, pathCalls: 0, pathBudget: 2, journal: [], postGame: false, explorer: 'Elias Voss', memoryDiscoveries: new Set() });
    this.diff = DIFFICULTY[this.settings.difficulty];
    this.input.onLockChange = l => { if (l) { if (this.state === 'lockwait' || this.state === 'pause') this.enterPlay(); } else if (this.state === 'play') this.pause(false); };
    this.input.onLockError = () => { if (this.state === 'lockwait') this.pause(true); };
    addEventListener('resize', () => this.applyGraphics());
    this.toMenu(); this.applyGraphics(); requestAnimationFrame(t => this.loop(t));
  }

  // ------------------------------------------------------------------------------------------------ settings / graphics
  saveSettings() { persist(this.store, this.settings); }
  applySettings() { this.diff = DIFFICULTY[this.settings.difficulty]; this.audio.apply(); this.ui.applySubSize(); this.applyGraphics(); this.saveSettings(); }
  applyGraphics() {
    const S = this.settings, Q = QUALITY[S.quality], ren = this.ren, key = S.quality;
    ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr) * S.resScale / 100); ren.setSize(innerWidth, innerHeight, false);
    this.cam.aspect = this.weapons.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); this.weapons.cam.updateProjectionMatrix();
    ren.shadowMap.enabled = Q.shadows;
    if (this.level) {
      this.level.setQuality(Q);
      if (key !== this.gfxKey) { this.gfxKey = key; this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => { x.needsUpdate = true; }); } }); }
    }
  }

  // ------------------------------------------------------------------------------------------------ menu / flow
  hasAnySave() { return this.save.has('auto') || LEVELS.some((_, i) => this.save.has('ch' + i)) || [1, 2, 3, 4, 5].some(i => this.save.has('manual' + i)); }
  slotList() {
    const out = [], fmt = r => `${(CHAPTERS[r.data.chapter] || { title: 'Unknown chapter' }).title} · ${new Date(r.t).toLocaleString()}`;
    const a = this.save.read('auto'); if (a) out.push({ id: 'auto', label: 'Latest checkpoint', info: fmt(a) + (a.recovered ? ' (recovered from backup)' : '') });
    LEVELS.forEach((_, i) => { const r = this.save.read('ch' + i); if (r) out.push({ id: 'ch' + i, label: `Chapter ${r.data.chapter + 1} start`, info: fmt(r) }); });
    for (let i = 1; i <= 5; i++) { const r = this.save.read('manual' + i); if (r) out.push({ id: 'manual' + i, label: `Manual slot ${i}`, info: fmt(r) }); }
    return out;
  }
  action(a) {
    const ui = this.ui;
    switch (a) {
      case 'new': if (this.hasAnySave()) ui.confirm('Start a new game? Your latest checkpoint stays until the first new checkpoint replaces it.').then(ok => ok && this.newGame()); else this.newGame(); break;
      case 'continue': { const r = this.save.read('auto') || this.firstChapterSave(); if (r) this.startChapter(r.data); break; }
      case 'load': ui.backTo = ui.cur; ui.buildSlots(); ui.show('load'); break;
      case 'save': ui.backTo = ui.cur; ui.buildSaveSlots(); ui.show('save'); break;
      case 'settings': ui.backTo = ui.cur; ui.buildSettings(); ui.show('settings'); break;
      case 'journal': ui.backTo = ui.cur; ui.buildJournal(this.journal, CHAPTERS); ui.show('journal'); break;
      case 'credits': ui.backTo = ui.cur; this.showCredits().then(() => ui.show(ui.backTo || 'main')); break;
      case 'quit': ui.card({ kicker: 'BLACK VEIL', title: 'THANK YOU FOR PLAYING', sub: 'Browsers do not let pages close themselves: you can close this tab.', btn: 'BACK' }).then(() => { try { window.close(); } catch {} ui.show('main'); }); break;
      case 'back': ui.show(ui.backTo || 'main'); break;
      case 'defaults': Object.assign(this.settings, sanitize(null)); this.applySettings(); ui.buildSettings(); break;
      case 'resume': this.beginPlay(); break;
      case 'restart': if (this.postGame) this.startPostGame(); else ui.confirm('Restart from the last checkpoint? Progress since then is lost.').then(ok => ok && this.restartCheckpoint()); break;
      case 'mainmenu': ui.confirm('Return to the main menu? Progress since the last checkpoint is lost.').then(ok => ok && this.toMenu()); break;
      case 'retry': this.restartCheckpoint(); break;
      case 'menu': this.toMenu(); break;
    }
  }
  firstChapterSave() { for (let i = LEVELS.length - 1; i >= 0; i--) { const r = this.save.read('ch' + i); if (r) return r; } return null; }
  fresh() { return { chapter: 0, cp: 0, hp: 100, weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: 48 } }, cur: 'pistol', choices: {}, done: [] }; }
  newGame() { this.startChapter(this.fresh()); }
  loadSlot(id) { const r = this.save.read(id); if (r) this.startChapter(r.data); else this.ui.toast('Save not found'); }
  async showCredits() { await this.ui.card({ kicker: 'CREDITS', title: 'BLACK VEIL', lines: CREDITS.slice(1).map(([a, b]) => (b ? `${a}: ${b}` : a)), btn: 'BACK' }); }
  toMenu() {
    this.postGame = false; this.explorer = 'Elias Voss';
    this.epoch++; this.state = 'menu'; this.ui.clearSubs(); this.ui.closeModal(); this.input.unlock(); this.enemies = []; this.corpses = [];
    this.loadLevel(0); this.ui.hud(false); this.ui.refreshMenu(); this.ui.show('main'); this.audio.ambience('snow', 0); this.applyGraphics();
  }
  beginPlay() {
    this.state = 'lockwait'; this.ui.hide(); this.ui.hud(true); this.audio.init(); this.input.lock();
    setTimeout(() => { if (this.state === 'lockwait' && !this.input.locked) this.pause(true); }, 800);
  }
  enterPlay() { this.state = 'play'; this.ui.hide(); this.ui.hud(true); this.lastT = performance.now(); }
  pause(clickOnly) { this.state = 'pause'; this.ui.hud(true); this.ui.show(clickOnly ? 'click' : 'pause'); }

  // ------------------------------------------------------------------------------------------------ chapters / saves
  loadLevel(ci) {
    if (this.level) { this.scene.remove(this.level.group); this.level.dispose(); }
    for (const e of this.enemies) this.scene.remove(e.group);
    this.clearEnemyGrenades(); this.enemies = []; this.corpses = []; this.hitMeshes = []; this.fx.clearDecals();
    this.level = new Level(LEVELS[ci], QUALITY[this.settings.quality]); this.scene.add(this.level.group);
    const f = this.level.fog; this.scene.background = new T.Color(f.color); this.scene.fog = new T.FogExp2(f.color, f.density);
    this.gfxKey = ''; this.level.setQuality(QUALITY[this.settings.quality]);
  }
  async startChapter(data, opt = {}) {
    this.postGame = false; this.explorer = 'Elias Voss';
    this.epoch++; const ep = this.epoch; this.ui.clearSubs(); this.ui.closeModal(); this.ui.hud(false);
    this.ci = data.chapter; this.cp = data.cp; this.choices = { ...data.choices }; this.journal = (data.journal || []).map(j => ({ ch: j.ch, title: j.title, text: j.text })); this.done = new Set(); this.running = new Set(); this.objText = ''; this.marker = null;
    this.loadLevel(this.ci); this.applyGraphics();
    const L = this.level, cp = L.def.cps[Math.min(data.cp, L.def.cps.length - 1)];
    for (const ev of data.done) this.replay(STORY[this.ci].events[ev] || []), this.done.add(ev);          // restore world state silently
    this.weapons.restore(data.weapons, data.ammo, data.cur);
    this.player.reset(cp.x, cp.z, cp.yaw, Math.max(60, Math.min(100, data.hp))); this.player.pitch = 0; this.player.y = L.groundAt(cp.x, cp.z);
    const skip = new Set(cp.skip || []);
    for (const g of L.def.startGroups) if (!skip.has(g)) this.spawnGroup(g);
    for (const g of cp.spawn || []) this.spawnGroup(g, { x: cp.x, z: cp.z });
    this.audio.init(); this.audio.ambience(L.def.env, this.ci);
    this.ui.setHealth(this.player.hp); if (this.objText) this.ui.setObjective(this.objText);
    const fresh = data.cp === 0 && !this.done.has('start');
    if (fresh) { this.writeAuto(); this.save.write('ch' + this.ci, this.lastData); }
    else this.lastData = data;
    if (fresh && !opt.skipCard) {
      this.state = 'card'; this.input.unlock();
      await this.ui.card({ kicker: CHAPTERS[this.ci].num, title: CHAPTERS[this.ci].title, sub: CHAPTERS[this.ci].sub, btn: 'BEGIN' });
      if (ep !== this.epoch) return;
    }
    this.beginPlay(); this.ui.refreshMenu();
    if (!this.done.has('start')) this.runEvent('start');
  }
  restartCheckpoint() { const d = this.lastData || (this.save.read('auto') || {}).data || this.fresh(); this.startChapter(JSON.parse(JSON.stringify(d)), { skipCard: true }); }
  writeAuto() {
    const w = this.weapons.snapshot();
    this.lastData = { chapter: this.ci, cp: this.cp, hp: Math.round(clamp(this.player.hp, 60, 100)), weapons: w.weapons, ammo: w.ammo, cur: w.cur, choices: { ...this.choices }, done: [...this.done], journal: this.journal.map(j => ({ ...j })) };
    return this.save.write('auto', this.lastData);
  }
  saveManual(slot) {
    if (this.postGame) { this.ui.toast('Manual campaign saves are unavailable in Memory World'); return false; }
    const w = this.weapons.snapshot();
    const data = { chapter: this.ci, cp: this.cp, hp: Math.max(1, Math.round(clamp(this.player.hp, 1, 100))), weapons: w.weapons, ammo: w.ammo, cur: w.cur, choices: { ...this.choices }, done: [...this.done], journal: this.journal.map(j => ({ ...j })) };
    const ok = this.save.write(slot, data); this.ui.toast(ok ? `Saved to ${slot.replace('manual', 'manual slot ')}` : 'Save failed; previous slot was preserved');
    return ok;
  }
  setCheckpoint(k) { this.cp = k; this.ui.toast(this.writeAuto() ? 'Checkpoint saved' : 'Checkpoint (could not write save)'); }
  async endChapter() {
    const ep = this.epoch; this.state = 'card'; this.input.unlock(); this.ui.clearSubs();
    if (this.ci >= LEVELS.length - 1) {
      const endingId = chooseEnding(this.choices);
      this.choices.ending = endingId;
      const e = ENDINGS[endingId] || ENDINGS[this.choices.fate === 'preserve' ? 'preserve' : 'purge'];
      // Store a separate final record so the last campaign checkpoint remains a valid restart point.
      try {
        const w = this.weapons.snapshot();
        this.save.write('ending', { chapter: this.ci, cp: this.cp, hp: Math.max(1, Math.round(this.player.hp)), weapons: w.weapons, ammo: w.ammo, cur: w.cur, choices: { ...this.choices }, done: [...this.done], journal: this.journal.map(j => ({ ...j })) });
      } catch (err) { console.warn('Could not persist final ending record', err); }
      await this.ui.card({ kicker: 'ENDING', title: e.title, lines: e.lines, btn: 'EXPLORE MEMORY WORLD' }); if (ep !== this.epoch) return;
      this.startPostGame(); return;
    }
    const w = this.weapons.snapshot(), hp = Math.round(clamp(this.player.hp, 70, 100));
    await this.ui.card({ kicker: 'CHAPTER COMPLETE', title: CHAPTERS[this.ci].title, btn: 'CONTINUE' }); if (ep !== this.epoch) return;
    this.startChapter({ chapter: this.ci + 1, cp: 0, hp, weapons: w.weapons, ammo: w.ammo, cur: w.cur, choices: { ...this.choices }, done: [], journal: this.journal.map(j => ({ ...j })) });
  }
  async startPostGame() {
    this.epoch++; const ep = this.epoch; this.postGame = true; this.explorer = 'Mara Vale';
    this.ui.clearSubs(); this.ui.closeModal(); this.ui.hud(false); this.input.unlock();
    this.ci = 1; this.cp = 0; this.done = new Set(); this.running = new Set(); this.marker = null;
    try { this.memoryDiscoveries = new Set(JSON.parse(this.store.getItem('blackveil.memory.discoveries') || '[]')); }
    catch { this.memoryDiscoveries = new Set(); }
    this.loadLevel(this.ci); this.applyGraphics();
    for (const it of this.level.inter) { it.active = false; it.mesh.visible = false; }
    this.clearEnemyGrenades(); this.enemies = []; this.corpses = []; this.hitMeshes = []; this.fx.clearDecals();
    const memories = [
      { id: 'familyHome', x: -30, z: 42, title: 'VOSS FAMILY HOME', prompt: 'Remember the family home', text: 'A kitchen light left on after midnight. Eleanor insisted it was easier to find the door that way. Thomas called it wasteful, then quietly replaced the bulb whenever it failed.' },
      { id: 'eleanorGarden', x: -48, z: 24, title: 'ELEANOR’S GARDEN', prompt: 'Recall Eleanor’s garden', text: 'Elias remembers a small patch of flowers beside a cold stone path. His mother could name every plant. The memory is warm, but he cannot remember the last time he visited.' },
      { id: 'thomasWorkshop', x: 44, z: -30, title: 'THOMAS’S WORKSHOP', prompt: 'Inspect the old workshop', text: 'A half-finished repair sits under a dust cover. Thomas used to say that broken things were easier to understand once someone stopped pretending they were never broken.' },
      { id: 'rescueStation', x: -52, z: -62, title: 'OLD RESCUE STATION', prompt: 'Listen to the old station recording', text: 'The recording is mostly wind and a familiar voice counting people twice. Elias remembers the checklist, not the faces. The distinction troubles him more than the silence.' },
      { id: 'sixSeconds', x: 0, z: -100, title: 'SIX SECONDS OF SILENCE', prompt: 'Listen for the carrier signal', text: 'For six seconds, the radio carries no voice at all. Then the noise floor returns. Mara cannot prove whether the silence was a signal, a machine settling, or simply the only honest thing the facility ever transmitted.' },
    ];
    for (const m of memories) {
      if (this.memoryDiscoveries.has(m.id)) continue;
      const it = { ...m, r: 3.2, event: m.id, vis: 'doc', once: true, active: true };
      it.mesh = this.level.vis(it); it.mesh.visible = true; this.level.group.add(it.mesh); this.level.inter.push(it);
    }
    this.player.reset(0, 108, 0, 100); this.player.y = this.level.groundAt(this.player.x, this.player.z); this.player.pitch = 0;
    this.audio.init(); this.audio.ambience('snow', this.ci); this.ui.setHealth(100); this.ui.setObjective('MARA VALE · Explore the valley and recover optional memories');
    await this.ui.card({ kicker: 'POST-GAME', title: 'MEMORY WORLD', sub: 'Free exploration · optional memories', lines: ['The campaign ending is preserved. This quiet exploration mode does not change the ending or revive anyone.', 'Five memory sites are available in the White Valley. Discovered sites are remembered between visits.'], btn: 'BEGIN EXPLORATION' });
    if (ep !== this.epoch) return;
    this.beginPlay(); this.ui.refreshMenu();
  }
  async runMemoryEvent(id) {
    if (!this.postGame || this.memoryDiscoveries.has(id)) return;
    const it = this.level.inter.find(x => x.id === id); if (!it) return;
    this.memoryDiscoveries.add(id);
    try { this.store.setItem('blackveil.memory.discoveries', JSON.stringify([...this.memoryDiscoveries])); } catch {}
    this.addJournal('Memory: ' + it.title, it.text);
    this.audio.stinger();
    await this.ui.note(it.title, it.text);
    this.ui.toast('Memory recorded');
  }

  onPlayerDead() { this.state = 'dead'; this.ui.clearSubs(); this.ui.closeModal(); this.input.unlock(); this.audio.stinger(); this.ui.show('dead'); }

  // ------------------------------------------------------------------------------------------------ story runner
  replay(list) {            // state-only replay used when loading a checkpoint (no dialogue, no spawns)
    for (const a of list) {
      if (a[0] === 'obj') this.objText = a[1];
      else if (a[0] === 'marker') this.marker = a[1] == null ? null : { x: a[1], z: a[2], label: a[3] || '' };
      else if (a[0] === 'show') this.level.setActive(a[1], true);
      else if (a[0] === 'hide') this.level.setActive(a[1], false);
      else if (a[0] === 'unlock') this.level.openDoor(a[1]);
      else if (a[0] === 'flag') this.choices[a[1]] = a[2];
      else if (a[0] === 'if') this.replay(this.cond(a) ? a[3] : (a[4] || []));
      else if (a[0] === 'choice') { /* result already stored in choices */ }
    }
  }
  cond(a) { const v = this.choices[a[1]]; return a[2] === true ? !!v : v === a[2]; }
  runEvent(name) {
    const acts = STORY[this.ci].events[name]; if (!acts || this.done.has(name)) return;
    this.done.add(name); this.running.add(name);
    this.act(acts, this.epoch).catch(e => console.error('story event failed', name, e)).finally(() => this.running.delete(name));
  }
  async act(list, ep) {
    for (const a of list) {
      if (ep !== this.epoch) return;
      switch (a[0]) {
        case 'say': await this.ui.say(a[1], a[2]); break;
        case 'obj': this.objText = a[1]; this.ui.setObjective(a[1]); break;
        case 'marker': this.marker = a[1] == null ? null : { x: a[1], z: a[2], label: a[3] || '' }; break;
        case 'checkpoint': this.setCheckpoint(a[1]); break;
        case 'spawn': this.spawnGroup(a[1], { x: this.player.x, z: this.player.z }); break;
        case 'show': this.level.setActive(a[1], true); break;
        case 'hide': this.level.setActive(a[1], false); break;
        case 'unlock': this.level.openDoor(a[1]); this.audio.click(260, 0.4); break;
        case 'give': this.weapons.unlock(a[1]); this.ui.toast(WEAPONS[a[1]].name + ' acquired'); this.weapons.switchTo(a[1]); break;
        case 'flag': this.choices[a[1]] = a[2]; break;
        case 'if': await this.act(this.cond(a) ? a[3] : (a[4] || []), ep); break;
        case 'choice': { const i = await this.ui.choice(a[1]); if (ep !== this.epoch) return; this.addJournal('Decision: ' + a[1].title, a[1].opts[i].t); await this.act(a[1].opts[i].do, ep); break; }
        case 'note': this.addJournal(a[1], a[2]); await this.ui.note(a[1], a[2]); break;
        case 'pickup': this.level.addPickup(a[1], a[2], a[3]); break;
        case 'wait': await new Promise(r => setTimeout(r, a[1] * 1000)); break;
        case 'stinger': this.audio.stinger(); break;
        case 'end': this.endChapter(); return;
      }
    }
  }
  addJournal(title, text) { if (this.journal.some(j => j.ch === this.ci && j.title === title) || this.journal.length >= 300) return; this.journal.push({ ch: this.ci, title, text }); this.ui.toast('Journal updated'); }
  openJournal() { this.state = 'pause'; this.input.unlock(); this.ui.hud(true); this.ui.backTo = 'pause'; this.ui.buildJournal(this.journal, CHAPTERS); this.ui.show('journal'); }
  reqMet(r) { return !r || (this.done.has(r) && !this.running.has(r)); }

  // ------------------------------------------------------------------------------------------------ enemies / combat
  spawnGroup(gid, alertAt) {
    const defs = this.level.def.groups[gid]; if (!defs) return;
    for (const d of defs) this.enemies.push(new Enemy(this, d, gid, alertAt));
    this.rebuildHit();
  }
  rebuildHit() { this.hitMeshes = []; for (const e of this.enemies) if (!e.dead) this.hitMeshes.push(...e.model.hit); }
  alertGroup(src) { for (const o of this.enemies) if (o !== src && !o.dead && o.gid === src.gid && o.state !== 'combat') { o.last = src.last; o.awareness = Math.max(o.awareness, 0.75); o.state = 'alert'; o.alertT = 6; } }
  noise(x, z, r) { for (const e of this.enemies) if (!e.dead) e.hear({ x, z, radius: r }); }
  onEnemyDead(e, zone) {
    this.rebuildHit(); this.fx.puff({ x: e.x, y: 1.2, z: e.z }, 'blood');
    this.fx.bloodSplat(e.x, this.level.groundAt(e.x, e.z), e.z, e.role === 'heavy' ? 1.2 : 1);
    this.corpses.push(e);
    if (Math.random() < 0.35) this.level.addPickup(Math.random() < 0.6 ? 'ammo' : 'health', e.x, e.z);
    if (this.corpses.length > 10) { const o = this.corpses.shift(); if (o.condition === 'DEAD') o.condition = 'DESPAWNING'; this.scene.remove(o.group); const i = this.enemies.indexOf(o); if (i >= 0) this.enemies.splice(i, 1); }
    if (!this.enemies.some(o => o.gid === e.gid && !o.dead)) this.runEvent('cleared:' + e.gid);
  }
  muzzleFlash() { const v = new T.Vector3(); this.weapons.muzzleWorld(v); this.flashLight.position.copy(v); this.flashLight.intensity = 2.4; }
  // Player hit-scan. Walls and cover block the ray; enemies are tested against their visible body-part meshes only.
  shoot(o, d, w, first = true) {
    const L = this.level, ow = { x: o.x, y: o.y, z: o.z }, dw = { x: d.x, y: d.y, z: d.z }, maxR = w.range * 1.6;
    const wall = rayWorld(ow, dw, L.blockers, maxR); let best = wall ? wall.t : maxR, hit = wall ? { type: 'wall', box: wall.box } : null;
    this.ray.set(o, d); this.ray.near = 0; this.ray.far = best;
    const hs = this.ray.intersectObjects(this.hitMeshes, false);
    if (hs.length && hs[0].distance < best) { best = hs[0].distance; hit = { type: 'enemy', enemy: hs[0].object.userData.enemy, zone: hs[0].object.userData.zone, point: hs[0].point }; }
    const end = new T.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best), m = new T.Vector3(); this.weapons.muzzleWorld(m);
    this.fx.tracer(m, end);
    if (!hit) return;
    if (hit.type === 'enemy') {
      const dmg = computeDamage(w.damage, hit.zone, { armor: hit.enemy.cfg.armor, dist: best, range: w.range });
      hit.enemy.damage(dmg, hit.zone); this.fx.puff(hit.point, 'blood'); this.ui.hit(hit.zone === 'head'); if (first) this.audio.hit(hit.zone);
    } else {
      const n = boxNormal(hit.box, end, L.terrain); this.fx.impact(end, n, hit.box.k); if (first) this.audio.impact(hit.box.k, { x: end.x, y: end.y, z: end.z });
    }
  }
  clearEnemyGrenades() { for (const g of this.enemyGrenades || []) { this.scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); } this.enemyGrenades = []; this.grenadeLight.intensity = 0; }
  throwEnemyGrenade(e) {
    const T = window.THREE, p = this.player;
    const mesh = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), new T.MeshStandardMaterial({ color: 0x27332b, metalness: 0.55, roughness: 0.55, emissive: 0x34200b, emissiveIntensity: 0.4 }));
    mesh.position.set(e.x, e.eyeY - 0.15, e.z); this.scene.add(mesh);
    this.ui.toast('GRENADE INCOMING');
    this.enemyGrenades.push({ mesh, from: { x: e.x, y: e.eyeY - 0.15, z: e.z }, to: { x: p.x, y: this.level.groundAt(p.x, p.z) + 0.2, z: p.z }, t: 0, duration: 1.35, fuse: 1.35, owner: e });
    this.audio.stinger();
  }
  updateEnemyGrenades(dt) {
    for (let i = this.enemyGrenades.length - 1; i >= 0; i--) {
      const g = this.enemyGrenades[i]; g.t += dt; const t = Math.min(1, g.t / g.duration), a = g.from, b = g.to;
      g.mesh.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 3.2, a.z + (b.z - a.z) * t);
      g.mesh.rotation.x += dt * 9; g.mesh.rotation.z += dt * 7;
      if (g.t < g.fuse) continue;
      const x = g.mesh.position.x, z = g.mesh.position.z, y = this.level.groundAt(x, z) + 0.12;
      this.fx.puff({ x, y: y + 0.25, z }, 'dust'); this.fx.puff({ x, y: y + 0.2, z }, 'spark');
      const d = Math.hypot(this.player.x - x, this.player.z - z);
      const vx = this.player.x - x, vy = this.player.eyeY - (y + 0.5), vz = this.player.z - z, vl = Math.hypot(vx, vy, vz) || 1;
      if (d < 7 && !rayWorld({ x, y: y + 0.5, z }, { x: vx / vl, y: vy / vl, z: vz / vl }, this.level.blockers, Math.max(0.1, d - 0.25))) {
        const falloff = 1 - d / 7; this.player.take( Math.round(34 * falloff), { x, z });
      }
      this.grenadeLight.position.set(x, y + 0.8, z); this.grenadeLight.intensity = 4.5;
      this.audio.impact('wreck', { x, y, z }); this.scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); this.enemyGrenades.splice(i, 1);
    }
  }
  // Enemy shot: damage needs an unobstructed line from muzzle to the player AND a successful accuracy roll; otherwise the bullet hits whatever is in the way.
  enemyFire(e) {
    const p = this.player, L = this.level; if (p.dead) return;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), o = { x: e.x + fx * 0.5, y: e.eyeY - 0.2, z: e.z + fz * 0.5 };
    const tgt = { x: p.x, y: p.eyeY - (p.crouch ? 0.3 : 0.45), z: p.z }, dx = tgt.x - o.x, dy = tgt.y - o.y, dz = tgt.z - o.z, dist = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist }, cfg = e.cfg;
    const chance = cfg.acc * this.diff.acc * (1 - clamp(dist / cfg.range, 0, 1) * 0.65) * (p.moving ? 0.8 : 1) * (p.crouch ? 0.85 : 1) * (0.4 + 0.6 * e.accRamp);
    const blocked = rayWorld(o, dir, L.blockers, dist - 0.05); let end;
    if (!blocked && Math.random() < chance) { end = tgt; p.take(cfg.dmg * this.diff.dmg, { x: e.x, z: e.z }); this.lastPlayerHurt = this.time; }
    else {
      const j = blocked ? 0 : 0.07, d2 = { x: dir.x + (Math.random() - 0.5) * j * 2, y: dir.y + (Math.random() - 0.5) * j, z: dir.z + (Math.random() - 0.5) * j * 2 }, l = Math.hypot(d2.x, d2.y, d2.z);
      d2.x /= l; d2.y /= l; d2.z /= l; const h = rayWorld(o, d2, L.blockers, cfg.range * 1.5), t = h ? h.t : (blocked ? blocked.t : dist + 20);
      end = { x: o.x + d2.x * t, y: o.y + d2.y * t, z: o.z + d2.z * t }; if (h) this.fx.impact(end, boxNormal(h.box, end, L.terrain), h.box.k);
    }
    this.fx.tracer(o, end, 0xff9060); this.audio.shot('enemy', { x: e.x, y: 1.5, z: e.z }, 0.9);
  }

  // ------------------------------------------------------------------------------------------------ per-frame
  cameraUpdate() {
    const p = this.player, S = this.settings, c = this.cam, s = p.shake * S.shake;
    c.position.set(p.x, p.eyeY + p.bobY, p.z);
    c.rotation.set(p.pitch + (Math.random() - 0.5) * 0.012 * s, p.yaw + (Math.random() - 0.5) * 0.012 * s, 0);
    const fov = S.fov * this.weapons.fovMul; if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
  }
  updateModal() {
    const m = this.ui.modal, inp = this.input; if (!m) return;
    if (m.type === 'note') { if (inp.hit('interact') || inp.hitCode('Enter') || inp.hitCode('Space')) this.ui.closeModal(); }
    else for (let i = 0; i < m.n; i++) if (inp.hitCode('Digit' + (i + 1)) || inp.hitCode('Numpad' + (i + 1))) { this.ui.closeModal(i); break; }
  }
  updateInteract() {
    const p = this.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let best = null, bd = 1e9;
    for (const it of this.level.inter) {
      if (!it.active) continue; const dx = it.x - p.x, dz = it.z - p.z, d = Math.hypot(dx, dz);
      if (d < it.r && (d < 1.2 || (dx * fx + dz * fz) / d > 0.2) && d < bd) { bd = d; best = it; }
    }
    this.ui.prompt(best ? `[${this.settings.binds.interact.replace(/^Key/, '')}] ${best.prompt}` : '');
    if (best && this.input.hit('interact')) {
      best.active = false; const ch = best.mesh.children; ch[ch.length - 1].visible = false; if (best.vis === 'keycard') best.mesh.visible = false;
      this.audio.click(520, 0.3); if (this.postGame) this.runMemoryEvent(best.id); else this.runEvent(best.event);
    }
  }
  updateTriggers() { if (this.postGame) return; const p = this.player; for (const t of this.level.def.triggers) if (!this.done.has(t.id) && this.reqMet(t.req) && Math.hypot(t.x - p.x, t.z - p.z) < t.r) this.runEvent(t.id); }
  updatePickups() {
    const p = this.player;
    for (const k of this.level.pickups.slice()) {
      if (k.taken || Math.hypot(k.x - p.x, k.z - p.z) > 1.2) continue;
      if (k.t === 'health') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 40); this.ui.setHealth(p.hp); this.ui.toast('Medkit used'); }
      else { this.weapons.addAmmo(); this.ui.toast('Ammunition collected'); }
      k.taken = true; k.mesh.visible = false; this.audio.pickup(); if (k.dyn) this.level.removePickup(k);
    }
  }
  step(dt) {
    const S = this.settings, st = this.state;
    if (st === 'menu') { this.menuT += dt * 0.07; const c = this.cam; c.position.set(Math.cos(this.menuT) * 22, 4.5, -26 + Math.sin(this.menuT) * 22); c.lookAt(0, 2.5, -26); c.fov = 65; c.updateProjectionMatrix(); this.level.update(dt, c.position, this.menuT * 10); this.audio.update(dt, c, 0); return; }
    if (st !== 'play') return;
    if (this.ui.modal) { this.updateModal(); this.cameraUpdate(); return; }
    if (this.input.hitCode('Enter')) this.ui.skipLine();
    if (this.input.hit('journal')) { this.openJournal(); return; }
    this.time += dt; this.pathCalls = 0;
    this.player.update(dt); this.cameraUpdate(); this.weapons.update(dt); this.cameraUpdate();
    if (this.state !== 'play') return;
    this.updateInteract(); this.updateTriggers(); this.updatePickups();
    let tension = 0;
    for (const e of this.enemies) { e.update(dt); if (!e.dead) { if (e.state === 'combat') tension = 1; else if (e.state === 'alert' || e.state === 'chase') tension = Math.max(tension, 0.5); } }
    this.level.update(dt, this.player, this.time); this.updateEnemyGrenades(dt); this.fx.update(dt); this.grenadeLight.intensity = Math.max(0, this.grenadeLight.intensity - dt * 12); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 30);
    this.audio.update(dt, this.cam, tension); if (this.scene.fog) this.scene.fog.density = this.level.fogDensity(this.time);
    this.ui.compass(this.player.yaw, this.settings.compass ? this.marker : null, this.player.x, this.player.z, this.settings.compass);
    const w = this.weapons.w; if (w) this.ui.crosshair(5 + this.weapons.spreadNow() * 700, this.weapons.ads < 0.4 && !this.player.sprinting);
  }
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    const cap = this.settings.fpsCap; if (cap && now - this.lastT < 1000 / cap - 1.5) return;
    const raw = (now - this.lastT) / 1000, dt = Math.min(0.05, raw); this.lastT = now;
    this.ft.push(raw); if (this.ft.length > 240) this.ft.shift();
    this.fpsT += raw; if (this.settings.showFps && this.fpsT > 0.5) { this.fpsT = 0; const a = this.ft.reduce((s, x) => s + x, 0) / this.ft.length, w = Math.max(...this.ft); this.ui.fps(`${(1 / a).toFixed(0)} FPS · avg ${(a * 1000).toFixed(1)} ms · worst ${(w * 1000).toFixed(1)} ms`); }
    else if (!this.settings.showFps && this.fpsT > 0.5) { this.fpsT = 0; this.ui.fps(''); }
    try { this.step(dt); } catch (e) { if (this.errs++ < 5) console.error('frame error', e); }
    const ren = this.ren; ren.clear(); ren.render(this.scene, this.cam);
    if (this.weapons.cur && (this.state === 'play' || this.state === 'lockwait' || this.state === 'pause')) { ren.clearDepth(); ren.render(this.weapons.scene, this.weapons.cam); }
    this.input.endFrame();
  }
}
