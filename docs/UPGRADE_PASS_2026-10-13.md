# BLACK VEIL — Visual & Combat Upgrade Pass (2026-10-13)

## Implemented in source

- Added a bounded pool of ground blood-splash decals. They are randomized in scale/rotation, remain briefly during a firefight, fade near the end of their lifetime, and are cleared during level reset. The pool is capped at 18 objects to avoid unbounded scene growth.
- Increased the blood-hit particle burst modestly while leaving sparks/dust on their existing paths.
- Reworked the existing blockout-compatible enemy death fall into an eased, short-duration fall with a small side lean/yaw variation and a subtle settle/drop. This is still a rigid procedural blockout animation, **not** skeletal animation, ragdoll, or motion-capture.
- Enemy death now adds a ground splash sized slightly larger for the heavy role. Existing corpse cap/despawn behavior remains in place.

## Verification performed

- `npm test`: PASS — 105 core tests, 55-reference static audit, 42 smoke tests, and 12 desktop tests; zero failures.
- `node --check src/effects.js`, `node --check src/enemy.js`, `node --check src/game.js`: PASS.

## Still incomplete / not verified

- No production rigged/skinned NPCs, motion-captured death clips, or true physics ragdolls were created by this pass. Current characters are still blockout/procedural meshes.
- No cinematic gore, dismemberment, or graphic effects were added. Blood effects remain stylized and restrained.
- Real browser/WebGL visual review, GPU profiling, and a full human playthrough were not available in this environment. Passing stubbed-renderer tests does not establish final visual quality or 60 FPS performance.
- The bundled Three.js runtime still needs `npm install` + `npm run prepare:vendor` in a network-enabled build environment before an offline release can be considered ready.

## Next high-value upgrade stage

Replace blockout NPCs with licensed production-quality rigged assets, add validated locomotion/aim/reload/hit/death animation clips, then perform real WebGL visual QA across all nine chapters. These require suitable source assets and an actual Blender/browser or engine runtime; they should not be falsely represented as completed by procedural code alone.
