// Builds the collision/navigation world of a level from its data: terrain, placed walls/props/doors, scattered trees,
// spatial index and nav grid. Shared by Level (rendering) and the tests, so tests exercise the real geometry.
import { Terrain, segDist } from './terrain.js';
import { SpatialIndex } from './spatial.js';
import { NavGrid } from './nav.js';
export const SLOPE_MAX = 0.75;   // ~37 degrees: steeper ground blocks walking (natural cliffs, no invisible walls)
const lcg = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;

// On terrain, a box without y0 is dropped onto the ground: its base goes to the lowest corner (so it never floats).
function place(b, terr) {
  const o = { ...b, h0: b.h };
  if (!terr || b.y0 !== undefined) return o;
  const hw = b.w / 2, hd = b.d / 2, hs = [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]].map(([a, c]) => terr.heightAt(b.x + a, b.z + c));
  const lo = Math.min(...hs) - 0.25; o.y0 = lo; o.h = b.h + (hs[0] - lo); return o;
}
export const walkableFn = terr => (terr ? (x, z) => terr.slopeAt(x, z) <= SLOPE_MAX : null);

export function buildWorld(def, { doors = 'closed' } = {}) {
  const terrain = def.terrain ? new Terrain(def.terrain, def.bounds) : null;
  const walls = def.walls.map(b => place(b, terrain)), props = def.props.map(b => place(b, terrain));
  const doorList = def.doors.map(d => ({ def: d, box: place({ x: d.x, z: d.z, w: d.w, d: d.d, h: d.h, k: 'door', id: d.id }, terrain) }));
  const scatter = [];
  for (const s of def.scatter || []) {
    const rnd = lcg(s.seed || 1); let n = 0, guard = 0;
    while (n < s.n && guard++ < s.n * 80) {
      const x = s.rect.x0 + rnd() * (s.rect.x1 - s.rect.x0), z = s.rect.z0 + rnd() * (s.rect.z1 - s.rect.z0);
      if (!treeOk(def, terrain, scatter, x, z)) continue;
      const h = terrain ? terrain.heightAt(x, z) : 0; scatter.push({ k: s.k, x, z, h, box: { x, z, w: 0.8, d: 0.8, y0: h - 0.3, h: 6.3, h0: 6.3, k: 'tree' } }); n++;
    }
  }
  const blockers = [...walls, ...props, ...scatter.map(s => s.box)];
  if (doors === 'closed') for (const d of doorList) blockers.push(d.box);
  blockers.terrain = terrain; if (terrain || def.indexed) blockers.index = new SpatialIndex(blockers, 8);
  const covers = props.filter(p => p.h0 >= 1.2 && Math.max(p.w, p.d) >= 1.2 && p.k !== 'tree');
  return { terrain, walls, props, doors: doorList, scatter, blockers, covers };
}
function treeOk(def, terr, placed, x, z) {
  const near = (px, pz, r) => Math.hypot(x - px, z - pz) < r;
  if (near(def.start.x, def.start.z, 10)) return false;
  for (const c of def.cps || []) if (near(c.x, c.z, 5)) return false;
  for (const o of [...(def.interactables || []), ...(def.triggers || []), ...(def.pickups || [])]) if (near(o.x, o.z, 3.5 + (o.r || 0) * 0.3)) return false;
  for (const g of Object.values(def.groups || {})) for (const e of g) { if (near(e.x, e.z, 3.5)) return false; for (const [px, pz] of e.patrol || []) if (near(px, pz, 3)) return false; }
  const ts = def.terrain || {};
  for (const p of ts.paths || []) for (let k = 0; k < p.pts.length - 1; k++) if (segDist(x, z, p.pts[k][0], p.pts[k][1], p.pts[k + 1][0], p.pts[k + 1][1]).d < p.w + 4) return false;
  for (const f of ts.flats || []) if (near(f.x, f.z, f.r + 3)) return false;
  for (const b of [...def.walls, ...def.props]) if (Math.abs(x - b.x) < b.w / 2 + 2.5 && Math.abs(z - b.z) < b.d / 2 + 2.5) return false;
  if (terr && terr.slopeAt(x, z) > 0.7) return false;
  for (const t of placed) if (Math.hypot(x - t.x, z - t.z) < 3) return false;
  return true;
}
export function makeNav(def, blockers, terrain) { return new NavGrid(blockers, def.bounds, def.navCell || 1, 0.45, walkableFn(terrain)); }
export function removeBlocker(blockers, b) { const i = blockers.indexOf(b); if (i >= 0) blockers.splice(i, 1); if (blockers.index) blockers.index.remove(b); }
