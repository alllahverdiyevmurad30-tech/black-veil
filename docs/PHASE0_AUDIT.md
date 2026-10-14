# BLACK VEIL - Phase 0 audit (read-only, before any expansion work)

Environment: Linux sandbox, Node 22, Python 3.12, no GPU, no browser, no network. Statuses: VERIFIED / PARTIALLY VERIFIED / NOT VERIFIED / BLOCKED.

## 1. Baseline (measured before any change in this session)
| Check | Result | Status |
|---|---|---|
| `node tests/run.js` | 53 passed, 0 failed | VERIFIED (ran) |
| `node tests/static.js` | 48 DOM refs, 13 menu actions, 12 modules: no problems | VERIFIED (ran) |
| `node tests/smoke.js` | 24 passed, 0 failed (stubbed THREE/DOM) | VERIFIED (ran); proves logic only |
| Real browser rendering, mouse feel, audio, FPS | not run | NOT VERIFIED / BLOCKED (no browser/GPU) |

## 2. Maps (measured from `src/data/levels.js`)
| Chapter | Area | Walls | Props | Doors | Enemies | Interactables | Elevation |
|---|---|---|---|---|---|---|---|
| 1 Frostline | 60 x 86 m (5,160 m2) | 6 | 19 | 0 | 7 | 2 | none |
| 2 Kalder Ridge | 68 x 86 m (5,848 m2) | 23 | 14 | 2 | 6 | 5 | none |
| 3 The Descent | 64 x 96 m (6,144 m2) | 32 | 18 | 1 | 6 | 3 | none |
| 4 Black Veil | 64 x 96 m (6,144 m2) | 16 | 15 | 1 | 10 | 1 | none |

Every map is a flat plane of roughly 5-6 thousand m2 (about 75 x 75 m). The "small arena" criticism is accurate.

## 3. Architecture findings (from reading the code; not profiled)
* **World:** the whole level is built at chapter load (`Level.build`); no regions, streaming, culling policy or LOD. One `Mesh` per wall/prop, so draw calls grow linearly with content; only trees are instanced.
* **Collision / movement:** 2D (x,z) circle-vs-AABB over a linear list; ground is y = 0 everywhere; no slopes, stairs, ladders or ground-height query; jumping does not clear obstacles. Bullets and line of sight use a 3D ray-vs-AABB over the same linear list.
* **Navigation:** 1 m grid + A*, rebuilt fully when a door opens. Fine at ~6k cells; a 10x larger map needs chunking or a spatial index.
* **AI:** state machine in `enemy.js`; perception in pure `core/detect.js`; cover chosen from props with h >= 1.2 m. Per-enemy cost is a linear ray scan every frame.
* **Characters / animation:** procedural (pivot rotations on box/sphere body parts). No skeleton, `SkinnedMesh`, `AnimationMixer` or loader is used anywhere in `src/`. Hit volumes are the visible part meshes.
* **Assets:** zero external model/texture/audio files; textures are canvas-generated, audio is synthesised.
* **Story runner:** verbs in `data/story.js`; events keyed by trigger/interactable id and `cleared:<group>`; checkpoint = chapter + cp index + done-event list + choices. Saves validate against `LEVELS.length`, so adding chapters does not invalidate v1 saves.
* **Text:** all strings are English, no localisation layer.

## 4. What this means for the requested expansion
* 8-10 chapters, bigger and elevated maps need: a ground-height/terrain model shared by player, enemies, nav and bullets; spatial indexing for collision/LOS; region loading and mesh merging/instancing; a mission-state module that is the single source of truth.
* RDR2-style animation requires a real rigged character with animation clips. Such assets cannot be authored by code, and none are present. Sourcing licensed GLB files needs network access (BLOCKED here); `GLTFLoader` is not currently bundled. Honest interim options: improve the procedural rig (weight shift, foot planting IK, upper/lower-body layering, state-driven blending) and state clearly that it is not mocap-quality.
* Performance targets cannot be set from measurements until the game is run on a real browser/GPU.

## 5. Phase status
Phase 0 (this audit): done. Phases 1-7 (campaign bible, vertical slice, map/mission expansion, animation pipeline, cinematics, optimisation, release gate): **NOT STARTED**.

## 6. Update after Phase 1-2 work (this session)
Phase 1 documents written (`CAMPAIGN.md`, `CONTINUITY.md`). Phase 2 vertical slice implemented as chapter 2 "The White Valley" with the engine work the audit called for: heightfield terrain (ground following, slope limit, terrain-blocked rays and LOS), spatial index, world builder shared by renderer and tests, per-frame A* budget, compass/marker, save v2 with chapter ids and v1 migration. Phase 4 (rigged animation) remains BLOCKED; phases 3, 5-7 are only partly started (see README limitations).
