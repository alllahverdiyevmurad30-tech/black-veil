// Grid navigation (A* + line-of-walk smoothing). Pure logic, unit-tested.
import { circleBlocked, clamp } from './math.js';

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  constructor(boxes, bounds, cell = 1, radius = 0.45, extra = null) {
    this.extra = extra; this.boxes = boxes; this.b = bounds; this.c = cell; this.r = radius;
    this.w = Math.ceil((bounds.x1 - bounds.x0) / cell); this.h = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.block = new Uint8Array(this.w * this.h); this.rebuild();
  }
  rebuild() {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const [x, z] = this.center(i, j);
      const edge = x < this.b.x0 + this.r || x > this.b.x1 - this.r || z < this.b.z0 + this.r || z > this.b.z1 - this.r;
      this.block[j * this.w + i] = edge || circleBlocked(x, z, this.r, this.boxes) || (this.extra && !this.extra(x, z)) ? 1 : 0;
    }
  }
  center(i, j) { return [this.b.x0 + (i + 0.5) * this.c, this.b.z0 + (j + 0.5) * this.c]; }
  cellOf(x, z) { return [clamp(Math.floor((x - this.b.x0) / this.c), 0, this.w - 1), clamp(Math.floor((z - this.b.z0) / this.c), 0, this.h - 1)]; }
  walkable(x, z) { const [i, j] = this.cellOf(x, z); return !this.block[j * this.w + i]; }
  clear(ax, az, bx, bz) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35));
    for (let k = 0; k <= n; k++) { const t = k / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (circleBlocked(x, z, this.r, this.boxes) || (this.extra && !this.extra(x, z))) return false; }
    return true;
  }
  nearestFree(i, j) {
    for (let r = 1; r <= 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < this.w && nj < this.h && !this.block[nj * this.w + ni]) return [ni, nj];
    }
    return null;
  }
  // Returns an array of [x,z] waypoints, or null when unreachable.
  path(ax, az, bx, bz) {
    let [si, sj] = this.cellOf(ax, az), [ti, tj] = this.cellOf(bx, bz);
    if (this.block[sj * this.w + si]) { const n = this.nearestFree(si, sj); if (n) [si, sj] = n; }
    if (this.block[tj * this.w + ti]) { const n = this.nearestFree(ti, tj); if (n) [ti, tj] = n; }
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const H = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return dx + dz - 0.586 * Math.min(dx, dz); };
    const heap = new Heap(), s = sj * W + si, t = tj * W + ti;
    g[s] = 0; heap.push({ f: H(si, sj), n: s });
    while (heap.size) {
      const { n } = heap.pop(); if (closed[n]) continue; closed[n] = 1;
      if (n === t) break;
      const i = n % W, j = (n / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const m = nj * W + ni; if (this.block[m] || closed[m]) continue;
        if (di && dj && (this.block[j * W + ni] || this.block[nj * W + i])) continue;
        const ng = g[n] + (di && dj ? 1.414 : 1);
        if (ng < g[m]) { g[m] = ng; from[m] = n; heap.push({ f: ng + H(ni, nj), n: m }); }
      }
    }
    if (t !== s && from[t] < 0) return null;
    const pts = [];
    for (let n = t; n !== -1; n = from[n]) pts.push(this.center(n % W, (n / W) | 0));
    pts.reverse();
    const out = []; let a = [ax, az], i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clear(a[0], a[1], pts[j][0], pts[j][1])) j--;
      out.push(pts[j]); a = pts[j]; i = j + 1;
    }
    return out;
  }
}
