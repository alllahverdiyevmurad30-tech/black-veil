// Checkpoint saves with versioning, checksum, backup copy, validation and migration.
// v2 stores a stable chapter id (`cid`) next to the index, so inserting chapters later never breaks old saves.
// v1 saves (index-based, written when the campaign had 4 chapters) are migrated on read.
export const SAVE_VERSION = 2;
export const LEGACY_V1_IDS = ['c1', 'c2', 'c3', 'c4'];
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

export function validateSave(d, maxChapters = 5) {
  return !!d && typeof d === 'object' && Number.isInteger(d.chapter) && d.chapter >= 0 && d.chapter < maxChapters
    && Number.isInteger(d.cp) && d.cp >= 0 && typeof d.hp === 'number' && d.hp > 0 && d.hp <= 100
    && Array.isArray(d.weapons) && d.weapons.length > 0 && d.ammo && typeof d.ammo === 'object'
    && d.choices && typeof d.choices === 'object' && Array.isArray(d.done)
    && (d.journal === undefined || (Array.isArray(d.journal) && d.journal.length <= 300 && d.journal.every(j => j && typeof j.title === 'string' && typeof j.text === 'string' && Number.isInteger(j.ch))));
}
// Returns data with `chapter` resolved against the current chapter id list, or null when the chapter no longer exists.
export function migrateSave(data, version, ids) {
  if (!data || typeof data !== 'object') return null;
  const d = { ...data };
  if (version < 2) { d.cid = LEGACY_V1_IDS[d.chapter]; if (d.cid === undefined) return null; }
  if (d.cid !== undefined) { const i = ids.indexOf(d.cid); if (i < 0) return null; d.chapter = i; }
  return d;
}

export class SaveManager {
  constructor(storage, prefix = 'blackveil.save.', ids = ['c1', 'v1', 'c2', 'c3', 'c4']) { this.s = storage; this.p = prefix; this.ids = ids; }
  write(slot, data) {
    const d = { ...data, cid: this.ids[data.chapter] };
    if (!validateSave(d, this.ids.length)) return false;
    try {
      const k = this.p + slot, prev = this.s.getItem(k);
      if (prev) this.s.setItem(k + '.bak', prev);       // keep the previous good save
      const body = JSON.stringify(d);
      this.s.setItem(k, JSON.stringify({ v: SAVE_VERSION, t: Date.now(), sum: fnv(body), body }));
      return true;
    } catch { return false; }
  }
  read(slot) {
    const k = this.p + slot;
    for (const key of [k, k + '.bak']) {
      try {
        const raw = this.s.getItem(key); if (!raw) continue;
        const p = JSON.parse(raw);
        if ((p.v !== 1 && p.v !== 2) || fnv(p.body) !== p.sum) continue;
        const data = migrateSave(JSON.parse(p.body), p.v, this.ids);
        if (data && validateSave(data, this.ids.length)) return { data, t: p.t, recovered: key !== k, migrated: p.v < SAVE_VERSION };
      } catch { /* try backup */ }
    }
    return null;
  }
  has(slot) { return !!this.read(slot); }
  remove(slot) { try { this.s.removeItem(this.p + slot); this.s.removeItem(this.p + slot + '.bak'); } catch {} }
}
