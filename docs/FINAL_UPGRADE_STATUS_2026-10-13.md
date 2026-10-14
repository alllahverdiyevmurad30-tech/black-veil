# BLACK VEIL — Final Upgrade Status

## Delivered in this archive

- Preserved the existing nine-chapter campaign, weapons, AI state machine, choices, checkpoints, save migration, settings, and desktop wrapper.
- Combat animation pass: procedural locomotion/crouch remains, enemy arms now blend toward a ready/aim pose during combat, firing drives a short recoil kick, hit-zone reactions remain, and deaths articulate torso/head/arms/legs with three bounded pose variants and zone-dependent timing.
- Tactical combat: retains the existing enemy cover, reposition, flank and one-grenade-per-enemy behaviours; grenade projectile warning, falloff and cleanup are implemented in the existing game loop.
- Weapon feel: retains weapon-specific recoil/ADS/spread/reload and pooled casing simulation plus muzzle flash/impact effects.
- Environment: retains the procedural industrial dressing pass and existing terrain/weather/light systems without adding collision blockers for decorative props.

## Verification

Executed `npm test` on this archive after the final procedural animation edit:
- Core tests: 105 passed, 0 failed.
- Static audit: 55 DOM references, 15 menu actions, 26 modules checked, no problems.
- Smoke tests: 42 passed, 0 failed (renderer is stubbed; not a real WebGL session).
- Desktop tests: 12 passed, 0 failed.
- `node --check src/enemy.js`: passed.

## Remaining release blockers (not misrepresented as completed)

1. Production skeletal character assets and authored animation clips (run, aim, fire, reload, peek/vault, injury and varied death) need licensed source assets or DCC authoring, retargeting, and in-engine alignment checks. Current enemy animation is procedural over the blockout rig; it is not motion capture or true ragdoll.
2. New bespoke secret rooms and alternative routes have not been authored and reachability-tested in all nine chapters. Existing level branches and authored consequences are preserved.
3. The actual browser/WebGL render, visual quality, audio mix, and target-hardware frame-time have not been verified in a live playthrough. Stub-renderer tests do not prove visual quality.
4. Offline desktop packaging depends on `npm run prepare:vendor` in an environment where the declared Three.js dependency is installed. No Windows EXE/macOS APP is included in this source archive.

## Recommended acceptance gate

- Launch the game in a real browser with WebGL and inspect every chapter at low/medium/high presets.
- Test combat with at least three enemy roles, grenade warning and occlusion, every weapon, and 15+ minutes of continuous play.
- Add/retarget licensed skeletal animation assets and verify weapon hand alignment, foot planting, cover peek and death transitions.
- Design and verify secret routes per chapter; check doors, navmesh/grid reachability, collision, checkpoints, story triggers and save restoration.
- Profile low/mid/high presets on minimum and target hardware before advertising a stable FPS target.
