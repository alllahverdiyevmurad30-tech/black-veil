// Settings schema, defaults, validation and persistence. Pure (storage is injected) so it can be tested.
export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'KeyC', jump: 'Space',
  reload: 'KeyR', interact: 'KeyE', journal: 'KeyJ', slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3',
  slot4: 'Digit4', slot5: 'Digit5', slot6: 'Digit6', slot7: 'Digit7', slot8: 'Digit8', slot9: 'Digit9',
};
export const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', sprint: 'Sprint', crouch: 'Crouch',
  jump: 'Jump', reload: 'Reload', interact: 'Interact', journal: 'Journal', slot1: 'M9-K Pistol', slot2: 'AR-7 Carbine', slot3: 'KS-12 Shotgun',
  slot4: 'VX-9 Machine Pistol', slot5: 'BR-4 Battle Rifle', slot6: 'SR-6 Marksman Rifle', slot7: 'LM-8 Support Weapon', slot8: 'Breach Shotgun', slot9: 'Suppressed Pistol',
};
export const QUALITY = {
  low: { pr: 0.75, shadows: false, sm: 1024, particles: 300, trees: 60 },
  medium: { pr: 1.25, shadows: true, sm: 1024, particles: 800, trees: 140 },
  high: { pr: 2, shadows: true, sm: 2048, particles: 1500, trees: 260 },
};
export const DIFFICULTY = {
  easy: { react: 1.5, acc: 0.6, dmg: 0.7 },
  normal: { react: 1, acc: 1, dmg: 1 },
  hard: { react: 0.7, acc: 1.2, dmg: 1.3 },
};
export const DEFAULTS = {
  master: 0.8, music: 0.5, sfx: 0.9, dialogue: 0.9, sens: 1, adsSens: 0.7, invertY: false,
  sprintToggle: false, aimToggle: false, crouchToggle: true, fov: 80, quality: 'high', resScale: 100, fpsCap: 0,
  showFps: false, compass: true, shake: 1, bob: 1, subs: true, subSize: 1.2, difficulty: 'normal',
};
export const SCHEMA = [
  { k: 'difficulty', tab: 'Game', label: 'Difficulty (enemy reaction, accuracy, damage)', type: 'select', options: ['easy', 'normal', 'hard'] },
  { k: 'subs', tab: 'Game', label: 'Subtitles', type: 'toggle' },
  { k: 'subSize', tab: 'Game', label: 'Subtitle size', min: 0.8, max: 1.8, step: 0.1 },
  { k: 'compass', tab: 'Game', label: 'Compass and objective marker', type: 'toggle' },
  { k: 'shake', tab: 'Game', label: 'Camera shake', min: 0, max: 1, step: 0.1 },
  { k: 'bob', tab: 'Game', label: 'Head and weapon bob', min: 0, max: 1, step: 0.1 },
  { k: 'sens', tab: 'Controls', label: 'Mouse sensitivity', min: 0.2, max: 3, step: 0.05 },
  { k: 'adsSens', tab: 'Controls', label: 'Aim-down-sights sensitivity', min: 0.3, max: 1.2, step: 0.05 },
  { k: 'invertY', tab: 'Controls', label: 'Invert Y axis', type: 'toggle' },
  { k: 'sprintToggle', tab: 'Controls', label: 'Sprint: toggle instead of hold', type: 'toggle' },
  { k: 'aimToggle', tab: 'Controls', label: 'Aim: toggle instead of hold', type: 'toggle' },
  { k: 'crouchToggle', tab: 'Controls', label: 'Crouch: toggle instead of hold', type: 'toggle' },
  { k: 'master', tab: 'Audio', label: 'Master volume', min: 0, max: 1, step: 0.05 },
  { k: 'music', tab: 'Audio', label: 'Music', min: 0, max: 1, step: 0.05 },
  { k: 'sfx', tab: 'Audio', label: 'Effects', min: 0, max: 1, step: 0.05 },
  { k: 'dialogue', tab: 'Audio', label: 'Dialogue / radio', min: 0, max: 1, step: 0.05 },
  { k: 'quality', tab: 'Video', label: 'Graphics preset', type: 'select', options: ['low', 'medium', 'high'] },
  { k: 'resScale', tab: 'Video', label: 'Render resolution (%)', min: 50, max: 100, step: 5 },
  { k: 'fov', tab: 'Video', label: 'Field of view', min: 60, max: 100, step: 1 },
  { k: 'fpsCap', tab: 'Video', label: 'Frame rate cap (0 = unlimited)', type: 'select', options: [0, 30, 60, 120] },
  { k: 'showFps', tab: 'Video', label: 'Show FPS counter', type: 'toggle' },
];

export function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const f of SCHEMA) {
      const v = raw[f.k]; if (v === undefined) continue;
      if (f.type === 'toggle') { if (typeof v === 'boolean') s[f.k] = v; }
      else if (f.type === 'select') { if (f.options.includes(v)) s[f.k] = v; }
      else if (typeof v === 'number' && isFinite(v)) s[f.k] = Math.min(f.max, Math.max(f.min, v));
    }
  }
  s.binds = { ...DEFAULT_BINDS };
  if (raw && raw.binds && typeof raw.binds === 'object') for (const a in DEFAULT_BINDS) if (typeof raw.binds[a] === 'string' && raw.binds[a].length < 24) s.binds[a] = raw.binds[a];
  return s;
}
export function loadSettings(storage) { try { return sanitize(JSON.parse(storage.getItem('blackveil.settings'))); } catch { return sanitize(null); } }
export function saveSettings(storage, s) { try { storage.setItem('blackveil.settings', JSON.stringify(s)); } catch { /* ignore */ } }
