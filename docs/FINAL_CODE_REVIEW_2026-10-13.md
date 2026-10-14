# BLACK VEIL — Final Code Review and Repair Record

Date: 2026-10-13

## Scope

Reviewed the delivered source archive end-to-end across gameplay modules, chapter/story data, save/settings logic, browser loader, Python launcher, Electron file serving, packaging workflows, tests, JSON metadata and character GLB containers. The project archive is not a Git checkout, so this review cannot produce a trustworthy Git diff against an original baseline.

## Repairs applied

1. **Electron file-serving symlink escape:** `desktop/files.cjs` previously checked normalized path prefixes but did not resolve existing filesystem targets. A symlink inside an allowed game directory could therefore point outside the game root. Existing targets are now resolved with `realpathSync` and rejected if their resolved path escapes the root.
2. **Regression coverage:** `tests/desktop.js` now creates an external symlink fixture and asserts that the resolver refuses it. The temporary fixture is removed in a `finally` block.
3. **Launcher startup stall:** `serve.py` previously attempted an unbounded `urlretrieve` before starting the local server, with no explicit timeout. An unavailable CDN could delay startup, and this path did not perform the same strong validation as the vendor scripts. Startup now proceeds immediately and clearly reports when the runtime is absent; the browser's bounded mirror fallback and the validated `prepare:vendor` / restore scripts remain the recovery paths.
4. **Documentation consistency:** README wording and test counts were corrected to reflect the character blockout assets and the current test suite.

## Verification executed after repairs

- `npm test`: three consecutive complete runs, each with 105/105 core tests, static audit clean (55 DOM references, 15 menu actions, 26 modules), 42/42 headless smoke tests, and 13/13 desktop checks.
- JavaScript syntax: all `.js` and `.cjs` files under source, tests, scripts, desktop and tools pass `node --check`.
- Python syntax: launcher and character pipeline scripts compile successfully.
- JSON validation: 14 JSON files parse successfully.
- Character asset audit: 12 GLB containers were inspected; the audit reports static blockouts and one skinned Elias prototype. This does not establish visual quality or in-engine animation correctness.
- Local HTTP smoke check: `index.html` and `/src/main.js` return HTTP 200; `/package.json` is denied with HTTP 404.
- Archive integrity: ZIP central directory and CRC test passed before this review; the final archive is re-created after these changes.

## Remaining blockers / incomplete requirements

- **BLOCKED — Three.js runtime bundle:** `vendor/three.min.js` is still absent. No valid cached bundle was found, and external package/CDN DNS access is unavailable in this environment. No fake or truncated library was added. The project can try its browser CDN mirrors online, but reliable offline first launch is not established.
- **NOT VERIFIED — real WebGL gameplay:** automated smoke tests use a stub renderer. A real visual browser session, GPU performance/FPS, actual audio mix and human campaign playthrough were not verified.
- **INCOMPLETE — production character assets:** most character GLBs are procedural static blockouts. The rigged Elias prototype is not proof of production-ready skin weights, animation quality, or runtime integration. Blender is not installed here, so the Blender pipeline could not be executed.
- **NOT VERIFIED — desktop release:** Electron packaging and Windows/macOS artifacts were not built in this environment. CI workflows are configured but a successful remote build was not observed in this review.
- **Known scope gaps:** README and campaign documents continue to identify compact chapter layouts, no pipe melee, no recorded dialogue, and no full production animation/character art as incomplete. They are not misreported as finished.

## Status summary

- IMPLEMENTED + VERIFIED: code-level gameplay/data/save checks, path resolver symlink protection, static references, syntax, JSON parsing, local HTTP allowlist behavior, repeated automated test runs.
- NOT VERIFIED: actual rendering, hardware performance, real audio/UI experience, complete human playthrough, packaged desktop launch.
- BLOCKED: guaranteed offline startup until the authentic pinned Three.js r128 build is available and validated in `vendor/three.min.js`.
