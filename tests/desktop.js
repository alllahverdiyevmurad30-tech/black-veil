// Checks for the desktop (.exe) packaging: safe file serving rules, package.json build config, workflows, icon.
// These are static / pure-logic checks. They do NOT launch Electron or run electron-builder (no network/Windows here).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { resolveRequest, mimeFor } = require('../desktop/files.cjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('  PASS', n); } catch (e) { fail++; console.log('  FAIL', n, '->', e.message); } };
const ok = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };
const root = path.resolve('.'), pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('Desktop file serving');
t('serves the game files', () => { for (const u of ['/', '/index.html', '/style.css', '/src/main.js', '/src/core/nav.js', '/vendor/three.min.js', '/public/models/characters/veil_research_faction_blockout.glb']) ok(resolveRequest(root, u), u); ok(resolveRequest(root, '/').endsWith('index.html')); });
t('refuses traversal and encoded traversal', () => { for (const u of ['/../package.json', '/%2e%2e/package.json', '/src/../package.json', '/src/%2e%2e/%2e%2e/package.json', '/src%5c..%5cpackage.json', '/src/..\\..\\package.json', '//etc/passwd', '/src/\0x']) ok(resolveRequest(root, u) === null, 'served ' + u); });
t('refuses non-game files', () => { for (const u of ['/package.json', '/tests/run.js', '/desktop/main.cjs', '/node_modules/three/package.json', '/.git/config', '/serve.py', '/build/icon.png', '/dist/x.exe']) ok(resolveRequest(root, u) === null, 'served ' + u); });
t('refuses symlinks that escape an allowed game folder', () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'blackveil-path-'));
  const outside = path.join(tmp, 'outside.txt'), inside = path.join(tmp, 'root');
  fs.mkdirSync(path.join(inside, 'public'), { recursive: true }); fs.writeFileSync(outside, 'private');
  try { fs.symlinkSync(outside, path.join(inside, 'public', 'escape.txt')); ok(resolveRequest(inside, '/public/escape.txt') === null, 'served external symlink target'); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
t('mime types are correct for module scripts and assets', () => { ok(mimeFor('a.js').startsWith('text/javascript')); ok(mimeFor('a.css').startsWith('text/css')); ok(mimeFor('a.html').startsWith('text/html')); ok(mimeFor('a.glb') === 'model/gltf-binary'); ok(mimeFor('a.xyz') === 'application/octet-stream'); });
t('every script/style referenced by index.html is servable and present (three.js only after prepare:vendor)', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) { const u = m[1]; if (/^https?:/.test(u)) continue; const f = resolveRequest(root, '/' + u); ok(f, 'not servable: ' + u); if (u === 'vendor/three.min.js' && !process.env.REQUIRE_VENDOR) continue; ok(fs.existsSync(f), 'missing file: ' + u); }
});
t('every module imported by src/ is servable', () => { for (const f of fs.readdirSync('src', { recursive: true })) if (f.endsWith('.js')) ok(resolveRequest(root, '/src/' + f.split(path.sep).join('/')), f); });

console.log('Packaging configuration');
t('package.json points at an existing main file and the electron toolchain', () => { ok(fs.existsSync(pkg.main), 'main missing'); ok(pkg.devDependencies.electron && pkg.devDependencies['electron-builder'], 'toolchain missing'); ok(pkg.devDependencies.three === '0.128.0', 'three must be pinned to the version the game was written against'); });
t('electron-builder config is coherent', () => {
  const b = pkg.build; ok(b.appId && b.productName); ok(fs.existsSync(path.join(b.directories.buildResources, 'icon.png')), 'icon missing');
  ok(b.win.target.some(x => x.target === 'portable') && b.win.target.some(x => x.target === 'nsis'));
  for (const g of ['index.html', 'style.css', 'src/**/*', 'vendor/three.min.js', 'public/models/characters/**/*', 'desktop/**/*']) ok(b.files.includes(g), 'files list misses ' + g);
  ok(!b.files.some(g => /tests|node_modules|dist/.test(g)), 'dev folders must not be packaged');
});
t('icon is a 512px PNG', () => { const d = fs.readFileSync('build/icon.png'); ok(d.slice(1, 4).toString() === 'PNG' && d.readUInt32BE(16) >= 256 && d.readUInt32BE(20) >= 256, 'bad icon'); });
t('workflow files exist and use the expected steps', () => {
  const w = fs.readFileSync('.github/workflows/build-windows.yml', 'utf8');
  for (const s of ['windows-latest', 'npm install', 'prepare:vendor', 'npm test', 'npm run dist', 'upload-artifact', 'tags:', 'workflow_dispatch', 'dist/*.exe']) ok(w.includes(s), 'workflow misses ' + s);
  ok(!/\t/.test(w), 'tab character in YAML'); ok(fs.existsSync('.github/workflows/ci.yml'));
});
t('prepare-vendor script and gitignore exist', () => { ok(fs.existsSync('scripts/prepare-vendor.cjs')); const g = fs.readFileSync('.gitignore', 'utf8'); ok(g.includes('node_modules') && g.includes('dist/')); });
t('main process source passes a syntax check and keeps secure window settings', () => {
  const m = fs.readFileSync('desktop/main.cjs', 'utf8'); new Function('require', 'module', '__dirname', m.replace(/^'use strict';/, ''));
  ok(/contextIsolation:\s*true/.test(m) && /nodeIntegration:\s*false/.test(m) && /sandbox:\s*true/.test(m), 'insecure webPreferences'); ok(m.includes("registerSchemesAsPrivileged") && m.includes("protocol.handle"));
});

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
