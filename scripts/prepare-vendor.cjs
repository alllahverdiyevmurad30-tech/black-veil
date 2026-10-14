'use strict';
// Stage the pinned Three.js r128 browser runtime atomically. Never package an
// arbitrary file merely because its name contains "three".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'vendor', 'three.min.js');
const minBytes = 400000;

function validate(file) {
  try {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return 'file does not exist';
    const stat = fs.statSync(file);
    if (stat.size < minBytes) return `file is too small (${stat.size} bytes)`;
    const text = fs.readFileSync(file, 'utf8');
    // The r128 UMD build exports a THREE global and contains REVISION = '128'.
    if (!/REVISION\s*=\s*["']128["']/.test(text) && !/REVISION[^\n]{0,80}["']128["']/.test(text)) {
      return 'revision marker for Three.js r128 was not found';
    }
    if (!/THREE|three\.js/i.test(text.slice(0, 20000))) return 'expected Three.js runtime markers were not found';
    return null;
  } catch (error) { return error.message; }
}

const candidates = [
  path.join(root, 'node_modules', 'three', 'build', 'three.min.js'),
  path.join(root, 'node_modules', 'three', 'build', 'three.js'),
  process.env.THREE_RUNTIME_PATH || '',
].filter(Boolean);

let source = null;
for (const candidate of candidates) {
  const problem = validate(candidate);
  if (!problem) { source = candidate; break; }
  console.log(`Skip ${candidate}: ${problem}`);
}
if (!source) {
  console.error('BLOCKED: no validated Three.js r128 source was found. Run npm install on a network-enabled machine or set THREE_RUNTIME_PATH to the official r128 build.');
  process.exit(2);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
const temp = `${dest}.${process.pid}.tmp`;
try {
  fs.copyFileSync(source, temp, fs.constants.COPYFILE_EXCL);
  const problem = validate(temp);
  if (problem) throw new Error(`staged runtime failed validation: ${problem}`);
  fs.renameSync(temp, dest);
  const bytes = fs.statSync(dest).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
  console.log(`READY: vendor/three.min.js (${bytes} bytes; revision 128; sha256 ${sha256})`);
} catch (error) {
  fs.rmSync(temp, { force: true });
  console.error(`BLOCKED: runtime was not installed: ${error.message}`);
  process.exit(2);
}
