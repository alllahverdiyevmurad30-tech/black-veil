# BLACK VEIL — Combat, Animation & Environment Upgrade

Date: 2026-10-13

## Implemented in this source pass

### Enemy animation and impact response
- Added hit-reaction timing based on hit zone (head/body/leg) and a brief procedural upper-body flinch.
- Added different procedural fall timing and lateral collapse cues for head, leg, body, and heavy enemy deaths.
- Preserved the existing blockout-compatible animation path. This is not skeletal animation, motion capture, or a physics ragdoll.
- Existing walk/run/crouch locomotion, aim-facing, cover transitions, patrol/search, and wounded/limping movement remain in place.

### Tactical combat
- Added a limited enemy grenade attack for eligible riflemen when the player is visible at a suitable distance. Each enemy uses it at most once per spawn.
- Grenades have a visible projectile arc, incoming warning toast, bounded lifecycle, area damage with distance falloff, and a basic blocker/line-of-sight check.
- The existing flank/reposition/cover behaviours remain active; grenade use can prompt the player to move rather than hold one position.
- Grenade objects are removed and their geometry/material disposed after detonation. They are cleared during chapter reset.

### Weapon feel
- Added a bounded recycled brass-casing pool with lateral ejection, spin, gravity and a small bounce. Casings expire and are reused.
- Extended the procedural muzzle flash window slightly and emit a short muzzle particle burst for the existing weapon controller.
- Existing weapon-specific recoil, ADS reduction, spread, camera shake, reload, pump and switch behaviour are preserved.

### Environmental dressing
- Added procedural industrial wall-side conduits, small status lamps, cable/scrap panels, and weathered exterior debris/rock clusters.
- Decorative props are explicitly visual-only: they do not alter collision blockers or navigation, so they should not create new invisible walls or invalidate existing authored routes.
- Existing fog, ambient/hemisphere/sun lighting, flickering lights, snow/dust particles, terrain, doors, and authored level layout remain intact.

## Verification performed
- `npm test`: PASS — 105 core tests, 55-reference static audit, 42 smoke tests, 12 desktop tests; zero failures.
- JavaScript syntax checks: PASS for `src/enemy.js`, `src/game.js`, `src/weapons.js`, and `src/level.js`.

## Not completed / must not be represented as finished
- Production-quality rigged character assets, skeletons, skin weights, and real animation clips (run, aim, fire, reload, vault/peek, injury and varied death) still require suitable licensed assets or authoring in Blender/another DCC, retargeting, and runtime validation.
- The current character mesh remains procedural/blockout. Added hit reactions and deaths are procedural rigid transforms, not true joint animation or ragdoll physics.
- Grenade collision uses the current world blockers/LOS model; it is not a full rigid-body physics simulation. Needs hands-on gameplay tuning.
- Decorative dressing adds detail but does not create genuinely new authored alternate routes, hidden rooms, or fully redesigned maps. Those require chapter-by-chapter level design and reachability testing.
- The new features have passed automated tests, but a real browser/WebGL playthrough and visual review were not available here. No claim is made that final visual quality, audio mix, or 60 FPS is verified.
- Offline packaging is still dependent on preparing the bundled Three.js vendor file in a network-enabled build environment.

## Recommended final production gate
1. Run the browser/WebGL build and inspect screenshots/video from every chapter and graphics preset.
2. Add a licensed humanoid skeleton/rig, retarget animation clips, test root motion and weapon-hand alignment, then add animation state blending.
3. Validate grenade telegraph, splash damage, cover occlusion, AI fairness, and accessibility warning timing in a real playthrough.
4. Design and test authored alternate routes/secret spaces per chapter, checking nav reachability, collision, checkpoints and story triggers.
5. Profile particle counts, shadow maps, draw calls and frame times on target PC hardware; test low/mid/high settings.
