// Hit-zone multipliers, range falloff, armour. One place, used by weapons and tests.
export const ZONE_MULT = { head: 2.5, torso: 1, arm: 0.7, leg: 0.6 };
export const falloff = (d, range) => d <= range * 0.5 ? 1 : Math.max(0.35, 1 - (d - range * 0.5) / (range * 0.8) * 0.65);
export function computeDamage(base, zone, { armor = 0, dist = 0, range = 1e9 } = {}) {
  const zm = ZONE_MULT[zone] ?? 1;
  const a = zone === 'head' ? armor * 0.3 : armor; // helmets are thinner than body armour
  return base * zm * falloff(dist, range) * (1 - a);
}
