// Pure geometry helpers shared by player, enemies and tests (no THREE / DOM).
// Boxes: {x,z,w,d,h,y0?} = centre on XZ plane, width(x), depth(z), thickness h starting at base elevation y0 (default 0).
// A boxes array may carry `.index` (SpatialIndex) and `.terrain` (Terrain); every query below honours them automatically.
export const TERRAIN_HIT = { terrain: true, k: 'snow', x: 0, z: 0, w: 0, d: 0, h: 0 };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function rayAABB(o, d, b, maxT = Infinity) {
  const y0 = b.y0 || 0, mn = [b.x - b.w / 2, y0, b.z - b.d / 2], mx = [b.x + b.w / 2, y0 + b.h, b.z + b.d / 2];
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  let t0 = 0, t1 = maxT;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < mn[i] || oo[i] > mx[i]) return null; continue; }
    let a = (mn[i] - oo[i]) / dd[i], c = (mx[i] - oo[i]) / dd[i];
    if (a > c) { const t = a; a = c; c = t; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return null;
  }
  return t0;
}

export function rayWorld(o, d, boxes, maxT = Infinity) {
  const lim = Math.min(maxT, 260), list = boxes.index ? boxes.index.alongRay(o, d, lim) : boxes;
  let best = maxT, hit = null;
  for (const b of list) { const t = rayAABB(o, d, b, best); if (t !== null && t < best) { best = t; hit = b; } }
  if (boxes.terrain) { const tt = boxes.terrain.rayHit(o, d, Math.min(best, lim)); if (tt !== null && tt < best) { best = tt; hit = TERRAIN_HIT; } }
  return hit ? { t: best, box: hit } : null;
}

// True when nothing solid lies between a and b (points are {x,y,z}).
export function losClear(a, b, boxes) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const L = Math.hypot(d.x, d.y, d.z);
  if (L < 1e-6) return true;
  d.x /= L; d.y /= L; d.z /= L;
  return !rayWorld(a, d, boxes, L - 0.01);
}

export function circleBlocked(x, z, r, boxes) {
  const test = b => !(b.h < 0.4 || b.pass) && x > b.x - b.w / 2 - r && x < b.x + b.w / 2 + r && z > b.z - b.d / 2 - r && z < b.z + b.d / 2 + r;
  if (boxes.index) return boxes.index.nearAny(x, z, test);
  for (const b of boxes) if (test(b)) return true;
  return false;
}

// Slides a circle (p has x,z) with axis-separated collision; keeps it inside bounds {x0,x1,z0,z1}.
// `walk(x,z)` (optional) rejects positions, e.g. slopes that are too steep.
export function moveCircle(p, dx, dz, r, boxes, bounds, walk = null) {
  const ok = (x, z) => x > bounds.x0 + r && x < bounds.x1 - r && z > bounds.z0 + r && z < bounds.z1 - r && !circleBlocked(x, z, r, boxes) && (!walk || walk(x, z));
  // Sub-step so a long frame (or a fast mover) can never tunnel through a thin wall.
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2)), sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) {
    const nx = p.x + sx; if (ok(nx, p.z)) p.x = nx;
    const nz = p.z + sz; if (ok(p.x, nz)) p.z = nz;
  }
}
