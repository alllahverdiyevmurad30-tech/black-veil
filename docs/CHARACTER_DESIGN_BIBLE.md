# BLACK VEIL — Character Design Bible & Asset Audit

**Revision:** 2026-10-13  
**Scope:** Existing browser/Three.js runtime, source repository and files actually present.  
**Status:** `PARTIAL / STATIC PROCEDURAL BLOCKOUTS`. Some GLB assets, generated per-part UVs/procedural base-color maps, a minimal static GLB loader and a Blender-side rigging script now exist. This is not a claim that AAA assets or a validated rig have been created.

## 1. Phase A audit — verified from the repository

- `src/characters.js` is the one shared procedural humanoid builder used by `src/enemy.js` and `src/level.js`.
- Existing character meshes are built from Three.js primitives and `MeshStandardMaterial`. The hit-zone meshes are visible body-part geometry with `userData.zone` values; the enemy controller expects `head`, `torso`, `arm`, and `leg` zones.
- `src/enemy.js` animates pivots procedurally and uses `src/core/npc-state.js` for injury-condition state. There is no `SkinnedMesh`, `Skeleton`, `AnimationMixer`, GLTF/FBX character loader, rigged animation clip, facial rig, blend-shape set, or character LOD pipeline in the current `src/` code.
- The character pipeline now exports `.glb` static blockouts plus the original Elias `.obj`/`.mtl` interchange copy. Ten UV-bearing review variants contain embedded procedural base-color maps. These are not scanned/photo-real PBR sets or a packed production UV atlas.
- The player is first-person and `src/player.js` does not create a full-body player model. Elias therefore has no actual hero mesh in this build.
- Level NPCs are generic static figures, not registered named character assets. Story data references Dana, Mara, Dr. Kessel and a wounded Warden through events/dialogue rather than a full cast asset system.
- Three.js is a declared package dependency but `vendor/three.min.js` is not bundled in the project archive. The static GLB loader is wired for researcher placeholder replacement, but a real browser/WebGL render was not visually verified in this environment.

## 2. Single source of character identity

`src/data/character-identity.js` is the authoritative *design manifest* for named characters, faction style rules and chapter appearance targets. It deliberately separates established canon from proposed art direction. It is not a mesh registry and does not pretend that an identity definition means an asset exists.

### Canonical named-character inventory

| Character | Existing story facts supported by repository | Asset state | Production direction |
|---|---|---|---|
| Elias Voss | Former rescue specialist; signed the Level 4 seal order believing the level was clear; arrives after a transmission in Dana's voice | **Static 127-part procedural blockout** (`elias_voss_uv.glb` includes per-part UVs and procedural base-color maps); first-person hero is not loaded into gameplay | Distinct rescue specialist, layered cold-weather shell, field trousers, detailed boots; keep fatigue grounded, not superhero-like |
| Dana Voss | Elias's wife; volunteered for VEIL Phase 3 interface; asked that Elias not be told until transfer was stable | **Static palette/shape blockout** (`dana_voss_blockout.glb`); not unique sculpted anatomy, rigged or gameplay-integrated | One canonical face/hair identity across timeline-appropriate everyday, recording and research variants; do not assume every timeline requires a lab coat |
| Mara Vale | Radio handler linked to carrier signal/investigation; post-game White Valley explorer label | **Static palette/shape blockout** (`mara_vale_blockout.glb`) with simple headset blockout; not rigged or gameplay-integrated | Distinct field-capable communications/investigation silhouette; modest equipment, not a futuristic gadget wall |
| Marcus Hale | Rescue Team Bravo roster with Elias and T. Rowan; later asked about by Mara | **Mentioned only**; no mesh | Rescue-team practical fieldwear; physical details remain a design target until story canon supplies more |
| Maren Hale | Continuity notes foreshadow Mara as Maren Hale; full reveal explicitly not implemented | **Not modeled; story reveal incomplete** | Keep separate from Mara until reveal/timeline are finalized; any family resemblance is provisional |
| Dr. Kessel | VEIL lead in chapter 3; later maintenance-channel presence is described in continuity | **Distinct procedural fallback in the chapter 3 static NPC slot**; still not a production mesh | Restrained tailored jacket, shirt/tie and access badge distinguish the senior role from lab staff; facial identity remains placeholder-level |
| Wounded Warden | Story/AI role exists; enemy conditions can include injury | **Procedural enemy fallback only** | Retain faction silhouette; any injury appearance must follow actual saved/AI state |
| T. Rowan | Named in Rescue Team Bravo roster | **Mentioned only** | Do not expand into a named cast member without an approved story requirement |

Eleanor Voss, Thomas Voss and Miriam Hale are **not present as approved, fully specified character assets** in the current project files. They are not created by this pass; adding them would risk expanding canon without story approval.

## 3. Faction visual system

The manifest defines design targets for Wardens, Drifters, Fractured survivors, Collectors, Returned characters, VEIL work roles, Kessel Holdings and friendly survivors. These are authored direction, not proof that every faction currently has a rendered implementation. Existing Warden-like combat roles, a generic static researcher-style NPC, and a distinct procedural Kessel silhouette are wired to the shared fallback builder.

- **Wardens:** charcoal/olive practical outerwear, restrained red-orange marking, role-specific vest and limited pouches. Spawn-position-derived palette variation is deterministic.
- **Drifters / Collectors / survivors:** individual repaired civilian layers, mixed materials and varied practical footwear are still design targets; their own faction spawn/model registration is not present in the current asset pipeline.
- **VEIL personnel:** researcher fallback uses light workwear and no helmet, but it is still a primitive procedural mesh, not a lab-ready professional model.
- **Returned characters:** retain the original canonical asset and apply state-backed changes only. No returned-character persistence/appearance system currently exists.

## 4. Procedural fallback changed in this pass

`src/characters.js` remains the single builder to avoid duplicate architecture. The fallback now includes:

- A skin-colored head with simple eyes, brows, nose, ears, mouth and hair/helmet layers instead of a helmet-colored sphere as the entire head.
- Rounded torso, shoulder, limb and knee volumes to soften the all-box silhouette.
- Garment seam/closure cues, restrained vest pockets, belt, buckle and limited radio option.
- A distinct boot upper, sole, toe volume, lace/eyelet cues and tread ribs.
- Deterministic palette variants based on spawn position seed; enemy AI and visible hit-zone API remain in the existing architecture.
- Researcher-style static NPC fallback without helmet and without the combat-ready raised-arm pose.

These are low-cost procedural mesh details, not sculpted anatomy, retopology or an AAA face. Hand/finger geometry is simplified. Facial expression is not animated. The static UV variants have generated per-part projections and embedded procedural base-color micro-variation, but no packed atlas, normal/AO/roughness maps, skinning or validated rig.

## 5. Chapter continuity targets

`CHAPTER_APPEARANCE` records deterministic wear *targets* for Frostline, White Valley, Kalder Ridge, Under the Rails, The Descent, The Archive, Quarantine, The Long Night and Black Veil. They are not yet connected to save/story state or material overlays. Snow, wetness, grime, tears and timeline-specific wardrobe changes are therefore **NOT IMPLEMENTED**. Do not apply random per-frame wear or claim that chapter wear persists.

## 6. Material / UV / rig / animation status

| Requirement | Status | Evidence / limitation |
|---|---|---|
| PBR-capable base material | Partial | GLB blockouts embed procedural base-color maps; not a production PBR set |
| Base color / normal / roughness / AO maps | Partial | Base-color micro-variation only; no authored normal/AO/roughness map set |
| UV layout / texel density | Partial | Per-part dominant-plane UV projection; no packed atlas or texel-density pass |
| Skeleton / skin weights / retargeting | Script prepared, not executed | `tools/character_pipeline/blender_rig_uv_export.py`; Blender unavailable here, so no rigged GLB is verified |
| Locomotion / weapon animation | Procedural fallback | Existing pivot rotation; no clips or animation blending |
| Facial expression / lip-sync | Not implemented | Facial parts are static geometry |
| Foot-contact IK / stair validation | Not implemented | No IK/foot locking system |
| LOD0–LOD3 character meshes | Not implemented | No character LOD pipeline |
| Actual render QA screenshots | Not verified | Browser/WebGL runtime not launched successfully in this environment |
| Character-specific save/load appearance | Not implemented | Chapter wear manifest is documentation only |

## 7. Required next production steps

1. Approve visual references and physical traits for Elias, Dana, Mara, Hale and Maren before sculpting faces.
2. Create or license production-ready base meshes with clear usage rights; create proper UVs, texture sets and a compatible humanoid skeleton.
3. Validate the static GLB loader in a real browser and ensure the researcher replacement does not cause texture/resource leaks; preserve combat hit-zone mapping and NPC state logic.
4. Replace placeholder variants with approved unique sculpts for Elias, Dana and Mara, then named supporting characters and faction variants.
5. Author chapter wear as deterministic state data and include it in save/load only after defining migration-compatible schema.
6. Validate exported GLB/GLTF, actual browser renders, face/footwear close-ups, animation deformation and LOD transitions on a real renderer.

## 8. Blocked steps and alternatives

- **Professional sculpt / retopology / production UVs / rigging:** generated blockouts and per-part UVs exist, and a Blender finishing script is prepared; Blender is not installed here, so no rigged/animated GLB is verified. Result is partial, not AAA complete.
- **GLB/GLTF visual runtime QA:** a small GLB v2 static loader is wired for static researcher NPCs, but no browser/WebGL session was available to verify actual pixels, texture upload or GPU behaviour. Automated tests validate GLB structure and file routing only.
- **Canonical face design:** story source does not specify detailed face, hair, eye color, or exact ages for most characters. Alternative used: separate canon facts from art-direction targets and avoid asserting invented traits as canon.
- **Chapter wear and save/load variants:** no current character appearance state system. Alternative used: deterministic chapter target manifest only; runtime integration remains future work.

## 9. Elias Voss mesh and material blockout

`tools/character_pipeline/build_elias_voss.py` deterministically generates the base Elias GLB and OBJ/MTL. This iteration expanded the asset from 104 to **127 separate mesh parts**, adding cargo pocket/flap/tab details, shoulder seams, elbow reinforcement, boot eyelets/side panels, closure snaps and zipper pull. Bounds remain approximately 0.85 m wide × 1.992 m tall × 0.452 m deep.

`tools/character_pipeline/build_character_variants.py` generates `elias_voss_uv.glb`, `dana_voss_blockout.glb`, `mara_vale_blockout.glb` and seven faction palette variants. The UV variants were reloaded through `trimesh`: each part has UV coordinates and the GLB contains 15 embedded procedural base-color material textures (Mara's headset adds one extra material). These maps are generated grain/micro-variation, not photogrammetry, hand-painted wear, or a full PBR set. Per-part UVs are not a packed production atlas.

`tools/character_pipeline/audit_character_assets.py` writes `public/models/characters/character_asset_audit.json` with geometry, UV, texture, skin and animation counts. The original `elias_voss_procedural_blockout.glb` remains an untextured source/interchange blockout; `elias_voss_uv.glb` is the UV/textured review copy.

## 10. Runtime import and rigging status

`src/character-assets.js` contains a minimal glTF 2.0 binary parser for static triangle meshes, materials and embedded base-color images. `src/level.js` uses it to asynchronously replace static researcher placeholder figures with `veil_research_faction_blockout.glb`; if loading fails, the existing procedural researcher remains. `serve.py` and `desktop/files.cjs` allow the `public/` asset folder, and the Electron package includes the character GLBs. This is a limited static NPC integration, not skeletal animation. Combat enemies keep their existing `buildHumanoid()` model and hit-zone pivots. Elias remains first-person; his hero mesh is not attached to the gameplay camera.

`tools/character_pipeline/blender_rig_uv_export.py` is prepared to import a GLB in Blender, smart-unwrap it, create a humanoid armature, assign rigid per-object weights and export a blockout rig with placeholder idle/walk actions. **Blender is not installed in this environment; the script was only syntax-checked, not executed.** Its rigid weights and generated actions are not production skinning/animation and must be reviewed in Blender before use.

**Verified:** 127-part base mesh exports; ten UV-bearing variants export; the generated GLBs reload with `trimesh`; each UV variant has UV coordinates on every mesh and embedded base-color images; static GLB v2 container parser tests pass; file serving/package checks pass; all automated game tests pass. **Not verified:** visual browser render, actual GPU texture upload, Blender rig export, skin deformation, facial animation, LODs, and production quality. No AAA completion is claimed.

The OBJ exporter initially referenced an MTL file it did not write in this environment; the workflow continues to explicitly generate `material.mtl` alongside the OBJ and audit the material definitions.
