# BLACK VEIL — Full Project Audit

**Audit date:** 2026-10-13  
**Scope:** current working tree at `/mnt/data/blackveil_work/blackveil`, including source, tests, data, docs, character assets, launch scripts, desktop wrapper and CI configuration.  
**Method:** read-only baseline first; then automated tests, syntax checks, asset validation and targeted integration review.  
**Important limitation:** this folder is not a Git repository (`git rev-parse --is-inside-work-tree` failed). There is no reliable Git diff/status or branch checkpoint. No existing project files were deleted. No runtime code fix was justified by the checks completed, so changes in this audit are documentation-only.

## 1. Initial state and baseline

| Check | Initial result | Evidence/status |
|---|---:|---|
| `npm test` | 105 + 55-reference static audit + 42 + 12 passed; 0 test failures | PASS, executed |
| Python compile (`serve.py`, all character pipeline scripts) | no syntax errors | PASS, executed |
| `node --check` on JS/CJS under `src`, `desktop`, `tests`, `tools` | no syntax errors | PASS, executed |
| Character asset audit | 11 GLBs inspected; all GLB v2, UV/textured variants report 127/118/129 mesh geometries with UVs; 0 skins and 0 animations | PASS for file integrity/declared features, not production quality |
| Git status / branch checkpoint | unavailable; folder is not a Git repository | BLOCKED |
| Real browser/WebGL play session | not completed; headless Chromium attempt timed out in this environment | NOT VERIFIED |
| Blender rig/export script execution | Blender executable unavailable | BLOCKED |
| Electron Windows packaging | dependencies not installed (`node_modules` absent); Windows target cannot be validated here | BLOCKED |

## 2. Accessible requirement audit

Only prompts and project notes available in the current context and accessible project documentation were considered. This is not a claim that every historical prompt was retrieved verbatim.

| Requirement/system | Evidence in project | Status |
|---|---|---|
| Preserve existing architecture and test assertions | tests retained; no test assertions removed in this audit | PASS for this audit |
| Nine-chapter campaign and chapter/story consistency | `src/data/levels.js`, `src/data/story.js`, `tests/run.js`, `tests/smoke.js` | Automated logic checks PASS; full playthrough in rendered runtime NOT VERIFIED |
| Choices/endings | story data + smoke walkthroughs | PASS in scripted/stubbed walkthroughs; visual cinematic verification NOT RUN |
| Player movement, collision, weapons, reload/ADS/crouch | `src/player.js`, `src/weapons.js`, `src/core/*`, smoke tests | Logic tests PASS; actual input feel NOT VERIFIED |
| Enemy perception, combat, navigation, terminal states | `src/enemy.js`, `src/core/detect.js`, `src/core/nav.js`, `src/core/npc-state.js` | Automated tests PASS; real-time AI behavior NOT VERIFIED |
| Save/checkpoint/manual slots/migration | `src/core/save.js`, tests | Automated round-trip, corrupt-save fallback, v1/v2 migration tests PASS |
| Settings and graphics presets | `src/settings.js`, `src/game.js`, smoke tests | State/parameter logic PASS; GPU effect quality/performance NOT VERIFIED |
| Static character GLB loading and fallback | `src/character-assets.js`, `src/level.js` | Parser unit checks PASS; actual WebGL rendering and replacement NOT VERIFIED |
| Elias hero model, rig, animation | `public/models/characters/`, `tools/character_pipeline/`, character bible | Static procedural blockout exists; no skeleton/skin weights/clips; first-person hero model not integrated |
| Dana/Mara/faction models | 11 GLBs and reports in `public/models/characters/` | Static UV/textured blockouts only; no rigging or animation |
| Audio/dialogue | `src/audio.js` and story text | Synthesized audio/code present; actual sound mix and timing NOT VERIFIED |
| Browser/offline startup | `index.html`, `serve.py`, `scripts/prepare-vendor.cjs`, `vendor/` | Vendor file absent in working tree; launcher attempts download and HTML falls back to CDN. Offline first-run is not guaranteed |
| Desktop security/path allowlist | `desktop/files.cjs`, `serve.py`, desktop tests | Traversal and disallowed-file tests PASS; packaged app launch NOT RUN |
| Multiplayer/network authority | project is single-player; no multiplayer implementation found in the inspected architecture | Not applicable to this project version, not counted as an error |
| Performance target (stable 60 FPS) | no hardware profile from an actual game session | NOT VERIFIED; no FPS claim made |

## 3. Findings registry

The same underlying condition is not counted multiple times.

### BV-AUD-001 — Runtime/browser render validation unavailable
- **Priority:** P2 (verification gap; not a confirmed gameplay defect)
- **Status:** UNVERIFIED
- **Scope:** rendering, input, model appearance, async character replacement, audio, visual effects, frame time.
- **Evidence:** automated smoke tests explicitly use a stubbed renderer; the headless Chromium attempt did not finish within the allotted time. No usable browser console/render capture was obtained.
- **Root cause:** environment/tooling limitation for this run, not proof of a code bug.
- **Fix/result:** no code change; remains unverified. Requires a normal browser/WebGL session and manual walkthrough.

### BV-AUD-002 — Offline first launch depends on a missing bundled Three.js file
- **Priority:** P1 for offline/disconnected deployment; otherwise a deployment risk
- **Status:** CONFIRMED configuration gap in the current working tree; impact conditional on network availability
- **Scope:** browser start and desktop packaged runtime if `vendor/three.min.js` has not been prepared.
- **Evidence:** `vendor/` contains only `.gitkeep`; `index.html` tries the local vendor file and then a CDN; `serve.py` attempts to download Three.js at startup; `scripts/prepare-vendor.cjs` requires installed `three@0.128.0` in `node_modules`; `node_modules` is absent.
- **Root cause:** generated vendor dependency is intentionally excluded from the source archive and is only created by dependency installation/preparation.
- **Fix/result:** not modified in this audit because network/package installation is not assumed and replacing Three.js with a guessed bundle would be unsafe. Run `npm install` and `npm run prepare:vendor` in a network-enabled build environment, then test a network-disabled launch. For release archives, verify that `vendor/three.min.js` is included.

### BV-AUD-003 — Character assets are not production-rigged assets
- **Priority:** INFO (known incomplete requirement, not a new bug)
- **Status:** CONFIRMED incomplete
- **Scope:** skeletal animation, retargeting, facial animation, hero-body rendering, production asset quality.
- **Evidence:** `character_asset_audit.json` reports `skins: 0`, `animations: 0` for all 11 GLBs; `src/data/character-identity.js` and `README.md` explicitly label static blockouts; Elias remains first-person and is not attached to the gameplay camera.
- **Root cause:** assets were generated procedurally as static review/blockout meshes; Blender was not available to execute the rig/export pipeline.
- **Fix/result:** no claim of rigging or AAA completion. Requires Blender execution, rig/weight validation, animation clips and visual QA.

## 4. Exact checks and outcomes

### PASS
- `npm test`: `tests/run.js` **105 passed, 0 failed**.
- `tests/static.js`: **55 DOM references, 15 menu actions, 26 modules checked; no problems**.
- `tests/smoke.js`: **42 passed, 0 failed** (logic walkthroughs with stubbed renderer/dialogue).
- `tests/desktop.js`: **12 passed, 0 failed**.
- `python -m py_compile serve.py tools/character_pipeline/*.py`: passed.
- `node --check` for all JS/CJS in `src desktop tests tools`: passed.
- `tools/character_pipeline/audit_character_assets.py`: generated/checked an audit for **11 GLBs**; files parse and expected static UV/textures are reported.

### FAIL
- No automated test failure observed in this run.

### BLOCKED
- Git status/diff/branch: not a Git repository.
- Blender rig/export execution: Blender unavailable.
- Windows Electron build: dependencies absent; Windows packaging not run.

### NOT RUN / NOT VERIFIED
- Real rendered gameplay, WebGL console inspection, mouse/controller feel, sound mix, chapter-by-chapter human playthrough, save migration in the packaged app, long-duration real hardware profiling, actual FPS measurement.

## 5. Files modified by this audit

- `docs/FULL_PROJECT_AUDIT_2026-10-13.md` — added this report.

No runtime source or tests were changed during the audit because no reproducible code defect was demonstrated by the available checks. The existing working tree already contains previous character-pipeline changes; because Git metadata is absent, this report cannot separate those earlier edits from the original baseline.

## 6. Remaining risks and next steps

1. In a network-enabled build environment, install pinned dependencies and run `npm run prepare:vendor`; include `vendor/three.min.js` in release artifacts and verify startup with network disabled.
2. Run the game in a normal Chromium/Electron window with WebGL enabled. Verify menu, new game, all chapter transitions, combat, death/retry, choices/endings, settings, manual saves, and Continue/Load.
3. Open each character GLB in Blender or a glTF viewer; inspect orientation, scale, materials, texture color space, silhouette, clipping and normals. Then produce and validate a real skeleton, weights and animation clips.
4. Test character replacement during chapter transitions and repeated level disposal/reload to observe async loading and GPU resource lifetime.
5. Capture real CPU/GPU timings on target hardware before making performance or 60 FPS claims.
6. Establish a Git repository or a safe version-control checkpoint before the next code-changing phase.

**Conclusion:** automated logic, static, smoke, desktop-helper, syntax and asset-container checks pass. The project is not proven error-free. The highest-confidence deployment concern is the missing generated Three.js vendor bundle for offline first-run; real browser rendering and production character rigging remain unverified/incomplete.
