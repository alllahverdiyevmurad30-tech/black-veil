# BLACK VEIL — Runtime and project verification report
Date: 2026-10-13

## Changes made in this pass

- Hardened `scripts/prepare-vendor.cjs`: validates that a candidate is a real, sufficiently sized Three.js r128 build, stages it to a temporary file, validates again, and atomically replaces the destination. It no longer accepts a file merely because its name contains `three`.
- Expanded local candidate checks in `scripts/restore-three-runtime.cjs` and retained its pinned upstream/CDN recovery attempts.
- Added a per-source timeout to the browser runtime loader so an unresponsive mirror cannot indefinitely block trying the next source.
- Improved the final boot error so it explains the required runtime and the recovery command without pretending a fallback runtime exists.
- Preserved the existing game architecture and gameplay files.

## Verification completed in this environment

Three consecutive `npm test` runs passed. Each run reported:

- Main logic: 105 passed, 0 failed.
- Static audit: 55 DOM references, 15 menu actions, 26 modules checked; no problems.
- Smoke tests: 42 passed, 0 failed. These use a stubbed renderer and are not real WebGL tests.
- Desktop tests: 12 passed, 0 failed.

The new vendor preparation script was also executed. It correctly exited with code 2 because neither a local `node_modules/three/build/three.min.js` nor `three.js` was available. It did not create a fake runtime.

## Remaining blockers — not claimed as fixed

- **BLOCKED:** `vendor/three.min.js` is not included. This environment's package registry/CDN access fails at DNS resolution, and no local copy or npm cache was found. The official r128 source can be inspected through a connector, but that does not provide a local binary-file transfer path into this archive.
- **NOT VERIFIED:** real browser/WebGL rendering, interactive visual playthrough, FPS/frame-time measurements, and offline desktop launch with a bundled runtime.
- **NOT VERIFIED:** production-quality rigged character animation and target-hardware performance. Passing stub-renderer tests does not establish these.

## Recovery on a machine with package/network access

From the project root:

```sh
npm install
node scripts/restore-three-runtime.cjs
npm run prepare:vendor
npm test
npm run start
```

Confirm that `vendor/three.min.js` exists and that the browser console reports `THREE.REVISION === '128'`. Then verify a visible WebGL frame, inspect console errors, play through representative levels, measure FPS/frame time, and launch the packaged desktop build offline. Do not label those gates verified until actually performed.
