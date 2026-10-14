# BLACK VEIL - continuity reference

Facts marked **[in game]** exist in the shipped text. Facts marked **[planned]** are design intent for unimplemented chapters and must not be contradicted by new text.

## Timeline
| When | Event | Source |
|---|---|---|
| Year 0, before 02:40 | VEIL Phase 3 needs a living volunteer "seated in the interface". Dana Voss signs the consent form and asks that her husband not be told until the transfer is stable. | [in game] ch2 recording 14 |
| Year 0, 02:40 | Evacuation roster: 112 evacuated, 31 unaccounted for (Lower Level 4). Rescue Team Bravo: E. Voss (lead), M. Hale, T. Rowan. K-7 containment active. | [in game] ch3 roster |
| Year 0, 03:12 | Level 4 blast doors sealed on Elias's authorization, on Dr. Kessel's confirmation that everyone was clear. | [in game] ch3 seal order |
| Year 0 | The power fails with 31 people still connected. VEIL "kept" them. | [in game] ch5 Kessel |
| Years 0-11 | Wardens, contractors paid by an unnamed VEIL trustee, guard the surface. Contract forbids contact with "the Kalder asset". | [in game] ch2 field log |
| Year 11, "03:40" | A transmission in Dana's voice goes out; Elias arrives at Frostline. | [in game] ch1 |
| Year 11 | The relay at the valley hill can be restored; Mara can then reach the Kalder gate controller. | [in game] ch2 |
| Year 11 | The Archive contains Dana’s consent record and a conflicting night guard log; copying or leaving the record affects the final evidence state. | [in game] ch6 |
| Year 11 | The Quarantine volunteer list shows several people as transferred rather than deceased; Elias can demand an unedited audit trail or accept Kessel’s account for now. | [in game] ch7 |
| Year 11 | The Long Night emergency console restores routing and logs a six-second carrier signal. | [in game] ch8 |
| Year 11 | The final authorization is chosen at the core: preserve/contain, destroy, or expose VEIL. | [in game] ch9 |
| Years 0-11 | Warden payroll and Site 4 shipments are billed to KESSEL HOLDINGS, not VEIL. | [in game] ch4 dispatch log |
| Year 11 | Mara asks about Hale; Elias recalls Marcus Hale's younger sister, "Maren? Something with an M"; Mara answers with a carrier tone. | [in game] ch4 (foreshadowing) |

## Who knows what (at the end of each implemented chapter)
| Character | Knows | Does not know |
|---|---|---|
| Elias | the voice matches Dana; Kessel Holdings paid the Wardens (ch4 log, if read); he signed the seal order; Dana volunteered (ch2 recording, if played) | what VEIL stores; that Kessel is alive until ch5 |
| Mara | voiceprint match 98%; the seal order carries Elias's signature | the carrier signal and the archive record connect to the old rescue team; the full Maren reveal is still not implemented |
| Kessel | everything about the core; he lied about "clear"; he speaks on the maintenance channel from ch4 and learns Elias's position if the pass is used | [planned] that Elias now knows Dana volunteered |
| Sato (Warden) | the cache; the side-door codes | he does not know what the Wardens guard |

## State variables (single source: `choices` in the save)
`spared`, `radioRestored`, `trustKessel`, `fate`, `archive`, `kesselTrust`, `nightLogFound`, `exposeVEIL`, `danaFate`, and `ending`. Plus the event log `done[]` (every event that has run) and the checkpoint index `cp`. `fate` is chosen at the Chapter IX final authorization console: `preserve`, `purge`, or `expose`.
Naming: lowerCamelCase; events are keyed by trigger/interactable id or `cleared:<groupId>`.
Validity rules enforced by tests: every event referenced by a trigger/interactable exists; every `show`/`unlock`/`spawn`/`give` target exists; every `checkpoint n` has a position in `cps`; all five ending-selector branches reachable from explicit state combinations.

## Consistency rules for new writing
1. Dana never says she was forced. She says it "hurts" and asks to stop. (ch9 line; ch2 recording)
2. Kessel's claim "31 still connected" is the number everyone uses.
3. Mara never lies outright; she omits. The ch4 conversation already foreshadows that she is Maren Hale. [planned reveal in the Archive chapter]
4. The seal order is signed by Elias; Elias believed the level was clear. He is not a villain and not blameless.
5. The Wardens are paid by a trustee; they are not VEIL staff.
