# BLACK VEIL — Campaign Implementation Status

This document distinguishes **implemented data and logic** from production-level content. All nine chapter IDs are present in `src/data/levels.js`, all nine event sets are present in `src/data/story.js`, and headless reachability checks cover every chapter. The three newer chapters use compact connected story-wing layouts and are not yet at the scale or visual quality of a finished AAA campaign.

## Chapter order and current status

| # | Stable ID | Chapter | Current implementation | Verification |
|---|---|---|---|---|
| 1 | `c1` | Frostline | Original outpost, transmitter, Warden choice, ambush | Headless gameplay and navigation checks |
| 2 | `v1` | The White Valley | Large heightfield, terrain slopes, tree instances, two routes, relay, buried outpost | Headless terrain/navigation checks |
| 3 | `c2` | Kalder Ridge | Settlement spaces, evidence, keycard, armory, Warden/relay consequences | Headless navigation/story checks |
| 4 | `b2` | Under the Rails | Depot, dispatch, Kessel pass choice, support locker, service lift | Headless navigation/story checks |
| 5 | `c3` | The Descent | Lower-level security, Kessel, preliminary core readout, breach weapon locker | Headless navigation/story checks |
| 6 | `c5` | The Archive | Compact connected archive wing, consent record, night guard log, archive choice, weapon cache | Headless reachability + scripted campaign smoke |
| 7 | `c6` | Quarantine | Compact medical-wing story space, volunteer list, Kessel trust choice, armory | Headless reachability + scripted campaign smoke |
| 8 | `c7` | The Long Night | Compact emergency-routing wing, power console, six-second signal | Headless reachability + scripted campaign smoke |
| 9 | `c4` | Black Veil | Core chamber, final authorization choice, Dana story event, ending resolution | Headless scripted paths + ending selector tests |

Stable IDs are deliberately independent of display order. Existing saves are resolved by ID, so the original final chapter (`c4`) remains identifiable after insertion of `c5`, `c6`, and `c7`.

## Decisions and consequences

- `spared`: changes the White Valley cache, later access and final support/encounter lines.
- `radioRestored`: changes access and is one of the evidence conditions for the best-supported outcomes.
- `trustKessel`: opens the short rail spur but exposes Elias's location to a squad.
- `archive`: copying or leaving the consent file changes the ending evidence state.
- `kesselTrust`: the Quarantine decision records whether Elias demanded the unedited record or accepted Kessel's account for now.
- `fate`: now selected at the final authorization console: preserve/contain, destroy the core, or expose VEIL.
- `nightLogFound`: records whether the optional night guard log was read.
- `danaFate`: records the final Dana story outcome.

## Five ending branches

1. **A Quiet Dawn** — preserve/contain with the Warden spared.
2. **The Truth Survives** — expose VEIL with the required evidence, or preserve with the full evidence trail and high Kessel trust.
3. **Ashes Below** — destroy the core without the complete signal/evidence conditions.
4. **A New Custodian** — expose VEIL without enough evidence, or preserve under conditions that leave control with Kessel.
5. **Six Seconds** — destroy the core after restoring the signal and copying the consent file plus night log.

Automated unit tests verify that all five selector branches are distinct and reachable from explicit state combinations. The scripted smoke suite currently exercises two full campaign routes (spare + preserve, leave + destroy); it does **not** yet complete a full human playthrough of all five endings.

## Weapons

The weapon controller now supports nine firearm definitions and selectable slots:

- M9-K Service Pistol
- AR-7 Carbine
- KS-12 Pump Shotgun
- VX-9 Machine Pistol
- BR-4 Battle Rifle
- SR-6 Marksman Rifle
- LM-8 Support Weapon
- Breach Shotgun
- Suppressed Pistol

The additional viewmodels are procedural variants built through the existing viewmodel builder, not externally sourced production assets. The existing controller handles ammo, fire rate, spread, reload, sound radius, recoil, ADS and switching. The requested pipe melee weapon is **not implemented**.

## NPC injury state

`src/core/npc-state.js` defines allowed condition transitions separately from the existing tactical AI state machine. Enemy hits can produce injured, limping or wounded conditions; leg injury reduces movement speed and changes the procedural leg swing; death blocks further damage/AI actions. This is not a full cinematic injury system: surrender, crying, grief, helper behavior, persistent named NPC wounds and rigged injury animations remain incomplete.

## Post-game Memory World

After the ending card, the game opens a free-exploration slice of The White Valley under the explorer label **Mara Vale**. It has five optional memory anchors and persists discovery IDs in local storage. It does not yet combine all nine campaign regions into a streamed open world, and the anchors are text/audio-led memory vignettes rather than fully animated 3D flashbacks.

## Known gaps / not verified

- The new chapters are compact story wings, not large bespoke levels with unique set pieces.
- No real rigged character assets or motion-capture animation files are included. Enemy limp/death behavior is procedural.
- NPC crying, grief, surrender, helping wounded allies, and named-character persistence are not fully implemented.
- No Mesh Impostor pipeline or sector streaming has been implemented; the current larger valley remains the only broad region.
- Post-game does not yet connect all nine chapter maps into one continuous world.
- Pipe melee, a fully animated train/elevator transition, cinematic camera choreography, full accessibility/content-warning flow, and visual flashbacks remain incomplete.
- Browser/WebGL, GPU, real audio listening, animation quality, Windows packaging and actual FPS remain unverified in this environment.
