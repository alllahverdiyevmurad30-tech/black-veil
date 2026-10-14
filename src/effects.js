// Pooled visual effects: tracers, bullet-hole decals and particle bursts. Everything is preallocated,
// so long sessions never accumulate objects.
const T = window.THREE;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tr = []; this.ti = 0;
    for (let i = 0; i < 24; i++) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
      const l = new T.Line(g, new T.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0 })); l.frustumCulled = false; scene.add(l); this.tr.push({ l, t: 0 });
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d');
    const gr = x.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.5, 'rgba(10,10,10,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.dm = new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.dc = []; this.di = 0;
    for (let i = 0; i < 48; i++) { const m = new T.Mesh(new T.PlaneGeometry(0.14, 0.14), this.dm); m.visible = false; m.userData.life = 0; scene.add(m); this.dc.push(m); }
    // Ground splashes are a separate bounded pool: persistent enough to sell combat,
    // but capped and faded so long encounters cannot accumulate scene objects.
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bx = bc.getContext('2d');
    const bg = bx.createRadialGradient(32, 32, 2, 32, 32, 30);
    bg.addColorStop(0, 'rgba(94,8,12,.72)'); bg.addColorStop(.42, 'rgba(126,12,18,.48)'); bg.addColorStop(1, 'rgba(90,5,10,0)');
    bx.fillStyle = bg; bx.fillRect(0, 0, 64, 64);
    this.bloodMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(bc), transparent: true, depthWrite: false, opacity: .78, side: T.DoubleSide });
    this.bloodDecals = []; this.bloodIndex = 0;
    for (let i = 0; i < 18; i++) { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: this.bloodMat.map, transparent: true, depthWrite: false, opacity: .72, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.life = 0; scene.add(m); this.bloodDecals.push(m); }
    this.ps = {};
    for (const [k, c, sz] of [['spark', 0xffc766, 0.07], ['dust', 0xb0b8c0, 0.18], ['blood', 0xaa1a1a, 0.1]]) {
      const n = 160, geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3).fill(-999), 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ color: c, size: sz, transparent: true, opacity: 0.9, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
      this.ps[k] = { pts, n, v: new Float32Array(n * 3), life: new Float32Array(n), i: 0 };
    }
  }
  tracer(a, b, color = 0xffe2a0) {
    const s = this.tr[this.ti++ % this.tr.length], p = s.l.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; s.l.material.color.setHex(color); s.l.material.opacity = 0.9; s.t = 0.07;
  }
  emit(kind, pt, nrm, count, speed, grav) {
    const s = this.ps[kind], pos = s.pts.geometry.attributes.position;
    for (let k = 0; k < count; k++) {
      const i = s.i++ % s.n;
      pos.setXYZ(i, pt.x, pt.y, pt.z);
      s.v[i * 3] = (nrm.x + (Math.random() - 0.5) * 1.2) * speed * Math.random();
      s.v[i * 3 + 1] = (nrm.y + Math.random() * 0.6) * speed * Math.random();
      s.v[i * 3 + 2] = (nrm.z + (Math.random() - 0.5) * 1.2) * speed * Math.random();
      s.life[i] = 0.25 + Math.random() * 0.35; s.grav = grav;
    }
    pos.needsUpdate = true;
  }
  impact(pt, nrm, kind) {
    const m = this.dc[this.di++ % this.dc.length];
    m.position.set(pt.x + nrm.x * 0.012, pt.y + nrm.y * 0.012, pt.z + nrm.z * 0.012);
    m.lookAt(pt.x + nrm.x, pt.y + nrm.y, pt.z + nrm.z); m.visible = true;
    const metal = kind === 'wall' || kind === 'tech' || kind === 'wreck';
    this.emit(metal ? 'spark' : 'dust', pt, nrm, metal ? 8 : 6, metal ? 4 : 1.8, 9);
  }
  puff(pt, kind) { this.emit(kind, pt, { x: 0, y: 0.3, z: 0 }, kind === 'blood' ? 14 : 8, kind === 'blood' ? 3.0 : 2.2, 6); }
  bloodSplat(x, y, z, strength = 1) {
    const m = this.bloodDecals[this.bloodIndex++ % this.bloodDecals.length];
    const scale = (0.55 + Math.random() * 0.5) * strength;
    m.position.set(x, y + 0.025, z); m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    m.scale.set(scale * (0.8 + Math.random() * 0.5), scale * (0.65 + Math.random() * 0.4), 1);
    m.material.opacity = 0.72; m.userData.life = 24 + Math.random() * 12; m.visible = true;
  }
  update(dt) {
    for (const s of this.tr) if (s.t > 0) { s.t -= dt; s.l.material.opacity = Math.max(0, s.t / 0.07) * 0.9; }
    for (const m of this.dc) { if (m.visible) { m.userData.life -= dt; if (m.userData.life <= 0) m.visible = false; } }
    for (const m of this.bloodDecals) { if (m.visible) { m.userData.life -= dt; if (m.userData.life <= 0) m.visible = false; else if (m.userData.life < 4) m.material.opacity = Math.max(0, m.userData.life / 4) * .72; } }
    for (const k in this.ps) {
      const s = this.ps[k], pos = s.pts.geometry.attributes.position; let any = false;
      for (let i = 0; i < s.n; i++) {
        if (s.life[i] <= 0) continue; any = true; s.life[i] -= dt;
        if (s.life[i] <= 0) { pos.setXYZ(i, 0, -999, 0); continue; }
        s.v[i * 3 + 1] -= (s.grav || 9) * dt;
        pos.setXYZ(i, pos.getX(i) + s.v[i * 3] * dt, pos.getY(i) + s.v[i * 3 + 1] * dt, pos.getZ(i) + s.v[i * 3 + 2] * dt);
      }
      if (any) pos.needsUpdate = true;
    }
  }
  clearDecals() { for (const m of this.dc) m.visible = false; for (const m of this.bloodDecals) m.visible = false; }
}
