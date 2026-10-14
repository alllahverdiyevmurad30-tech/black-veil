// Weapon stats. Nine firearms, each with its own handling, recoil, noise and ADS behaviour.
export const ORDER = ['pistol', 'rifle', 'shotgun', 'vx9', 'br4', 'sr6', 'lm8', 'breach', 'suppressed'];
export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'M9-K SERVICE PISTOL', slot: 1, damage: 24, rpm: 380, auto: false, mag: 12, reserveMax: 84,
    reload: 1.55, range: 32, spread: 0.010, adsSpread: 0.002, moveSpread: 0.02, pellets: 1, noise: 34, pack: 12,
    recoil: { up: 0.0105, side: 0.003, kick: 0.05 }, hip: [0.17, -0.15, -0.34], adsPos: [0, -0.105, -0.27], adsFov: 0.85, perShell: false,
  },
  rifle: {
    id: 'rifle', name: 'AR-7 CARBINE', slot: 2, damage: 19, rpm: 640, auto: true, mag: 30, reserveMax: 180,
    reload: 2.2, range: 70, spread: 0.014, adsSpread: 0.003, moveSpread: 0.03, pellets: 1, noise: 48, pack: 30,
    recoil: { up: 0.0075, side: 0.0035, kick: 0.035 }, hip: [0.18, -0.17, -0.38], adsPos: [0, -0.112, -0.25], adsFov: 0.7, perShell: false,
  },
  shotgun: {
    id: 'shotgun', name: 'KS-12 PUMP SHOTGUN', slot: 3, damage: 12, rpm: 75, auto: false, mag: 6, reserveMax: 36,
    reload: 0.55, range: 16, spread: 0.055, adsSpread: 0.04, moveSpread: 0.03, pellets: 8, noise: 55, pack: 6,
    recoil: { up: 0.03, side: 0.01, kick: 0.11 }, hip: [0.18, -0.16, -0.36], adsPos: [0, -0.11, -0.27], adsFov: 0.85, perShell: true,
  },
  vx9: {
    id: 'vx9', name: 'VX-9 MACHINE PISTOL', slot: 4, damage: 15, rpm: 900, auto: true, mag: 24, reserveMax: 168,
    reload: 1.65, range: 25, spread: 0.022, adsSpread: 0.009, moveSpread: 0.035, pellets: 1, noise: 39, pack: 24,
    recoil: { up: 0.009, side: 0.006, kick: 0.045 }, hip: [0.17, -0.15, -0.34], adsPos: [0, -0.105, -0.27], adsFov: 0.82, perShell: false,
  },
  br4: {
    id: 'br4', name: 'BR-4 BATTLE RIFLE', slot: 5, damage: 31, rpm: 430, auto: false, mag: 20, reserveMax: 120,
    reload: 2.15, range: 82, spread: 0.009, adsSpread: 0.0018, moveSpread: 0.024, pellets: 1, noise: 52, pack: 20,
    recoil: { up: 0.015, side: 0.005, kick: 0.075 }, hip: [0.18, -0.17, -0.39], adsPos: [0, -0.112, -0.26], adsFov: 0.68, perShell: false,
  },
  sr6: {
    id: 'sr6', name: 'SR-6 MARKSMAN RIFLE', slot: 6, damage: 48, rpm: 180, auto: false, mag: 10, reserveMax: 70,
    reload: 2.45, range: 110, spread: 0.004, adsSpread: 0.0007, moveSpread: 0.035, pellets: 1, noise: 58, pack: 10,
    recoil: { up: 0.023, side: 0.004, kick: 0.1 }, hip: [0.18, -0.17, -0.42], adsPos: [0, -0.112, -0.28], adsFov: 0.55, perShell: false,
  },
  lm8: {
    id: 'lm8', name: 'LM-8 SUPPORT WEAPON', slot: 7, damage: 17, rpm: 720, auto: true, mag: 60, reserveMax: 240,
    reload: 3.1, range: 65, spread: 0.019, adsSpread: 0.006, moveSpread: 0.045, pellets: 1, noise: 60, pack: 60,
    recoil: { up: 0.0085, side: 0.006, kick: 0.055 }, hip: [0.2, -0.18, -0.42], adsPos: [0, -0.12, -0.28], adsFov: 0.72, perShell: false,
  },
  breach: {
    id: 'breach', name: 'BREACH SHOTGUN', slot: 8, damage: 16, rpm: 105, auto: false, mag: 5, reserveMax: 30,
    reload: 0.62, range: 13, spread: 0.066, adsSpread: 0.05, moveSpread: 0.035, pellets: 10, noise: 59, pack: 5,
    recoil: { up: 0.034, side: 0.012, kick: 0.13 }, hip: [0.18, -0.16, -0.36], adsPos: [0, -0.11, -0.27], adsFov: 0.84, perShell: true,
  },
  suppressed: {
    id: 'suppressed', name: 'SUPPRESSED PISTOL', slot: 9, damage: 21, rpm: 330, auto: false, mag: 15, reserveMax: 90,
    reload: 1.6, range: 36, spread: 0.008, adsSpread: 0.0015, moveSpread: 0.018, pellets: 1, noise: 15, pack: 15,
    recoil: { up: 0.008, side: 0.002, kick: 0.04 }, hip: [0.17, -0.15, -0.34], adsPos: [0, -0.105, -0.27], adsFov: 0.86, perShell: false,
  },
};
