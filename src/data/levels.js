// Level data for the nine-chapter campaign. Coordinates: x east, z south (the player mostly travels toward -z).
// Yaw convention: forward = (-sin yaw, -cos yaw); yaw 0 faces -z (north), PI faces +z, PI/2 faces -x.
const T = 0.4;

// Rectangular room walls with door gaps. Sides: n (z0), s (z1), w (x0), e (x1). Gap c = centre along that wall.
export function rect(x0, z0, x1, z1, h, gaps = []) {
  const out = [];
  const run = (name, fixed, lo, hi, horiz) => {
    const gs = gaps.filter(g => g.s === name).map(g => [g.c - g.w / 2, g.c + g.w / 2]).sort((a, b) => a[0] - b[0]);
    let cur = lo;
    const seg = (a, b) => { if (b - a < 0.05) return; out.push(horiz ? { x: (a + b) / 2, z: fixed, w: b - a, d: T, h, k: 'wall' } : { x: fixed, z: (a + b) / 2, w: T, d: b - a, h, k: 'wall' }); };
    for (const [a, b] of gs) { seg(cur, a); cur = b; }
    seg(cur, hi);
  };
  run('n', z0, x0, x1, true); run('s', z1, x0, x1, true); run('w', x0, z0, z1, false); run('e', x1, z0, z1, false);
  return out;
}
export function line(x0, x1, z, h, gaps = []) {
  const out = []; let cur = x0;
  const gs = gaps.map(g => [g.c - g.w / 2, g.c + g.w / 2]).sort((a, b) => a[0] - b[0]);
  const seg = (a, b) => { if (b - a > 0.05) out.push({ x: (a + b) / 2, z, w: b - a, d: T, h, k: 'wall' }); };
  for (const [a, b] of gs) { seg(cur, a); cur = b; }
  seg(cur, x1);
  return out;
}
const P = (x, z, w, d, h, k) => ({ x, z, w, d, h, k });
const H = 4.2;

// Compact, fully connected story wings used for the three campaign chapters that were previously only planned.
// They deliberately reuse the existing Level/world/navigation/interaction pipeline rather than adding another scene system.
function storyWing({ id, name, env = 'indoor', fileX = -7, fileZ = -18, terminalId = 'storyTerminal', terminalPrompt = 'Inspect records', prop = 'tech', enemyRole = 'rifleman', extra = [] }) {
  return {
    id, name, env, surface: env === 'indoor' ? 'metal' : 'snow', ceil: H,
    bounds: { x0: -20, x1: 20, z0: -54, z1: 22 }, start: { x: 0, z: 14, yaw: 0 },
    walls: rect(-16, -42, 16, 14, H, [{ s: 'n', c: 0, w: 5 }, { s: 's', c: 0, w: 5 }]),
    surfaces: [],
    props: [P(-10, -6, 2.4, 1.4, 1.3, 'crate'), P(10, -9, 2.4, 1.4, 1.3, 'crate'), P(-9, -29, 2.4, 1.4, 1.3, 'crate'), P(9, -30, 2.4, 1.4, 1.3, 'crate'), P(0, -35, 3.2, 1.1, 2.4, prop)],
    doors: [], lights: [{ x: 0, y: 3.5, z: -8, c: 0x70c8ff, i: 0.9, d: 18 }, { x: 0, y: 3.5, z: -32, c: 0xffa05a, i: 0.8, d: 16, flicker: true }],
    groups: { security: [{ role: enemyRole, x: -4, z: -22, yaw: 0 }, { role: 'defender', x: 4, z: -31, yaw: Math.PI }] },
    startGroups: ['security'],
    interactables: [
      { id: terminalId, x: fileX, z: fileZ, r: 2.4, prompt: terminalPrompt, event: terminalId, vis: 'doc', once: true },
      ...extra,
    ],
    triggers: [{ id: 'entry', x: 0, z: 2, r: 5 }, { id: 'exit', x: 0, z: -48, r: 3, req: terminalId }],
    pickups: [{ x: 12, z: 5, t: 'ammo' }, { x: -12, z: -35, t: 'health' }],
    cps: [{ x: 0, z: 14, yaw: 0 }, { x: 0, z: -20, yaw: 0, skip: [] }],
  };
}
const archiveWing = storyWing({ id: 'c5', name: 'THE ARCHIVE', fileX: -7, fileZ: -17, terminalId: 'consentFile', terminalPrompt: 'Review Dana’s consent file', prop: 'tech', extra: [{ id: 'nightLog', x: 7, z: -26, r: 2, prompt: 'Read night guard log', event: 'nightLog', vis: 'doc', once: true }, { id: 'weaponCache', x: -12, z: -36, r: 2.4, prompt: 'Open archive weapon cache', event: 'weaponCache', vis: 'locker', once: true }] });
const quarantineWing = storyWing({ id: 'c6', name: 'QUARANTINE', fileX: 7, fileZ: -17, terminalId: 'volunteerList', terminalPrompt: 'Inspect volunteer list', prop: 'tech', enemyRole: 'defender', extra: [{ id: 'weaponLocker', x: -12, z: -35, r: 2.4, prompt: 'Open quarantine armory', event: 'weaponLocker', vis: 'locker', once: true }] });
const longNightWing = storyWing({ id: 'c7', name: 'THE LONG NIGHT', fileX: 0, fileZ: -34, terminalId: 'powerConsole', terminalPrompt: 'Restore emergency routing', prop: 'core', enemyRole: 'heavy' });

// Chapter 2 terrain: a long valley floor between two ridges, closed in by mountains to the north and south.
const valleyHeight = (x, z) => {
  const a = Math.abs(x), ridge = a < 55 ? 0 : Math.pow(Math.min(1, (a - 55) / 50), 1.6) * 38;
  const roll = 2.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.037) + 1.4 * Math.sin(z * 0.08 + x * 0.028);
  const north = z < -92 ? Math.pow(Math.min(1, (-92 - z) / 26), 1.5) * 30 : 0, south = z > 112 ? Math.pow(Math.min(1, (z - 112) / 8), 1.5) * 16 : 0;
  return 3 + ridge + roll + north + south;
};

export const LEVELS = [
  // ---------------------------------------------------------------- CHAPTER 1
  {
    id: 'c1', name: 'FROSTLINE', env: 'snow', forest: true, surface: 'snow',
    bounds: { x0: -30, x1: 30, z0: -60, z1: 26 }, start: { x: 0, z: 21, yaw: 0 },
    walls: rect(-9, -34, 9, -18, 4, [{ s: 's', c: 0, w: 3 }, { s: 'e', c: -26, w: 2.4 }]),
    surfaces: [{ x0: -9, x1: 9, z0: -34, z1: -18, t: 'metal' }],
    props: [
      P(-6, 20, 7, 3, 2.4, 'wreck'), P(9, 12, 2, 2, 1.3, 'crate'), P(10.8, 12.2, 1.4, 1.4, 1.3, 'crate'),
      P(-9, 6, 2, 1.6, 1.3, 'crate'), P(-10.5, 6, 1.4, 1.4, 1, 'crate'),
      P(-14, 0, 3.2, 2.6, 1.7, 'rock'), P(15, -6, 2.8, 2.2, 1.5, 'rock'), P(-18, -14, 2.6, 2.6, 1.6, 'rock'),
      P(14, -14, 2.4, 2, 1.4, 'rock'), P(0, -4, 2.6, 1.6, 1.3, 'rock'), P(4, 4, 0.8, 0.8, 1.1, 'barrel'),
      P(-6, -12, 0.8, 0.8, 6, 'tree'), P(7, -10, 0.8, 0.8, 6, 'tree'), P(-3, -44, 0.8, 0.8, 6, 'tree'),
      P(-6, -30, 2.4, 1.2, 1, 'tech'), P(5, -22, 1.5, 1.5, 1.2, 'crate'), P(0, -33.2, 2.4, 0.8, 1.4, 'tech'),
      P(-12, -42, 3, 2.4, 1.5, 'rock'), P(12, -44, 3, 2.4, 1.5, 'rock'),
    ],
    doors: [],
    lights: [{ x: 0, y: 3, z: -26, c: 0xff8a50, i: 1.3, d: 16 }],
    groups: {
      pa: [{ role: 'rifleman', x: -12, z: -4, yaw: 0, patrol: [[-12, -4], [-12, 8]] }, { role: 'rifleman', x: 12, z: -2, yaw: 0, patrol: [[12, -2], [12, 10]] }],
      in: [{ role: 'defender', x: -5, z: -24, yaw: Math.PI }, { role: 'rifleman', x: 5, z: -26, yaw: 0, patrol: [[5, -26], [5, -31], [-3, -31]] }],
      w2: [{ role: 'rifleman', x: -20, z: -54 }, { role: 'rifleman', x: 0, z: -54 }, { role: 'rifleman', x: 20, z: -54 }],
    },
    startGroups: ['pa', 'in'],
    interactables: [
      { id: 'transmitter', x: 0, z: -31.6, r: 2.4, prompt: 'Activate transmitter', event: 'transmitter', vis: 'transmitter', once: true },
      { id: 'warden', x: 2, z: -46, r: 2.4, prompt: 'Question the Warden', event: 'warden', vis: 'npc_warden', once: true, hidden: true },
    ],
    triggers: [
      { id: 'pw', x: 0, z: 6, r: 8 }, { id: 'enterOutpost', x: 0, z: -24, r: 3.5 },
      { id: 'exit', x: 0, z: -56, r: 3, req: 'warden' },
    ],
    pickups: [{ x: -5, z: 22, t: 'ammo' }, { x: 8, z: -26, t: 'health' }, { x: 4, z: -40, t: 'ammo' }],
    cps: [{ x: 0, z: 21, yaw: 0 }, { x: 0, z: -22, yaw: Math.PI, skip: ['pa', 'in'], spawn: ['w2'] }, { x: 0, z: -40, yaw: 0, skip: ['pa', 'in', 'w2'] }],
  },
  // ---------------------------------------------------------------- CHAPTER 2 (new): THE WHITE VALLEY
  // 240 x 240 m of rolling terrain. Two ways north: the valley road (checkpoint) or the ridge path (long, cold, one sniper).
  // The relay station on its hill is optional and changes chapter 3. Slopes steeper than ~37 deg block walking (natural cliffs).
  {
    id: 'v1', name: 'THE WHITE VALLEY', env: 'snow', forest: true, surface: 'snow', navCell: 1.5, indexed: true,
    bounds: { x0: -120, x1: 120, z0: -120, z1: 120 }, start: { x: 0, z: 108, yaw: 0 },
    weather: { fogMin: 0.011, fogMax: 0.03 },
    terrain: {
      res: 2, height: valleyHeight,
      flats: [{ x: -32, z: 42, r: 13, h: 3.8, blend: 8 }, { x: -2, z: -12, r: 11, h: 4.7, blend: 8 }, { x: 44, z: -30, r: 20, h: 14, blend: 12 }, { x: -52, z: -62, r: 11, h: 9, blend: 8 }],
      paths: [
        { w: 4, blend: 7, pts: [[0, 116, 2], [6, 95, 2.5], [10, 75, 3], [4, 55, 3.5], [-8, 35, 3.5], [-12, 15, 4], [-4, 0, 4.5], [0, -20, 5], [-6, -40, 5.5], [-18, -60, 6], [-10, -80, 6.5], [0, -100, 7], [0, -118, 7.5]] },
        { w: 3, blend: 6, pts: [[-8, 35, 3.6], [-30, 30, 4], [-50, 22, 4.5], [-65, 12, 8], [-75, 0, 12], [-82, -20, 16], [-82, -45, 16], [-70, -65, 12], [-50, -80, 7], [-25, -92, 7], [-4, -99, 7]] },
        { w: 3.5, blend: 6, pts: [[0, -20, 5], [18, -22, 7.5], [32, -26, 11], [44, -30, 14]] },
      ],
    },
    scatter: [{ k: 'tree', n: 260, seed: 5, rect: { x0: -105, x1: 105, z0: -112, z1: 112 } }],
    walls: [
      ...rect(8, -20, 18, -8, 3.2, [{ s: 'w', c: -14, w: 2.8 }]),
      ...rect(46, -42, 60, -30, 3.6, [{ s: 'w', c: -36, w: 2.8 }]),
      ...rect(-58, -70, -46, -56, 3.4, [{ s: 'e', c: -63, w: 2.8 }, { s: 'n', c: -52, w: 2.8 }]),
    ],
    surfaces: [{ x0: 46, x1: 60, z0: -42, z1: -30, t: 'metal' }, { x0: 8, x1: 18, z0: -20, z1: -8, t: 'wood' }, { x0: -58, x1: -46, z0: -70, z1: -56, t: 'metal' }],
    props: [
      // Warden field camp (flat at -32,42)
      P(-38, 37, 5, 4, 2.4, 'tent'), P(-27, 35, 5, 4, 2.4, 'tent'), P(-37, 49, 5, 4, 2.4, 'tent'), P(-26, 47, 2, 2, 1.3, 'crate'), P(-24, 48.6, 1.4, 1.4, 1.3, 'crate'),
      P(-19.5, 42, 3, 3, 2.2, 'tech'), P(-31, 41, 0.8, 0.8, 1.1, 'barrel'),
      // checkpoint on the road
      P(-8, -10, 7, 0.8, 1.3, 'crate'), P(6, -10, 7, 0.8, 1.3, 'crate'), P(-2, -18, 2.4, 2.4, 1.4, 'crate'), P(-14, -17, 2.4, 5, 1.6, 'wreck'),
      // relay station on the hill
      P(53, -40, 2.4, 1, 1.3, 'tech'), P(62, -36, 2, 2, 14, 'tech'), P(36, -22, 2.6, 1.4, 1.3, 'crate'), P(34, -38, 3, 2.4, 1.6, 'rock'), P(52, -24, 2.6, 1.4, 1.3, 'crate'),
      // buried outpost rubble
      P(-52, -60, 2.4, 2, 1.4, 'rock'), P(-47, -66, 2, 2, 1.2, 'rock'),
      // wrecks along the road, boulders for cover
      P(16, 70, 2.2, 4.6, 1.5, 'wreck'), P(-6, 58, 4.6, 2.2, 1.5, 'wreck'), P(10, -48, 4.6, 2.2, 1.5, 'wreck'),
      P(22, 85, 3.4, 2.6, 2.2, 'rock'), P(-24, 72, 3, 3, 2, 'rock'), P(24, 40, 3.6, 2.8, 2.2, 'rock'), P(30, 10, 3.4, 2.6, 2, 'rock'), P(-26, 2, 3, 3, 2, 'rock'),
      P(26, -50, 3.4, 2.6, 2, 'rock'), P(-30, -35, 3, 2.8, 2, 'rock'), P(-26, -74, 3, 3, 2.2, 'rock'), P(14, -72, 3.4, 2.6, 2, 'rock'), P(-70, -8, 3, 3, 2.4, 'rock'),
    ],
    doors: [],
    lights: [{ x: -31, y: 6.3, z: 42, c: 0xffa050, i: 1.4, d: 24 }, { x: 50, y: 18, z: -36, c: 0x70d0ff, i: 1.2, d: 22 }, { x: 0, y: 8.7, z: -14, c: 0xffffff, i: 1.1, d: 24 }],
    groups: {
      camp: [
        { role: 'rifleman', x: -34, z: 36, yaw: 0, patrol: [[-34, 36], [-24, 38], [-28, 50]] }, { role: 'rifleman', x: -30, z: 44, yaw: 0 },
        { role: 'defender', x: -22, z: 44, yaw: Math.PI / 2 }, { role: 'rifleman', x: -41, z: 44, yaw: 0, patrol: [[-41, 44], [-41, 53]] },
      ],
      chk: [
        { role: 'defender', x: 0, z: -14, yaw: Math.PI }, { role: 'rifleman', x: -6, z: -12, yaw: Math.PI }, { role: 'rifleman', x: 6, z: -12, yaw: Math.PI }, { role: 'rifleman', x: 13, z: -14, yaw: Math.PI / 2 },
      ],
      ridge: [{ role: 'defender', x: -82, z: -30, yaw: Math.PI }],
      stn: [
        { role: 'heavy', x: 40, z: -22, yaw: Math.PI }, { role: 'rifleman', x: 34, z: -34, yaw: 0, patrol: [[34, -34], [34, -20]] }, { role: 'rifleman', x: 54, z: -26, yaw: 0, patrol: [[54, -26], [40, -26]] },
      ],
      bur: [{ role: 'rifleman', x: -43, z: -60, yaw: 0, patrol: [[-43, -60], [-43, -68]] }, { role: 'rifleman', x: -56, z: -62, yaw: Math.PI / 2 }],
      rein: [{ role: 'rifleman', x: -3, z: -110 }, { role: 'rifleman', x: 0, z: -113 }, { role: 'rifleman', x: 3, z: -110 }],
    },
    startGroups: ['camp', 'chk', 'ridge', 'stn', 'bur'],
    interactables: [
      { id: 'campLog', x: -30, z: 44.8, r: 2, prompt: 'Read field log', event: 'campLog', vis: 'doc', once: true },
      { id: 'cache', x: -18.5, z: 44.5, r: 2.4, prompt: 'Open supply cache', event: 'cache', vis: 'cache', once: true, hidden: true },
      { id: 'buriedDoc', x: -52, z: -64, r: 2, prompt: 'Play recording', event: 'buriedDoc', vis: 'doc', once: true },
      { id: 'stationTerm', x: 53, z: -38, r: 2.4, prompt: 'Restore relay link', event: 'station', vis: 'terminal', once: true },
    ],
    triggers: [
      { id: 'sawCamp', x: -32, z: 42, r: 28 }, { id: 'chkNear', x: 0, z: -4, r: 24 }, { id: 'northRoad', x: 0, z: -100, r: 10 },
      { id: 'exit', x: 0, z: -116, r: 4, req: 'northRoad' },
    ],
    pickups: [{ x: 6, z: 100, t: 'ammo' }, { x: -10, z: 30, t: 'health' }, { x: 2, z: -30, t: 'ammo' }, { x: 38, z: -34, t: 'health' }, { x: -82, z: -25, t: 'ammo' }, { x: -70, z: -64, t: 'health' }],
    cps: [{ x: 0, z: 108, yaw: 0 }, { x: -10, z: 10, yaw: 0, skip: ['camp'] }, { x: 32, z: -26, yaw: Math.PI / 2, skip: ['camp', 'stn'] }],
  },
  // ---------------------------------------------------------------- CHAPTER 3 (was 2): KALDER RIDGE
  {
    id: 'c2', name: 'KALDER RIDGE', env: 'dusk', forest: true, surface: 'snow',
    bounds: { x0: -34, x1: 34, z0: -56, z1: 30 }, start: { x: 0, z: 26, yaw: 0 },
    walls: [
      ...rect(-24, 12, -10, 26, 3.6, [{ s: 'e', c: 19, w: 2.2 }]), ...rect(10, 14, 26, 28, 3.6, [{ s: 'w', c: 21, w: 2.2 }]),
      ...rect(-26, -16, -10, 0, 3.6, [{ s: 'e', c: -8, w: 2.2 }]), ...rect(10, -22, 26, -6, 3.6, [{ s: 'w', c: -14, w: 2.2 }]),
      ...line(-34, 34, -44, 3.6, [{ c: 0, w: 4 }, { c: -29, w: 2 }]),
    ],
    surfaces: [{ x0: -24, x1: -10, z0: 12, z1: 26, t: 'wood' }, { x0: 10, x1: 26, z0: 14, z1: 28, t: 'wood' }, { x0: -26, x1: -10, z0: -16, z1: 0, t: 'wood' }, { x0: 10, x1: 26, z0: -22, z1: -6, t: 'metal' }],
    props: [
      P(-4, 4, 2.2, 4.6, 1.5, 'wreck'), P(6, -12, 2.2, 4.6, 1.5, 'wreck'), P(-6, -26, 4.6, 2.2, 1.5, 'wreck'), P(8, -30, 4.6, 2.2, 1.5, 'wreck'),
      P(-7, -38, 6, 0.7, 1.3, 'crate'), P(7, -38, 6, 0.7, 1.3, 'crate'), P(3, 18, 1.6, 1.6, 1.3, 'crate'),
      P(-17, 18, 2, 1.2, 1, 'crate'), P(-18, -8, 2, 1.2, 1, 'crate'), P(18, 22, 2, 1.2, 1, 'crate'), P(22, -14, 1.4, 1.4, 1.1, 'tech'),
      P(-20, 4, 0.8, 0.8, 6, 'tree'), P(20, 6, 0.8, 0.8, 6, 'tree'), P(-14, -30, 3, 2.4, 1.6, 'rock'),
    ],
    doors: [{ id: 'mineGate', x: 0, z: -44, w: 4, d: 0.5, h: 3.4, locked: true }, { id: 'sideDoor', x: -29, z: -44, w: 2, d: 0.5, h: 3.4, locked: true }],
    lights: [{ x: -17, y: 2.8, z: 19, c: 0xffb060, i: 1.1, d: 12 }, { x: 18, y: 2.8, z: 21, c: 0xffb060, i: 1.1, d: 12 }, { x: -18, y: 2.8, z: -8, c: 0xffa050, i: 1, d: 12 }, { x: 0, y: 4, z: -40, c: 0xff4040, i: 1.2, d: 18 }],
    groups: {
      st: [{ role: 'rifleman', x: -3, z: 10, yaw: 0, patrol: [[-3, 10], [-3, -20]] }, { role: 'rifleman', x: 4, z: -4, yaw: 0, patrol: [[4, -4], [4, 14]] }],
      arm: [{ role: 'defender', x: 14, z: -12, yaw: Math.PI / 2 }],
      gate: [{ role: 'defender', x: -6, z: -41, yaw: Math.PI }, { role: 'rifleman', x: 6, z: -41, yaw: Math.PI }, { role: 'rifleman', x: -10, z: -32, yaw: 0, patrol: [[-10, -32], [10, -34]] }],
    },
    startGroups: ['st', 'arm', 'gate'],
    interactables: [
      { id: 'roster', x: -20, z: 22, r: 2, prompt: 'Read evacuation roster', event: 'roster', vis: 'doc', once: true },
      { id: 'log', x: 21, z: 24, r: 2, prompt: 'Read foreman log', event: 'log', vis: 'doc', once: true },
      { id: 'seal', x: -22, z: -12, r: 2, prompt: 'Read seal order', event: 'seal', vis: 'doc', once: true },
      { id: 'keycard', x: -14, z: -3, r: 2, prompt: 'Take keycard', event: 'keycard', vis: 'keycard', once: true },
      { id: 'armory', x: 22, z: -12.4, r: 2, prompt: 'Open weapon locker', event: 'armory', vis: 'locker', once: true },
    ],
    triggers: [{ id: 'street', x: 0, z: 12, r: 6 }, { id: 'exit2', x: 0, z: -52, r: 2.5 }],
    pickups: [{ x: -18, z: 20, t: 'health' }, { x: 20, z: 26, t: 'ammo' }, { x: -22, z: -4, t: 'ammo' }, { x: 16, z: -20, t: 'ammo' }, { x: 0, z: -30, t: 'health' }],
    cps: [{ x: 0, z: 26, yaw: 0 }, { x: -14, z: -4, yaw: Math.PI, skip: ['st'] }],
  },
  // ---------------------------------------------------------------- CHAPTER 4 (new): UNDER THE RAILS
  // Dispatch office -> rail depot (4 sub-spaces). Two ways to the service lift: the Kessel pass opens the short spur, otherwise
  // you cross the guarded pump room. Quiet corridor first, one big depot fight, one optional-to-avoid encounter.
  {
    id: 'b2', name: 'UNDER THE RAILS', env: 'indoor', surface: 'metal', ceil: H,
    bounds: { x0: -40, x1: 40, z0: -110, z1: 24 }, start: { x: 0, z: 18, yaw: 0 },
    walls: [
      ...rect(-4, -34, 4, 20, H, [{ s: 'n', c: 0, w: 8 }, { s: 'e', c: -10, w: 2.8 }]),
      ...rect(4, -20, 16, -2, H, [{ s: 'w', c: -10, w: 2.8 }]),
      ...rect(-24, -72, 24, -34, H, [{ s: 's', c: 0, w: 8 }, { s: 'n', c: 12, w: 2.8 }, { s: 'n', c: -14, w: 2.8 }]),
      ...rect(8, -84, 16, -72, H, [{ s: 's', c: 12, w: 2.8 }, { s: 'n', c: 12, w: 2.8 }]),
      ...rect(-34, -84, -8, -72, H, [{ s: 's', c: -14, w: 2.8 }, { s: 'n', c: -30, w: 2.8 }]),
      ...rect(-32, -104, 16, -84, H, [{ s: 's', c: -30, w: 2.8 }, { s: 's', c: 12, w: 2.8 }]),
    ],
    surfaces: [{ x0: 4, x1: 16, z0: -20, z1: -2, t: 'wood' }],
    props: [
      P(-2.5, 6, 1.4, 1.4, 1.2, 'crate'), P(2.4, -16, 1.4, 1.4, 1.2, 'crate'), P(10, -6, 4, 1.4, 1, 'tech'), P(14, -15, 1.4, 1.4, 1.2, 'crate'),
      P(-12, -52, 3, 9, 1.8, 'wreck'), P(12, -52, 3, 9, 1.8, 'wreck'), P(0, -44, 10, 1.6, 1.4, 'crate'), P(-20, -62, 2.6, 1.4, 1.3, 'crate'), P(20, -40, 2.6, 1.4, 1.3, 'crate'),
      P(-6, -62, 1.4, 1.4, H, 'wall'), P(6, -62, 1.4, 1.4, H, 'wall'),
      P(-26, -78, 3, 3, 2, 'tech'), P(-18, -78, 3, 3, 2, 'tech'), P(-30, -74, 2.6, 1.4, 1.3, 'crate'),
      P(0, -103, 6, 1.5, 3, 'tech'), P(-12, -96, 2.6, 1.4, 1.3, 'crate'),
    ],
    doors: [{ id: 'railGate', x: 12, z: -78, w: 7.6, d: 0.6, h: H, locked: true }],
    lights: [
      { x: 0, y: 3.6, z: 10, c: 0x8fd0ff, i: 1.1, d: 16, flicker: true }, { x: 10, y: 3.4, z: -10, c: 0xffb070, i: 1, d: 12 }, { x: 0, y: 3.8, z: -28, c: 0xff4050, i: 1, d: 14 },
      { x: -12, y: 3.8, z: -46, c: 0x9fc8ff, i: 1.3, d: 22 }, { x: 12, y: 3.8, z: -62, c: 0xffa860, i: 1.2, d: 22 }, { x: -24, y: 3.4, z: -78, c: 0x70ffd0, i: 1, d: 16, flicker: true },
      { x: 12, y: 3.4, z: -78, c: 0xff4040, i: 0.8, d: 10 }, { x: 0, y: 3.6, z: -94, c: 0x60b0ff, i: 1.4, d: 18 },
    ],
    groups: {
      ent: [{ role: 'rifleman', x: 0, z: -24, yaw: Math.PI }],
      dep: [
        { role: 'defender', x: 0, z: -50, yaw: Math.PI }, { role: 'rifleman', x: -14, z: -40, yaw: Math.PI, patrol: [[-14, -40], [14, -40]] },
        { role: 'rifleman', x: 17, z: -60, yaw: Math.PI / 2 }, { role: 'rifleman', x: -18, z: -66, yaw: 0, patrol: [[-18, -66], [-18, -50]] },
      ],
      pump: [{ role: 'defender', x: -30, z: -80, yaw: -Math.PI / 2 }, { role: 'rifleman', x: -12, z: -78, yaw: Math.PI, patrol: [[-12, -78], [-24, -82]] }, { role: 'rifleman', x: -22, z: -74, yaw: Math.PI }],
      cart: [{ role: 'rifleman', x: -20, z: -38 }, { role: 'rifleman', x: 20, z: -38 }, { role: 'rifleman', x: 18, z: -44 }],
    },
    startGroups: ['ent', 'dep', 'pump'],
    interactables: [
      { id: 'dispatchLog', x: 6, z: -14, r: 2, prompt: 'Read dispatch log', event: 'dispatchLog', vis: 'doc', once: true },
      { id: 'dispatch', x: 14, z: -3.5, r: 2.4, prompt: 'Use dispatcher panel', event: 'dispatch', vis: 'terminal', once: true },
      { id: 'supportLocker', x: 20, z: -48, r: 2.4, prompt: 'Open support weapon locker', event: 'supportLocker', vis: 'locker', once: true },
      { id: 'lift', x: 0, z: -99, r: 2.6, prompt: 'Call the service lift', event: 'lift', vis: 'terminal', once: true },
    ],
    triggers: [{ id: 'enterDepot', x: 0, z: -36, r: 5 }, { id: 'enterLift', x: 0, z: -90, r: 5 }],
    pickups: [{ x: 2, z: 10, t: 'ammo' }, { x: -2, z: -30, t: 'health' }, { x: 14, z: -18, t: 'health' }, { x: 6, z: -4, t: 'ammo' }, { x: -20, z: -58, t: 'ammo' }, { x: 20, z: -44, t: 'health' }, { x: -30, z: -82, t: 'ammo' }, { x: 8, z: -96, t: 'health' }],
    cps: [{ x: 0, z: 18, yaw: 0 }, { x: 0, z: -32, yaw: 0, skip: ['ent'] }, { x: 0, z: -90, yaw: 0, skip: ['ent', 'dep', 'pump', 'cart'] }],
  },
  // ---------------------------------------------------------------- CHAPTER 5 (was 3): THE DESCENT
  {
    id: 'c3', name: 'THE DESCENT', env: 'indoor', surface: 'metal', ceil: H,
    bounds: { x0: -32, x1: 32, z0: -74, z1: 22 }, start: { x: 0, z: 18, yaw: 0 },
    walls: [
      ...rect(-4, -32, 4, 20, H, [{ s: 'n', c: 0, w: 8 }, { s: 'w', c: -12, w: 2.6 }, { s: 'e', c: -12, w: 2.6 }]),
      ...rect(-20, -22, -4, -2, H, [{ s: 'e', c: -12, w: 2.6 }]), ...rect(4, -22, 20, -2, H, [{ s: 'w', c: -12, w: 2.6 }]),
      ...rect(-18, -62, 18, -32, H, [{ s: 's', c: 0, w: 8 }, { s: 'n', c: 0, w: 4 }, { s: 'e', c: -46, w: 2.6 }]),
      ...rect(18, -54, 30, -38, H, [{ s: 'w', c: -46, w: 2.6 }]), ...rect(-8, -72, 8, -62, H, [{ s: 's', c: 0, w: 4 }]),
    ],
    surfaces: [],
    props: [
      P(-2.5, 6, 1.4, 1.4, 1.2, 'crate'), P(2.4, -8, 1.4, 1.4, 1.2, 'crate'), P(-2.6, -22, 1.4, 1.4, 1.2, 'crate'),
      P(-12, -8, 3, 1.2, 1, 'tech'), P(-12, -16, 3, 1.2, 1, 'tech'), P(8, -6, 2.4, 0.9, 1.1, 'crate'), P(8, -18, 2.4, 0.9, 1.1, 'crate'), P(15, -12, 2, 2, 1, 'crate'),
      P(-9, -42, 1.4, 1.4, H, 'wall'), P(9, -42, 1.4, 1.4, H, 'wall'), P(-9, -54, 1.4, 1.4, H, 'wall'), P(9, -54, 1.4, 1.4, H, 'wall'),
      P(0, -47, 6, 1, 1.2, 'tech'), P(-13, -48, 2.6, 1.4, 1.2, 'crate'), P(13, -50, 2.6, 1.4, 1.2, 'crate'), P(5, -37, 2.4, 1.2, 1.2, 'crate'),
      P(0, -69, 2, 1, 1.3, 'tech'), P(24, -46, 1.6, 1, 0.9, 'crate'),
    ],
    doors: [{ id: 'cell', x: 18, z: -46, w: 0.6, d: 2.6, h: H, locked: true }],
    lights: [
      { x: 0, y: 3.6, z: 14, c: 0x8fd0ff, i: 1.2, d: 16, flicker: true }, { x: 0, y: 3.6, z: -4, c: 0xffb070, i: 1, d: 14 }, { x: 0, y: 3.6, z: -24, c: 0xff4050, i: 1.1, d: 14, flicker: true },
      { x: -12, y: 3.4, z: -12, c: 0x70ffd0, i: 1, d: 12 }, { x: 12, y: 3.4, z: -12, c: 0xffa860, i: 0.9, d: 12 },
      { x: 0, y: 3.8, z: -40, c: 0x9fc8ff, i: 1.3, d: 22 }, { x: 0, y: 3.8, z: -54, c: 0xff6040, i: 1.2, d: 22, flicker: true },
      { x: 24, y: 3.4, z: -46, c: 0xffffff, i: 0.8, d: 10 }, { x: 0, y: 3.4, z: -67, c: 0x60b0ff, i: 1.6, d: 12 },
    ],
    groups: {
      cor: [{ role: 'rifleman', x: 0, z: -22, yaw: 0, patrol: [[0, -22], [0, 8]] }],
      tip: [{ role: 'rifleman', x: -2, z: -4 }, { role: 'rifleman', x: 2, z: -6 }],   // only spawned when the player trusted Kessel's pass in chapter 4
      bar: [{ role: 'rifleman', x: 14, z: -16, yaw: Math.PI / 2 }],
      hall: [
        { role: 'heavy', x: 0, z: -56, yaw: Math.PI }, { role: 'defender', x: 12, z: -58, yaw: Math.PI },
        { role: 'rifleman', x: -12, z: -40, yaw: 0, patrol: [[-12, -40], [-12, -56]] }, { role: 'rifleman', x: 12, z: -40, yaw: 0, patrol: [[12, -40], [12, -53]] },
      ],
    },
    startGroups: ['cor', 'bar', 'hall'],
    interactables: [
      { id: 'lab', x: -12, z: -6.4, r: 2, prompt: 'Read lab note', event: 'lab', vis: 'doc', once: true },
      { id: 'cellPanel', x: 16.6, z: -43.6, r: 2.4, prompt: 'Open cell door', event: 'cellPanel', vis: 'panel', once: true, hidden: true },
      { id: 'terminal', x: 0, z: -70.4, r: 2.4, prompt: 'Use VEIL terminal', event: 'terminal', vis: 'terminal', once: true, hidden: true },
      { id: 'fieldLocker', x: -14, z: -58, r: 2.4, prompt: 'Open field weapon locker', event: 'fieldLocker', vis: 'locker', once: true },
    ],
    npcs: [{ type: 'kessel', x: 24, z: -46, yaw: Math.PI / 2 }],
    triggers: [{ id: 'enterHall', x: 0, z: -30, r: 4 }, { id: 'exit', x: 0, z: -72, r: 3, req: 'terminal' }],
    pickups: [{ x: -16, z: -4, t: 'health' }, { x: 16, z: -4, t: 'ammo' }, { x: -16, z: -20, t: 'ammo' }, { x: -14, z: -58, t: 'health' }, { x: 3, z: 10, t: 'ammo' }],
    cps: [{ x: 0, z: 18, yaw: 0 }, { x: 0, z: -29, yaw: 0, skip: ['cor', 'bar'] }, { x: 14, z: -44, yaw: Math.PI / 2, skip: ['cor', 'bar', 'hall'] }],
  },
  // Chapters VI–VIII: previously planned wings, now connected to the same runtime pipeline.
  archiveWing,
  quarantineWing,
  longNightWing,
  // ---------------------------------------------------------------- CHAPTER 6 (was 4): BLACK VEIL
  {
    id: 'c4', name: 'BLACK VEIL', env: 'indoor', surface: 'metal', ceil: 5,
    bounds: { x0: -32, x1: 32, z0: -74, z1: 22 }, start: { x: 0, z: 18, yaw: 0 },
    walls: [
      ...rect(-8, -30, 8, 20, 5, [{ s: 'n', c: 0, w: 6 }, { s: 'w', c: -12, w: 2.2 }]), ...rect(-20, -16, -8, -8, 5, [{ s: 'e', c: -12, w: 2.2 }]),
      ...rect(-22, -66, 22, -30, 5, [{ s: 's', c: 0, w: 6 }]),
    ],
    surfaces: [],
    props: [
      P(-4.5, 6, 1.6, 1.6, 1.2, 'crate'), P(4.5, -6, 1.6, 1.6, 1.2, 'crate'), P(-4, -20, 1.6, 1.6, 1.2, 'crate'), P(4, -22, 1.6, 1.6, 1.2, 'crate'),
      P(0, -48, 3.2, 3.2, 5, 'core'), P(-10, -40, 1.4, 1.4, 5, 'wall'), P(10, -40, 1.4, 1.4, 5, 'wall'), P(-10, -56, 1.4, 1.4, 5, 'wall'), P(10, -56, 1.4, 1.4, 5, 'wall'),
      P(-6, -36, 2.6, 1.2, 1.2, 'crate'), P(6, -36, 2.6, 1.2, 1.2, 'crate'), P(-15, -48, 2.6, 1.4, 1.2, 'crate'), P(15, -48, 2.6, 1.4, 1.2, 'crate'),
      P(-6, -60, 2.6, 1.2, 1.2, 'tech'), P(6, -60, 2.6, 1.2, 1.2, 'tech'),
    ],
    doors: [{ id: 'sideDoor4', x: -8, z: -12, w: 0.6, d: 2.2, h: 5, locked: true }],
    lights: [
      { x: 0, y: 4, z: 12, c: 0x8fd0ff, i: 1.1, d: 16, flicker: true }, { x: 0, y: 4, z: -8, c: 0xffa060, i: 1, d: 14 }, { x: 0, y: 4, z: -24, c: 0xff4050, i: 1.1, d: 14, flicker: true },
      { x: 0, y: 3.5, z: -48, c: 0x6fb0ff, i: 2.4, d: 34 }, { x: -14, y: 4, z: -40, c: 0xff5040, i: 1, d: 18 }, { x: 14, y: 4, z: -58, c: 0xff5040, i: 1, d: 18 }, { x: -14, y: 3.4, z: -12, c: 0xa0ffd0, i: 1, d: 10 },
    ],
    groups: {
      app: [{ role: 'rifleman', x: 0, z: -18, yaw: 0, patrol: [[0, -18], [0, 4]] }, { role: 'rifleman', x: -4, z: -26, yaw: Math.PI }, { role: 'defender', x: 5, z: -10, yaw: Math.PI }],
      fin1: [
        { role: 'defender', x: -14, z: -42, yaw: Math.PI }, { role: 'defender', x: 14, z: -42, yaw: Math.PI },
        { role: 'rifleman', x: -12, z: -60, yaw: 0, patrol: [[-12, -60], [12, -60]] }, { role: 'heavy', x: 0, z: -63, yaw: Math.PI },
      ],
      amb: [{ role: 'rifleman', x: -18, z: -58 }, { role: 'rifleman', x: 18, z: -58 }, { role: 'rifleman', x: 0, z: -62 }],
    },
    startGroups: ['app', 'fin1'],
    interactables: [{ id: 'core', x: 0, z: -45, r: 3, prompt: 'Access VEIL core', event: 'core', vis: 'terminal', once: true, hidden: true }],
    triggers: [{ id: 'enterCore', x: 0, z: -32, r: 3.5 }],
    pickups: [{ x: -16, z: -12, t: 'health' }, { x: -14, z: -10, t: 'health' }, { x: -16, z: -14, t: 'ammo' }, { x: 6, z: 2, t: 'ammo' }, { x: 6, z: -14, t: 'health' }],
    cps: [{ x: 0, z: 18, yaw: 0 }, { x: 0, z: -30, yaw: 0, skip: ['app'] }],
  },
];
