// Builds a playable level from data/levels.js: textured geometry, lights, doors, interactables, pickups, particles.
import { buildWorld, makeNav, walkableFn, removeBlocker } from './core/world.js';
import { buildHumanoid } from './characters.js';
import { loadCharacterAsset } from './character-assets.js';
import { CHARACTER_ASSETS } from './data/character-identity.js';
const T = window.THREE;

// ---- procedural textures (canvas) ------------------------------------------------------------------------------
const texCache = {}, matCache = {};
const BASE = { wall: '#3d4750', metal: '#2d363e', crate: '#4d4a3a', rock: '#4f545a', wreck: '#30343a', tech: '#1d252d', snow: '#c9d5df', floorm: '#262d33', barrel: '#6a3b2a', door: '#3a444d', core: '#12202e', cliff: '#2b2f35', tree: '#2a2018', tent: '#55604c' };
function makeTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.fillStyle = BASE[kind] || '#444'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S * S * 0.05; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.12})`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  x.lineWidth = 2;
  if (kind === 'wall' || kind === 'metal' || kind === 'door' || kind === 'floorm') {
    x.strokeStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i <= S; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
    x.fillStyle = 'rgba(200,210,220,.25)'; for (let i = 8; i < S; i += 32) for (let j = 8; j < S; j += 32) x.fillRect(i, j, 2, 2);
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(80,50,30,0)'); g.addColorStop(1, 'rgba(80,50,30,.25)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  } else if (kind === 'crate') {
    x.strokeStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i <= S; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
    x.strokeStyle = 'rgba(20,18,10,.6)'; x.lineWidth = 6; x.strokeRect(3, 3, S - 6, S - 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(S, S); x.stroke();
  } else if (kind === 'snow') {
    for (let i = 0; i < 700; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(110,140,170,.25)'; x.fillRect(Math.random() * S, Math.random() * S, 3, 3); }
  } else if (kind === 'rock') {
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,20,24' : '160,165,170'},.18)`; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 14, 0, 7); x.fill(); }
  } else if (kind === 'wreck') {
    x.strokeStyle = 'rgba(180,120,60,.35)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(Math.random() * S, Math.random() * S); x.lineTo(Math.random() * S, Math.random() * S); x.stroke(); }
  } else if (kind === 'tech') {
    for (let i = 0; i < 18; i++) { x.fillStyle = ['#2bd4ff', '#ffb347', '#6bff9e'][i % 3]; x.fillRect(Math.random() * S, Math.random() * S, 3, 2); }
  }
  const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
  return (texCache[kind] = t);
}
function matFor(kind) {
  if (matCache[kind]) return matCache[kind];
  const o = { map: makeTex(kind), roughness: 0.75, metalness: 0.1 };
  if (kind === 'metal' || kind === 'door' || kind === 'wreck' || kind === 'core') { o.metalness = 0.55; o.roughness = 0.5; }
  if (kind === 'snow') { o.roughness = 0.95; o.metalness = 0; }
  if (kind === 'tech') { o.emissive = new T.Color(0x0b2a3a); o.metalness = 0.4; }
  if (kind === 'core') { o.emissive = new T.Color(0x1a5fa0); o.emissiveIntensity = 0.9; }
  return (matCache[kind] = new T.MeshStandardMaterial(o));
}
function scaleUV(g, w, h, d, tile = 2) {
  const uv = g.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < 24; i++) { const [a, b] = f[(i / 4) | 0]; uv.setXY(i, uv.getX(i) * a / tile, uv.getY(i) * b / tile); }
  uv.needsUpdate = true;
}
const FOG = { snow: [0x9db0c0, 0.017], dusk: [0x56607a, 0.02], indoor: [0x06090c, 0.034] };

export class Level {
  constructor(def, q) {
    this.disposed = false;
    this.def = def; this.q = q; this.group = new T.Group();
    this.doors = {}; this.inter = []; this.pickups = []; this.anim = []; this.flick = [];
    this.W = buildWorld(def); this.terrain = this.W.terrain; this.blockers = this.W.blockers; this.covers = this.W.covers; this.walkFn = walkableFn(this.terrain);
    this.build();
  }
  box(b, kind) {
    const g = new T.BoxGeometry(b.w, b.h, b.d); scaleUV(g, b.w, b.h, b.d);
    const m = new T.Mesh(g, matFor(kind)); m.position.set(b.x, (b.y0 || 0) + b.h / 2, b.z); m.castShadow = true; m.receiveShadow = true; this.group.add(m); return m;
  }

  buildEnvironmentalDressing(B, indoor, env) {
    const T = window.THREE, grp = this.group;
    const metal = new T.MeshStandardMaterial({ color: indoor ? 0x39434a : 0x4a4b49, metalness: 0.62, roughness: 0.58 });
    const rust = new T.MeshStandardMaterial({ color: 0x514036, metalness: 0.48, roughness: 0.78 });
    const emissive = new T.MeshStandardMaterial({ color: 0x2b414b, emissive: 0x1b6d8c, emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.5 });
    const midX = (B.x0 + B.x1) / 2, midZ = (B.z0 + B.z1) / 2;
    const w = B.x1 - B.x0, h = B.z1 - B.z0;
    const addBox = (x, y, z, sx, sy, sz, mat, rot = 0) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; grp.add(m); };
    const addPipe = (x, y, z, len, rot = 0) => { const m = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, len, 8), metal); m.rotation.z = Math.PI / 2; m.rotation.y = rot; m.position.set(x, y, z); grp.add(m); };
    if (indoor) {
      // Wall-side utility conduits and small status lamps; never placed in the central combat lane.
      const count = Math.min(9, Math.max(4, Math.floor(w / 7)));
      for (let i = 0; i < count; i++) {
        const x = B.x0 + 3 + (w - 6) * (i / Math.max(1, count - 1));
        addPipe(x, 2.65, B.z0 + 1.1, 2.1, 0); addPipe(x, 2.65, B.z1 - 1.1, 2.1, 0);
        if (i % 2 === 0) {
          const lamp = new T.Mesh(new T.BoxGeometry(0.32, 0.07, 0.12), emissive); lamp.position.set(x, Math.max(2.5, (this.def.ceil || 4.2) - 0.22), midZ + (i % 4 ? -1.5 : 1.5)); grp.add(lamp);
        }
      }
      // Low scrap panels and cable trays along selected wall margins create layered silhouettes.
      for (let i = 0; i < 5; i++) { const side = i % 2 ? -1 : 1; const x = midX + side * (w * 0.34); const z = midZ + (i - 2) * Math.min(4, h / 7); addBox(x, 0.22, z, 1.0 + (i % 3) * 0.25, 0.44, 0.12, i % 2 ? rust : metal, side * 0.12); }
    } else {
      // Weathered wreckage, broken barriers and rock-like scrap around map margins.
      for (let i = 0; i < 10; i++) {
        const side = i % 4, t = (Math.floor(i / 4) + 1) / 4;
        const x = side < 2 ? B.x0 + w * t : (side === 2 ? B.x0 + 1.6 : B.x1 - 1.6);
        const z = side >= 2 ? B.z0 + h * t : (side === 0 ? B.z0 + 1.8 : B.z1 - 1.8);
        addBox(x, 0.18 + (i % 3) * 0.08, z, 0.65 + (i % 3) * 0.22, 0.35 + (i % 2) * 0.2, 0.7, i % 3 ? rust : metal, i * 0.63);
      }
      if (env === 'snow' || env === 'dusk') for (let i = 0; i < 7; i++) {
        const x = B.x0 + 2 + ((i * 17) % Math.max(5, Math.floor(w - 4)));
        const z = B.z0 + 2 + ((i * 23) % Math.max(5, Math.floor(h - 4)));
        // Small rock clusters are visual-only; authored nav and blockers remain authoritative.
        const rock = new T.Mesh(new T.DodecahedronGeometry(0.25 + (i % 3) * 0.11, 0), new T.MeshStandardMaterial({ color: 0x50565b, roughness: 0.96 })); rock.position.set(x, 0.12, z); rock.rotation.set(i * 0.3, i * 0.8, i * 0.17); rock.scale.y = 0.6; grp.add(rock);
      }
    }
  }
  build() {
    const d = this.def, q = this.q, indoor = d.env === 'indoor', B = d.bounds, grp = this.group;
    const [fc, fd] = FOG[d.env]; this.fog = { color: fc, density: fd };
    // floor: displaced terrain mesh (vertex-coloured by slope) or a flat textured plane
    const fw = B.x1 - B.x0 + 8, fh = B.z1 - B.z0 + 8;
    if (this.terrain) grp.add(this.terrainMesh()); else {
      const ft = makeTex(indoor ? 'floorm' : 'snow').clone();
      ft.needsUpdate = true; ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(fw / 4, fh / 4);
      const floor = new T.Mesh(new T.PlaneGeometry(fw, fh), new T.MeshStandardMaterial({ map: ft, roughness: indoor ? 0.45 : 0.95, metalness: indoor ? 0.45 : 0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2); floor.receiveShadow = true; grp.add(floor);
    }
    // geometry
    for (const w of this.W.walls) this.box(w, indoor ? 'metal' : 'wall');
    for (const p of this.W.props) {
      if (p.k === 'tree') this.tree(p);
      else if (p.k === 'barrel') { const m = new T.Mesh(new T.CylinderGeometry(p.w / 2, p.w / 2, p.h, 12), matFor('crate')); m.material = new T.MeshStandardMaterial({ color: 0x6a3b2a, metalness: 0.6, roughness: 0.5 }); m.position.set(p.x, (p.y0 || 0) + p.h / 2, p.z); m.castShadow = true; grp.add(m); }
      else this.box(p, p.k === 'wall' ? (indoor ? 'metal' : 'wall') : p.k);
    }
    // Environmental dressing: bounded, decorative-only clutter adds scale and story without
    // silently changing collision/navigation or blocking authored routes.
    this.buildEnvironmentalDressing(B, indoor, d.env);
    for (const dd of this.W.doors) {
      const b = dd.box, dr = dd.def, mesh = this.box(b, 'door'), strip = new T.Mesh(new T.BoxGeometry(dr.w + 0.04, 0.12, dr.d + 0.04), new T.MeshBasicMaterial({ color: 0xff3030 }));
      strip.position.set(0, 1.6 - b.h / 2, 0); mesh.add(strip);
      this.doors[dr.id] = { b, mesh, strip, open: false, ty: 0 };
    }
    if (indoor) { const c = new T.Mesh(new T.PlaneGeometry(fw, fh), new T.MeshStandardMaterial({ color: 0x14191e, roughness: 1 })); c.rotation.x = Math.PI / 2; c.position.set((B.x0 + B.x1) / 2, d.ceil, (B.z0 + B.z1) / 2); grp.add(c); }
    // lighting
    if (indoor) { grp.add(new T.HemisphereLight(0x405468, 0x0a0c10, 0.55)); grp.add(new T.AmbientLight(0x1a2530, 0.6)); }
    else {
      grp.add(new T.HemisphereLight(d.env === 'dusk' ? 0x8a8fb8 : 0xa9c4e0, 0x2a2e38, d.env === 'dusk' ? 0.55 : 0.75));
      const sun = this.sun = new T.DirectionalLight(d.env === 'dusk' ? 0xff9a60 : 0xffe2c0, d.env === 'dusk' ? 0.9 : 1.1);
      sun.castShadow = q.shadows; sun.shadow.mapSize.set(q.sm, q.sm); sun.shadow.bias = -0.0006;
      Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix();
      grp.add(sun); grp.add(sun.target);
    }
    this.lightObjs = []; (d.lights || []).slice(0, 9).forEach(l => { const p = new T.PointLight(l.c, l.i, l.d, 1.6); p.position.set(l.x, l.y, l.z); grp.add(p); this.lightObjs.push(p); if (l.flicker) this.flick.push({ p, base: l.i, t: Math.random() * 10 }); });
    if (d.forest) this.forest();
    if (this.W.scatter.length) this.scatterTrees();
    // interactables, pickups, NPCs
    for (const it of d.interactables) { const o = { ...it, active: !it.hidden, mesh: this.vis(it) }; o.mesh.visible = o.active; grp.add(o.mesh); this.inter.push(o); }
    for (const p of d.pickups) { const o = { ...p, taken: false, mesh: this.pickupMesh(p.t) }; o.by = this.groundAt(p.x, p.z) + 0.55; o.mesh.position.set(p.x, o.by + 0.05, p.z); grp.add(o.mesh); this.pickups.push(o); }
    for (const n of d.npcs || []) {
      const isKessel = n.type === 'kessel';
      const h = buildHumanoid({
        suit: isKessel ? 0x303941 : 0xdadfe3, vest: isKessel ? 0x222a30 : 0xe8ecef,
        helm: 0x8a6a50, accent: isKessel ? 0x8c8064 : 0x587d8d, rifle: false,
        coat: !isKessel, coatColor: 0xd3d5d2, helmet: false, readyPose: false,
        radio: !isKessel, seed: isKessel ? 3 : Math.abs(Math.floor(n.x * 19 + n.z * 7)),
        profile: isKessel ? 'kessel-senior-researcher' : 'veiled-researcher-fallback'
      });
      h.group.position.set(n.x, this.groundAt(n.x, n.z), n.z); h.group.rotation.y = n.yaw || 0;
      h.parts.aR.sh.rotation.x = 0.1; h.parts.aL.sh.rotation.x = 0.1; h.parts.aL.sh.rotation.z = 0; grp.add(h.group);
      // Replace static researcher placeholders with the authored GLB when available. The existing
      // procedural model remains a deliberate offline/error fallback; these NPCs have no AI rig.
      loadCharacterAsset(CHARACTER_ASSETS.veilResearch.url, T).then(asset => {
        if (this.disposed || !h.group.parent) { asset.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return; }
        asset.position.set(n.x, this.groundAt(n.x, n.z), n.z); asset.rotation.y = n.yaw || 0;
        this.group.remove(h.group); this.group.add(asset);
        h.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
      }).catch(() => { /* Keep the established procedural NPC if local GLB loading is unavailable. */ });
    }
    // particles: snow outdoors, floating dust indoors
    const n = indoor ? 160 : 1500, geo = new T.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 20; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    this.snow = new T.Points(geo, new T.PointsMaterial({ color: indoor ? 0x8aa0b4 : 0xffffff, size: indoor ? 0.04 : 0.09, transparent: true, opacity: indoor ? 0.35 : 0.85, depthWrite: false }));
    this.snow.frustumCulled = false; this.snowN = indoor ? 160 : q.particles; grp.add(this.snow);
    this.nav = makeNav(d, this.blockers, this.terrain);
  }
  tree(p) {
    const g = new T.Group(), tr = new T.Mesh(new T.CylinderGeometry(0.28, 0.4, p.h0 || p.h, 8), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }));
    tr.position.y = (p.h0 || p.h) / 2; g.add(tr);
    for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(2.1 - i * 0.55, 3, 8), new T.MeshStandardMaterial({ color: 0x1d3328, roughness: 1 })); c.position.y = 2.6 + i * 1.6; c.castShadow = true; g.add(c); const s = new T.Mesh(new T.ConeGeometry(1.7 - i * 0.5, 0.9, 8), new T.MeshStandardMaterial({ color: 0xdfe8f0, roughness: 1 })); s.position.y = 3.4 + i * 1.6; g.add(s); }
    g.position.set(p.x, this.groundAt(p.x, p.z), p.z); this.group.add(g);
  }
  forest() {
    const B = this.def.bounds, N = 260, rnd = (() => { let s = 7; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.3, 0.42, 6, 6), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }), N);
    const crown = new T.InstancedMesh(new T.ConeGeometry(2.2, 7, 7), new T.MeshStandardMaterial({ color: 0x1b2f26, roughness: 1 }), N);
    const m = new T.Matrix4(); let i = 0, guard = 0;
    while (i < N && guard++ < N * 20) {
      const x = B.x0 - 14 + rnd() * (B.x1 - B.x0 + 28), z = B.z0 - 14 + rnd() * (B.z1 - B.z0 + 28);
      if (x > B.x0 + 1.5 && x < B.x1 - 1.5 && z > B.z0 + 1.5 && z < B.z1 - 1.5) continue;
      const s = 0.8 + rnd() * 0.7;
      const gy = this.groundAt(Math.max(B.x0, Math.min(B.x1, x)), Math.max(B.z0, Math.min(B.z1, z)));
      m.makeScale(s, s, s); m.setPosition(x, gy + 3 * s, z); trunk.setMatrixAt(i, m);
      m.makeScale(s, s * (0.9 + rnd() * 0.4), s); m.setPosition(x, gy + 8 * s, z); crown.setMatrixAt(i, m); i++;
    }
    trunk.count = crown.count = Math.min(i, this.q.trees); trunk.userData.full = crown.userData.full = i; trunk.frustumCulled = crown.frustumCulled = false; this.forestMeshes = [trunk, crown]; this.group.add(trunk, crown);
  }
  groundAt(x, z) { return this.terrain ? this.terrain.heightAt(x, z) : 0; }
  fogDensity(time) { const w = this.def.weather; return w ? w.fogMin + (w.fogMax - w.fogMin) * (0.5 + 0.5 * Math.sin(time * 0.05)) : this.fog.density; }
  // Colliding trees (see core/world.js scatter): one instanced draw call for trunks and one for crowns. Every collider is drawn at every quality level.
  scatterTrees() {
    const list = this.W.scatter, n = list.length, rnd = (() => { let s = 11; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.3, 0.42, 6, 6), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }), n);
    const crown = new T.InstancedMesh(new T.ConeGeometry(2.2, 7, 7), new T.MeshStandardMaterial({ color: 0x1b2f26, roughness: 1 }), n), m = new T.Matrix4();
    list.forEach((t, i) => { const s = 0.85 + rnd() * 0.5; m.makeScale(s, s, s); m.setPosition(t.x, t.h + 3 * s - 0.3, t.z); trunk.setMatrixAt(i, m); m.makeScale(s, s * (0.9 + rnd() * 0.4), s); m.setPosition(t.x, t.h + 8 * s - 0.3, t.z); crown.setMatrixAt(i, m); });
    trunk.frustumCulled = crown.frustumCulled = false; this.group.add(trunk, crown);
  }
  terrainMesh() {
    const terr = this.terrain, B = this.def.bounds, W = B.x1 - B.x0, D = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const g = new T.PlaneGeometry(W, D, Math.round(W / terr.res), Math.round(D / terr.res)); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terr.heightAt(x, z), sl = Math.min(1, terr.slopeAt(x, z) / 0.9), r = Math.max(0, Math.min(1, (sl - 0.35) / 0.4)), tint = 0.9 + 0.1 * Math.sin(x * 0.11 + z * 0.07);
      pos.setY(i, h); cols[i * 3] = (0.93 * (1 - r) + 0.34 * r) * tint; cols[i * 3 + 1] = (0.96 * (1 - r) + 0.36 * r) * tint; cols[i * 3 + 2] = (1.0 * (1 - r) + 0.4 * r) * tint;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const tx = makeTex('snow').clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(W / 5, D / 5);
    const mesh = new T.Mesh(g, new T.MeshStandardMaterial({ map: tx, vertexColors: true, roughness: 0.95, metalness: 0 })); mesh.receiveShadow = true; return mesh;
  }
  pickupMesh(t) {
    const g = new T.Group();
    if (t === 'health') { g.add(new T.Mesh(new T.BoxGeometry(0.34, 0.22, 0.24), new T.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.6 }))); const c = new T.Mesh(new T.BoxGeometry(0.2, 0.235, 0.06), new T.MeshBasicMaterial({ color: 0xff3030 })); g.add(c); const c2 = c.clone(); c2.rotation.y = Math.PI / 2; g.add(c2); }
    else { g.add(new T.Mesh(new T.BoxGeometry(0.34, 0.2, 0.22), new T.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.7, metalness: 0.2 }))); const s = new T.Mesh(new T.BoxGeometry(0.3, 0.05, 0.05), new T.MeshBasicMaterial({ color: 0xffc040 })); s.position.set(0, 0.06, 0.115); g.add(s); }
    return g;
  }
  vis(it) {
    const g = new T.Group(), M = (c, e) => new T.MeshStandardMaterial({ color: c, emissive: e ?? 0x000000, roughness: 0.6, metalness: 0.3 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    g.position.set(it.x, this.groundAt(it.x, it.z), it.z);
    if (it.vis === 'transmitter') {
      add(new T.BoxGeometry(1.6, 1, 0.5), M(0x20282e), 0, 0.5, 0.2); add(new T.BoxGeometry(1.2, 0.5, 0.05), M(0x103020, 0x20c060), 0, 0.7, -0.07);
      add(new T.CylinderGeometry(0.04, 0.04, 2.4, 6), M(0x555c62), 0.6, 1.9, 0.2); const l = add(new T.SphereGeometry(0.08, 8, 6), new T.MeshBasicMaterial({ color: 0xff2020 }), 0.6, 3.1, 0.2); this.anim.push(t => { l.visible = (t % 1.2) < 0.5; });
    } else if (it.vis === 'doc' || it.vis === 'keycard') {
      add(new T.BoxGeometry(0.6, 0.62, 0.5), matFor('crate'), 0, 0.31, 0);
      if (it.vis === 'doc') add(new T.BoxGeometry(0.42, 0.03, 0.3), M(0xe8e2cc, 0x403c30), 0, 0.64, 0);
      else add(new T.BoxGeometry(0.2, 0.02, 0.32), M(0x30c070, 0x30c070), 0, 0.64, 0);
    } else if (it.vis === 'cache') {
      add(new T.BoxGeometry(0.9, 0.6, 0.6), matFor('crate'), 0, 0.3, 0); add(new T.BoxGeometry(0.8, 0.05, 0.5), M(0x3a2a10, 0xffa030), 0, 0.62, 0);
    } else if (it.vis === 'locker') {
      add(new T.BoxGeometry(1.2, 0.12, 0.6), M(0x30a060, 0x20c070), 0, 1.16, 0);
    } else if (it.vis === 'panel') {
      add(new T.BoxGeometry(0.14, 0.6, 0.5), M(0x202020, 0xff8a20), 0, 1.3, 0);
    } else if (it.vis === 'terminal') {
      add(new T.BoxGeometry(1.2, 0.9, 0.6), M(0x1c242c), 0, 0.45, 0); const s = add(new T.BoxGeometry(1, 0.55, 0.05), M(0x103050, 0x30a0ff), 0, 1.05, -0.2); s.rotation.x = -0.35;
    } else if (it.vis === 'npc_warden') {
      const h = buildHumanoid({ suit: 0x3a4048, accent: 0xff4a3a, rifle: false }), p = h.parts;
      p.body.position.y = -0.48; p.lL.hp.rotation.x = -1.45; p.lR.hp.rotation.x = -1.45; p.lL.kn.rotation.x = 1.5; p.lR.kn.rotation.x = 1.5;
      p.aL.sh.rotation.set(0.3, 0, 0); p.aR.sh.rotation.set(0.5, 0, -0.2); p.body.rotation.x = 0.25; h.group.rotation.y = Math.PI; g.add(h.group);
    }
    const b = add(new T.OctahedronGeometry(0.08), new T.MeshBasicMaterial({ color: 0xffb347 }), 0, it.vis === 'npc_warden' ? 1.6 : 1.7, 0); this.anim.push(t => { b.rotation.y = t * 2; b.position.y = (it.vis === 'npc_warden' ? 1.6 : 1.7) + Math.sin(t * 2) * 0.05; });
    return g;
  }
  // Dropped pickups are dynamic: at most 12 exist at once (oldest is recycled) and taken ones leave the scene immediately.
  addPickup(t, x, z) {
    const dyn = this.pickups.filter(k => k.dyn);
    if (dyn.length >= 12) this.removePickup(dyn[0]);
    const o = { x, z, t, taken: false, dyn: true, mesh: this.pickupMesh(t) }; o.mesh.position.set(x, 0.6, z); this.group.add(o.mesh); this.pickups.push(o);
  }
  removePickup(k) { this.group.remove(k.mesh); k.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); const i = this.pickups.indexOf(k); if (i >= 0) this.pickups.splice(i, 1); }
  // Applies a graphics preset to an already-built level (particles, trees, shadows, light count).
  setQuality(q) {
    this.q = q; const indoor = this.def.env === 'indoor';
    this.snowN = indoor ? 160 : q.particles; this.snow.geometry.setDrawRange(0, this.snowN);
    if (this.sun) { this.sun.castShadow = q.shadows; if (this.sun.shadow.mapSize.x !== q.sm) { this.sun.shadow.mapSize.set(q.sm, q.sm); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } } }
    for (const m of this.forestMeshes || []) m.count = Math.min(m.userData.full, q.trees);
    (this.lightObjs || []).forEach((p, i) => { p.visible = !(q.pr < 1 && i >= 5); });
  }
  setActive(id, on) { const i = this.inter.find(x => x.id === id); if (i) { i.active = on; i.mesh.visible = on; } }
  openDoor(id) {
    const d = this.doors[id]; if (!d || d.open) return; d.open = true; d.strip.material.color.setHex(0x30ff80);
    removeBlocker(this.blockers, d.b);
    d.ty = (d.b.y0 || 0) + d.b.h * 1.5 + 0.1; this.nav.rebuild();
  }
  surfaceAt(x, z) { for (const s of this.def.surfaces || []) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s.t; return this.def.surface; }
  update(dt, p, time) {
    for (const a of this.anim) a(time);
    for (const f of this.flick) { f.t += dt * 12; f.p.intensity = f.base * (Math.sin(f.t) * Math.sin(f.t * 2.7) > 0.55 ? 0.15 : 1); }
    for (const id in this.doors) { const d = this.doors[id]; if (d.open && d.mesh.position.y < d.ty) d.mesh.position.y += dt * 2.2; }
    for (const pk of this.pickups) if (!pk.taken) { pk.mesh.rotation.y += dt * 1.5; pk.mesh.position.y = pk.by + Math.sin(time * 2 + pk.x) * 0.05; }
    if (this.sun) { this.sun.position.set(p.x + 22, (p.y || 0) + 36, p.z + 14); this.sun.target.position.set(p.x, p.y || 0, p.z); }
    const pos = this.snow.geometry.attributes.position, n = this.snowN, indoor = this.def.env === 'indoor', fall = indoor ? 0.08 : 1.8, wind = indoor ? 0.05 : 0.7;
    for (let i = 0; i < n; i++) {
      let x = pos.getX(i) + wind * dt, y = pos.getY(i) - fall * dt * (0.7 + (i % 5) * 0.15), z = pos.getZ(i);
      const py = p.y || 0; if (y < py - 2) y += 22; else if (y > py + 20) y -= 22; if (x - p.x > 20) x -= 40; else if (x - p.x < -20) x += 40; if (z - p.z > 20) z -= 40; else if (z - p.z < -20) z += 40;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }
  dispose() { this.disposed = true; this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } }); }
}
