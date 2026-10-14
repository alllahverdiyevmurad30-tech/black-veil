// Shared NPC condition state transitions. Kept separate from tactical AI states
// (patrol/combat/search) so injury never overwrites the existing AI architecture.
export const NPC_CONDITIONS = Object.freeze([
  'HEALTHY', 'INJURED', 'LIMPING', 'WOUNDED', 'DOWNED',
  'SURRENDERING', 'PANICKING', 'GRIEVING', 'DEAD', 'DESPAWNING',
]);

const TRANSITIONS = Object.freeze({
  HEALTHY: new Set(['INJURED', 'LIMPING', 'WOUNDED', 'DOWNED', 'SURRENDERING', 'PANICKING', 'GRIEVING', 'DEAD']),
  INJURED: new Set(['LIMPING', 'WOUNDED', 'DOWNED', 'SURRENDERING', 'PANICKING', 'GRIEVING', 'DEAD']),
  LIMPING: new Set(['WOUNDED', 'DOWNED', 'SURRENDERING', 'PANICKING', 'GRIEVING', 'DEAD']),
  WOUNDED: new Set(['DOWNED', 'SURRENDERING', 'PANICKING', 'GRIEVING', 'DEAD']),
  DOWNED: new Set(['SURRENDERING', 'GRIEVING', 'DEAD', 'DESPAWNING']),
  SURRENDERING: new Set(['INJURED', 'LIMPING', 'WOUNDED', 'DOWNED', 'PANICKING', 'GRIEVING', 'DEAD', 'DESPAWNING']),
  PANICKING: new Set(['INJURED', 'LIMPING', 'WOUNDED', 'SURRENDERING', 'GRIEVING', 'DEAD']),
  GRIEVING: new Set(['PANICKING', 'SURRENDERING', 'DEAD', 'DESPAWNING']),
  DEAD: new Set(['DESPAWNING']),
  DESPAWNING: new Set(),
});

export function canTransitionNpc(from, to) {
  return !!TRANSITIONS[from] && TRANSITIONS[from].has(to);
}

export function transitionNpcCondition(npc, next) {
  if (!npc || !NPC_CONDITIONS.includes(next)) return false;
  const current = npc.condition || 'HEALTHY';
  if (current === next) return true;
  if (!canTransitionNpc(current, next)) return false;
  npc.condition = next;
  npc.conditionChangedAt = Number.isFinite(npc.game?.time) ? npc.game.time : 0;
  return true;
}

export function conditionFromHit({ zone = 'torso', hp = 100, maxHp = 100, current = 'HEALTHY' } = {}) {
  if (hp <= 0) return 'DEAD';
  if (current === 'WOUNDED' || current === 'DOWNED' || current === 'DEAD' || current === 'DESPAWNING') return current;
  if (hp <= maxHp * 0.32) return 'WOUNDED';
  if (zone === 'leg') return 'LIMPING';
  return 'INJURED';
}
