// Enemy AI. States: idle / patrol -> alert -> combat (fire | toCover | inCover | reposition | flank) -> chase -> search -> return.
// Perception comes from core/detect.js (vision cone + LOS + hearing); movement uses NavGrid paths + circle collision.
import { moveCircle, losClear, clamp } from './core/math.js';
import { visionGain, hears, angleDiff } from './core/detect.js';
import { buildHumanoid } from './characters.js';
import { loadRiggedCharacterAsset } from './character-assets.js';
import { conditionFromHit, transitionNpcCondition } from './core/npc-state.js';
const T = window.THREE;
const rnd = (a, b) => a + Math.random() * (b - a);

export const ROLES = {
  rifleman: { hp: 70, speed: 3.3, acc: 0.5, dmg: 6, rpm: 520, burst: [3, 6], range: 42, fov: 2.0, armor: 0, suit: 0x3a4048, accent: 0xff4a3a, react: 0.45 },
  defender: { hp: 95, speed: 2.7, acc: 0.65, dmg: 8, rpm: 380, burst: [2, 4], range: 50, fov: 1.7, armor: 0.15, suit: 0x3b3f34, accent: 0xffaa30, react: 0.5 },
  heavy: { hp: 170, speed: 2.3, acc: 0.55, dmg: 9, rpm: 600, burst: [5, 9], range: 38, fov: 1.6, armor: 0.45, suit: 0x2a2630, accent: 0xff2020, heavy: true, react: 0.65 },
};

export class Enemy {
  constructor(game, def, gid, alertAt) {
    this.game = game; this.cfg = ROLES[def.role]; this.role = def.role; this.gid = gid;
    this.x = def.x; this.z = def.z; this.y = game.level.groundAt(def.x, def.z); this.pending = null; this.yaw = def.yaw ?? 0; this.homeYaw = this.yaw; this.home = { x: def.x, z: def.z };
    this.patrol = def.patrol || null; this.pi = 0; this.hp = this.cfg.hp; this.dead = false; this.condition = 'HEALTHY'; this.conditionChangedAt = 0; this.limpSign = Math.random() < 0.5 ? -1 : 1;
    this.state = this.patrol ? 'patrol' : 'idle'; this.sub = 'fire'; this.subT = 0; this.awareness = 0; this.lostT = 0; this.seeing = false;
    this.last = null; this.stance = 'stand'; this.path = null; this.pathI = 0; this.repathT = 0; this.waitT = 0; this.fireT = 0;
    this.burstLeft = 0; this.burstPause = 0; this.react = 0; this.accRamp = 0; this.flankCd = 0; this.lastHurtT = -99; this.lastHitPlayerT = 0;
    this.flash = 0; this.hitReactT = 0; this.hitReactSide = 1; this.hitReactZone = 'body'; this.grenadeReadyAt = 0; this.grenadeUsed = false; this.deadT = 0; this.deathYaw = 0; this.deathStart = { x: this.x, z: this.z }; this.speedNow = 0; this.phase = 0; this.coverPos = null; this.peekT = 0; this.searchT = 0; this.alertT = 0; this.stuckT = 0; this.stuckPos = { x: this.x, z: this.z }; this.turn = 1; this.crouchK = 0; this.aimK = 0; this.fireKick = 0; this.deathPose = 0;
    const visualSeed = Math.abs(Math.floor((this.x + 137.2) * 31 + (this.z + 211.7) * 17 + (def.variantSeed || 0)));
    const h = buildHumanoid({ suit: this.cfg.suit, accent: this.cfg.accent, heavy: this.cfg.heavy, seed: visualSeed, radio: this.role !== 'heavy', profile: `warden-${this.role}` });
    this.model = h; this.group = h.group; this.group.rotation.order = 'YXZ'; h.hit.forEach(m => { m.userData.enemy = this; });
    this.riggedModel = null; this.riggedMixer = null; this.riggedActions = new Map(); this.riggedAction = null; this.riggedLoadFailed = false;
    this.group.position.set(this.x, this.y, this.z); game.scene.add(this.group);
    // Prefer the actual skinned GLB when it is available; preserve the existing procedural
    // model and its hit regions as a safe fallback if loading or validation fails.
    loadRiggedCharacterAsset('/public/models/characters/elias_voss_rigged.glb', T).then(asset => {
      if (this.game.disposed || !this.group.parent) { asset.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return; }
      this.riggedModel = asset; this.riggedMixer = asset.userData.animationMixer || null;
      this.group.add(asset);
      const clips = asset.userData.animationClips || [];
      for (const clip of clips) this.riggedActions.set(clip.name.replace(/^BV_/, '').toLowerCase(), this.riggedMixer.clipAction(clip));
      // Hide only the procedural render materials. Keep hit meshes and their metadata intact
      // for the existing server/gameplay raycast contract.
      this.model.mats.forEach(mat => { mat.transparent = true; mat.opacity = 0; mat.depthWrite = false; });
      this.playRiggedAnimation('idle');
    }).catch(() => { this.riggedLoadFailed = true; });
    if (alertAt) { this.last = { x: alertAt.x, z: alertAt.z }; this.state = 'alert'; this.awareness = 0.7; this.alertT = 6; }
  }
  get eyeY() { return this.y + (this.stance === 'crouch' ? 1.0 : 1.6) * (this.cfg.heavy ? 1.1 : 1); }

  // ---------------------------------------------------------------- perception
  senses(dt) {
    const g = this.game, p = g.player, d = g.diff;
    const gain = visionGain({ x: this.x, z: this.z, yaw: this.yaw, eye: this.eyeY, fov: this.cfg.fov, range: this.cfg.range }, p.senseInfo(), g.level.blockers);
    this.seeing = gain > 0;
    if (this.seeing) { this.awareness = Math.min(1.5, this.awareness + gain * dt / d.react); this.last = { x: p.x, z: p.z }; }
    else this.awareness = Math.max(0, this.awareness - dt * (this.state === 'combat' ? 0.12 : 0.3));
    if (this.awareness >= 1 && this.state !== 'combat') this.enterCombat();
    else if (this.awareness >= 0.3 && (this.state === 'idle' || this.state === 'patrol' || this.state === 'search')) { this.state = 'alert'; this.alertT = 5; }
  }
  hear(n) {
    if (this.dead || this.state === 'combat') return;
    if (hears({ x: this.x, z: this.z }, n, this.game.level.blockers)) {
      this.last = { x: n.x, z: n.z }; this.awareness = Math.max(this.awareness, 0.55);
      if (this.state !== 'chase') { this.state = 'alert'; this.alertT = 6; }
    }
  }
  enterCombat() {
    this.state = 'combat'; this.react = this.cfg.react * this.game.diff.react + rnd(0, 0.25); this.accRamp = 0; this.lostT = 0;
    this.sub = this.role === 'defender' && Math.random() < 0.6 ? 'toCover' : 'fire'; this.subT = rnd(1.5, 3);
    if (this.sub === 'toCover') { const c = this.findCover(false); if (c) { this.coverPos = c; this.goTo(c.x, c.z, true); } else this.sub = 'fire'; }
    this.game.alertGroup(this);
  }

  // ---------------------------------------------------------------- movement helpers
  goTo(x, z, force) {
    if (!force && this.repathT > 0) return;
    const g = this.game; if (g.pathCalls >= g.pathBudget) { this.pending = { x, z }; return; }   // spread A* cost over frames on big maps
    g.pathCalls++; this.repathT = 0.7; this.pending = null;
    this.path = g.level.nav.path(this.x, this.z, x, z); this.pathI = 0; this.target = { x, z };
  }
  moveAlong(dt, speed, faceMove = true) {
    if (this.condition === 'LIMPING') speed *= 0.66;
    else if (this.condition === 'WOUNDED') speed *= 0.78;
    if (this.pending) { const q = this.pending; this.goTo(q.x, q.z, true); if (this.pending) { this.speedNow = 0; return false; } }
    if (!this.path || this.pathI >= this.path.length) { this.speedNow = 0; return true; }
    const [tx, tz] = this.path[this.pathI], dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.35) { this.pathI++; return this.pathI >= this.path.length; }
    const step = Math.min(speed * dt, d), nx = dx / d, nz = dz / d;
    moveCircle(this, nx * step, nz * step, 0.4, this.game.level.blockers, this.game.level.def.bounds, this.game.level.walkFn);
    for (const o of this.game.enemies) { if (o === this || o.dead) continue; const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz); if (od < 0.8 && od > 0.01) { this.x += ox / od * 0.8 * dt; this.z += oz / od * 0.8 * dt; } }
    this.speedNow = speed;
    if (faceMove) this.faceToward(this.x + nx, this.z + nz, 7, dt);
    // stuck detection: no progress for 1.5 s -> re-plan
    this.stuckT += dt; if (this.stuckT > 1.5) { if (Math.hypot(this.x - this.stuckPos.x, this.z - this.stuckPos.z) < 0.3 && this.target) this.goTo(this.target.x, this.target.z, true); this.stuckT = 0; this.stuckPos = { x: this.x, z: this.z }; }
    return false;
  }
  faceToward(x, z, rate, dt) {
    const want = Math.atan2(-(x - this.x), -(z - this.z)), df = angleDiff(want, this.yaw);
    this.yaw += clamp(df, -rate * dt, rate * dt);
  }

  // ---------------------------------------------------------------- behaviours
  calm(dt) {
    this.speedNow = 0;
    if (this.state === 'patrol') {
      if (this.waitT > 0) { this.waitT -= dt; this.yaw += Math.sin(this.game.time * 1.2 + this.x) * 0.6 * dt; return; }
      const [px, pz] = this.patrol[this.pi];
      if (Math.hypot(px - this.x, pz - this.z) < 0.8) { this.pi = (this.pi + 1) % this.patrol.length; this.waitT = rnd(1.5, 3.5); return; }
      this.goTo(px, pz); this.moveAlong(dt, this.cfg.speed * 0.5);
    } else {
      if (Math.hypot(this.home.x - this.x, this.home.z - this.z) > 1) { this.goTo(this.home.x, this.home.z); this.moveAlong(dt, this.cfg.speed * 0.5); }
      else this.yaw = this.homeYaw + Math.sin(this.game.time * 0.5 + this.x * 3) * 0.55; // idle guard scans left/right
    }
  }
  alertB(dt) {
    this.alertT -= dt;
    if (this.last) {
      this.faceToward(this.last.x, this.last.z, 4, dt);
      if (this.awareness > 0.5) { this.goTo(this.last.x, this.last.z); if (this.moveAlong(dt, this.cfg.speed * 0.55) || Math.hypot(this.last.x - this.x, this.last.z - this.z) < 1.5) { this.state = 'search'; this.searchT = 6; } }
    }
    if (this.awareness < 0.05 && this.alertT <= 0) this.returnToPost();
  }
  chase(dt) {
    if (!this.last) return this.returnToPost();
    this.stance = 'stand'; this.goTo(this.last.x, this.last.z);
    if (this.moveAlong(dt, this.cfg.speed) || Math.hypot(this.last.x - this.x, this.last.z - this.z) < 1.5) { this.state = 'search'; this.searchT = 7; }
  }
  search(dt) {
    this.searchT -= dt; this.speedNow = 0; this.yaw += this.turn * 1.1 * dt; if (Math.random() < dt * 0.4) this.turn *= -1;
    if (this.searchT <= 0) this.returnToPost();
  }
  returnToPost() { this.state = this.patrol ? 'patrol' : 'idle'; this.awareness = 0; this.stance = 'stand'; this.path = null; }

  combat(dt) {
    const g = this.game, p = g.player, d = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.seeing) { this.lostT = 0; this.accRamp = Math.min(1, this.accRamp + dt / 1.6); } else this.lostT += dt;
    if (this.react > 0) this.react -= dt;
    const inCoverPhase = this.sub === 'toCover' || this.sub === 'inCover';
    switch (this.sub) {
      case 'fire':
        this.stance = 'stand'; this.speedNow = 0;
        if (this.seeing) { this.faceToward(p.x, p.z, 9, dt); if (this.react <= 0) this.shoot(dt); }
        else if (this.last) { this.goTo(this.last.x, this.last.z); this.moveAlong(dt, this.cfg.speed * 0.8); }
        this.subT -= dt; if (this.subT <= 0) this.decide(d);
        break;
      case 'toCover':
        this.stance = 'stand';
        if (this.moveAlong(dt, this.cfg.speed) || !this.coverPos) { this.sub = 'inCover'; this.peekT = rnd(1.2, 2.6); }
        break;
      case 'inCover':
        this.stance = 'crouch'; this.speedNow = 0; this.faceToward(p.x, p.z, 6, dt); this.peekT -= dt;
        if (this.peekT <= 0) { this.stance = 'stand'; this.sub = 'fire'; this.subT = rnd(1.4, 2.6); }
        break;
      case 'reposition':
        this.stance = 'stand'; if (this.moveAlong(dt, this.cfg.speed)) { this.sub = 'fire'; this.subT = rnd(1.5, 3); }
        break;
      case 'flank':
        this.stance = 'stand'; if (this.moveAlong(dt, this.cfg.speed) || (this.seeing && d < 20)) { this.sub = 'fire'; this.subT = 3; }
        break;
    }
    if (!inCoverPhase && this.lostT > 1.6) { this.state = 'chase'; }
    if (inCoverPhase && this.lostT > 8) { this.state = 'chase'; this.stance = 'stand'; }
  }
  decide(d) {
    const g = this.game, hurtRecent = g.time - this.lastHurtT < 2.5;
    if (this.hp < this.cfg.hp * 0.35 && Math.random() < 0.6) { const c = this.findCover(true); if (c) return this.takeCover(c); }
    if (hurtRecent && (this.role === 'defender' || Math.random() < 0.45)) { const c = this.findCover(false); if (c) return this.takeCover(c); }
    const allies = g.enemies.filter(e => e !== this && !e.dead && e.state === 'combat').length;
    if (!this.grenadeUsed && g.time > this.grenadeReadyAt && d > 8 && d < 23 && this.seeing && Math.random() < 0.24) { this.grenadeUsed = true; this.grenadeReadyAt = g.time + 999; g.throwEnemyGrenade(this); this.sub = 'reposition'; const a = Math.atan2(this.z - g.player.z, this.x - g.player.x); this.goTo(this.x + Math.cos(a) * 4, this.z + Math.sin(a) * 4, true); if (this.path) return; }
    if (this.role === 'rifleman' && allies > 0 && g.time > this.flankCd && g.time - g.lastPlayerHurt > 6 && d > 10 && Math.random() < 0.3) {
      const p = g.player, dx = p.x - this.x, dz = p.z - this.z, L = Math.hypot(dx, dz) || 1, side = Math.random() < 0.5 ? 1 : -1;
      const fx = p.x + (-dz / L) * 12 * side - dx / L * 3, fz = p.z + (dx / L) * 12 * side - dz / L * 3;
      if (g.level.nav.walkable(fx, fz)) { this.flankCd = g.time + 25; this.sub = 'flank'; this.goTo(fx, fz, true); if (this.path) return; }
    }
    if (Math.random() < 0.35) {
      const a = Math.random() * 6.28, r = rnd(4, 9), x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
      if (g.level.nav.walkable(x, z)) { this.sub = 'reposition'; this.goTo(x, z, true); if (this.path) return; }
    }
    this.sub = 'fire'; this.subT = rnd(1.5, 3);
  }
  takeCover(c) { this.coverPos = c; this.sub = 'toCover'; this.goTo(c.x, c.z, true); }
  // Finds a spot behind a prop that is hidden from the player when crouched; `far` prefers distance (retreat).
  findCover(far) {
    const g = this.game, p = g.player, L = g.level; let best = null, bs = 1e9;
    for (const b of L.covers) {
      const dx = b.x - p.x, dz = b.z - p.z, dl = Math.hypot(dx, dz) || 1, off = Math.max(b.w, b.d) / 2 + 0.9;
      const cx = b.x + dx / dl * off, cz = b.z + dz / dl * off;
      if (!L.nav.walkable(cx, cz)) continue;
      if (losClear({ x: p.x, y: p.eyeY, z: p.z }, { x: cx, y: L.groundAt(cx, cz) + 1.0, z: cz }, L.blockers)) continue;
      const dEn = Math.hypot(cx - this.x, cz - this.z), dPl = Math.hypot(cx - p.x, cz - p.z);
      if (dPl < 5 || dPl > this.cfg.range * 0.8 || dEn > (far ? 40 : 22)) continue;
      const sc = far ? -dPl * 0.5 + dEn * 0.3 : dEn + Math.abs(dPl - 16) * 0.3;
      if (sc < bs) { bs = sc; best = { x: cx, z: cz }; }
    }
    return best;
  }
  shoot(dt) {
    this.fireT -= dt;
    if (this.burstLeft <= 0) { this.burstPause -= dt; if (this.burstPause <= 0) this.burstLeft = Math.round(rnd(this.cfg.burst[0], this.cfg.burst[1])); return; }
    if (this.fireT > 0) return;
    this.fireT = 60 / this.cfg.rpm; this.burstLeft--; if (this.burstLeft <= 0) this.burstPause = rnd(0.6, 1.4);
    this.fireKick = Math.min(1, this.fireKick + 0.85); this.game.enemyFire(this);
  }

  // ---------------------------------------------------------------- damage / death
  damage(amount, zone) {
    if (this.dead || this.condition === 'DESPAWNING') return; const g = this.game;
    this.hp -= amount; this.flash = 0.1; this.lastHurtT = g.time; this.hitReactT = Math.max(this.hitReactT, zone === 'head' ? 0.24 : zone === 'leg' ? 0.38 : 0.3); this.hitReactZone = zone || 'body'; this.hitReactSide = Math.random() < 0.5 ? -1 : 1;
    // Small impact flinch: procedural fallback only; does not pretend to be a skeletal hit clip.
    this.react = Math.max(this.react, zone === 'head' ? 0.28 : 0.16);
    if (this.hp <= 0) return this.die(zone);
    const nextCondition = conditionFromHit({ zone, hp: this.hp, maxHp: this.cfg.hp, current: this.condition });
    transitionNpcCondition(this, nextCondition);
    if (this.state !== 'combat') { this.awareness = 1.5; this.last = { x: g.player.x, z: g.player.z }; this.enterCombat(); }
  }
  die(zone) {
    if (this.dead) return;
    this.dead = true; transitionNpcCondition(this, 'DEAD'); this.state = 'dead'; this.deadT = 0;
    // Directional, eased fall: keep this compatible with the current blockout rig while
    // making the death read as a short animation instead of an instant rigid rotation.
    this.fallSign = (Math.random() < 0.5 ? -1 : 1);
    this.deathYaw = (Math.random() - 0.5) * 0.65; this.deathStart = { x: this.x, z: this.z }; this.deathZone = zone || 'body';
    this.deathDuration = zone === 'head' ? 0.48 : zone === 'leg' ? 0.92 : this.role === 'heavy' ? 0.84 : 0.7; this.deathDirection = Math.random() < 0.5 ? -1 : 1; this.deathPose = Math.floor(Math.random() * 3);
    this.game.onEnemyDead(this, zone);
  }

  playRiggedAnimation(name) {
    if (!this.riggedMixer) return;
    const aliases = { patrol: 'walk', alert: 'aim', search: 'aim', combat: this.sub === 'inCover' ? 'cover' : 'aim', chase: 'run', dead: 'death' };
    const key = this.dead ? 'death' : (aliases[name] || name);
    const next = this.riggedActions.get(key) || this.riggedActions.get('idle');
    if (!next || next === this.riggedAction) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1);
    next.setLoop(key === 'death' ? T.LoopOnce : T.LoopRepeat, key === 'death' ? 1 : Infinity);
    next.clampWhenFinished = key === 'death'; next.fadeIn(0.18).play();
    if (this.riggedAction) this.riggedAction.fadeOut(0.18);
    this.riggedAction = next;
  }
  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      if (this.riggedMixer) { this.playRiggedAnimation('death'); this.riggedMixer.update(dt); this.group.position.set(this.x, this.y, this.z); this.group.rotation.set(0, this.yaw, 0); return; } const t = Math.min(1, this.deadT / (this.deathDuration || 0.7));
      const eased = t * t * (3 - 2 * t);
      const legDrop = this.deathZone === 'leg', headSnap = this.deathZone === 'head';
      this.group.rotation.x = eased * (legDrop ? 1.12 : headSnap ? 1.55 : 1.38) * this.fallSign;
      this.group.rotation.z = Math.sin(t * Math.PI) * (legDrop ? 0.25 : 0.13) * this.deathDirection;
      this.group.rotation.y = this.yaw + this.deathYaw * eased;
      // Distinct hit-zone fall timing and lateral collapse; still a procedural rigid-body approximation.
      this.group.position.y = this.y - Math.sin(t * Math.PI * 0.5) * (this.role === 'heavy' ? 0.16 : 0.12);
      // Articulate the fallback limbs during the fall; distinct poses remain bounded and reversible only by level reset.
      const p = this.model.parts, fall = Math.sin(eased * Math.PI * 0.5);
      p.body.rotation.z = this.deathDirection * fall * (this.deathPose === 1 ? 0.28 : 0.12);
      p.head.rotation.x = fall * (this.deathZone === 'head' ? 0.22 : 0.06);
      p.aL.sh.rotation.x = fall * (this.deathPose === 0 ? -0.8 : -0.35); p.aR.sh.rotation.x = fall * (this.deathPose === 2 ? -0.85 : -0.32);
      p.aL.el.rotation.x = fall * 0.65; p.aR.el.rotation.x = fall * 0.48;
      p.lL.hp.rotation.x = fall * (this.deathZone === 'leg' ? -0.75 : 0.28); p.lR.hp.rotation.x = fall * (this.deathZone === 'leg' ? 0.32 : -0.18);
      p.lL.kn.rotation.x = fall * 0.55; p.lR.kn.rotation.x = fall * 0.35;
      return;
    }
    this.repathT -= dt; this.senses(dt);
    switch (this.state) { case 'idle': case 'patrol': this.calm(dt); break; case 'alert': this.alertB(dt); break; case 'combat': this.combat(dt); break; case 'chase': this.chase(dt); break; case 'search': this.search(dt); break; }
    this.animate(dt);
  }
  animate(dt) {
    if (this.riggedMixer) {
      const clipName = this.state === 'combat' ? (this.sub === 'inCover' ? 'cover' : 'aim') : this.state === 'chase' ? 'run' : this.speedNow > 0.15 ? (this.speedNow > 2.8 ? 'run' : 'walk') : this.hitReactT > 0 ? 'hit' : 'idle';
      this.playRiggedAnimation(clipName); this.riggedMixer.update(dt);
      this.y = this.game.level.groundAt(this.x, this.z); this.group.position.set(this.x, this.y, this.z); this.group.rotation.set(0, this.yaw, 0); this.group.updateMatrixWorld(true);
      if (this.flash > 0) { this.flash -= dt; const e = this.flash > 0 ? 0.7 : 0; for (const mt of this.model.mats) { mt.emissive.setHex(e ? 0xffffff : 0); mt.emissiveIntensity = e; } }
      return;
    }
    const m = this.model.parts, crouch = this.stance === 'crouch', limping = this.condition === 'LIMPING' || this.condition === 'WOUNDED';
    this.crouchK += ((crouch ? 1 : 0) - this.crouchK) * Math.min(1, dt * 10);
    this.phase += this.speedNow * dt * 2.1; const sw = Math.sin(this.phase) * Math.min(1, this.speedNow / 2.5) * 0.6, k = this.crouchK;
    const leftSwing = limping && this.limpSign < 0 ? sw * 0.28 : sw;
    const rightSwing = limping && this.limpSign > 0 ? -sw * 0.28 : -sw;
    m.lL.hp.rotation.x = leftSwing * (1 - k) - 0.95 * k; m.lR.hp.rotation.x = rightSwing * (1 - k) - 0.95 * k;
    m.lL.kn.rotation.x = Math.max(0, -leftSwing) * 0.9 + 1.5 * k; m.lR.kn.rotation.x = Math.max(0, rightSwing) * 0.9 + 1.5 * k;
    // Blend from locomotion to a two-handed ready/aim pose when in combat. This remains a procedural fallback, not a mocap clip.
    const aiming = this.state === 'combat' && (this.sub === 'fire' || this.sub === 'inCover' || this.sub === 'flank');
    this.aimK += ((aiming ? 1 : 0) - this.aimK) * Math.min(1, dt * 5.5);
    this.fireKick = Math.max(0, this.fireKick - dt * 5.8);
    const aim = this.aimK, kick = this.fireKick;
    m.aR.sh.rotation.x = -0.55 * aim + kick * 0.22; m.aR.sh.rotation.z = -0.16 * aim;
    m.aR.el.rotation.x = -0.85 * aim + kick * 0.3;
    m.aL.sh.rotation.x = -0.48 * aim; m.aL.sh.rotation.z = 0.12 * aim;
    m.aL.el.rotation.x = -0.62 * aim;
    m.body.position.y = -0.46 * k + (this.hitReactT > 0 ? Math.sin((1 - this.hitReactT / 0.38) * Math.PI) * 0.055 : 0);
    if (this.hitReactT > 0) { this.hitReactT = Math.max(0, this.hitReactT - dt); const h = Math.sin(Math.min(1, this.hitReactT / 0.38) * Math.PI); m.body.rotation.x = h * 0.08; m.lL.hp.rotation.z += h * this.hitReactSide * 0.12; m.lR.hp.rotation.z -= h * this.hitReactSide * 0.1; } else m.body.rotation.x *= 0.75;
    this.y = this.game.level.groundAt(this.x, this.z); this.group.position.set(this.x, this.y, this.z); this.group.rotation.y = this.yaw; this.group.updateMatrixWorld(true);
    if (this.flash > 0) { this.flash -= dt; const e = this.flash > 0 ? 0.7 : 0; for (const mt of this.model.mats) { mt.emissive.setHex(e ? 0xffffff : 0); mt.emissiveIntensity = e; } }
  }
}
