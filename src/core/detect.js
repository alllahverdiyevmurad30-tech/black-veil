// Enemy perception rules: vision cone + range + line of sight, and hearing with wall muffling.
import { losClear } from './math.js';
const TAU = Math.PI * 2;
export function angleDiff(a, b) { let d = (a - b + Math.PI) % TAU; if (d < 0) d += TAU; return d - Math.PI; }

// e:{x,z,yaw,eye,fov,range}  p:{x,z,eye,crouch,sprint}. Returns awareness gain per second (0 = not seen).
export function visionGain(e, p, boxes) {
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  if (d > e.range) return 0;
  if (d > 1.5 && Math.abs(angleDiff(Math.atan2(-dx, -dz), e.yaw)) > e.fov / 2) return 0;
  if (!losClear({ x: e.x, y: e.eye, z: e.z }, { x: p.x, y: p.eye, z: p.z }, boxes)) return 0;
  let g = 1.1 * (1 - d / e.range) + 0.25;
  if (p.crouch) g *= 0.6;
  if (p.sprint) g *= 1.4;
  if (d < 6) g *= 2;
  return g;
}

// n:{x,z,radius}. Walls between source and listener shrink the effective radius.
export function hears(e, n, boxes) {
  const d = Math.hypot(n.x - e.x, n.z - e.z);
  if (d > n.radius) return false;
  const open = losClear({ x: e.x, y: 1.4, z: e.z }, { x: n.x, y: 1.4, z: n.z }, boxes);
  return d <= n.radius * (open ? 1 : 0.55);
}
