# BLACK VEIL — Desktop build guide (.exe / macOS .app)

This repository is configured to build desktop packages with Electron and electron-builder. The browser game code is reused; the desktop wrapper is in `desktop/`.

## Build from GitHub (recommended)

1. Create a GitHub repository and upload the **contents of this `blackveil` folder** (so `package.json`, `.github/`, `desktop/`, `scripts/`, `src/`, and `index.html` are at repository root).
2. Open the repository's **Actions** tab and enable Actions if GitHub asks.
3. To build Windows: choose **Build Windows exe** → **Run workflow**. Download the `BlackVeil-windows` artifact after the run succeeds. It contains the installer `.exe` and portable `.exe`.
4. To build macOS: choose **Build macOS app** → **Run workflow**. Download the `BlackVeil-macOS-arm64` and/or `BlackVeil-macOS-x64` artifact. The `.dmg` and `.zip` contain the macOS `.app` bundle.
5. To publish both from a release tag, push a tag such as `v0.1.0`. The workflows attach their packages to the GitHub Release.

## Build locally

Requires Node.js 20+ and internet access for npm dependencies and the pinned Three.js runtime.

- Windows: `npm install`, then `npm test`, then `npm run dist`
- macOS: `npm install`, then `npm test`, then `npm run dist:mac`
- Run the desktop app during development: `npm install`, then `npm run desktop`

Build outputs are written to `dist/`. The Three.js r128 runtime is staged into `vendor/three.min.js` by `npm run prepare:vendor`; the script validates the revision and fails rather than packaging a fake placeholder. Do not remove this validation or commit an arbitrary file under that name.

## Important verification limits

The project's automated Node test suite can run without a real GPU, but its gameplay smoke tests use a stub renderer. A successful package build proves packaging completed; it does **not** by itself prove full gameplay, WebGL rendering, FPS, or every level. The GitHub-hosted Windows/macOS build workflows must run successfully before the corresponding binary should be called built and verified. Builds are unsigned by default; operating systems may show security warnings.
