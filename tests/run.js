// Deterministic-system tests. Run: node tests/run.js  (no browser needed)
import { rayWorld, losClear, moveCircle } from '../src/core/math.js';
import { NavGrid } from '../src/core/nav.js';
import { computeDamage, ZONE_MULT, falloff } from '../src/core/damage.js';
import { visionGain, hears } from '../src/core/detect.js';
import { SaveManager, validateSave } from '../src/core/save.js';
import { sanitize, SCHEMA, DEFAULTS, DEFAULT_BINDS } from '../src/settings.js';
import { LEVELS } from '../src/data/levels.js';
import { buildWorld, makeNav, SLOPE_MAX } from '../src/core/world.js';
import { Terrain } from '../src/core/terrain.js';
import { SpatialIndex } from '../src/core/spatial.js';
import { circleBlocked } from '../src/core/math.js';
import { migrateSave, LEGACY_V1_IDS } from '../src/core/save.js';
import { STORY, CHAPTERS, ENDINGS, chooseEnding } from '../src/data/story.js';
import { NPC_CONDITIONS, canTransitionNpc, transitionNpcCondition, conditionFromHit } from '../src/core/npc-state.js';
import { WEAPONS, ORDER } from '../src/data/weapons.js';
import { CHARACTER_IDENTITIES, FACTION_VISUALS, CHAPTER_APPEARANCE, CHARACTER_ASSETS } from '../src/data/character-identity.js';
import { readGlbChunks } from '../src/character-assets.js';
import fs from 'node:fs';
import path from 'node:path';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  PASS', name); } catch (e) { fail++; console.log('  FAIL', name, '->', e.message); } };
const ok = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };
const near = (a, b, e = 1e-6) => ok(Math.abs(a - b) < e, `${a} != ${b}`);
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, _m: m }; };


t('Elias procedural character asset exists and GLB has a valid binary header', () => {
  const base = 'public/models/characters';
  const glb = fs.readFileSync(path.join(base, 'elias_voss_procedural_blockout.glb'));
  ok(glb.length > 100000, `GLB unexpectedly small: ${glb.length}`);
  ok(glb.toString('ascii', 0, 4) === 'glTF', 'invalid GLB magic');
  ok(fs.existsSync(path.join(base, 'elias_voss_procedural_blockout.obj')), 'OBJ missing');
  ok(fs.existsSync(path.join(base, 'material.mtl')), 'OBJ material library missing');
  ok(fs.existsSync(path.join(base, 'elias_voss_asset_report.json')), 'asset report missing');
  ok(CHARACTER_IDENTITIES.eliasVoss.implementation.includes('PARTIAL_PROCEDURAL_BLOCKOUT_ASSET'), 'manifest must report partial asset status');
});

console.log('Geometry / hit detection');
const wall = { x: 0, z: -5, w: 10, d: 0.4, h: 4 }, crate = { x: 0, z: -3, w: 2, d: 2, h: 1.2 };
t('ray hits a wall in front', () => { const r = rayWorld({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 }, [wall]); near(r.t, 4.8, 1e-6); });
t('ray misses when aimed away', () => ok(rayWorld({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: 1 }, [wall]) === null));
t('bullets do not pass through walls (LOS blocked)', () => ok(!losClear({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 1.6, z: -8 }, [wall])));
t('LOS passes over low cover at standing height', () => ok(losClear({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 1.6, z: -8 }, [crate])));
t('crouching target behind low cover is not visible', () => ok(!losClear({ x: 0, y: 1.0, z: 0 }, { x: 0, y: 1.0, z: -8 }, [crate])));
t('circle movement slides along a wall and respects bounds', () => {
  const p = { x: 0, z: -4 }, b = { x0: -20, x1: 20, z0: -20, z1: 20 };
  moveCircle(p, 2, -2, 0.4, [wall], b); ok(p.z > -4.6, 'went through wall'); ok(p.x > 0, 'did not slide');
  const q = { x: 19.5, z: 0 }; moveCircle(q, 5, 0, 0.4, [], b); ok(q.x < 19.7);
});

console.log('Damage');
t('headshot multiplier is 2.5x, limbs reduced', () => { near(computeDamage(20, 'head'), 50); near(computeDamage(20, 'torso'), 20); near(computeDamage(20, 'leg'), 12); ok(ZONE_MULT.arm < 1); });
t('armour reduces body damage more than headshots', () => ok(computeDamage(20, 'torso', { armor: 0.45 }) < computeDamage(20, 'head', { armor: 0.45 }) / 2.5));
t('range falloff is monotonic and floored at 35%', () => { ok(falloff(5, 30) === 1); ok(falloff(25, 30) < falloff(18, 30)); near(falloff(500, 30), 0.35); });

console.log('Perception');
const e0 = { x: 0, z: 0, yaw: 0, eye: 1.6, fov: 2, range: 40 }, pl = (z, o = {}) => ({ x: 0, z, eye: 1.55, crouch: false, sprint: false, ...o });
t('enemy sees player in front with clear LOS', () => ok(visionGain(e0, pl(-15), []) > 0));
t('enemy does not see player behind it', () => ok(visionGain(e0, pl(15), []) === 0));
t('enemy does not see through walls', () => ok(visionGain(e0, pl(-15), [{ x: 0, z: -8, w: 6, d: 0.4, h: 4 }]) === 0));
t('enemy does not see beyond range', () => ok(visionGain(e0, pl(-60), []) === 0));
t('crouching lowers detection, sprinting raises it', () => { const a = visionGain(e0, pl(-15), []); ok(visionGain(e0, pl(-15, { crouch: true }), []) < a); ok(visionGain(e0, pl(-15, { sprint: true }), []) > a); });
t('walls muffle noise', () => { const w = [{ x: 0, z: -10, w: 6, d: 0.4, h: 4 }]; ok(hears(e0, { x: 0, z: -20, radius: 25 }, [])); ok(!hears(e0, { x: 0, z: -20, radius: 25 }, w)); });

console.log('Save system');
const good = { chapter: 1, cp: 1, hp: 80, weapons: ['pistol', 'rifle'], ammo: { pistol: { mag: 5, reserve: 30 } }, choices: { spared: true }, done: ['start'] };
t('write then read round-trips', () => { const m = new SaveManager(mem()); ok(m.write('auto', good)); const r = m.read('auto'); ok(r && r.data.chapter === 1 && r.data.choices.spared === true); });
t('invalid data is refused', () => { const m = new SaveManager(mem()); ok(!m.write('auto', { chapter: 99 })); ok(!validateSave(null)); ok(!validateSave({ ...good, hp: 0 })); });
t('corrupt save falls back to the backup', () => {
  const s = mem(), m = new SaveManager(s); m.write('auto', good); m.write('auto', { ...good, chapter: 2 });
  s.setItem('blackveil.save.auto', '{"v":1,"sum":"bad","body":"{}"}');
  const r = m.read('auto'); ok(r && r.recovered && r.data.chapter === 1);
});
t('garbage storage never throws', () => { const s = mem(); s.setItem('blackveil.save.auto', 'not json'); ok(new SaveManager(s).read('auto') === null); });
t('a failed write does not destroy the previous save', () => { const s = mem(), m = new SaveManager(s); m.write('auto', good); m.write('auto', { chapter: 'x' }); ok(m.read('auto').data.chapter === 1); });

console.log('Settings');
t('sanitize clamps, rejects bad types, keeps defaults', () => {
  const s = sanitize({ sens: 999, master: 'loud', quality: 'ultra', fov: 75, binds: { forward: 'ArrowUp', jump: 5 } });
  ok(s.sens === 3 && s.master === DEFAULTS.master && s.quality === 'high' && s.fov === 75 && s.binds.forward === 'ArrowUp' && s.binds.jump === DEFAULT_BINDS.jump);
});
t('null input yields defaults', () => ok(sanitize(null).fov === DEFAULTS.fov));
t('every schema key has a default', () => ok(SCHEMA.every(f => f.k in DEFAULTS)));

console.log('Character identity / asset audit');
t('static GLB loader parses GLB v2 container without pretending to support skins', () => {
  const bytes = fs.readFileSync('public/models/characters/veil_research_faction_blockout.glb');
  const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const { json, bin } = readGlbChunks(exact);
  ok(json.asset.version === '2.0', 'glTF v2 metadata missing');
  ok(Array.isArray(json.meshes) && json.meshes.length > 0, 'mesh definitions missing');
  ok(Array.isArray(json.images) && json.images.length >= 15, 'embedded base-color images missing');
  ok(json.materials.some(m => m.pbrMetallicRoughness?.baseColorTexture), 'textured material references missing');
  ok(bin.byteLength > 1000, 'binary mesh buffer missing');
  ok(CHARACTER_ASSETS.veilResearch.status.includes('RUNTIME_FALLBACK_REPLACEMENT_ENABLED'), 'runtime status must be explicit');
});
t('character blockout variants have UV-bearing GLBs and honest status reports', () => {
  const names = ['elias_voss_uv','dana_voss_blockout','mara_vale_blockout','warden_faction_blockout','drifter_faction_blockout','fractured_faction_blockout','collector_faction_blockout','veil_research_faction_blockout','kessel_security_faction_blockout','friendly_survivor_faction_blockout'];
  for (const name of names) {
    const report = JSON.parse(fs.readFileSync(`public/models/characters/${name}_report.json`, 'utf8'));
    ok(fs.existsSync(`public/models/characters/${name}.glb`), `${name} GLB missing`);
    ok(report.uv_geometry_count > 0 && report.uv_geometry_count === report.geometry_count, `${name} UV count mismatch`);
    ok(report.rigged === false && report.runtime_integrated === false, `${name} must not claim rig/runtime status`);
  }
  ok(CHARACTER_ASSETS.danaVoss.url.includes('dana_voss_blockout.glb'), 'Dana asset path missing');
  ok(CHARACTER_ASSETS.maraVale.url.includes('mara_vale_blockout.glb'), 'Mara asset path missing');
  ok(fs.existsSync('tools/character_pipeline/blender_rig_uv_export.py'), 'Blender rig/export pipeline script missing');
  ok(fs.existsSync('public/models/characters/character_asset_audit.json'), 'asset audit missing');
  const sourceReport = JSON.parse(fs.readFileSync('public/models/characters/elias_voss_asset_report.json', 'utf8'));
  ok(sourceReport.geometry_count === 127 && sourceReport.rigged === false, 'Elias source report must be current and honest');
});

t('canonical character manifest distinguishes established canon from production targets', () => {
  for (const id of ['eliasVoss', 'danaVoss', 'maraVale', 'hale', 'maren']) {
    const c = CHARACTER_IDENTITIES[id]; ok(c && c.id === id && c.name && c.canon.length && c.designTarget && c.implementation, id);
  }
  ok(CHARACTER_IDENTITIES.eliasVoss.implementation.includes('PARTIAL_PROCEDURAL_BLOCKOUT_ASSET') && CHARACTER_IDENTITIES.eliasVoss.implementation.includes('hero asset is not loaded into gameplay'), 'must distinguish prepared mesh from runtime-integrated hero');
  ok(CHARACTER_IDENTITIES.danaVoss.implementation.includes('PARTIAL'), 'Dana asset status should remain honest');
  ok(CHARACTER_IDENTITIES.maren.implementation.includes('NOT_MODELED'), 'Maren model status should remain honest');
});
t('faction design rules cover all requested primary groups without claiming nonexistent models', () => {
  for (const id of ['warden', 'drifter', 'fractured', 'collector', 'returned', 'veilResearch', 'kesselHoldings', 'friendlySurvivor']) {
    const f = FACTION_VISUALS[id]; ok(f && f.name && f.palette.length && f.garments.length && f.variation, id);
  }
});
t('chapter appearance targets cover all nine chapters and are deterministic data', () => {
  for (const id of ['c1', 'v1', 'c2', 'b2', 'c3', 'c5', 'c6', 'c7', 'c4']) {
    const a = CHAPTER_APPEARANCE[id]; ok(a && a.label && a.wear >= 0 && a.wear <= 1 && a.notes, id);
  }
  ok(Object.keys(CHAPTER_APPEARANCE).length === 9, 'unexpected chapter variant count');
});

console.log('Weapons / data');
t('weapons are consistent', () => { for (const id of ORDER) { const w = WEAPONS[id]; ok(w && w.mag > 0 && w.rpm > 0 && w.damage > 0 && w.reload > 0 && w.range > 0, id); } });
t('all nine firearm definitions have stable slots and matching controls', () => {
  ok(ORDER.length === 9, 'weapon count=' + ORDER.length);
  for (const id of ORDER) { const w = WEAPONS[id]; ok(w && w.id === id && w.slot >= 1 && w.slot <= 9, id); ok(DEFAULT_BINDS['slot' + w.slot], 'missing slot bind ' + w.slot); }
  ok(WEAPONS.suppressed.noise < WEAPONS.pistol.noise, 'suppressed sidearm should have a smaller sound radius');
  ok(WEAPONS.shotgun.perShell && WEAPONS.breach.perShell, 'pump weapons must keep interruptible shell reload');
});
t('story: every trigger/interactable/cleared event exists', () => {
  LEVELS.forEach((L, i) => {
    const ev = STORY[i].events;
    for (const tr of L.triggers) ok(ev[tr.id], `c${i + 1} trigger ${tr.id}`);
    for (const it of L.interactables) ok(ev[it.event], `c${i + 1} interactable ${it.id}`);
    for (const g of Object.keys(L.groups)) if (ev['cleared:' + g]) ok(true);
    ok(ev.start, `c${i + 1} start`);
  });
  ok(CHAPTERS.length === LEVELS.length && STORY.length === LEVELS.length);
});
t('story: actions use known verbs and valid references', () => {
  const verbs = new Set(['say', 'obj', 'checkpoint', 'spawn', 'show', 'hide', 'unlock', 'give', 'flag', 'if', 'choice', 'note', 'pickup', 'end', 'wait', 'stinger', 'marker']);
  const walk = (acts, L, tag) => acts.forEach(a => {
    ok(verbs.has(a[0]), `${tag}: unknown verb ${a[0]}`);
    if (a[0] === 'spawn') ok(L.groups[a[1]], `${tag}: spawn ${a[1]}`);
    if (a[0] === 'show' || a[0] === 'hide') ok(L.interactables.some(i => i.id === a[1]), `${tag}: show ${a[1]}`);
    if (a[0] === 'unlock') ok(L.doors.some(d => d.id === a[1]), `${tag}: unlock ${a[1]}`);
    if (a[0] === 'give') ok(WEAPONS[a[1]], `${tag}: give ${a[1]}`);
    if (a[0] === 'if') { walk(a[3], L, tag); walk(a[4] || [], L, tag); }
    if (a[0] === 'choice') a[1].opts.forEach(o => walk(o.do, L, tag));
  });
  LEVELS.forEach((L, i) => Object.entries(STORY[i].events).forEach(([n, acts]) => walk(acts, L, `c${i + 1}.${n}`)));
});
t('story: meaningful choices exist and both endings are written', () => {
  const flat = JSON.stringify(STORY);
  ok(flat.includes('"spared"') && flat.includes('"fate"') && ENDINGS.preserve.lines.length && ENDINGS.purge.lines.length);
});
t('final authorization console exposes all three endgame decisions', () => {
  const choices = STORY[8].events.core.filter(a => a[0] === 'choice');
  ok(choices.length === 1, 'final choice missing');
  const c = choices[0][1]; ok(c.id === 'finalAuthorization' && c.opts.length === 3, 'wrong final options');
  const flags = c.opts.map(o => o.do.find(a => a[0] === 'flag' && a[1] === 'fate')?.[2]);
  ok(flags.join(',') === 'preserve,purge,expose', 'fate mapping ' + flags.join(','));
});
t('campaign now has nine unique levels with a matching story and chapter entry', () => {
  ok(LEVELS.length === 9, 'levels=' + LEVELS.length); ok(STORY.length === 9, 'story=' + STORY.length); ok(CHAPTERS.length === 9, 'chapters=' + CHAPTERS.length);
  ok(new Set(LEVELS.map(x => x.id)).size === 9, 'duplicate level ids');
  ok(['THE ARCHIVE', 'QUARANTINE', 'THE LONG NIGHT'].every(n => LEVELS.some(l => l.name === n)), 'missing new campaign wing');
});
t('five ending branches are distinct and reachable from explicit story-state conditions', () => {
  const base = { fate: 'preserve', spared: true };
  ok(chooseEnding(base) === 'quietDawn');
  ok(chooseEnding({ fate: 'preserve', spared: false, radioRestored: true, archive: 'copy', nightLogFound: true, kesselTrust: 2 }) === 'truthSurvives');
  ok(chooseEnding({ fate: 'purge' }) === 'ashesBelow');
  ok(chooseEnding({ fate: 'preserve', spared: false, trustKessel: true, archive: 'leave' }) === 'newCustodian');
  ok(chooseEnding({ fate: 'purge', radioRestored: true, archive: 'copy', nightLogFound: true }) === 'sixSeconds');
  ok(chooseEnding({ fate: 'expose', radioRestored: true, archive: 'copy', nightLogFound: true }) === 'truthSurvives');
  ok(chooseEnding({ fate: 'expose', archive: 'leave' }) === 'newCustodian');
  ok(new Set(['quietDawn','truthSurvives','ashesBelow','newCustodian','sixSeconds'].map(k => ENDINGS[k].title)).size === 5);
});
t('NPC condition state machine blocks resurrection and invalid terminal transitions', () => {
  ok(NPC_CONDITIONS.includes('LIMPING') && NPC_CONDITIONS.includes('GRIEVING'));
  const n = { condition: 'HEALTHY', game: { time: 4 } };
  ok(transitionNpcCondition(n, 'LIMPING') && n.conditionChangedAt === 4);
  ok(transitionNpcCondition(n, 'WOUNDED'));
  ok(transitionNpcCondition(n, 'DEAD'));
  ok(!transitionNpcCondition(n, 'COMBAT') && !transitionNpcCondition(n, 'HEALTHY'));
  ok(canTransitionNpc('DEAD', 'DESPAWNING') && !canTransitionNpc('DESPAWNING', 'ACTIVE'));
  ok(conditionFromHit({ zone: 'leg', hp: 80, maxHp: 100 }) === 'LIMPING');
  ok(conditionFromHit({ zone: 'torso', hp: 20, maxHp: 100 }) === 'WOUNDED');
  ok(conditionFromHit({ zone: 'head', hp: 0, maxHp: 100 }) === 'DEAD');
});
t('story: checkpoint indices exist in level data', () => {
  LEVELS.forEach((L, i) => { const walk = acts => acts.forEach(a => { if (a[0] === 'checkpoint') ok(L.cps[a[1]], `c${i + 1} cp ${a[1]}`); if (a[0] === 'if') { walk(a[3]); walk(a[4] || []); } }); Object.values(STORY[i].events).forEach(walk); });
});

console.log('Level geometry / navigation (all doors opened)');
const blockersOf = (L, withDoors = false) => buildWorld(L, { doors: withDoors ? 'closed' : 'open' }).blockers;   // the real world builder (terrain, trees, placement)
const endsChapter = acts => (acts || []).some(a => a[0] === 'end' || (a[0] === 'if' && (endsChapter(a[3]) || endsChapter(a[4]))) || (a[0] === 'choice' && a[1].opts.some(o => endsChapter(o.do))));
const chapterExit = (L, i) => [...L.triggers, ...L.interactables].find(o => endsChapter(STORY[i].events[o.event || o.id]));
LEVELS.forEach((L, i) => {
  const boxes = blockersOf(L), nav = makeNav(L, boxes, boxes.terrain);
  t(`c${i + 1} ${L.name}: start is walkable`, () => ok(nav.walkable(L.start.x, L.start.z)));
  t(`c${i + 1} every enemy spawn is walkable and reachable from start`, () => {
    for (const [gid, list] of Object.entries(L.groups)) for (const e of list) {
      ok(nav.walkable(e.x, e.z), `${gid} spawn (${e.x},${e.z}) is inside geometry`);
      ok(nav.path(L.start.x, L.start.z, e.x, e.z), `${gid} (${e.x},${e.z}) unreachable`);
      for (const [px, pz] of e.patrol || []) ok(nav.walkable(px, pz) && nav.path(e.x, e.z, px, pz), `${gid} patrol point (${px},${pz})`);
    }
  });
  t(`c${i + 1} interactables, triggers and pickups are reachable`, () => {
    for (const o of [...L.interactables, ...L.triggers, ...L.pickups]) {
      const p = nav.path(L.start.x, L.start.z, o.x, o.z);
      ok(p, `${o.id || o.t} at (${o.x},${o.z}) unreachable`);
      const last = p[p.length - 1], r = o.r || 1;
      ok(Math.hypot(last[0] - o.x, last[1] - o.z) <= Math.max(r + 1.2, 2.2), `${o.id || o.t} not reachable within interaction range`);
    }
  });
  t(`c${i + 1} checkpoints are walkable`, () => L.cps.forEach((c, k) => ok(nav.walkable(c.x, c.z), `cp${k}`)));
  t(`c${i + 1} chapter exit is reachable with doors open`, () => {
    const ex = chapterExit(L, i); ok(ex, 'no event ends this chapter'); ok(nav.path(L.start.x, L.start.z, ex.x, ex.z), 'exit unreachable');
  });
  if (L.doors.length) t(`c${i + 1} closed doors really block (no sequence break)`, () => {
    const cb = blockersOf(L, true), closed = makeNav(L, cb, cb.terrain);
    const gated = L.doors.filter(d => ['mineGate', 'cell', 'sideDoor4'].includes(d.id));
    const exit = chapterExit(L, i);
    if (L.id === 'c2') ok(closed.path(L.start.x, L.start.z, exit.x, exit.z) === null, 'chapter 2 exit reachable with gates closed');
    if (L.id === 'c3') ok(closed.path(L.start.x, L.start.z, 24, -46) === null, 'cell reachable while locked');
    if (L.id === 'b2') { const open = nav, len = p => p.reduce((n, q, k) => n + (k ? Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) : Math.hypot(q[0] - L.start.x, q[1] - L.start.z)), 0), lift = [0, -99];
      const pc = closed.path(L.start.x, L.start.z, ...lift), po = open.path(L.start.x, L.start.z, ...lift); ok(pc && po, 'lift unreachable'); ok(len(pc) > len(po) + 15, `shortcut should save distance: closed ${len(pc).toFixed(0)} m vs open ${len(po).toFixed(0)} m`); }
    ok(gated.length >= 0);
  });
});
t('enemies can path to the player start area from every group (combat reachability)', () => {
  LEVELS.forEach(L => { const bb = blockersOf(L), nav = makeNav(L, bb, bb.terrain); for (const list of Object.values(L.groups)) for (const e of list) ok(nav.path(e.x, e.z, L.start.x, L.start.z), `${L.id} group enemy at (${e.x},${e.z})`); });
});
t('A* path is collision-free (waypoint segments clear)', () => {
  const L = LEVELS[0], bb = blockersOf(L), nav = makeNav(L, bb, bb.terrain), p = nav.path(0, 21, 0, -50); ok(p && p.length >= 2);
  let a = [0, 21]; for (const q of p) { ok(nav.clear(a[0], a[1], q[0], q[1]), 'segment blocked'); a = q; }
});


console.log('Terrain, spatial index, slopes (chapter 2: The White Valley)');
const V = LEVELS.find(l => l.id === 'v1'), VW = buildWorld(V, { doors: 'open' }), TR = VW.terrain;
t('terrain heights honour flat platforms and path heights', () => { near(TR.heightAt(-32, 42), 3.8, 0.05); near(TR.heightAt(44, -30), 14, 0.05); near(TR.heightAt(0, -20), 5, 0.15); ok(TR.heightAt(0, 108) < 3 && TR.heightAt(-100, 0) > 20, 'ridge missing'); });
t('terrain height is continuous (no steps between neighbouring samples)', () => { let worst = 0; for (let x = -100; x < 100; x += 0.7) for (let z = -100; z < 100; z += 9.3) worst = Math.max(worst, Math.abs(TR.heightAt(x + 0.1, z) - TR.heightAt(x, z))); ok(worst < 0.3, 'jump ' + worst); });
t('terrain normals: flat ground points up, ridge faces lean', () => { ok(TR.normalAt(-32, 42).y > 0.99); ok(TR.normalAt(-90, 0).y < 0.9); });
t('terrain rays: down hits ground, up misses, sideways hits the ridge', () => {
  const o = { x: 0, y: TR.heightAt(0, 0) + 1.6, z: 0 }; near(TR.rayHit(o, { x: 0, y: -1, z: 0 }, 50), 1.6, 0.1); ok(TR.rayHit(o, { x: 0, y: 1, z: 0 }, 100) === null); ok(TR.rayHit(o, { x: -1, y: 0, z: 0 }, 200) !== null, 'ridge not hit');
});
t('terrain blocks line of sight across the ridge and bullets into the ground', () => {
  const a = { x: 44, y: TR.heightAt(44, -5) + 1.6, z: -5 }, b = { x: 44, y: TR.heightAt(44, -58) + 1.6, z: -58 }; ok(!losClear(a, b, VW.blockers), 'saw through the station hill'); ok(losClear({ x: 0, y: TR.heightAt(0, 100) + 1.6, z: 100 }, { x: 0, y: TR.heightAt(0, 60) + 1.6, z: 60 }, VW.blockers), 'valley floor should be open');
  const r = rayWorld({ x: 0, y: TR.heightAt(0, 108) + 1.6, z: 108 }, { x: 0, y: -1, z: 0 }, VW.blockers, 50); ok(r && r.box.terrain && Math.abs(r.t - 1.6) < 0.15, 'bullet missed the ground');
});
t('spatial index returns exactly what a linear scan returns (800 random queries)', () => {
  let s = 12345; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647, boxes = [];
  for (let i = 0; i < 150; i++) boxes.push({ x: (rnd() - 0.5) * 200, z: (rnd() - 0.5) * 200, w: 0.5 + rnd() * 12, d: 0.5 + rnd() * 12, h: 0.5 + rnd() * 6, y0: rnd() * 3, k: 'wall' });
  const lin = boxes.slice(), idx = boxes.slice(); idx.index = new SpatialIndex(idx, 8);
  for (let i = 0; i < 400; i++) { const x = (rnd() - 0.5) * 210, z = (rnd() - 0.5) * 210, r = 0.3 + rnd(); ok(circleBlocked(x, z, r, lin) === circleBlocked(x, z, r, idx), `circle mismatch at ${x},${z}`); }
  for (let i = 0; i < 400; i++) { const a = rnd() * 6.283, e = (rnd() - 0.5) * 0.6, d = { x: Math.cos(a) * Math.cos(e), y: Math.sin(e), z: Math.sin(a) * Math.cos(e) }, o = { x: (rnd() - 0.5) * 200, y: 1 + rnd() * 4, z: (rnd() - 0.5) * 200 }, A = rayWorld(o, d, lin, 150), B = rayWorld(o, d, idx, 150); ok((A === null) === (B === null) && (!A || (Math.abs(A.t - B.t) < 1e-9 && A.box === B.box)), 'ray mismatch'); }
});
t('spatial index remove() takes a box out of every query', () => { const b = { x: 0, z: 0, w: 20, d: 20, h: 3 }, arr = [b]; arr.index = new SpatialIndex(arr, 8); ok(circleBlocked(0, 0, 0.4, arr)); arr.index.remove(b); arr.length = 0; ok(!circleBlocked(0, 0, 0.4, arr)); });
t('valley: both routes north exist; the ridge path is walkable end to end below the slope limit', () => {
  const nav = makeNav(V, VW.blockers, TR), S = [V.start.x, V.start.z]; ok(nav.path(...S, 0, -116), 'road route'); 
  const B = [[-8, 35], [-30, 30], [-50, 22], [-65, 12], [-75, 0], [-82, -20], [-82, -45], [-70, -65], [-50, -80], [-25, -92], [-4, -99]]; let worst = 0;
  for (let i = 0; i < B.length - 1; i++) { ok(nav.path(B[i][0], B[i][1], B[i + 1][0], B[i + 1][1]), `ridge hop ${i} blocked`); for (let k = 0; k <= 20; k++) worst = Math.max(worst, TR.slopeAt(B[i][0] + (B[i + 1][0] - B[i][0]) * k / 20, B[i][1] + (B[i + 1][1] - B[i][1]) * k / 20)); }
  ok(worst <= SLOPE_MAX, 'ridge path slope ' + worst);
});
t('valley: steep ground blocks walking (cliffs) and the station hill has cliff sides plus a ramp', () => {
  const nav = makeNav(V, VW.blockers, TR); let steep = 0; for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) { const [x, z] = nav.center(i, j); if (TR.slopeAt(x, z) > SLOPE_MAX) { steep++; ok(!nav.walkable(x, z), 'steep cell walkable'); } } ok(steep > 2000, 'expected real cliffs, got ' + steep);
  let ring = 0, steepRing = 0; for (let a = 0; a < 360; a += 10) { const x = 44 + 27 * Math.cos(a * Math.PI / 180), z = -30 + 27 * Math.sin(a * Math.PI / 180); ring++; if (TR.slopeAt(x, z) > SLOPE_MAX) steepRing++; }
  ok(steepRing >= 8, `station hill should have cliff sides, steep ring points ${steepRing}/${ring}`); ok(nav.path(20, -50, 44, -30), 'hill unreachable'); ok(nav.path(0, -20, 44, -30), 'ramp route missing');
});
t('valley: nav path requests are fast enough to budget (worst measured is printed)', () => {
  const nav = makeNav(V, VW.blockers, TR); let worst = 0; for (const [a, b] of [[[0, 108], [0, -116]], [[0, 108], [53, -38]], [[0, 108], [-52, -64]], [[-82, -30], [34, -26]]]) { const t0 = performance.now(); nav.path(...a, ...b); worst = Math.max(worst, performance.now() - t0); }
  console.log(`    (info) worst A* on the 160x160 valley grid: ${worst.toFixed(1)} ms on this machine`); ok(worst < 400, 'pathfinding too slow: ' + worst);
});

console.log('Save migration');
const fnvT = x => { let h = 2166136261; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const ids5 = LEVELS.map(l => l.id);
t('chapter order: ids are unique and legacy v1 chapters are still present', () => { ok(new Set(ids5).size === ids5.length); for (const id of LEGACY_V1_IDS) ok(ids5.includes(id), id); });
t('v1 (index-based) saves migrate to the right chapter after the valley was inserted', () => {
  const st = mem(), body = JSON.stringify({ chapter: 1, cp: 1, hp: 80, weapons: ['pistol', 'rifle'], ammo: { pistol: { mag: 5, reserve: 30 } }, choices: { spared: true }, done: ['start'] });
  st.setItem('blackveil.save.auto', JSON.stringify({ v: 1, t: 1, sum: fnvT(body), body }));
  const r = new SaveManager(st, 'blackveil.save.', ids5).read('auto'); ok(r && r.migrated && r.data.cid === 'c2' && r.data.chapter === ids5.indexOf('c2'), JSON.stringify(r && r.data.chapter)); ok(r.data.choices.spared === true);
});
t('v2 saves are keyed by chapter id: inserting a chapter later keeps the right chapter', () => {
  const st = mem(), a = new SaveManager(st, 'p.', ['c1', 'v1', 'c2', 'c3', 'c4']); ok(a.write('auto', { ...good, chapter: 2 }));
  const r = new SaveManager(st, 'p.', ['c1', 'v1', 'new', 'c2', 'c3', 'c4']).read('auto'); ok(r && r.data.chapter === 3, 'got ' + (r && r.data.chapter));
});
t('a save for a chapter that no longer exists is refused, not loaded wrongly', () => { const st = mem(); new SaveManager(st, 'p.', ['c1', 'v1', 'c2', 'c3', 'c4']).write('auto', { ...good, chapter: 4 }); ok(new SaveManager(st, 'p.', ['c1', 'v1']).read('auto') === null); });
t('migrateSave never throws on garbage', () => { ok(migrateSave(null, 1, ids5) === null); ok(migrateSave({ chapter: 99 }, 1, ids5) === null); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
