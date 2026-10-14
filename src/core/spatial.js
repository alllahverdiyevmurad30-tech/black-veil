// Uniform-grid spatial index for axis-aligned boxes: keeps collision and ray queries fast on large maps (pure, unit-tested).
const EMPTY = [];
export class SpatialIndex {
  constructor(boxes, cell = 8) { this.cell = cell; this.map = new Map(); for (const b of boxes) this.add(b); }
  key(i, j) { return (i + 2048) * 4096 + (j + 2048); }
  cells(b, f) {
    const c = this.cell, p = 0.02;
    for (let i = Math.floor((b.x - b.w / 2 - p) / c); i <= Math.floor((b.x + b.w / 2 + p) / c); i++) for (let j = Math.floor((b.z - b.d / 2 - p) / c); j <= Math.floor((b.z + b.d / 2 + p) / c); j++) f(this.key(i, j));
  }
  add(b) { this.cells(b, k => { let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(b); }); }
  remove(b) { this.cells(b, k => { const a = this.map.get(k); if (a) { const i = a.indexOf(b); if (i >= 0) a.splice(i, 1); } }); }
  // true when fn(box) is true for any box in the 3x3 cells around (x,z)
  nearAny(x, z, fn) {
    const i0 = Math.floor(x / this.cell), j0 = Math.floor(z / this.cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const a = this.map.get(this.key(i, j)) || EMPTY; for (let n = 0; n < a.length; n++) if (fn(a[n])) return true; }
    return false;
  }
  // boxes in every grid cell the XZ projection of the ray passes through (Amanatides-Woo traversal), de-duplicated
  alongRay(o, d, maxT) {
    const c = this.cell, ex = o.x + d.x * maxT, ez = o.z + d.z * maxT, dx = ex - o.x, dz = ez - o.z, out = [], seen = new Set();
    let i = Math.floor(o.x / c), j = Math.floor(o.z / c); const ei = Math.floor(ex / c), ej = Math.floor(ez / c), sx = Math.sign(dx), sz = Math.sign(dz);
    const tDx = dx ? c / Math.abs(dx) : Infinity, tDz = dz ? c / Math.abs(dz) : Infinity;
    let tx = dx ? ((sx > 0 ? (i + 1) * c - o.x : o.x - i * c) / Math.abs(dx)) : Infinity, tz = dz ? ((sz > 0 ? (j + 1) * c - o.z : o.z - j * c) / Math.abs(dz)) : Infinity;
    for (let n = 0; n < 8192; n++) {
      const a = this.map.get(this.key(i, j)); if (a) for (const b of a) if (!seen.has(b)) { seen.add(b); out.push(b); }
      if (i === ei && j === ej) break;
      if (tx < tz) { i += sx; tx += tDx; } else { j += sz; tz += tDz; }
    }
    return out;
  }
}
