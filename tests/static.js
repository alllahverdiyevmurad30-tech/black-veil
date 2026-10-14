// Static consistency checks (no execution of game code): DOM ids referenced from JS exist in index.html,
// every menu action in the HTML is handled by Game.action, and every ES-module import resolves to a file.
import fs from 'node:fs'; import path from 'node:path';
let fail = 0; const bad = m => { fail++; console.log('  FAIL', m); };
const html = fs.readFileSync('index.html', 'utf8'), src = fs.readdirSync('src', { recursive: true }).map(f => f.split(path.sep).join('/')).filter(f => f.endsWith('.js'));
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
let refs = 0;
for (const f of src) {
  const code = fs.readFileSync('src/' + f, 'utf8'), dir = path.dirname(path.join('src', f));
  for (const m of code.matchAll(/(?:\$|getElementById)\(\s*'([A-Za-z0-9_-]+)'\s*\)/g)) { refs++; if (!ids.has(m[1]) && !ids.has(m[1].replace(/^s-/, 's-'))) bad(`${f}: element #${m[1]} missing from index.html`); }
  for (const m of code.matchAll(/from\s+'(\.[^']+)'/g)) if (!fs.existsSync(path.join(dir, m[1]))) bad(`${f}: import ${m[1]} not found`);
}
const game = fs.readFileSync('src/game.js', 'utf8'), actions = new Set([...game.matchAll(/case '([a-z]+)':/g)].map(m => m[1]));
const used = [...html.matchAll(/data-a="([a-z]+)"/g)].map(m => m[1]); for (const a of new Set(used)) if (!actions.has(a)) bad(`menu action "${a}" has no handler in Game.action`);
for (const m of html.matchAll(/<script[^>]*src="([^"]+)"/g)) if (!m[1].startsWith('http') && !m[1].startsWith('vendor/') && !fs.existsSync(m[1])) bad(`script ${m[1]} missing`);
if (!fs.existsSync('style.css')) bad('style.css missing');
console.log(`${refs} DOM references, ${new Set(used).size} menu actions, ${src.length} modules checked: ${fail ? fail + ' problem(s)' : 'no problems'}`);
process.exit(fail ? 1 : 0);
