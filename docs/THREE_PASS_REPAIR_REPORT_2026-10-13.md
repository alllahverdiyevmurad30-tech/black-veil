# BLACK VEIL — Three-pass repair report (2026-10-13)

## Work performed in this repair pass

- Expanded `tools/character_pipeline/blender_rig_uv_export.py` from two placeholder actions to a named blockout animation set: idle, walk, run, aim, fire, reload, cover, hit reaction and death.
- Added explicit action names and loop/non-loop intent, retained actions through NLA strips for GLB export, and kept the script's limitations explicit.
- Ran Python syntax compilation on the updated Blender script successfully.
- Ran the full existing `npm test` suite three consecutive times. All three runs passed: `tests/run.js`, `tests/static.js`, `tests/smoke.js`, and `tests/desktop.js`.

## Three consecutive test runs

Each run reported:
- Main logic tests: 105 passed, 0 failed
- Static checks: no problems
- Smoke tests: 42 passed, 0 failed (renderer is stubbed)
- Desktop tests: 12 passed, 0 failed

Full logs are included in `docs/test-runs/`.

## Not fixed / blocked — do not treat this ZIP as a finished AAA release

1. No real production-quality rigged character asset was generated in this environment. Existing GLBs remain blockout/static assets; the updated Blender script is a pipeline source, not proof of a generated rigged GLB.
2. Blender is not installed in this environment, so the Blender export script was syntax-checked only. It was not executed; the output GLB was not inspected.
3. The game's `src/character-assets.js` remains a custom static GLB loader and does not integrate `SkinnedMesh`, skeletons, or animation clips. Thus the newly named Blender clips are NOT runtime-integrated. A real GLTFLoader/AnimationMixer integration (or a fully tested equivalent) is still required.
4. The nine campaign levels have not all received fully built, visually reviewed secret rooms and alternate routes. Existing navigation tests are not proof of finished level design. Real renderer/playthrough testing remains outstanding.
5. `vendor/three.min.js` is absent from this source archive; offline first-launch behavior and packaged `.exe`/`.app` are not verified.
6. No real WebGL screenshot test, FPS profiling, long-session memory test, or complete chapter playthrough was performed.

## Required next gates

- Run the Blender pipeline on a real model and inspect armature, vertex weights, animation names, retargeting and deformations in Blender.
- Integrate a glTF skeletal-animation loader and animation state machine in the game; test actual clip playback and transitions in the renderer.
- Build and validate a distinct hidden room plus alternate route in each of the nine chapters, including collision, AI reachability, checkpoints, save/load and rewards.
- Run a real browser/Electron playthrough and profile performance before calling this release-ready.

## Status

- IMPLEMENTED + VERIFIED: expanded Blender animation-authoring script; Python syntax check; three consecutive existing test-suite passes.
- NOT VERIFIED: generated rigged/animated GLB output; runtime skeletal animation playback; real rendered visual quality; all secret rooms and alternate paths.
- BLOCKED: full asset/runtime integration because no Blender executable or production rigged animation assets were available in this environment.
