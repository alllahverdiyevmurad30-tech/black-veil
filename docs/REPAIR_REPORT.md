# BLACK VEIL — Repair and verification report

Date: 2026-10-12

## Change made

### Local development server exposed project-only files

**Finding:** `serve.py` used `SimpleHTTPRequestHandler` without restricting paths. Because the server was loopback-only, this was not a public network exposure, but any local browser/client able to reach that port could request repository files such as `package.json`, tests, docs, or launcher source. This also differed from the stricter allowlist in the Electron file server.

**Fix:** `serve.py` now allows only `index.html`, `style.css`, and files under `src/`, `vendor/`, and `assets/`; rejects hidden paths, traversal, backslashes and NUL characters; resolves real paths to prevent symlink escapes; and disables directory listings. The server remains bound to `127.0.0.1`.

## Verification performed

- `npm test`: **79 unit/data/navigation checks passed**, **54 DOM references / 14 actions / 23 modules static check passed**, **38 headless smoke checks passed**, **12 desktop/package checks passed**.
- `node --check` on all JavaScript/CommonJS files: passed.
- `python3 -m py_compile serve.py`: passed.
- Live HTTP check: `/`, `/index.html`, and `/src/main.js` returned HTTP 200; `package.json`, tests, `serve.py`, `.git/config`, directory listing `/src/`, and encoded traversal returned HTTP 404.

## Not verified

A real browser/WebGL session, visuals, animation quality, audio mix, pointer-lock feel, GPU performance, and Windows packaging were not run in this environment. `vendor/three.min.js` and `node_modules` are not included in this archive, so first launch needs internet access to fetch Three.js, or `npm install` followed by `npm run prepare:vendor` for a bundled/desktop build.

No claim is made that all game features are complete or that the project is error-free. See `README.md` for known gameplay and asset limitations.


## Campaign implementation continuation (2026-10-13)

### Implemented in the current working archive

- Added connected story-wing levels and event sets for **The Archive**, **Quarantine**, and **The Long Night**, keeping the existing `Level`, `Game`, navigation, interaction and save architecture. The Descent now exits to the Archive rather than ending the campaign early.
- Moved final authorization to the Black Veil core console and added three final choices: Preserve/Contain, Destroy the Core, and Expose VEIL. Added a five-branch ending selector and a separate `ending` save record so the existing checkpoint remains available.
- Added nine firearm definitions, slots 1–9, procedural variants through the existing viewmodel builder, and story lockers that make the added weapons obtainable. Pipe melee is not implemented.
- Added a separate NPC condition transition module and integrated hit-based injured/limping/wounded conditions into enemy movement and procedural leg motion. This is not a complete cinematic injury/emotion system.
- Added five manual save slots to the pause menu and load list.
- Added a post-game White Valley exploration slice labelled Mara Vale, with five memory anchors whose discovery IDs persist in local storage. This is not yet a continuous nine-region world and does not include fully animated flashback scenes.
- Expanded regression coverage for nine chapter entries, five ending selector branches, NPC condition transitions, all weapon definitions and controls, all five manual save slots, weapon selection, and post-game memory persistence.

### Current automated results

- `npm test`: **99 unit/data/navigation checks**, **55 DOM references / 15 menu actions / 24 modules static checks**, **42 headless smoke checks**, and **12 desktop/package checks** passed.
- Real browser/WebGL, GPU rendering, visual animation quality, real audio listening, Windows packaging and FPS are **NOT VERIFIED**.
- The three new chapter wings are compact layouts; no claim is made that they meet AAA production scope. Five ending selector states are unit-tested, but only two full scripted campaign routes are tested end-to-end.
