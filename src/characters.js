// Shared procedural character fallback for the current Three.js r128 renderer.
// This improves silhouette, face readability, garment layering and footwear while keeping the
// existing visible-part hit meshes and pivot API. It is NOT a substitute for sculpted/UV-mapped,
// rigged AAA character assets; no SkinnedMesh or animation clips are fabricated here.
const T = window.THREE;

const PALETTES = [
  { skin: 0xb98568, hair: 0x30251f, trim: 0x6b756e, pack: 0x252d2c },
  { skin: 0x8f6049, hair: 0x171717, trim: 0x77705e, pack: 0x34332a },
  { skin: 0xd0a184, hair: 0x6d5544, trim: 0x4e5a63, pack: 0x242b31 },
  { skin: 0xa87358, hair: 0x292522, trim: 0x5c6654, pack: 0x333b30 },
  { skin: 0xdeb89a, hair: 0x4b382d, trim: 0x6c7379, pack: 0x30343a },
];

export function buildHumanoid(o = {}) {
  const g = new T.Group(), hit = [], mats = [], parts = {};
  const seed = Math.abs(Math.floor(o.seed ?? 0)) % PALETTES.length, palette = PALETTES[seed];
  const M = (c, metalness = 0.02, roughness = 0.82) => { const m = new T.MeshStandardMaterial({ color: c, metalness, roughness }); mats.push(m); return m; };
  const suitColor = o.suit ?? 0x303840, vestColor = o.vest ?? 0x1a2026;
  const suit = M(suitColor), seam = M(o.trim ?? palette.trim), vest = M(vestColor, 0.12, 0.68);
  const skin = M(o.skin ?? palette.skin, 0, 0.9), hair = M(o.hair ?? palette.hair, 0, 0.92);
  const helmet = M(o.helm ?? 0x20262a, 0.18, 0.58), boot = M(o.boot ?? 0x171a1c, 0.08, 0.72);
  const sole = M(0x090b0d, 0.02, 0.92), glove = M(o.glove ?? 0x24292b, 0.02, 0.8);
  const hardware = M(0x51585b, 0.62, 0.42), pouchMat = M(o.pouch ?? 0x252b2d, 0.03, 0.9);
  const accent = new T.MeshStandardMaterial({ color: o.accent ?? 0x9b4437, emissive: 0x000000, roughness: 0.65 }); mats.push(accent);
  const eyeWhite = M(0xd4d0c6, 0, 0.55), iris = M(o.eye ?? 0x465b60, 0, 0.38), dark = M(0x171719, 0, 0.9), lip = M(0x70483e, 0, 0.86);
  const s = o.heavy ? 1.1 : (o.scale ?? 1), front = -1;

  function mesh(geo, material, x, y, z, parent, zone = null, cast = true) {
    const m = new T.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m);
    if (zone) { m.userData.zone = zone; hit.push(m); }
    return m;
  }
  function ellipsoid(parent, material, x, y, z, sx, sy, sz, zone = null, detail = 16) {
    const m = mesh(new T.SphereGeometry(1, detail, Math.max(10, Math.floor(detail * 0.7))), material, x, y, z, parent, zone);
    m.scale.set(sx, sy, sz); return m;
  }
  function box(parent, material, x, y, z, w, h, d, zone = null) {
    return mesh(new T.BoxGeometry(w, h, d), material, x, y, z, parent, zone);
  }
  function cylinder(parent, material, x, y, z, rt, rb, h, sides = 10) {
    return mesh(new T.CylinderGeometry(rt, rb, h, sides), material, x, y, z, parent);
  }

  // Torso and pelvis: overlapping rounded volumes give the fallback a less block-like silhouette.
  const body = new T.Group(); g.add(body); parts.body = body;
  ellipsoid(body, suit, 0, 0.98, 0, 0.205 * s, 0.18, 0.125, 'torso', 18);
  const chest = ellipsoid(body, suit, 0, 1.35, 0, 0.255 * s, 0.34, 0.15, 'torso', 20);
  chest.rotation.x = -0.03;
  ellipsoid(body, vest, 0, 1.36, -0.006, 0.245 * s, 0.29, 0.158, null, 18);
  // Shoulder pads are garment pieces, not hitboxes that extend beyond the body.
  for (const side of [-1, 1]) {
    const pad = ellipsoid(body, vest, side * 0.255 * s, 1.57, 0, 0.105, 0.105, 0.125, null, 12);
    pad.rotation.z = side * -0.12;
    box(body, seam, side * 0.185 * s, 1.31, -0.155, 0.018, 0.31, 0.008);
  }
  // Collar, neck, belt, seams, closure and deliberately limited utility gear.
  ellipsoid(body, seam, 0, 1.64, -0.006, 0.12, 0.055, 0.105, null, 12);
  cylinder(body, skin, 0, 1.69, 0, 0.064, 0.07, 0.14, 12);
  box(body, pouchMat, 0, 1.035, -0.126, 0.32, 0.055, 0.035);
  box(body, hardware, 0, 1.035, -0.15, 0.065, 0.045, 0.018);
  box(body, seam, 0, 1.39, -0.165, 0.014, 0.24, 0.012);
  for (const x of [-0.13, 0.13]) {
    const p = box(body, pouchMat, x, 1.22, -0.167, 0.075, 0.105, 0.04);
    p.rotation.z = x * -0.35;
    box(body, hardware, x, 1.26, -0.19, 0.026, 0.012, 0.01);
  }
  // ID tab / subdued unit marking; no oversized glowing sci-fi visor.
  box(body, accent, -0.17, 1.49, -0.16, 0.055, 0.024, 0.012);
  if (o.coat) {
    const coat = ellipsoid(body, M(o.coatColor ?? 0xd3d5d2, 0, 0.93), 0, 1.25, 0.012, 0.285, 0.43, 0.17, null, 18);
    coat.scale.x = 0.285; coat.material.side = T.DoubleSide;
    box(body, seam, 0, 1.34, -0.165, 0.012, 0.4, 0.008);
    for (const x of [-0.18, 0.18]) box(body, o.coatColor ? M(o.coatColor, 0, 0.9) : seam, x, 1.24, -0.15, 0.065, 0.12, 0.018);
  }
  if (o.profile === 'kessel-senior-researcher') {
    // Restrained tailored jacket, shirt and tie distinguish the senior facility role from lab staff.
    const shirt = M(0xc8c9c4, 0, 0.88), tie = M(o.accent ?? 0x77705d, 0.02, 0.7);
    const lapelL = box(body, seam, -0.075, 1.43, -0.17, 0.075, 0.19, 0.018); lapelL.rotation.z = -0.28;
    const lapelR = box(body, seam, 0.075, 1.43, -0.17, 0.075, 0.19, 0.018); lapelR.rotation.z = 0.28;
    box(body, shirt, 0, 1.42, -0.164, 0.105, 0.23, 0.012);
    box(body, tie, 0, 1.38, -0.178, 0.028, 0.17, 0.014);
    box(body, hardware, -0.16, 1.18, -0.17, 0.055, 0.032, 0.012); // restrained access badge
  }
  if (o.heavy) {
    ellipsoid(body, vest, 0, 1.34, 0.18, 0.235, 0.3, 0.12, null, 14);
    box(body, pouchMat, 0, 1.18, 0.27, 0.22, 0.17, 0.06);
  }

  // Head is skin, not a helmet-colored sphere. Features face -Z and are intentionally restrained.
  const head = new T.Group(); head.position.set(0, 1.83, 0); body.add(head); parts.head = head;
  const skull = ellipsoid(head, skin, 0, 0, 0, 0.137, 0.177, 0.128, 'head', 20);
  skull.scale.x *= 0.98 + (seed % 3) * 0.025;
  ellipsoid(head, skin, 0, -0.09, -0.045, 0.095, 0.078, 0.093, null, 16); // lower face / jaw
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, side * 0.137, -0.005, 0, 0.027, 0.045, 0.024, null, 10); // ears
    ellipsoid(head, dark, side * 0.053, 0.022, -0.113, 0.034, 0.026, 0.013, null, 12); // socket shadow
    ellipsoid(head, eyeWhite, side * 0.052, 0.022, -0.124, 0.024, 0.015, 0.008, null, 12);
    ellipsoid(head, iris, side * 0.052, 0.022, -0.132, 0.009, 0.011, 0.004, null, 10);
    ellipsoid(head, dark, side * 0.052, 0.022, -0.136, 0.0045, 0.007, 0.0025, null, 8);
    const brow = ellipsoid(head, hair, side * 0.052, 0.049, -0.12, 0.035, 0.009, 0.009, null, 10); brow.rotation.z = side * -0.08;
  }
  // Nose bridge/tip, mouth and subtle chin shadow.
  ellipsoid(head, skin, 0, -0.015, -0.134, 0.018, 0.04, 0.021, null, 10);
  ellipsoid(head, skin, 0, -0.043, -0.142, 0.027, 0.016, 0.018, null, 10);
  box(head, lip, 0, -0.071, -0.126, 0.046, 0.008, 0.009);
  if (o.stubble) {
    const stubble = M(o.stubbleColor ?? 0x4b3931, 0, 1); ellipsoid(head, stubble, 0, -0.102, -0.085, 0.076, 0.035, 0.04, null, 12);
  }
  // Hairline/cap with side locks. For soldiers, helmet overlays the top but leaves the face readable.
  const hairCap = ellipsoid(head, hair, 0, 0.105, 0.008, 0.14, 0.075, 0.13, null, 16);
  hairCap.rotation.x = -0.08;
  for (const side of [-1, 1]) ellipsoid(head, hair, side * 0.118, 0.035, 0.012, 0.026, 0.082, 0.09, null, 12);
  if (o.helmet !== false) {
    const shell = ellipsoid(head, helmet, 0, 0.105, 0.008, 0.15, 0.087, 0.145, null, 16);
    shell.scale.y = 0.78;
    ellipsoid(head, helmet, 0, 0.05, -0.108, 0.12, 0.022, 0.035, null, 12); // brow lip
    box(head, accent, 0, 0.082, -0.15, 0.06, 0.012, 0.008);
  }

  // Arms: upper/lower pivots retained for existing procedural movement and hit-zone semantics.
  const arm = side => {
    const sh = new T.Group(); sh.position.set(side * 0.29 * s, 1.56, 0); body.add(sh);
    const upper = ellipsoid(sh, suit, 0, -0.145, 0, 0.079, 0.18, 0.082, 'arm', 14); upper.rotation.z = side * -0.04;
    ellipsoid(sh, vest, 0, -0.06, -0.008, 0.084, 0.09, 0.086, null, 12); // shoulder seam/pad
    const el = new T.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    ellipsoid(el, suit, 0, -0.13, 0, 0.064, 0.17, 0.067, 'arm', 14);
    ellipsoid(el, glove, 0, -0.28, -0.004, 0.06, 0.06, 0.065, null, 12);
    // cuff ring and simplified palm; finger shapes are kept low-cost for the fallback.
    cylinder(el, hardware, 0, -0.245, 0, 0.064, 0.064, 0.025, 10);
    ellipsoid(el, glove, 0, -0.345, -0.01, 0.057, 0.072, 0.052, null, 12);
    for (let i = -1; i <= 1; i++) ellipsoid(el, glove, i * 0.027, -0.398, -0.025, 0.014, 0.04, 0.018, null, 8);
    return { sh, el };
  };
  const aL = arm(-1), aR = arm(1); parts.aL = aL; parts.aR = aR;

  // Articulated legs with reinforced knees and distinct boot sole / toe / lace details.
  const leg = side => {
    const hp = new T.Group(); hp.position.set(side * 0.115 * s, 0.94, 0); g.add(hp);
    ellipsoid(hp, suit, 0, -0.205, 0, 0.09 * s, 0.245, 0.105, 'leg', 16);
    ellipsoid(hp, seam, 0, -0.35, -0.013, 0.085 * s, 0.075, 0.108, null, 12); // knee reinforcement
    const kn = new T.Group(); kn.position.set(0, -0.44, 0); hp.add(kn);
    ellipsoid(kn, suit, 0, -0.19, 0, 0.071 * s, 0.22, 0.08, 'leg', 14);
    ellipsoid(kn, suit, 0, -0.335, -0.01, 0.072, 0.08, 0.086, null, 12); // ankle/cuff
    // Foot points forward (-Z); boot upper is rounded and sole is a distinct rubber layer.
    const shoe = ellipsoid(kn, boot, 0, -0.415, -0.065, 0.078, 0.074, 0.145, null, 14);
    shoe.rotation.x = -0.05;
    box(kn, sole, 0, -0.468, -0.067, 0.158, 0.026, 0.29);
    ellipsoid(kn, boot, 0, -0.397, -0.14, 0.073, 0.05, 0.07, null, 12); // toe cap
    box(kn, seam, 0, -0.39, -0.078, 0.06, 0.01, 0.055); // tongue
    for (let i = 0; i < 3; i++) box(kn, hardware, 0, -0.37 + i * 0.018, -0.08 + i * 0.025, 0.044, 0.007, 0.008);
    // Tread ribs are modeled geometry, not texture claims.
    for (let i = 0; i < 3; i++) box(kn, dark, 0, -0.483, -0.16 + i * 0.075, 0.11, 0.006, 0.012);
    return { hp, kn };
  };
  const lL = leg(-1), lR = leg(1); parts.lL = lL; parts.lR = lR;

  // A small shoulder radio and aerial are role-specific, never a wall of decorative equipment.
  if (o.radio) {
    box(body, pouchMat, -0.205, 1.56, -0.125, 0.07, 0.11, 0.04);
    cylinder(body, hardware, -0.205, 1.65, -0.13, 0.006, 0.006, 0.09, 6).rotation.z = 0.1;
  }
  if (o.rifle !== false) {
    const r = new T.Group(); aR.el.add(r); r.position.set(-0.04, -0.31, -0.19);
    box(r, hardware, 0, 0, 0, 0.055, 0.055, 0.42);
    box(r, dark, 0, -0.045, 0.09, 0.065, 0.11, 0.08);
    box(r, pouchMat, 0, -0.02, -0.14, 0.045, 0.04, 0.15);
  }

  // Preserve the prior ready pose used by enemies and static NPCs.
  if (o.readyPose !== false) {
    aR.sh.rotation.x = -1.15; aL.sh.rotation.x = -1.2;
    aL.sh.rotation.z = 0.27; aR.el.rotation.x = -0.15; aL.el.rotation.x = -0.2;
  }
  g.userData.characterFallback = true;
  g.userData.profile = o.profile ?? (o.coat ? 'researcher-fallback' : o.heavy ? 'warden-heavy-fallback' : 'warden-fallback');
  g.userData.seed = seed;
  return { group: g, hit, mats, parts, quality: 'procedural-fallback-not-production-asset' };
}
