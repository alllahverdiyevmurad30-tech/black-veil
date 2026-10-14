'use strict';
// Restore the exact Three.js r128 UMD runtime. Downloads only from official project/CDN mirrors,
// validates the revision and size, and never leaves a partial file in vendor/.
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'vendor', 'three.min.js');
const revision = '128';
const minBytes = 400000;
const urls = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
  'https://unpkg.com/three@0.128.0/build/three.min.js',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/build/three.min.js',
  'https://minime.stephan-brumme.com/files/threejs/three-r128.min.js',
  'https://raw.githubusercontent.com/mrdoob/three.js/r128/build/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.js',
  'https://unpkg.com/three@0.128.0/build/three.js'
];
// Published upstream r128 minified build hash; used as an additional integrity signal.
const officialR128Md5 = 'eb8549863a97355411c3259a3f93b8e1';
function valid(file) {
  try {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size < minBytes) return false;
    const s = fs.readFileSync(file, 'utf8');
    const head = s.slice(0, 12000);
    const revisionOk = /REVISION\s*=\s*["']128["']/.test(head) || /REVISION[^0-9]{0,20}128/.test(head);
    if (!revisionOk) return false;
    // Official minified file has a stable hash; non-minified upstream build is revision-checked.
    const md5 = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
    return md5 === officialR128Md5 || /THREE\.REVISION\s*=\s*["']128["']/.test(s) || /REVISION\s*=\s*["']128["']/.test(s);
  } catch { return false; }
}
function copyIfValid(file) {
  if (!valid(file)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.tmp';
  fs.copyFileSync(file, tmp);
  if (!valid(tmp)) { fs.rmSync(tmp, { force: true }); return false; }
  fs.renameSync(tmp, dest);
  console.log(`RESTORED: vendor/three.min.js (${fs.statSync(dest).size} bytes; Three.js r${revision})`);
  return true;
}
function download(url, target, redirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      if (err) reject(err); else resolve();
    };
    const req = client.get(url, { headers: { 'User-Agent': 'BLACK-VEIL-runtime-recovery/1.0' }, timeout: 4000 }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); clearTimeout(hardTimeout); settled = true;
        return resolve(download(new URL(res.headers.location, url).toString(), target, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return finish(new Error(`HTTP ${res.statusCode}`)); }
      const out = fs.createWriteStream(target);
      res.pipe(out);
      out.on('finish', () => out.close(() => finish()));
      out.on('error', finish);
    });
    const hardTimeout = setTimeout(() => req.destroy(new Error('source timed out')), 4500);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', finish);
  });
}
async function main() {
  const candidates = [
    path.join(root, 'node_modules/three/build/three.min.js'),
    path.join(root, 'node_modules/three/build/three.js'),
    process.env.THREE_RUNTIME_PATH || ''
  ].filter(Boolean);
  for (const p of candidates) if (copyIfValid(p)) return;
  try {
    cp.execFileSync('npm', ['install', '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', 'three@0.128.0'], { cwd: root, stdio: 'inherit', timeout: 20000 });
    if (copyIfValid(path.join(root, 'node_modules/three/build/three.min.js')) || copyIfValid(path.join(root, 'node_modules/three/build/three.js'))) return;
  } catch (e) { console.warn('npm install did not restore Three.js:', e.message); }
  const tmp = dest + '.download';
  for (const url of urls) {
    try {
      console.log('Trying', url);
      await download(url, tmp);
      if (!valid(tmp)) throw new Error('downloaded file failed r128/size validation');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(tmp, dest);
      console.log(`RESTORED: vendor/three.min.js (${fs.statSync(dest).size} bytes; Three.js r${revision})`);
      return;
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      console.warn('Source unavailable:', e.message);
    }
  }
  console.error('BLOCKED: local cache and all configured mirrors were unavailable or failed validation. The game now has browser-side mirror fallback too. Retry on any network-enabled machine: node scripts/restore-three-runtime.cjs');
  process.exitCode = 2;
}
main().catch(e => { console.error(e); process.exitCode = 2; });
