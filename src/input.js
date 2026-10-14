// Keyboard / mouse input with pointer lock. Actions are looked up through settings.binds (rebindable).
export class Input {
  constructor(canvas, settings) {
    this.s = settings; this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = { l: false, r: false }; this.rEdge = false;
    this.dx = 0; this.dy = 0; this.wheel = 0; this.locked = false;
    this.onLockChange = () => {}; this.onLockError = () => {}; this.onRawKey = null;

    addEventListener('keydown', e => {
      if (this.onRawKey) { e.preventDefault(); this.onRawKey(e); return; }
      if (this.locked && (e.code === 'Space' || e.code === 'F5' || e.code === 'Tab')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) this.mouse.l = true;
      if (e.button === 2) { this.mouse.r = true; this.rEdge = true; }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    addEventListener('mousemove', e => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; } });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.mouse.l = this.mouse.r = false; }
      this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError());
  }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => this.onLockError()); } catch { this.onLockError(); } }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  down(a) { return this.keys.has(this.s.binds[a]); }
  hit(a) { const c = this.s.binds[a]; if (this.pressed.has(c)) { this.pressed.delete(c); return true; } return false; }
  hitCode(c) { if (this.pressed.has(c)) { this.pressed.delete(c); return true; } return false; }
  endFrame() { this.pressed.clear(); this.dx = this.dy = 0; this.wheel = 0; this.rEdge = false; }
}
