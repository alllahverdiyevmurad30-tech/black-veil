// Weapon controller: separate viewmodel scene (never clips into walls), procedural recoil / reload / swap / sprint animation,
// ammo bookkeeping, spread and hit-scan origin. Damage is resolved in Game.shoot (single source of truth).
import { WEAPONS, ORDER } from './data/weapons.js';
import { clamp } from './core/math.js';
const T = window.THREE;
const lerp = (a, b, t) => a + (b - a) * t;

const MAT = {
  metal: () => new T.MeshStandardMaterial({ color: 0x1d2227, metalness: 0.85, roughness: 0.35 }),
  poly: () => new T.MeshStandardMaterial({ color: 0x14171a, metalness: 0.2, roughness: 0.7 }),
  wood: () => new T.MeshStandardMaterial({ color: 0x4a3322, metalness: 0.05, roughness: 0.7 }),
  glove: () => new T.MeshStandardMaterial({ color: 0x15181b, metalness: 0.1, roughness: 0.85 }),
  sleeve: () => new T.MeshStandardMaterial({ color: 0x2a3038, metalness: 0, roughness: 0.95 }),
  accent: () => new T.MeshStandardMaterial({ color: 0xff8a20, emissive: 0xff6a00, emissiveIntensity: 0.5 }),
  red: () => new T.MeshBasicMaterial({ color: 0xff2020 }),
};

function buildViewmodel(id) {
  const g = new T.Group(), m = { metal: MAT.metal(), poly: MAT.poly(), wood: MAT.wood(), glove: MAT.glove(), sleeve: MAT.sleeve(), accent: MAT.accent() };
  const box = (w, h, d, mat, x, y, z, rx = 0, par = g) => { const k = new T.Mesh(new T.BoxGeometry(w, h, d), mat); k.position.set(x, y, z); k.rotation.x = rx; par.add(k); return k; };
  const cyl = (r, len, mat, x, y, z) => { const k = new T.Mesh(new T.CylinderGeometry(r, r, len, 10), mat); k.rotation.x = Math.PI / 2; k.position.set(x, y, z); g.add(k); return k; };
  let mag = null, pump = null, muzzleZ = -0.2, rh, lh;
  if (['pistol', 'vx9', 'suppressed'].includes(id)) {
    box(0.045, 0.05, 0.2, m.metal, 0, 0.025, -0.05); box(0.04, 0.03, 0.18, m.poly, 0, -0.005, -0.04); box(0.04, 0.11, 0.055, m.poly, 0, -0.075, 0.045, 0.25);
    box(0.02, 0.02, 0.05, m.metal, 0, 0.025, -0.17); box(0.01, 0.014, 0.01, m.accent, 0, 0.056, -0.14); box(0.012, 0.014, 0.01, m.accent, 0, 0.056, 0.04);
    mag = box(0.03, id === 'vx9' ? 0.065 : 0.04, 0.045, m.metal, 0, -0.14, 0.05); muzzleZ = -0.2; rh = [0.0, -0.1, 0.05]; lh = [-0.04, -0.115, 0.03];
    if (id === 'suppressed') { cyl(0.025, 0.24, m.metal, 0, 0.025, -0.29); muzzleZ = -0.42; }
    if (id === 'vx9') box(0.045, 0.025, 0.08, m.poly, 0, 0.045, -0.09);
  } else if (['rifle', 'br4', 'sr6', 'lm8'].includes(id)) {
    box(0.06, 0.085, 0.34, m.metal, 0, 0, 0); box(0.055, 0.06, 0.26, m.poly, 0, -0.005, -0.29); cyl(0.012, 0.28, m.metal, 0, 0.01, -0.52);
    box(0.045, 0.08, 0.2, m.poly, 0, -0.01, 0.28, 0.05); box(0.04, 0.1, 0.05, m.poly, 0, -0.09, 0.1, 0.3); box(0.03, 0.01, 0.3, m.metal, 0, 0.05, -0.1);
    mag = box(0.04, 0.14, 0.07, m.poly, 0, -0.1, -0.04, 0.15); box(0.045, 0.05, 0.09, m.metal, 0, 0.078, -0.02); box(0.028, 0.028, 0.006, MAT.red(), 0, 0.078, -0.067);
    const barrelEnd = id === 'sr6' ? -0.88 : id === 'lm8' ? -0.74 : -0.67;
    if (id === 'sr6') { box(0.055, 0.07, 0.22, m.metal, 0, 0.09, -0.22); box(0.03, 0.025, 0.11, m.accent, 0, 0.135, -0.22); }
    if (id === 'lm8') box(0.09, 0.11, 0.12, m.metal, 0, -0.12, -0.05);
    if (id === 'br4') box(0.07, 0.07, 0.12, m.metal, 0, 0.07, -0.13);
    box(0.012, 0.03, 0.012, m.metal, 0, 0.03, barrelEnd); muzzleZ = barrelEnd - 0.03; rh = [0, -0.12, 0.09]; lh = [0, -0.075, -0.28];
  } else {
    box(0.06, 0.09, 0.3, m.metal, 0, 0, 0); cyl(0.017, 0.6, m.metal, 0, 0.025, -0.45); cyl(0.014, 0.5, m.metal, 0, -0.02, -0.4);
    pump = box(0.065, 0.05, id === 'breach' ? 0.15 : 0.2, m.wood, 0, -0.025, -0.32); box(0.05, 0.1, 0.28, m.wood, 0, -0.02, 0.28, 0.1); box(0.04, 0.1, 0.05, m.wood, 0, -0.09, 0.1, 0.3);
    box(0.012, 0.025, 0.012, m.accent, 0, 0.05, -0.74); muzzleZ = -0.76; rh = [0, -0.12, 0.1]; lh = [0, -0.065, -0.32];
  }
  // hands + sleeves (gloved hands on the grip and fore-end; the left hand follows the pump on the shotgun)
  const hand = (p, side, parent) => {
    const h = new T.Group(); h.position.set(p[0], p[1], p[2]); parent.add(h);
    box(0.07, 0.075, 0.11, m.glove, 0, 0, 0, 0, h); box(0.075, 0.02, 0.07, m.poly, 0, 0.04, -0.01, 0, h);          // glove + knuckle guard
    box(0.09, 0.09, 0.55, m.sleeve, side * 0.035, -0.06, 0.36, -0.28, h);                                              // sleeve running back toward the camera
    return h;
  };
  hand(rh, 1, g); const lHand = hand(lh, -1, pump ? pump : g);
  if (pump) lHand.position.set(0, -0.04, 0);
  const muzzle = new T.Object3D(); muzzle.position.set(0, 0.02, muzzleZ); g.add(muzzle);
  const flash = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  flash.position.set(0, 0.02, muzzleZ - 0.05); flash.visible = false; g.add(flash);
  g.userData = { muzzle, mag, magY: mag ? mag.position.y : 0, pump, pumpZ: pump ? pump.position.z : 0, flash };
  return g;
}

export class Weapons {
  constructor(game) {
    this.g = game; this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(55, 1, 0.01, 10);
    this.scene.add(new T.HemisphereLight(0xcfe0ff, 0x201810, 1.0)); this.casings = []; this.casingIndex = 0; for (let i = 0; i < 14; i++) { const mesh = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.045, 7), new T.MeshStandardMaterial({ color: 0xb78b42, metalness: 0.82, roughness: 0.28 })); mesh.visible = false; this.scene.add(mesh); this.casings.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0, spin: 0 }); } const d = new T.DirectionalLight(0xffffff, 0.9); d.position.set(1, 2, 1); this.scene.add(d);
    this.models = {}; for (const id of ORDER) { const m = buildViewmodel(id); m.visible = false; this.scene.add(m); this.models[id] = m; }
    this.reset();
  }
  reset() {
    this.unlocked = []; this.state = {}; this.cur = null; this.w = null; this.cd = 0; this.reloading = false; this.relT = 0; this.relPhase = 0;
    this.swT = 0; this.next = null; this.ads = 0; this.kick = 0; this.debt = 0; this.sinceShot = 9; this.held = false; this.fovMul = 1; this.flashT = 0; this.dryT = 0;
    this.sprintK = 0; this.sway = { x: 0, y: 0 }; this.prevYaw = 0; this.prevPitch = 0; this.pumpT = 0; for (const c of this.casings) { c.life = 0; c.mesh.visible = false; }
    for (const id of ORDER) this.models[id].visible = false;
  }
  unlock(id) {
    if (this.unlocked.includes(id)) return; const w = WEAPONS[id];
    this.unlocked.push(id); this.state[id] = { mag: w.mag, reserve: Math.min(w.reserveMax, w.pack * 3) };
    if (!this.cur) this.select(id);
  }
  restore(list, ammo, cur) {
    this.reset(); for (const id of list) { if (!WEAPONS[id]) continue; this.unlocked.push(id); const a = ammo[id] || {}; this.state[id] = { mag: clamp(a.mag ?? WEAPONS[id].mag, 0, WEAPONS[id].mag), reserve: clamp(a.reserve ?? 0, 0, WEAPONS[id].reserveMax) }; }
    if (!this.unlocked.length) this.unlock('pistol'); this.select(this.unlocked.includes(cur) ? cur : this.unlocked[0]);
  }
  snapshot() { const ammo = {}; for (const id of this.unlocked) ammo[id] = { ...this.state[id] }; return { weapons: [...this.unlocked], ammo, cur: this.cur }; }
  select(id) { for (const k of ORDER) this.models[k].visible = k === id; this.cur = id; this.w = WEAPONS[id]; this.reloading = false; this.cd = 0.1; }
  switchTo(id) {
    if (id === this.cur || !this.unlocked.includes(id) || this.swT > 0) return;
    this.next = id; this.swT = 0.32; this.reloading = false; this.g.audio.swap();
  }
  addAmmo() { for (const id of this.unlocked) { const s = this.state[id], w = WEAPONS[id]; s.reserve = Math.min(w.reserveMax, s.reserve + w.pack); } }
  startReload() {
    if (this.reloading || this.swT > 0 || !this.w) return; const s = this.state[this.cur], w = this.w;
    if (s.mag >= w.mag || s.reserve <= 0) return;
    this.reloading = true; this.relT = 0; this.relPhase = 0; this.g.audio.reloadPhase(0);
  }
  muzzleWorld(out) { const m = this.models[this.cur]; this.scene.updateMatrixWorld(true); m.userData.muzzle.getWorldPosition(out); return this.g.cam.localToWorld(out); }

  update(dt) {
    const g = this.g, inp = g.input, p = g.player, S = g.settings; if (!this.w) return;
    for (const id of this.unlocked) if (inp.hit('slot' + WEAPONS[id].slot)) this.switchTo(id);
    if (inp.wheel && this.swT <= 0 && this.unlocked.length > 1) { const i = this.unlocked.indexOf(this.cur); this.switchTo(this.unlocked[(i + (inp.wheel > 0 ? 1 : this.unlocked.length - 1)) % this.unlocked.length]); }
    if (this.swT > 0) { const prev = this.swT; this.swT -= dt; if (prev > 0.16 && this.swT <= 0.16 && this.next) this.select(this.next); if (this.swT <= 0) { this.swT = 0; this.next = null; } }
    const w = this.w, st = this.state[this.cur], model = this.models[this.cur], ud = model.userData;
    this.cd -= dt; this.sinceShot += dt; this.dryT -= dt;
    // reload
    if (inp.hit('reload')) this.startReload();
    if (this.reloading) {
      this.relT += dt;
      if (w.perShell) { if (this.relT >= w.reload) { this.relT = 0; st.mag++; st.reserve--; g.audio.reloadPhase(1); if (st.mag >= w.mag || st.reserve <= 0) { this.reloading = false; g.audio.reloadPhase(2); } } }
      else { const t = this.relT / w.reload; if (t > 0.5 && this.relPhase === 0) { this.relPhase = 1; g.audio.reloadPhase(1); } if (t >= 1) { const n = Math.min(w.mag - st.mag, st.reserve); st.mag += n; st.reserve -= n; this.reloading = false; g.audio.reloadPhase(2); } }
    }
    // aim down sights
    const target = p.aiming && this.swT <= 0 && !(this.reloading && !w.perShell) && !p.sprinting ? 1 : 0;
    this.ads += (target - this.ads) * Math.min(1, dt * 11); this.fovMul = 1 - (1 - w.adsFov) * this.ads;
    // fire
    const want = w.auto ? inp.mouse.l : inp.mouse.l && !this.held; this.held = inp.mouse.l;
    if (want && this.cd <= 0 && this.swT <= 0 && !p.sprinting) {
      if (this.reloading && w.perShell && st.mag > 0) this.reloading = false;
      if (!this.reloading) { if (st.mag > 0) this.fire(st); else if (this.dryT <= 0) { g.audio.empty(); this.dryT = 0.3; this.startReload(); } }
    }
    // recoil recovery (half of the climb returns when you stop firing)
    if (this.sinceShot > 0.14 && this.debt > 0) { const r = Math.min(this.debt, this.debt * 3.5 * dt + 0.0004); p.pitch -= r * 0.6; this.debt -= r; }
    this.kick += (0 - this.kick) * Math.min(1, dt * 13); this.pumpT = Math.max(0, this.pumpT - dt);
    // viewmodel pose
    this.sprintK += ((p.sprinting ? 1 : 0) - this.sprintK) * Math.min(1, dt * 9);
    const dy = p.yaw - this.prevYaw, dp = p.pitch - this.prevPitch; this.prevYaw = p.yaw; this.prevPitch = p.pitch;
    this.sway.x += (clamp(-dy * 1.2, -0.05, 0.05) - this.sway.x) * Math.min(1, dt * 9); this.sway.y += (clamp(dp * 1.2, -0.05, 0.05) - this.sway.y) * Math.min(1, dt * 9);
    const a = this.ads, bobAmt = S.bob * (1 - a * 0.75) * Math.min(1, p.speed / 3) * (p.grounded ? 1 : 0.2);
    const sw = this.swT > 0 ? Math.sin(Math.PI * (1 - this.swT / 0.32)) : 0;
    let rl = 0; if (this.reloading) rl = w.perShell ? Math.sin(Math.PI * clamp(this.relT / w.reload, 0, 1)) * 0.5 : Math.sin(Math.PI * clamp(this.relT / w.reload, 0, 1));
    const px = lerp(w.hip[0], w.adsPos[0], a) + Math.sin(p.bobT * 1.05) * 0.008 * bobAmt + this.sway.x + this.sprintK * 0.07;
    const py = lerp(w.hip[1], w.adsPos[1], a) + Math.abs(Math.sin(p.bobT * 1.05)) * 0.01 * bobAmt + this.sway.y - sw * 0.28 - rl * 0.11 - this.sprintK * 0.08;
    const pz = lerp(w.hip[2], w.adsPos[2], a) + this.kick * 0.9 + this.sprintK * 0.02;
    model.position.set(px, py, pz);
    model.rotation.set(this.kick * 1.8 + rl * 0.45 + this.sprintK * 0.35 + sw * 0.7, this.sprintK * -0.55 + this.sway.x * 2, rl * -0.35 + this.sprintK * 0.1);
    if (ud.mag) { const t = this.reloading && !w.perShell ? this.relT / w.reload : 0, k = t < 0.25 ? 0 : t < 0.45 ? (t - 0.25) / 0.2 : t < 0.6 ? 1 : t < 0.8 ? 1 - (t - 0.6) / 0.2 : 0; ud.mag.position.y = ud.magY - k * 0.2; ud.mag.visible = !(t > 0.42 && t < 0.62); }
    if (ud.pump) ud.pump.position.z = ud.pumpZ + (this.pumpT > 0 ? Math.sin(Math.PI * (1 - this.pumpT / 0.35)) * 0.09 : 0);
    for (const c of this.casings) if (c.life > 0) { c.life -= dt; c.vy -= 5.5 * dt; c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.position.z += c.vz * dt; c.mesh.rotation.x += c.spin * dt; c.mesh.rotation.z += c.spin * 0.7 * dt; if (c.mesh.position.y < -0.3) { c.mesh.position.y = -0.3; c.vy = Math.abs(c.vy) * 0.22; c.vx *= 0.72; c.vz *= 0.72; } if (c.life <= 0) c.mesh.visible = false; }
    if (this.flashT > 0) { this.flashT -= dt; ud.flash.visible = this.flashT > 0; ud.flash.rotation.z = Math.random() * 6; ud.flash.scale.setScalar(0.8 + Math.random() * 0.6); } else ud.flash.visible = false;
    g.ui.setAmmo(w.name, st.mag, st.reserve, this.reloading);
  }
  spreadNow() {
    const p = this.g.player, w = this.w; if (!w) return 0.01;
    return Math.max(0.0005, lerp(w.spread, w.adsSpread, this.ads) + (p.moving ? w.moveSpread * (p.sprinting ? 1.5 : 1) : 0) + (p.grounded ? 0 : 0.04) - (p.crouch ? w.spread * 0.3 : 0));
  }
  fire(st) {
    const g = this.g, p = g.player, w = this.w, S = g.settings, cam = g.cam; st.mag--;
    this.cd = 60 / w.rpm; this.sinceShot = 0; this.flashT = 0.075; if (w.perShell) this.pumpT = 0.35;
    // Recycled brass casing, kicked sideways and down; bounded pool prevents scene growth.
    if (!['suppressed'].includes(this.cur) && Math.random() < (w.pellets > 1 ? 0.9 : 0.82)) { const c = this.casings[this.casingIndex++ % this.casings.length]; const vm = this.models[this.cur]; c.mesh.position.set(vm.position.x + 0.12, vm.position.y + 0.04, vm.position.z - 0.18); c.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); c.vx = 0.8 + Math.random() * 1.1; c.vy = 1.2 + Math.random() * 0.8; c.vz = 0.3 + Math.random() * 0.7; c.spin = 8 + Math.random() * 10; c.life = 1.4; c.mesh.visible = true; }
    const muzzlePt = new T.Vector3(); this.models[this.cur].userData.muzzle.getWorldPosition(muzzlePt); g.fx.emit('spark', muzzlePt, { x: 0, y: 0.2, z: -1 }, w.pellets > 1 ? 7 : 4, 1.8, 4);
    cam.updateMatrixWorld(true);
    const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), right = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    let spread = lerp(w.spread, w.adsSpread, this.ads) + (p.moving ? w.moveSpread * (p.sprinting ? 1.5 : 1) : 0) + (p.grounded ? 0 : 0.04) - (p.crouch ? w.spread * 0.3 : 0);
    spread = Math.max(0.0005, spread);
    const origin = cam.position.clone();
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = spread * Math.sqrt(Math.random());
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      g.shoot(origin, dir, w, i === 0);
    }
    g.audio.shot(w.id); g.noise(p.x, p.z, w.noise);
    const k = (1 - this.ads * 0.35), rc = w.recoil;
    const up2 = rc.up * (0.8 + Math.random() * 0.4) * k; p.pitch += up2; this.debt += up2; p.yaw += (Math.random() - 0.5) * 2 * rc.side * k;
    this.kick += rc.kick * (1 - this.ads * 0.4); p.shake = Math.min(1, p.shake + 0.08 * (w.pellets > 1 ? 2 : 1));
    g.muzzleFlash();
  }
}
