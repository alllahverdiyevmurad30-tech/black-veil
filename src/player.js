// First-person controller: smoothed movement, sprint / crouch / jump, collision, footsteps (with noise), health.
import { moveCircle, clamp } from './core/math.js';

export class Player {
  constructor(game) { this.g = game; this.reset(0, 0, 0, 100); }
  reset(x, z, yaw, hp) {
    Object.assign(this, { x, z, y: 0, vy: 0, yaw, pitch: 0, vx: 0, vz: 0, hp, crouch: false, sprint: false, sprinting: false, aiming: false, eyeH: 1.65, bobT: 0, stepD: 0, lastHurt: -99, shake: 0, speed: 0, grounded: true, dead: false, bobY: 0 });
  }
  get eyeY() { return this.y + this.eyeH; }
  get moving() { return this.speed > 0.5; }
  senseInfo() { return { x: this.x, z: this.z, eye: this.eyeY - 0.1, crouch: this.crouch, sprint: this.sprinting && this.speed > 5 }; }

  update(dt) {
    const g = this.g, inp = g.input, S = g.settings, w = g.weapons, lvl = g.level;
    // look (ADS slows the mouse in proportion to the zoom, so sensitivity feels consistent)
    const mul = this.aiming ? S.adsSens * w.fovMul : 1;
    this.yaw -= inp.dx * 0.0021 * S.sens * mul;
    this.pitch = clamp(this.pitch - inp.dy * 0.0021 * S.sens * mul * (S.invertY ? -1 : 1), -1.5, 1.5);
    // stances (hold or toggle, per settings)
    if (S.crouchToggle) { if (inp.hit('crouch')) this.crouch = !this.crouch; } else this.crouch = inp.down('crouch');
    const f = (inp.down('forward') ? 1 : 0) - (inp.down('back') ? 1 : 0), r = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (S.aimToggle) { if (inp.rEdge) this.aiming = !this.aiming; } else this.aiming = inp.mouse.r;
    if (S.sprintToggle) { if (inp.hit('sprint')) this.sprint = !this.sprint; } else this.sprint = inp.down('sprint');
    this.sprinting = this.sprint && f > 0 && !this.aiming && !this.crouch && !w.busyBlocksSprint;
    if (S.sprintToggle && f <= 0) this.sprint = false;
    if (this.sprinting && this.crouch) this.crouch = false;
    // movement
    let sp = this.crouch ? 2.1 : this.sprinting ? 6.6 : 4.0; if (this.aiming) sp *= 0.62;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let dx = -sy * f + cy * r, dz = -cy * f - sy * r; const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; }
    const k = Math.min(1, dt * (this.grounded ? 11 : 2.2));
    this.vx += (dx * sp - this.vx) * k; this.vz += (dz * sp - this.vz) * k;
    moveCircle(this, this.vx * dt, this.vz * dt, 0.38, lvl.blockers, lvl.def.bounds, lvl.walkFn);
    this.speed = Math.hypot(this.vx, this.vz);
    // vertical: walk along the terrain surface; jumping and falling off ledges use gravity
    const gy = lvl.groundAt(this.x, this.z);
    if (inp.hit('jump') && this.grounded && !this.crouch) { this.vy = 4.8; this.grounded = false; }
    if (this.grounded) { if (gy < this.y - 0.35) { this.grounded = false; this.vy = 0; } else this.y += (gy - this.y) * Math.min(1, dt * 20); }
    if (!this.grounded) { this.vy -= 13 * dt; this.y += this.vy * dt; if (this.y <= gy) { this.y = gy; if (this.vy < -2) g.audio.step(lvl.surfaceAt(this.x, this.z), 1.3); this.vy = 0; this.grounded = true; } }
    this.eyeH += ((this.crouch ? 1.1 : 1.65) - this.eyeH) * Math.min(1, dt * 9);
    // head bob + footsteps
    this.bobT += this.speed * dt * (this.sprinting ? 1.5 : 1);
    this.bobY = Math.sin(this.bobT * 2.1) * 0.025 * S.bob * Math.min(1, this.speed / 3) * (this.grounded ? 1 : 0);
    if (this.grounded && this.speed > 0.6) {
      this.stepD += this.speed * dt; const stride = this.crouch ? 1.5 : this.sprinting ? 2.5 : 1.9;
      if (this.stepD > stride) {
        this.stepD = 0; g.audio.step(lvl.surfaceAt(this.x, this.z), this.crouch ? 0.4 : this.sprinting ? 1.2 : 0.8);
        g.noise(this.x, this.z, this.crouch ? 2 : this.sprinting ? 14 : 7);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    // slow regeneration after 7 s without damage, up to 60 HP (medkits restore the rest)
    if (g.time - this.lastHurt > 7 && this.hp < 60 && !this.dead) { this.hp = Math.min(60, this.hp + 6 * dt); g.ui.setHealth(this.hp); }
  }
  take(d, from) {
    if (this.dead) return; const g = this.g;
    this.hp = Math.max(0, this.hp - d); this.lastHurt = g.time; this.shake = Math.min(1, this.shake + d / 20);
    g.audio.hurt(); g.ui.damage(this.hp, from ? Math.atan2(-(from.x - this.x), -(from.z - this.z)) - this.yaw : null); g.ui.setHealth(this.hp);
    if (this.hp <= 0) { this.dead = true; g.onPlayerDead(); }
  }
}
