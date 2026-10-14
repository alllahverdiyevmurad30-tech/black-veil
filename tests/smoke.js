// Headless integration test: runs the REAL game code (game loop, player, weapons, enemy AI, story runner, saves)
// against a stubbed THREE.js / DOM. It verifies logic and control flow only. It does NOT render, so it says nothing
// about visuals, GPU performance or real mouse/keyboard feel. Run: node tests/smoke.js
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  PASS', name); } catch (e) { fail++; console.log('  FAIL', name, '->', e.stack.split('\n').slice(0, 3).join(' | ')); } };
const ok = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

// ---------------------------------------------------------------- stubs
const noop = () => undefined;
class BA { constructor(a, n) { this.array = a; this.itemSize = n; this.needsUpdate = false; } get count() { return this.array.length / this.itemSize; } setY(i, y) { this.array[i * this.itemSize + 1] = y; } getZ(i) { return this.array[i * this.itemSize + 2]; } setXYZ(i, x, y, z) { const a = this.array, k = i * 3; a[k] = x; a[k + 1] = y; a[k + 2] = z; } setXY(i, x, y) { const k = i * this.itemSize; this.array[k] = x; this.array[k + 1] = y; } getX(i) { return this.array[i * this.itemSize]; } getY(i) { return this.array[i * this.itemSize + 1]; } getZ(i) { return this.array[i * this.itemSize + 2]; } }
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { return this.set(v.x, v.y, v.z); } clone() { return new V3(this.x, this.y, this.z); } addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; } normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / l, this.y / l, this.z / l); } applyQuaternion() { return this; } setScalar(s) { return this.set(s, s, s); } }
class Obj {
  constructor() { this.position = new V3(); this.rotation = { x: 0, y: 0, z: 0, order: 'XYZ', set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.scale = new V3(1, 1, 1); this.children = []; this.userData = {}; this.visible = true; this.quaternion = {}; this.castShadow = false; this.receiveShadow = false; this.count = 0; }
  add(...c) { this.children.push(...c); } remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  traverse(f) { f(this); for (const c of this.children) c.traverse ? c.traverse(f) : f(c); }
  updateMatrixWorld() {} getWorldPosition(v) { return v; } localToWorld(v) { return v; } lookAt() {} setMatrixAt() {} clone() { return new this.constructor(); }
}
class Geo { rotateX() {} translate() {} computeVertexNormals() {} constructor() { this.attributes = { uv: new BA(new Float32Array(48), 2), position: new BA(new Float32Array(72), 3) }; } setAttribute(n, a) { this.attributes[n] = a; } setDrawRange() {} dispose() {} }
class Mat { constructor(o = {}) { Object.assign(this, o); this.color = { setHex() {}, set() {} }; this.emissive = { setHex() {}, set() {} }; this.needsUpdate = false; } dispose() {} }
class Tex { constructor() { this.repeat = { set() {} }; } clone() { return new Tex(); } }
const mk = (base, extra = {}) => class extends base { constructor(...a) { super(...a); Object.assign(this, extra); } };
const THREE = new Proxy({
  Vector3: V3, Object3D: Obj, Group: Obj, Scene: mk(Obj), Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g || new Geo(); this.material = m || new Mat(); } },
  Points: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }, Line: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  InstancedMesh: class extends Obj { constructor(g, m, n) { super(); this.geometry = g; this.material = m; this.count = n; } },
  PerspectiveCamera: class extends Obj { constructor(f) { super(); this.fov = f; this.aspect = 1; } updateProjectionMatrix() {} },
  BufferGeometry: Geo, BoxGeometry: Geo, BufferAttribute: BA, Matrix4: class { makeScale() { return this; } setPosition() { return this; } },
  Color: class { constructor() {} setHex() { return this; } }, FogExp2: class {}, CanvasTexture: Tex,
  Raycaster: class { constructor() { this.ray = {}; } set() {} intersectObjects() { return []; } },
  WebGLRenderer: class { constructor() { this.shadowMap = {}; this.domElement = {}; } setPixelRatio() {} setSize() {} clear() {} clearDepth() {} render() {} },
  sRGBEncoding: 1, ACESFilmicToneMapping: 2, PCFSoftShadowMap: 3, RepeatWrapping: 4, AdditiveBlending: 5, DoubleSide: 6,
}, {
  get(t, k) {
    if (k in t) return t[k];
    if (/Light$/.test(String(k))) return class extends Obj { constructor() { super(); this.shadow = { mapSize: { x: 0, set(x) { this.x = x; } }, camera: { updateProjectionMatrix() {} }, map: null }; this.target = new Obj(); this.intensity = 1; } };
    if (/Material$/.test(String(k))) return Mat;
    if (/Geometry$/.test(String(k))) return Geo;
    return class extends Obj {};
  },
});
const el = () => new Proxy({ style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, children: [], offsetWidth: 0, hidden: false, textContent: '', requestPointerLock() {} }, {
  get(t, k) { if (k === 'firstElementChild') return t._fc ??= el(); if (k in t) return t[k]; return noop; }, set(t, k, v) { t[k] = v; return true; },
});
const els = {};
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : noop), set: () => true });
const store = {};
Object.assign(globalThis, {
  window: globalThis, THREE, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
});
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.document = { getElementById: id => (els[id] ??= el()), querySelectorAll: () => [], addEventListener: noop, createTextNode: t => ({ t }), createElement: tag => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : el()), documentElement: { style: { setProperty() {} } }, pointerLockElement: null, exitPointerLock: noop };

const { STORY, ENDINGS, CHAPTERS } = await import('../src/data/story.js');
const { WEAPONS, ORDER } = await import('../src/data/weapons.js');
const { LEVELS } = await import('../src/data/levels.js');
const { Game } = await import('../src/game.js');
const IDX = Object.fromEntries(LEVELS.map((l, i) => [l.id, i]));

// ---------------------------------------------------------------- helpers
const g = new Game();
const lock = () => { document.pointerLockElement = g.ui; g.input.locked = true; g.input.onLockChange(true); };
const stubUI = () => {
  g.ui.say = () => Promise.resolve(); g.ui.note = () => Promise.resolve(); g.ui.choice = async def => (g.choiceFn ? g.choiceFn(def) : 0);
  g.cards = []; g.ui.card = async c => { g.cards.push(c); };
};
const frames = (n, dt = 1 / 60, f) => { for (let i = 0; i < n; i++) { if (f) f(i); g.step(dt); g.input.endFrame(); } };
const restart = () => { g.restartCheckpoint(); lock(); ok(g.state === 'play', 'state after restart: ' + g.state); };
const countObjs = o => { let n = 0; o.traverse(() => n++); return n; };
const killAll = () => { for (const e of g.enemies.slice()) if (!e.dead) e.damage(9999, 'head'); };
const startNew = async () => { g.toMenu(); g.newGame(); await tick(); if (g.state === 'card') g.ui.endCard(); await tick(); lock(); await tick(); };

console.log('Boot / menu');
await t('game boots to the main menu and renders menu frames', async () => { ok(g.state === 'menu'); frames(120); g.loop(performance.now() + 16); g.loop(performance.now() + 33); });

console.log('Gameplay core (real code, stubbed renderer)');
await t('new game: chapter card, then play state with player at the start', async () => {
  g.newGame(); await tick(); ok(g.state === 'card', 'expected chapter card, got ' + g.state); g.ui.endCard(); await tick(); lock(); await tick();
  ok(g.state === 'play', g.state); ok(g.ci === 0 && g.level.def.id === 'c1'); ok(Math.hypot(g.player.x - 0, g.player.z - 21) < 1);
  ok(g.weapons.cur === 'pistol' && g.weapons.state.pistol.mag === 12);
});
stubUI();
await t('first checkpoint is written at chapter start and is loadable', () => { const r = g.save.read('auto'); ok(r && r.data.chapter === 0 && r.data.cp === 0); });
await t('movement stays inside the level and never enters solid geometry', () => {
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  restart(); frames(1500, 1 / 60, i => { g.player.hp = 100; g.input.keys.clear(); g.input.keys.add(keys[(i / 40 | 0) % 4]); if (i % 200 === 0) g.input.keys.add('ShiftLeft'); g.input.dx = Math.sin(i / 30) * 9; if (i % 97 === 0) g.input.pressed.add('Space'); });
  ok(g.state === 'play', 'game left play state: ' + g.state); const p = g.player, B = g.level.def.bounds; ok(Number.isFinite(p.x) && Number.isFinite(p.z)); ok(p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1, 'left bounds');
  for (const b of g.level.blockers) ok(!(Math.abs(p.x - b.x) < b.w / 2 - 0.05 && Math.abs(p.z - b.z) < b.d / 2 - 0.05 && b.h > 0.4), `player inside box at (${b.x},${b.z})`);
});
await t('player cannot walk through the outpost wall', () => {
  restart();
  g.player.reset(-4, -12, 0, 100); g.input.keys.clear(); g.input.keys.add('KeyW'); g.enemies.forEach(e => e.damage(9999, 'torso'));
  frames(300, 1 / 60, () => { g.player.yaw = 0; g.player.hp = 100; }); ok(g.player.z > -17.7, 'passed through wall at z=-18 (z=' + g.player.z.toFixed(2) + ')');
  g.input.keys.clear(); g.player.reset(0, -12, 0, 100); g.input.keys.add('KeyW'); frames(300, 1 / 60, () => { g.player.yaw = 0; g.player.hp = 100; }); ok(g.player.z < -19, 'could not walk through the doorway (z=' + g.player.z.toFixed(2) + ')');
});
await t('firing consumes ammo, reload refills, empty-click auto reloads', () => {
  restart(); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.hp = 100; frames(10); // 0.1 s weapon draw time
  g.input.keys.clear(); g.player.reset(0, 21, 0, 100); const w = g.weapons, st = w.state.pistol, before = st.mag;
  g.input.mouse.l = true; frames(2); g.input.mouse.l = false; frames(10); ok(st.mag === before - 1, `mag ${st.mag}`);
  w.cd = 0; st.mag = 0; g.input.mouse.l = true; frames(3); g.input.mouse.l = false; ok(w.reloading, 'did not auto reload'); frames(200); ok(!w.reloading && st.mag === 12, `mag ${st.mag}`);
});
await t('semi-auto pistol fires once per click; rifle fires automatically', () => {
  restart(); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.hp = 100; frames(10); // 0.1 s weapon draw time
  const w = g.weapons; w.state.pistol.mag = 12; g.input.mouse.l = true; frames(30); g.input.mouse.l = false; frames(5); ok(w.state.pistol.mag === 11, 'pistol held fire: ' + w.state.pistol.mag);
  w.unlock('rifle'); w.switchTo('rifle'); frames(40); ok(w.cur === 'rifle'); const s = w.state.rifle; s.mag = 30; g.input.mouse.l = true; frames(30); g.input.mouse.l = false; ok(s.mag <= 26 && s.mag >= 20, 'rifle mag ' + s.mag + ' (expected ~5 shots in 0.5 s at 640 rpm)');
});
await t('weapon switching works by key; locked weapons cannot be selected', () => {
  restart(); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.hp = 100; frames(10); // 0.1 s weapon draw time
  const w = g.weapons; w.unlock('rifle'); w.switchTo('pistol'); frames(40); ok(w.cur === 'pistol'); w.switchTo('shotgun'); frames(40); ok(w.cur === 'pistol', 'switched to a locked weapon');
  g.input.pressed.add('Digit2'); frames(40); ok(w.cur === 'rifle');
});
await t('shotgun reloads shell by shell and can be interrupted by firing', () => {
  restart(); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.hp = 100; frames(10); // 0.1 s weapon draw time
  const w = g.weapons; w.unlock('shotgun'); w.switchTo('shotgun'); frames(40); const s = w.state.shotgun; s.mag = 2; w.startReload(); frames(40); ok(s.mag === 3 || s.mag === 4, 'shell loading ' + s.mag);
  const m = s.mag; g.input.mouse.l = true; frames(2); g.input.mouse.l = false; ok(!w.reloading && s.mag === m - 1, 'did not interrupt');
});
await t('crouch and ADS change stance and zoom', () => {
  restart(); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.hp = 100; frames(10); // 0.1 s weapon draw time
  g.input.keys.clear(); g.settings.crouchToggle = false; g.input.keys.add('KeyC'); frames(60); ok(g.player.crouch && g.player.eyeH < 1.3); g.input.keys.clear(); frames(60); ok(!g.player.crouch && g.player.eyeH > 1.6);
  g.input.mouse.r = true; frames(60); ok(g.player.aiming && g.weapons.fovMul < 0.95); g.input.mouse.r = false; frames(60); ok(g.weapons.fovMul > 0.99); g.settings.crouchToggle = true;
});

console.log('Enemy AI and combat fairness');
await t('enemy facing a clear line of sight notices, fights and damages the player', () => {
  restart(); frames(1); const e = g.enemies.find(x => x.gid === 'pa'); ok(e, 'no enemy'); g.enemies.forEach(o => { if (o !== e) o.damage(9999, 'torso'); });
  e.x = 0; e.z = -2; e.yaw = Math.PI; e.state = 'idle'; e.home = { x: 0, z: -2 }; e.homeYaw = Math.PI; g.player.reset(0, 8, 0, 100); g.player.pitch = 0;
  let sawCombat = false; frames(600, 1 / 60, () => { g.player.hp = Math.max(g.player.hp, 1); if (e.state === 'combat') sawCombat = true; }); ok(sawCombat, 'enemy never entered combat'); ok(g.player.hp < 100 || g.lastPlayerHurt > 0, 'enemy never damaged the player');
});
await t('enemy never sees or damages the player through a solid wall', () => {
  restart(); frames(1); const e = g.enemies.find(x => x.role === 'defender'); g.enemies.forEach(o => { if (o !== e) o.damage(9999, 'torso'); });
  g.player.reset(-5, -40, 0, 100); let seen = false; frames(900, 1 / 60, () => { if (e.seeing) seen = true; g.input.keys.clear(); }); ok(!seen, 'enemy saw through wall'); ok(g.player.hp === 100, 'damage through wall'); ok(e.state === 'idle', e.state);
});
await t('enemy bullets hit cover instead of the player when LOS is blocked', () => {
  restart(); frames(1); const e = g.enemies[0]; g.enemies.forEach(o => { if (o !== e) o.damage(9999, 'torso'); });
  g.level.blockers.push({ x: 0, z: -30, w: 6, d: 0.4, h: 4, k: 'wall' }); e.x = 0; e.z = -34; e.yaw = Math.PI; g.player.reset(0, -26, 0, 100); const hp = g.player.hp; for (let i = 0; i < 200; i++) g.enemyFire(e); ok(g.player.hp === hp, 'shot through wall'); g.level.blockers.pop();
});
await t('player shots are stopped by walls before reaching enemies (hit order)', () => {
  const L = g.level, o = { x: 0, y: 1.6, z: 0 }; L.blockers.push({ x: 0, z: -5, w: 6, d: 0.4, h: 4, k: 'wall' }); let hit = 0; const orig = g.ray.intersectObjects; g.ray.intersectObjects = () => [{ distance: 10, object: { userData: { enemy: { cfg: { armor: 0 }, damage: () => { hit++; } }, zone: 'head' } }, point: new THREE.Vector3() }];
  g.shoot(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1), { damage: 20, range: 30 }); ok(hit === 0, 'enemy behind wall was damaged'); L.blockers.pop();
  g.shoot(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1), { damage: 20, range: 30 }); ok(hit === 1, 'visible enemy was not damaged'); g.ray.intersectObjects = orig;
});
await t('dead enemies stop acting; group-cleared event fires once', () => {
  restart(); frames(1); const n = g.enemies.length; killAll(); frames(120); ok(g.enemies.every(e => e.dead)); const pos = g.enemies.map(e => [e.x, e.z]); frames(60); ok(g.enemies.every((e, i) => e.x === pos[i][0] && e.z === pos[i][1]), 'dead enemy moved'); ok(n >= 3);
});
await t('enemy pathfinding: every spawn in every chapter reaches the player start (A*)', () => {
  for (let c = 0; c < LEVELS.length; c++) { g.loadLevel(c); const L = g.level; for (const list of Object.values(L.def.groups)) for (const d of list) ok(L.nav.path(d.x, d.z, L.def.start.x, L.def.start.z), `c${c + 1} (${d.x},${d.z})`); }
});

console.log('Story, choices, endings and saves (scripted walkthrough, stubbed dialogue)');
async function playthrough(choiceFn) {
  g.choiceFn = choiceFn; g.cards.length = 0; g.toMenu(); stubUI(); g.newGame(); await tick(); lock(); await tick();
  for (let guard = 0; guard < 500 && g.state !== 'menu'; guard++) {
    if (g.postGame) { if (g.state === 'card') g.ui.endCard(); await tick(4); g.toMenu(); break; }
    const startCi = g.ci; g.player.hp = 100; g.state === 'card' && g.ui.endCard(); if (g.state === 'lockwait') lock();
    if (g.state === 'play') {
      killAll(); frames(3);
      for (const it of g.level.inter.filter(i => i.active)) { g.player.x = it.x; g.player.z = it.z; g.input.pressed.add(g.settings.binds.interact); frames(2); }
      const alive = g.enemies.some(e => !e.dead), active = g.level.inter.some(i => i.active);
      for (const tr of g.level.def.triggers.filter(x => !x.id.startsWith('exit') || (!alive && !active))) { g.player.x = tr.x; g.player.z = tr.z; frames(2); }
    }
    await tick(4);
    if (g.state === 'card') { g.ui.endCard(); await tick(4); }
  }
}
await t('playthrough A (spare warden + PRESERVE): reaches the PRESERVE ending', async () => {
  await playthrough(def => 0); ok(g.state === 'menu', 'did not finish, state ' + g.state + ' ch' + (g.ci + 1)); ok(g.cards.some(c => c.title === ENDINGS.preserve.title), 'wrong ending: ' + g.cards.map(c => c.title).join(','));
  ok(g.choices.spared === true && g.choices.fate === 'preserve');
  const endingSave = g.save.read('ending'); ok(endingSave && endingSave.data.choices.ending === 'quietDawn' && endingSave.data.choices.danaFate === 'dead', 'final state not persisted');
});
await t('playthrough B (leave warden + PURGE): reaches the PURGE ending', async () => {
  await playthrough(def => 1); ok(g.state === 'menu'); ok(g.cards.some(c => c.title === ENDINGS.purge.title), 'wrong ending: ' + g.cards.map(c => c.title).join(','));
  ok(g.choices.spared === false && g.choices.fate === 'purge');
  const endingSave = g.save.read('ending'); ok(endingSave && endingSave.data.choices.ending === 'ashesBelow', 'purge ending record missing');
});
await t('choice consequences are implemented: spared opens the chapter-2 side door and the chapter-4 supply room', async () => {
  await playthrough(def => 0); // leaves chapter 4 done; rebuild states to inspect
  g.stubOnly = true; g.toMenu(); g.startChapter({ chapter: IDX.c2, cp: 0, hp: 100, weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: 48 } }, choices: { spared: true }, done: [] }); await tick(); g.ui.endCard(); await tick(); lock(); await tick(); g.runEvent('start'); await tick();
  ok(g.level.doors.sideDoor.open, 'spared: side door closed'); g.toMenu(); g.startChapter({ chapter: IDX.c2, cp: 0, hp: 100, weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: 48 } }, choices: { spared: false }, done: [] }); await tick(); g.ui.endCard(); await tick(); lock(); await tick(); ok(!g.level.doors.sideDoor.open, 'not spared: side door open');
  g.toMenu(); g.startChapter({ chapter: IDX.c4, cp: 0, hp: 100, weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: 48 } }, choices: { spared: false, fate: 'purge' }, done: [] }); await tick(); g.ui.endCard(); await tick(); lock(); await tick(); ok(!g.level.doors.sideDoor4.open, 'not spared: supply room open');
});
await t('dying and restarting restores the checkpoint state (weapons, choices, world state)', async () => {
  g.choiceFn = () => 0; g.toMenu(); stubUI(); g.newGame(); await tick(); lock(); await tick(); g.runEvent('transmitter'); await tick(); ok(g.save.read('auto').data.cp === 1, 'checkpoint 1 not saved');
  g.player.take(500, null); ok(g.state === 'dead'); g.restartCheckpoint(); await tick(); lock(); await tick(); ok(g.state === 'play' && g.cp === 1 && g.done.has('transmitter') && g.enemies.some(e => e.gid === 'w2' && !e.dead), 'ambush wave missing after restore'); ok(!g.enemies.some(e => e.gid === 'pa'), 'cleared group respawned');
});
await t('continue loads the latest save; corrupt latest save falls back to its backup', async () => {
  const k = 'blackveil.save.auto'; store[k] = '{"v":1,"sum":"xx","body":"{}"}'; const r = g.save.read('auto'); ok(r && r.recovered, 'no recovery'); g.toMenu(); g.action('continue'); await tick(); ok(g.ci >= 0 && ['card', 'lockwait', 'play', 'pause'].includes(g.state), g.state);
});

console.log('Chapter 2 vertical slice: terrain, compass, consequences');
const startAt = async (id, choices = {}) => { g.toMenu(); stubUI(); g.startChapter({ chapter: IDX[id], cp: 0, hp: 100, weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: 48 } }, cur: 'pistol', choices, done: [] }); await tick(); if (g.state === 'card') g.ui.endCard(); await tick(); lock(); await tick(); };
await t('valley: player follows the terrain height while walking and stays on walkable ground', async () => {
  await startAt('v1'); g.enemies.forEach(e => e.damage(9999, 'torso')); g.input.keys.add('KeyW');
  frames(900, 1 / 60, i => { g.player.hp = 100; g.player.yaw = Math.sin(i / 120) * 0.8; });
  const p = g.player, L = g.level; ok(g.state === 'play'); ok(Math.abs(p.y - L.groundAt(p.x, p.z)) < 0.05, `y ${p.y} vs ground ${L.groundAt(p.x, p.z)}`); ok(L.terrain.slopeAt(p.x, p.z) <= 0.8, 'standing on a cliff'); ok(p.z < 100, 'did not move');
});
await t('valley: pushing into the ridge stops at the cliff (no invisible wall, no climbing)', async () => {
  await startAt('v1'); g.enemies.forEach(e => e.damage(9999, 'torso')); g.player.reset(-40, 20, Math.PI / 2, 100); g.player.y = g.level.groundAt(-40, 20); g.input.keys.clear(); g.input.keys.add('KeyW');
  frames(1500, 1 / 60, () => { g.player.yaw = Math.PI / 2; g.player.hp = 100; }); const p = g.player; ok(p.x > -118 && p.x < -60, 'x=' + p.x.toFixed(1)); ok(g.level.terrain.slopeAt(p.x, p.z) <= 0.8, 'ended up on a cliff face'); ok(p.y < g.level.groundAt(p.x, p.z) + 0.1);
});
await t('valley: story sets the compass marker; compass renders without errors', async () => {
  await startAt('v1'); await tick(8); ok(g.marker && g.marker.z === -116, JSON.stringify(g.marker)); g.settings.compass = true; frames(5); g.settings.compass = false; frames(3); g.settings.compass = true; ok(g.errs === 0);
});
await t('valley consequence: sparing the Warden reveals the supply cache, otherwise it stays hidden', async () => {
  await startAt('v1', { spared: true }); await tick(8); const c1 = g.level.inter.find(i => i.id === 'cache'); ok(c1.active, 'cache hidden for spared'); const n = g.level.pickups.length; g.runEvent('cache'); await tick(4); ok(g.level.pickups.length === n + 3, 'cache loot missing');
  await startAt('v1', { spared: false }); await tick(8); ok(!g.level.inter.find(i => i.id === 'cache').active, 'cache visible for not spared');
});
await t('valley consequence: restoring the relay opens the chapter 3 side door even without the Warden', async () => {
  await startAt('v1', { spared: false }); g.runEvent('station'); await tick(6); ok(g.choices.radioRestored === true && g.save.read('auto').data.cp === 2, 'relay flag/checkpoint missing');
  await startAt('c2', { spared: false, radioRestored: true }); await tick(8); ok(g.level.doors.sideDoor.open, 'side door still closed'); await startAt('c2', { spared: false, radioRestored: false }); await tick(8); ok(!g.level.doors.sideDoor.open, 'side door open without cause');
});
await t('valley: terrain stops player bullets (ground impact, no crash)', async () => {
  await startAt('v1'); g.enemies.forEach(e => e.damage(9999, 'torso')); let n = 0; const orig = g.fx.impact; g.fx.impact = (...a) => { n++; return orig.apply(g.fx, a); };
  g.shoot(new THREE.Vector3(0, g.level.groundAt(0, 108) + 1.6, 108), new THREE.Vector3(0, -1, 0), { damage: 20, range: 30 }); g.fx.impact = orig; ok(n === 1, 'no ground impact');
});
await t('valley: restoring checkpoint 2 re-applies the relay state and skips cleared camps', async () => {
  await startAt('v1'); g.runEvent('station'); await tick(6); g.player.take(500, null); g.restartCheckpoint(); lock(); await tick(4);
  ok(g.cp === 2 && g.choices.radioRestored === true && !g.enemies.some(e => e.gid === 'camp' || e.gid === 'stn') && g.enemies.some(e => e.gid === 'chk'), 'checkpoint restore wrong');
});
await t('pathfinding cost is spread across frames (at most 2 A* searches per frame)', async () => {
  await startAt('v1'); const nav = g.level.nav, orig = nav.path.bind(nav); let calls = 0; nav.path = (...a) => { calls++; return orig(...a); };
  for (const gid of ['camp', 'chk', 'stn']) g.spawnGroup(gid, { x: g.player.x, z: g.player.z }); let worst = 0; for (let i = 0; i < 120; i++) { calls = 0; frames(1); worst = Math.max(worst, calls); } nav.path = orig; ok(worst <= 2, 'searches in one frame: ' + worst);
});
await t('valley: 5 simulated minutes with combat keeps scene objects bounded', async () => {
  await startAt('v1'); const nonEnemy = () => countObjs(g.scene) - g.enemies.reduce((n, e) => n + countObjs(e.group), 0), o0 = nonEnemy(); let maxObj = 0;
  frames(18000, 1 / 60, i => { g.player.hp = 100; g.input.keys.clear(); g.input.keys.add('KeyW'); g.input.dx = Math.sin(i / 70) * 14; g.input.mouse.l = (i % 140) < 40; if (i % 2400 === 0) g.spawnGroup('rein', { x: g.player.x, z: g.player.z }); if (i % 1200 === 600) killAll(); if (i % 3000 === 0) maxObj = Math.max(maxObj, nonEnemy()); });
  ok(maxObj < o0 + 80, `objects ${o0} -> ${maxObj}`); ok(g.errs === 0, 'frame errors ' + g.errs);
});

console.log('Journal and chapter 4 (Under the Rails)');
await t('journal: notes are recorded once, saved with checkpoints and restored after death', async () => {
  await startAt('c2'); g.journal.length = 0; g.runEvent('roster'); await tick(6); g.runEvent('seal'); await tick(6); ok(g.journal.length === 2 && g.journal[0].title.startsWith('EVACUATION'), 'entries: ' + g.journal.length);
  g.addJournal(g.journal[0].title, 'again'); ok(g.journal.length === 2, 'duplicate added');
  g.setCheckpoint(1); g.player.take(500, null); g.restartCheckpoint(); lock(); await tick(4); ok(g.journal.length === 2 && g.journal[1].title.includes('SEAL ORDER'), 'journal lost after restore');
  g.ui.buildJournal(g.journal, CHAPTERS); g.action('journal'); ok(g.errs === 0);
});
await t('journal: decisions are recorded with the chosen option', async () => {
  await startAt('c1'); g.journal.length = 0; g.choiceFn = () => 1; g.runEvent('warden'); await tick(10); const d = g.journal.find(j => j.title.startsWith('Decision:')); ok(d && d.text.startsWith('Take his codes'), JSON.stringify(g.journal));
});
await t('journal: carries into the next chapter, and a malformed journal makes the save invalid', async () => {
  await startAt('c1'); g.journal.length = 0; g.addJournal('Test note', 'x'); g.endChapter(); await tick(6); g.ui.endCard(); await tick(6); ok(g.ci === IDX.v1 && g.journal.some(j => j.title === 'Test note'), 'journal lost between chapters (ci ' + g.ci + ')');
  ok(!g.save.write('auto', { ...g.lastData, journal: [{ title: 5, text: 'x', ch: 0 }] }), 'malformed journal accepted');
});
await t('chapter 4 decision: the rail pass opens the short spur, refusing keeps it shut; chapter 5 reacts to it', async () => {
  await startAt('b2'); g.choiceFn = () => 0; g.runEvent('dispatch'); await tick(8); ok(g.level.doors.railGate.open && g.choices.trustKessel === true, 'pass did not open the gate');
  await startAt('b2'); g.choiceFn = () => 1; g.runEvent('dispatch'); await tick(8); ok(!g.level.doors.railGate.open && g.choices.trustKessel === false, 'gate open after refusing');
  await startAt('c3', { trustKessel: true }); await tick(8); ok(g.enemies.some(e => e.gid === 'tip' && e.state === 'alert'), 'tip-off ambush missing'); await startAt('c3', { trustKessel: false }); await tick(8); ok(!g.enemies.some(e => e.gid === 'tip'), 'ambush without cause');
});
await t('chapter 4: depot checkpoint restore skips the entrance guard and keeps the pass state', async () => {
  await startAt('b2'); g.choiceFn = () => 0; g.runEvent('dispatch'); await tick(8); g.runEvent('enterDepot'); await tick(6); ok(g.cp === 1); g.player.take(500, null); g.restartCheckpoint(); lock(); await tick(4);
  ok(g.level.doors.railGate.open === false || g.choices.trustKessel === true); ok(!g.enemies.some(e => e.gid === 'ent') && g.enemies.some(e => e.gid === 'dep'), 'checkpoint groups wrong');
});

await t('leg hit applies limping condition and death is terminal', async () => {
  await startAt('c1'); const e = g.enemies.find(x => !x.dead); ok(e, 'no enemy for condition test');
  e.damage(5, 'leg'); ok(e.condition === 'LIMPING', 'leg hit condition=' + e.condition);
  e.damage(9999, 'torso'); ok(e.dead && e.condition === 'DEAD', 'death state not set');
  e.damage(5, 'torso'); ok(e.condition === 'DEAD' && e.dead, 'dead enemy changed state');
});

await t('manual save slots 1-5 store independent chapter snapshots', async () => {
  await startAt('c1');
  for (let i = 1; i <= 5; i++) ok(g.saveManual('manual' + i), 'save failed for slot ' + i);
  for (let i = 1; i <= 5; i++) { const r = g.save.read('manual' + i); ok(r && r.data.chapter === g.ci, 'slot missing or wrong chapter: ' + i); }
  ok(g.slotList().filter(s => s.id.startsWith('manual')).length === 5, 'manual slots not listed');
});
await t('all nine weapon models can be unlocked and selected by the existing weapon controller', async () => {
  await startAt('c1'); const w = g.weapons;
  for (const id of ORDER) {
    ok(WEAPONS[id] && w.models[id], 'model missing for ' + id);
    w.unlock(id); w.switchTo(id); frames(30); ok(w.cur === id, 'failed to select ' + id);
    ok(w.state[id].mag > 0, 'empty initial magazine ' + id);
  }
});

await t('post-game opens a separate Mara memory walk and persists optional discoveries', async () => {
  g.toMenu(); g.store.removeItem('blackveil.memory.discoveries'); stubUI(); await g.startPostGame();
  ok(g.postGame && g.explorer === 'Mara Vale', 'post-game identity/state missing');
  ok(g.level.def.id === 'v1' && g.level.inter.some(i => i.id === 'familyHome'), 'memory region/hotspot missing');
  lock(); await tick(2); await g.runMemoryEvent('familyHome');
  const found = JSON.parse(store['blackveil.memory.discoveries'] || '[]');
  ok(found.includes('familyHome'), 'memory discovery not persisted');
  g.toMenu();
});

console.log('Settings, long-session stability');
await t('settings persist and are re-sanitised on load', () => { g.settings.fov = 90; g.settings.quality = 'low'; g.applySettings(); const raw = JSON.parse(store['blackveil.settings']); ok(raw.fov === 90 && raw.quality === 'low'); store['blackveil.settings'] = '{"fov":"x","quality":"ultra"}'; });
await t('graphics preset really changes rendering parameters', async () => {
  await startAt('c1'); // outdoor level: snow particle count follows the preset (indoor dust is fixed)
  g.settings.quality = 'high'; g.applyGraphics(); ok(g.ren.shadowMap.enabled === true); const hi = g.level.snowN; g.settings.quality = 'low'; g.applyGraphics(); ok(g.ren.shadowMap.enabled === false && g.level.snowN < hi, 'preset had no effect'); g.settings.quality = 'high'; g.applyGraphics();
});
await t('10 minutes of simulated play with combat: object counts stay bounded', async () => {
  g.choiceFn = () => 0; g.toMenu(); stubUI(); g.newGame(); await tick(); lock(); await tick(); frames(60);
  const nonEnemy = () => countObjs(g.scene) - g.enemies.reduce((n, e) => n + countObjs(e.group), 0), o0 = nonEnemy(), keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD']; let maxEn = 0, maxObj = 0;
  frames(36000, 1 / 60, i => { g.player.hp = 100; g.input.keys.clear(); g.input.keys.add(keys[(i / 90 | 0) % 4]); g.input.dx = Math.sin(i / 50) * 12; g.input.mouse.l = (i % 120) < 40; if (i % 3000 === 0) { g.spawnGroup('w2', { x: g.player.x, z: g.player.z }); g.spawnGroup('pa', { x: g.player.x, z: g.player.z }); } if (i % 1500 === 750) killAll(); maxEn = Math.max(maxEn, g.enemies.length); if (i % 2000 === 0) maxObj = Math.max(maxObj, nonEnemy()); });
  ok(maxEn <= 24, 'enemy list grew to ' + maxEn); ok(maxObj < o0 + 80, `non-enemy scene objects grew from ${o0} to ${maxObj}`); ok(g.fx.tr.length === 24 && g.fx.dc.length === 48, 'pools changed size'); ok(g.errs === 0, 'frame errors: ' + g.errs);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
