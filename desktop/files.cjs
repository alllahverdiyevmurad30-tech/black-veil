'use strict';
// Pure helpers used by the Electron main process (kept free of Electron imports so they can be unit-tested with plain Node).
// Only the game's own folders are ever served: index.html, style.css, src/**, vendor/**, assets/** and public/**. Everything else
// (tests, desktop code, package.json, node_modules, dotfiles) is refused, and path traversal is rejected.
const path = require('path');
const fs = require('fs');

const ALLOWED_FILES = new Set(['index.html', 'style.css']);
const ALLOWED_DIRS = ['src', 'vendor', 'assets', 'public'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

// Returns an absolute file path inside `root`, or null when the request is not allowed.
function resolveRequest(root, urlPath) {
  let p;
  try { p = decodeURIComponent(String(urlPath)); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  p = p.replace(/^\/+/, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const norm = path.posix.normalize(p);
  if (norm === '..' || norm.startsWith('../') || path.posix.isAbsolute(norm)) return null;
  const parts = norm.split('/');
  const ok = parts.length === 1 ? ALLOWED_FILES.has(norm) : ALLOWED_DIRS.includes(parts[0]);
  if (!ok || parts.some(s => s === '' || s === '.' || s.startsWith('.') && s !== '.gitkeep')) return null;
  const base = path.resolve(root), abs = path.join(base, ...parts);
  if (!abs.startsWith(base + path.sep)) return null;
  // Lexical traversal checks do not stop a symlink inside an allowed folder from
  // pointing outside the game root. Resolve existing targets before serving them.
  try {
    const realBase = fs.realpathSync(base);
    const realTarget = fs.realpathSync(abs);
    if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) return null;
    return realTarget;
  } catch (error) {
    // Keep the resolver useful for static checks of optional files (e.g. the
    // generated vendor bundle); the protocol handler still returns 404 on read.
    if (error && error.code === 'ENOENT') return abs;
    return null;
  }
}
function mimeFor(file) { return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'; }

module.exports = { resolveRequest, mimeFor, ALLOWED_FILES, ALLOWED_DIRS, MIME };
