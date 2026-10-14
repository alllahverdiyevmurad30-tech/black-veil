// Small static GLB loader for BLACK VEIL's unskinned character blockouts.
// Keeps the current Three.js r128 global runtime; this intentionally does not claim skeletal animation support.
const glbCache = new Map();

export function readGlbChunks(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB header');
  if (view.getUint32(4, true) !== 2) throw new Error('Only GLB v2 is supported');
  const declared = view.getUint32(8, true);
  if (declared > view.byteLength || declared < 20) throw new Error('Invalid GLB length');
  let offset = 12, json = null, bin = null;
  while (offset + 8 <= declared) {
    const size = view.getUint32(offset, true), type = view.getUint32(offset + 4, true); offset += 8;
    if (size < 0 || offset + size > declared) throw new Error('Invalid GLB chunk bounds');
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, size)).replace(/\u0000+$/g, '').trim());
    else if (type === 0x004e4942) bin = new Uint8Array(buffer, offset, size);
    offset += size;
  }
  if (!json || !bin || !json.asset || !String(json.asset.version).startsWith('2')) throw new Error('GLB missing JSON/BIN or glTF 2 asset metadata');
  return { json, bin };
}

const COMPONENT = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const COMPONENT_CTOR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function accessorArray(gltf, bin, index) {
  const a = gltf.accessors?.[index], bv = a && gltf.bufferViews?.[a.bufferView];
  if (!a || !bv || a.sparse) throw new Error('Unsupported or missing GLB accessor');
  const [bytes, getter] = COMPONENT[a.componentType] || [];
  const count = COMPONENTS[a.type];
  if (!bytes || !count) throw new Error('Unsupported GLB accessor format');
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || bytes * count;
  const out = new COMPONENT_CTOR[a.componentType](a.count * count), view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < count; c++) {
    const at = start + i * stride + c * bytes;
    out[i * count + c] = bytes === 1 ? view[getter](at) : view[getter](at, true);
  }
  return { array: out, itemSize: count, componentType: a.componentType };
}

async function buildStaticScene(gltf, bin, T) {
  const textureCache = new Map();
  const loadTexture = async index => {
    if (textureCache.has(index)) return textureCache.get(index);
    const def = gltf.textures?.[index], imageDef = def && gltf.images?.[def.source];
    if (!imageDef || imageDef.bufferView === undefined || typeof createImageBitmap !== 'function' || typeof Blob !== 'function') return null;
    const bv = gltf.bufferViews[imageDef.bufferView], start = bv.byteOffset || 0;
    const bytes = bin.subarray(start, start + bv.byteLength);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: imageDef.mimeType || 'image/png' }));
    const tex = new T.Texture(bitmap); tex.needsUpdate = true;
    if (T.sRGBEncoding !== undefined) tex.encoding = T.sRGBEncoding;
    const sampler = def.sampler === undefined ? {} : (gltf.samplers || [])[def.sampler] || {};
    if (sampler.wrapS === 10497) tex.wrapS = T.RepeatWrapping;
    if (sampler.wrapT === 10497) tex.wrapT = T.RepeatWrapping;
    textureCache.set(index, tex); return tex;
  };
  const materials = await Promise.all((gltf.materials || []).map(async m => {
    const p = m.pbrMetallicRoughness || {}, c = p.baseColorFactor || [1, 1, 1, 1];
    const map = p.baseColorTexture ? await loadTexture(p.baseColorTexture.index) : null;
    return new T.MeshStandardMaterial({ color: new T.Color(c[0], c[1], c[2]), map, opacity: c[3] ?? 1, transparent: (c[3] ?? 1) < 1, roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 0, side: m.doubleSided ? T.DoubleSide : T.FrontSide, emissive: m.emissiveFactor ? new T.Color(...m.emissiveFactor) : new T.Color(0x000000) });
  }));
  const meshDefs = (gltf.meshes || []).map(md => (md.primitives || []).map(p => {
    if (p.mode !== undefined && p.mode !== 4) throw new Error('Only triangle primitives are supported by the static blockout loader');
    const g = new T.BufferGeometry();
    for (const [semantic, attr] of Object.entries(p.attributes || {})) {
      if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(semantic)) continue;
      const a = accessorArray(gltf, bin, attr), name = semantic === 'POSITION' ? 'position' : semantic === 'NORMAL' ? 'normal' : 'uv';
      g.setAttribute(name, new T.BufferAttribute(a.array, a.itemSize, false));
    }
    if (p.indices !== undefined) { const a = accessorArray(gltf, bin, p.indices); g.setIndex(new T.BufferAttribute(a.array, 1)); }
    if (!g.getAttribute('position')) throw new Error('GLB primitive has no POSITION attribute');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.computeBoundingSphere();
    return new T.Mesh(g, materials[p.material] || new T.MeshStandardMaterial({ color: 0x777777, roughness: 0.9 }));
  }));
  const nodes = (gltf.nodes || []).map((n, i) => {
    const group = new T.Group(); group.name = n.name || `GLB_Node_${i}`;
    if (n.matrix) { const matrix = new T.Matrix4().fromArray(n.matrix); matrix.decompose(group.position, group.quaternion, group.scale); }
    else { if (n.translation) group.position.fromArray(n.translation); if (n.rotation) group.quaternion.set(n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]); if (n.scale) group.scale.fromArray(n.scale); }
    if (n.mesh !== undefined) for (const m of meshDefs[n.mesh] || []) group.add(m.clone());
    return group;
  });
  nodes.forEach((obj, i) => { for (const child of gltf.nodes[i].children || []) nodes[i].add(nodes[child]); });
  const scene = new T.Group(); scene.name = 'BLACK_VEIL_Static_GLTF';
  const def = gltf.scenes?.[gltf.scene || 0];
  for (const root of def?.nodes || nodes.map((_, i) => i).filter(i => !(gltf.nodes || []).some(n => (n.children || []).includes(i)))) scene.add(nodes[root]);
  return scene;
}

export async function loadCharacterAsset(url, T = window.THREE) {
  if (!T) throw new Error('Three.js is not available');
  let promise = glbCache.get(url);
  if (!promise) {
    promise = fetch(url).then(r => { if (!r.ok) throw new Error(`Character GLB request failed: ${r.status}`); return r.arrayBuffer(); })
      .then(async buffer => { const { json, bin } = readGlbChunks(buffer); return await buildStaticScene(json, bin, T); });
    glbCache.set(url, promise);
    promise.catch(() => glbCache.delete(url));
  }
  const base = await promise, copy = base.clone(true);
  // Per-instance geometry/material copies prevent one level's disposal from invalidating the cache.
  copy.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone()); else o.material = o.material.clone(); o.castShadow = true; o.receiveShadow = true; } });
  return copy;
}

// Skeletal GLB loader for authored/procedural glTF 2.0 characters. Returns a Group with
// userData.animationMixer and userData.animationClips for existing game systems to drive.
export async function loadRiggedCharacterAsset(url, T = window.THREE) {
  if (!T) throw new Error('Three.js is not available');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Rigged character request failed: ${response.status}`);
  const { json: gltf, bin } = readGlbChunks(await response.arrayBuffer());
  if (!gltf.skins?.length) throw new Error('GLB does not contain a skin/skeleton');
  const skin = gltf.skins[0];
  const nodes = gltf.nodes || [];
  const jointSet = new Set(skin.joints);
  const objectNodes = nodes.map((n, i) => {
    const o = jointSet.has(i) ? new T.Bone() : new T.Group(); o.name = n.name || `GLTF_Node_${i}`;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  nodes.forEach((n, i) => (n.children || []).forEach(ci => objectNodes[i].add(objectNodes[ci])));
  const roots = gltf.scenes?.[gltf.scene || 0]?.nodes || [];
  const scene = new T.Group(); scene.name = 'BLACK_VEIL_RiggedCharacter';
  roots.forEach(i => scene.add(objectNodes[i]));
  const jointNodes = skin.joints.map(i => objectNodes[i]);
  const inverse = skin.inverseBindMatrices === undefined ? null : accessorArray(gltf, bin, skin.inverseBindMatrices).array;
  const inverseMatrices = jointNodes.map((_, i) => inverse ? new T.Matrix4().fromArray(Array.from(inverse.slice(i * 16, i * 16 + 16))) : new T.Matrix4());
  const skeleton = new T.Skeleton(jointNodes, inverseMatrices);
  const mats = (gltf.materials || []).map(m => {
    const p = m.pbrMetallicRoughness || {}, c = p.baseColorFactor || [1,1,1,1];
    return new T.MeshStandardMaterial({color:new T.Color(c[0],c[1],c[2]), roughness:p.roughnessFactor ?? 1, metalness:p.metallicFactor ?? 0, side:m.doubleSided ? T.DoubleSide : T.FrontSide});
  });
  for (const nd of nodes) {
    if (nd.mesh === undefined || nd.skin === undefined) continue;
    const meshDef = gltf.meshes[nd.mesh];
    for (const prim of meshDef.primitives || []) {
      const g = new T.BufferGeometry();
      for (const [semantic, attr] of Object.entries(prim.attributes || {})) {
        const a = accessorArray(gltf, bin, attr);
        const names = {POSITION:'position', NORMAL:'normal', TEXCOORD_0:'uv', JOINTS_0:'skinIndex', WEIGHTS_0:'skinWeight'};
        if (names[semantic]) g.setAttribute(names[semantic], new T.BufferAttribute(a.array, a.itemSize, false));
      }
      if (prim.indices !== undefined) { const a = accessorArray(gltf, bin, prim.indices); g.setIndex(new T.BufferAttribute(a.array, 1)); }
      if (!g.getAttribute('position') || !g.getAttribute('skinIndex') || !g.getAttribute('skinWeight')) throw new Error('Skinned primitive requires POSITION, JOINTS_0 and WEIGHTS_0');
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const mesh = new T.SkinnedMesh(g, mats[prim.material] || new T.MeshStandardMaterial({color:0x444950, roughness:.8}));
      mesh.name = meshDef.name || 'BV_SkinnedMesh'; mesh.bind(skeleton); mesh.castShadow = true; mesh.receiveShadow = true;
      objectNodes[nodes.indexOf(nd)].add(mesh);
    }
  }
  const clips = (gltf.animations || []).map(a => {
    const tracks = [];
    for (const ch of a.channels || []) {
      const sampler = a.samplers[ch.sampler], target = ch.target, node = nodes[target.node];
      if (!sampler || !node) continue;
      const input = accessorArray(gltf, bin, sampler.input).array;
      const output = accessorArray(gltf, bin, sampler.output).array;
      const path = target.path;
      const size = path === 'rotation' ? 4 : path === 'translation' || path === 'scale' ? 3 : 0;
      if (!size) continue;
      const trackName = `${node.name || `GLTF_Node_${target.node}`}.${path === 'rotation' ? 'quaternion' : path}`;
      const Track = path === 'rotation' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
      tracks.push(new Track(trackName, input, output));
    }
    return new T.AnimationClip(a.name || 'GLTF_Animation', -1, tracks);
  });
  const mixer = new T.AnimationMixer(scene);
  scene.userData.animationMixer = mixer;
  scene.userData.animationClips = clips;
  scene.userData.skeleton = skeleton;
  return scene;
}
