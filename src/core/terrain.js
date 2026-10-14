// Heightfield terrain (pure, unit-tested). Built from a height function + flat platforms + carved paths so that routes have
// controlled slopes. Used by the player (ground following), enemies, navigation (slope limit) and bullets/line of sight.
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}
export class Terrain {
  // spec: {res, height(x,z), flats:[{x,z,r,h,blend}], paths:[{pts:[[x,z,h],...], w, blend}]}
  constructor(spec, b) {
    this.res = spec.res || 2; this.x0 = b.x0; this.z0 = b.z0; this.x1 = b.x1; this.z1 = b.z1;
    this.nx = Math.ceil((b.x1 - b.x0) / this.res) + 1; this.nz = Math.ceil((b.z1 - b.z0) / this.res) + 1; this.h = new Float32Array(this.nx * this.nz);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = this.x0 + i * this.res, z = this.z0 + j * this.res; let v = spec.height(x, z);
      for (const f of spec.flats || []) { const m = 1 - sm(f.r, f.r + (f.blend ?? 8), Math.hypot(x - f.x, z - f.z)); if (m > 0) v += (f.h - v) * m; }
      for (const p of spec.paths || []) {
        let best = null;
        for (let k = 0; k < p.pts.length - 1; k++) { const a = p.pts[k], c = p.pts[k + 1], s = segDist(x, z, a[0], a[1], c[0], c[1]); if (!best || s.d < best.d) best = { d: s.d, h: a[2] + (c[2] - a[2]) * s.t }; }
        const m = 1 - sm(p.w, p.w + (p.blend ?? 7), best.d); if (m > 0) v += (best.h - v) * m;
      }
      this.h[j * this.nx + i] = v;
    }
  }
  at(i, j) { return this.h[Math.max(0, Math.min(this.nz - 1, j)) * this.nx + Math.max(0, Math.min(this.nx - 1, i))]; }
  heightAt(x, z) {
    const fx = (x - this.x0) / this.res, fz = (z - this.z0) / this.res, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    return (this.at(i, j) * (1 - tx) + this.at(i + 1, j) * tx) * (1 - tz) + (this.at(i, j + 1) * (1 - tx) + this.at(i + 1, j + 1) * tx) * tz;
  }
  gradient(x, z) { const e = this.res * 0.5; return { gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e), gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e) }; }
  slopeAt(x, z) { const g = this.gradient(x, z); return Math.hypot(g.gx, g.gz); }
  normalAt(x, z) { const g = this.gradient(x, z), l = Math.hypot(g.gx, 1, g.gz); return { x: -g.gx / l, y: 1 / l, z: -g.gz / l }; }
  // Distance along the ray to the first terrain hit, or null. The origin must be above the ground.
  rayHit(o, d, maxT) {
    const step = this.res * 0.5; if (o.y - this.heightAt(o.x, o.z) < 0) return null;
    let prev = 0;
    for (let t = step; t <= maxT + step; t += step) {
      const tt = Math.min(t, maxT), f = o.y + d.y * tt - this.heightAt(o.x + d.x * tt, o.z + d.z * tt);
      if (f < 0) { let lo = prev, hi = tt; for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; (o.y + d.y * mid - this.heightAt(o.x + d.x * mid, o.z + d.z * mid) < 0) ? (hi = mid) : (lo = mid); } return hi; }
      prev = tt; if (tt >= maxT) break;
    }
    return null;
  }
}
