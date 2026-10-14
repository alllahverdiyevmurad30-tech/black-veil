// Story script. Each chapter has `events`: name -> list of actions run by the game's action runner.
// Verbs: say, obj, checkpoint, spawn, show, hide, unlock, give, flag, if, choice, note, pickup, end, wait, stinger, marker.
//  ['say', speaker, text]            subtitle + radio line (Enter skips)
//  ['obj', text]                     set the objective
//  ['checkpoint', n]                 write a checkpoint save
//  ['spawn', groupId]                spawn an enemy group (alerted)
//  ['show'|'hide', interactableId]
//  ['unlock', doorId]   ['give', weaponId]   ['flag', key, value]
//  ['if', key, value, thenActions, elseActions]
//  ['choice', {id,title,body,opts:[{t,do:[...]}]}]
//  ['note', title, text]   ['pickup', type, x, z]   ['end']   ['wait', seconds]   ['stinger']
//  ['marker', x, z, label] sets the compass objective marker; ['marker'] clears it

export const CHAPTERS = [
  { num: 'CHAPTER I', title: 'FROSTLINE', sub: 'Northern relay · 03:40' },
  { num: 'CHAPTER II', title: 'THE WHITE VALLEY', sub: 'A day on foot between the ridges' },
  { num: 'CHAPTER III', title: 'KALDER RIDGE', sub: 'Former VEIL staff housing' },
  { num: 'CHAPTER IV', title: 'UNDER THE RAILS', sub: 'Kalder depot · the service line' },
  { num: 'CHAPTER V', title: 'THE DESCENT', sub: 'Site 4 · Lower levels' },
  { num: 'CHAPTER VI', title: 'THE ARCHIVE', sub: 'Consent files · conflicting accounts' },
  { num: 'CHAPTER VII', title: 'QUARANTINE', sub: 'Medical wing · the volunteer list' },
  { num: 'CHAPTER VIII', title: 'THE LONG NIGHT', sub: 'Power failure · emergency routing' },
  { num: 'CHAPTER IX', title: 'BLACK VEIL', sub: 'The core' },
];

export const STORY = [
  { // ------------------------------------------------------------------ 1
    events: {
      start: [
        ['say', 'Mara', "Elias, you're down. The chopper is a write-off. Pilot's breathing but out cold. Stay low."],
        ['say', 'Elias', "I'm intact. Where's the signal coming from?"],
        ['say', 'Mara', "Frostline relay, due north. VEIL has been dead for eleven years. Something just woke it up."],
        ['obj', 'Reach the Frostline relay outpost'],
      ],
      pw: [
        ['say', 'Mara', "Contacts ahead. Armed, not military issue. Wardens: private security. They shouldn't exist out here."],
        ['say', 'Elias', 'Then who pays them?'],
      ],
      enterOutpost: [['obj', 'Activate the relay transmitter']],
      transmitter: [
        ['stinger'],
        ['say', 'Recording', '[RECOVERED TRANSMISSION · VEIL SITE 4 · TIMESTAMP CORRUPTED]'],
        ['say', 'Dana', "Elias... if you can hear this, don't go into the lower levels. It isn't finished with us. Please, the doors..."],
        ['say', 'Elias', 'Dana?'],
        ['say', 'Mara', "Voiceprint match, ninety-eight percent. Dana Voss, VEIL staff. She's on the casualty roll, Elias."],
        ['say', 'Elias', 'She was my wife. She died eleven years ago.'],
        ['say', 'Mara', 'Then someone is using her voice. Heads up: vehicles on the ridge. They heard that broadcast too.'],
        ['checkpoint', 1], ['spawn', 'w2'], ['obj', 'Survive the Warden ambush'],
      ],
      'cleared:w2': [
        ['show', 'warden'], ['obj', 'Question the wounded Warden'],
        ['say', 'Mara', "One of them is still breathing. Down, not out. Your call, Elias."],
      ],
      warden: [
        ['say', 'Warden', "Don't... I only guard the surface. The deep levels... nobody who goes down comes back the same."],
        ['say', 'Warden', "Take my access codes. Just don't leave me out here."],
        ['choice', {
          id: 'warden', title: 'THE WOUNDED WARDEN', body: 'He is no longer a threat. His codes will open doors ahead.',
          opts: [
            { t: 'Spare him. Dress his wound and take the codes.', do: [['flag', 'spared', true], ['say', 'Mara', "Codes uploaded. He'll remember who helped him."]] },
            { t: 'Take his codes and supplies. Leave him.', do: [['flag', 'spared', false], ['pickup', 'health', 2, -44], ['pickup', 'ammo', 4, -44], ['say', 'Mara', "Efficient. Cold. Let's hope nobody finds him talking."]] },
          ],
        }],
        ['obj', 'Move north through the ridge pass'], ['checkpoint', 2],
      ],
      exit: [['end']],
    },
  },
  { // ------------------------------------------------------------------ 2 (new): THE WHITE VALLEY
    events: {
      start: [
        ['say', 'Mara', 'The Frostline relay is behind you. Kalder Ridge is north, about a kilometre through the White Valley. The old road follows the stream.'],
        ['say', 'Elias', 'And the Wardens?'],
        ['say', 'Mara', 'Field camps along the valley. The road is fastest, but there is a checkpoint. The ridge path to the west is longer and colder, and it avoids the checkpoint.'],
        ['obj', 'Cross the White Valley to the Kalder Ridge road'],
        ['marker', 0, -116, 'Kalder Ridge road'],
        ['if', 'spared', true,
          [['show', 'cache'], ['say', 'Sato', 'Elias, Sato here. My crew keeps a supply cache behind the fuel tank at the old camp, east of the tents. Take what you need.']],
          []],
      ],
      sawCamp: [['say', 'Mara', 'Smoke ahead: a Warden field camp. Four heat signatures. You can skirt it or clear it, your call.']],
      campLog: [['note', 'FIELD LOG · WARDEN CAMP 2', 'Contract clause 9: no contact with the "Kalder asset" under any circumstances.\n\nWe were told the asset is a person. Sato says it is a machine. Nobody here is paid enough to find out which.\n\nPayment comes from the VEIL trustee. Nobody will say who the trustee is.']],
      cache: [
        ['pickup', 'health', -17, 46], ['pickup', 'health', -17, 43], ['pickup', 'ammo', -16, 44.5],
        ['say', 'Sato', 'Good luck out there. Tell Mara the old codes still work.'],
      ],
      chkNear: [
        ['checkpoint', 1],
        ['say', 'Mara', 'Checkpoint on the road: barricades, a guard shack, four shooters. The ridge path starts west of the old camp if you want to avoid them.'],
      ],
      'cleared:chk': [['say', 'Elias', 'Road is open.']],
      buriedDoc: [
        ['note', 'RECORDING 14 · SITE 4 VOLUNTEER BRIEFING', 'Phase 3 will require a living volunteer to be seated in the interface. The consent form is signed. There is no obligation to continue.\n\nVOLUNTEER ROSTER (signed): ...  D. VOSS  ...\n\nShe asked that her husband not be told until the transfer was stable.'],
        ['say', 'Elias', 'Volunteer. She never told me.'],
        ['say', 'Mara', 'Elias... it says she asked them not to tell you. That is not the same as being sealed in against her will.'],
      ],
      station: [
        ['checkpoint', 2],
        ['say', 'Mara', 'Relay is up! I can see the whole valley now, and the gate logs at Kalder. I can talk to the gate controller from here.'],
        ['flag', 'radioRestored', true],
        ['say', 'Mara', 'If the controller accepts my codes, the side door at Kalder will open for you. Keep moving north.'],
      ],
      northRoad: [
        ['say', 'Mara', 'Engines on the north road: Warden trucks, coming fast.'],
        ['spawn', 'rein'], ['obj', 'Hold the road and reach Kalder Ridge'],
      ],
      exit: [['end']],
    },
  },
  { // ------------------------------------------------------------------ 3 (was 2): KALDER RIDGE
    events: {
      start: [
        ['say', 'Mara', "Kalder Ridge. Eleven years ago this was VEIL staff housing. Don't expect a welcome."],
        ['say', 'Elias', 'Dana sent me photos of this street. Snow on the porch rails.'],
        ['obj', 'Find a way through the mine gate'],
        ['if', 'spared', true,
          [['unlock', 'sideDoor'], ['say', 'Mara', "The Warden's codes just opened a maintenance door in the gate wall, far west. Quiet way in."]],
          [['if', 'radioRestored', true,
            [['unlock', 'sideDoor'], ['say', 'Mara', 'The relay I patched in the valley is still up. The gate controller gave me the side door.']],
            [['say', 'Mara', "The gate is locked tight. Try the foreman's house on the west side. Keycard, maybe."]]]]],
      ],
      street: [['say', 'Mara', 'Patrols on the main street. Use the houses and wrecks for cover. They hear you sprinting.']],
      roster: [
        ['note', 'EVACUATION ROSTER · KALDER RIDGE', 'DAY 0 · 02:40\n\nSite 4 staff evacuated: 112\nUnaccounted for (Lower Level 4): 31\n\nRescue Team Bravo: E. VOSS (lead), M. HALE, T. ROWAN\n\nNOTE: No entry to L4 after 03:00. Containment protocol K-7 is active.'],
        ['say', 'Elias', "My team. I remember Hale. I don't remember a K-7 protocol."],
      ],
      log: [
        ['note', 'FOREMAN LOG', "The new interface is picking up voices on the old radio bands. The crew calls them ghosts.\n\nKessel says it's only echo. I don't think he believes that either.\n\nI've started sleeping in the truck."],
      ],
      armory: [['give', 'rifle'], ['give', 'vx9'], ['say', 'Mara', 'Service rifle and a compact machine pistol. Keep the latter for close quarters.']],
      seal: [
        ['note', 'LOWER LEVEL 4 · SEAL ORDER 03:12', 'Blast doors on Level 4 sealed by authorization of rescue lead E. VOSS, on confirmation from Dr. I. Kessel that all personnel were clear.\n\nAUTHORIZED: E. VOSS 03:12'],
        ['say', 'Elias', 'I signed that. He told me everyone was out.'],
        ['say', 'Mara', "Elias... they weren't. Thirty-one people were behind those doors."],
        ['say', 'Elias', 'Then Dana was one of them. And I locked her in.'],
      ],
      keycard: [
        ['unlock', 'mineGate'], ['checkpoint', 1], ['obj', 'Go through the mine gate'],
        ['say', 'Mara', 'Keycard logged. The mine gate should read it now.'],
      ],
      exit2: [['end']],
    },
  },
  { // ------------------------------------------------------------------ 4 (new): UNDER THE RAILS
    events: {
      start: [
        ['say', 'Mara', "The mine gate opens onto the old rail depot. It runs under the settlement to the service lift. The Wardens use it as a supply line."],
        ['say', 'Mara', 'Elias, tell me about Hale. The roster says M. Hale. What was he like?'],
        ['say', 'Elias', 'Marcus Hale. Comms specialist. Loud laugh. He always said his younger sister would never forgive him if he missed her birthday. Maren? Something with an M.'],
        ['say', 'Mara', 'Go on. I am listening.'],
        ['say', 'Recording', '[radio: carrier tone only, six seconds]'],
        ['obj', 'Reach the service lift under the rail depot'], ['marker', 0, -99, 'Service lift'],
      ],
      supportLocker: [['give', 'br4'], ['say', 'Mara', 'BR-4 battle rifle acquired. It hits harder, but the slower cadence leaves less room for missed shots.']],
      dispatchLog: [
        ['note', 'DISPATCH LOG · DEPOT 7', 'Shipments to Site 4 are billed to KESSEL HOLDINGS, not VEIL.\n\nWarden payroll: same account.\n\nThe service lift answers only to a dispatcher pass. The dispatcher took his pass home eleven years ago. The spare is issued from the panel at the desk.'],
        ['say', 'Elias', "Kessel Holdings. So the surface guards were never VEIL's. They were his."],
      ],
      dispatch: [
        ['say', 'Kessel', 'Elias, it is Kessel, on the old maintenance channel. That panel can issue you a rail pass. It opens the service spur straight to the lift. Take it.'],
        ['say', 'Mara', 'Do not. Whatever he gives you, he can track.'],
        ['choice', {
          id: 'trustKessel', title: 'KESSEL\'S RAIL PASS', body: 'The pass opens the short service spur. The other way is the guarded pump room.',
          opts: [
            { t: "Take Kessel's pass. Short route, but he will know where you are.", do: [['flag', 'trustKessel', true], ['unlock', 'railGate'], ['say', 'Kessel', 'Pass logged. Straight through the service spur. Thank you for trusting me, Elias.'], ['say', 'Mara', 'He knows where you are now. I do not like it.']] },
            { t: 'Refuse. Take the pump-room route.', do: [['flag', 'trustKessel', false], ['say', 'Mara', 'Smart. The pump room is the long way, and it is guarded.']] },
          ],
        }],
      ],
      enterDepot: [
        ['checkpoint', 1],
        ['say', 'Mara', 'Rail carts are rolling in: Wardens, arriving on the old line. Hold the depot.'],
        ['spawn', 'cart'], ['obj', 'Clear the depot'],
      ],
      'cleared:cart': [['obj', 'Reach the service lift'], ['say', 'Mara', 'That was the last of the carts. The lift is north.']],
      enterLift: [['checkpoint', 2]],
      lift: [
        ['say', 'Elias', 'Down again.'],
        ['say', 'Mara', 'Elias... whatever you find down there, I need you to tell me the truth about it. All of it.'],
        ['end'],
      ],
    },
  },
  { // ------------------------------------------------------------------ 5 (was 3): THE DESCENT
    events: {
      start: [
        ['say', 'Mara', "Signal's fading down here. I'm routing through the old shaft relay. If I drop, keep moving."],
        ['say', 'Elias', "Down is where I never went back."],
        ['obj', 'Descend to Lower Level 4'],
        ['if', 'trustKessel', true,
          [['spawn', 'tip'], ['say', "Mara", "Kessel's pass pinged the lower levels. Someone down there is expecting you."]],
          []],
      ],
      fieldLocker: [['give', 'breach'], ['say', 'Mara', 'Breach shotgun acquired. Short reach, wide spread; do not waste it across a corridor.']],
      lab: [['note', 'LAB 3 NOTE', "Veil does not store data. It stores people.\n\nWe told the board it was an archive. It is not an archive.\n\nIf they find out what the interface really holds, they will never let us shut it down."]],
      enterHall: [
        ['checkpoint', 1], ['obj', 'Clear the security hall'],
        ['say', 'Mara', 'Wardens main post ahead. Heavy armor in there. Go for the head.'],
      ],
      'cleared:hall': [
        ['show', 'cellPanel'], ['obj', 'Open the cell door on the east wall'],
        ['say', 'Mara', 'Cell panel on the east wall. Someone inside tapped the pipes twice.'],
      ],
      cellPanel: [
        ['unlock', 'cell'], ['show', 'terminal'],
        ['if', 'trustKessel', true,
          [['say', 'Kessel', 'You used my pass. I hoped you would.']],
          [['say', 'Kessel', 'You refused my pass. Wise. I would have, in your place.']]],
        ['say', 'Kessel', "Elias Voss. They told me you'd come. Please, before you shoot: the seal order."],
        ['say', 'Elias', 'You told me the level was clear.'],
        ['say', 'Kessel', "I told you what the board required. Level 4 held the VEIL core. Thirty-one people were still connected when the power failed. VEIL didn't kill them, Elias. It kept them."],
        ['say', 'Elias', 'Dana.'],
        ['say', 'Kessel', 'The voice you heard was not a recording. It is what is left of her, running in a dying machine.'],
        ['say', 'Mara', "Elias, he sealed the dead inside a machine and called it a project. Don't trust him."],
        ['say', 'Kessel', "She's right not to. But the core is failing. When it dies, they go with it. You can carry the drive out, or end it. I won't pretend either is clean."],
        ['obj', "Decide the core's fate at the terminal"], ['checkpoint', 2],
      ],
      terminal: [
        ['note', 'CORE AUTHORIZATION · PRELIMINARY READOUT', 'The core is failing. Three routes remain technically possible: preserve and contain the memory drive, destroy the core, or expose the system and its evidence. Final authorization is deferred until the core chamber.'],
        ['say', 'Kessel', 'Do not choose from a summary. See the core first, and decide with the full record in front of you.'],
        ['obj', 'Reach the Archive access corridor'], ['checkpoint', 2],
      ],
      exit: [['say', 'Mara', 'The archive is ahead. Do not trust a single version of the shutdown report.'], ['end']],
    },
  },
  { // ------------------------------------------------------------------ 6: THE ARCHIVE
    events: {
      entry: [],
      start: [
        ['say', 'Mara', 'Archive access is live. Copy the consent file before the facility erases its local index.'],
        ['obj', 'Find Dana’s consent file and compare the night reports'],
      ],
      consentFile: [
        ['note', 'DANA VOSS · CONSENT RECORD', 'VEIL interface trial: volunteer consent recorded. The attached witness statement is incomplete; the date stamp conflicts with the shutdown log.'],
        ['choice', { id: 'archive', title: 'THE CONSENT FILE', body: 'A clean copy can be sent to Mara. Leaving it on the local server preserves Kessel’s access.', opts: [
          { t: 'Copy the file for Mara', do: [['flag', 'archive', 'copy'], ['say', 'Mara', 'I have it. The consent form is real, but it does not explain the shutdown order.']] },
          { t: 'Leave the file on the server', do: [['flag', 'archive', 'leave'], ['say', 'Kessel', 'A careful decision. The full record is more complicated than the summary.']] },
        ]}],
        ['obj', 'Compare the consent record with the night guard log'],
      ],
      weaponCache: [['give', 'sr6'], ['give', 'suppressed'], ['say', 'Mara', 'Marksman rifle and suppressed sidearm found in the archive cache. The suppressor reduces sound range; it does not make you invisible.']],
      nightLog: [
        ['note', 'NIGHT GUARD LOG', '03:09 — the lower-level evacuation was not complete. A second authorization arrived from the board channel. The log copy ends before the sender ID.'],
        ['flag', 'nightLogFound', true],
      ],
      exit: [['say', 'Mara', 'The reports disagree about who knew the lower level was occupied. Keep both versions; the difference matters.'], ['end']],
    },
  },
  { // ------------------------------------------------------------------ 7: QUARANTINE
    events: {
      entry: [],
      start: [
        ['say', 'Mara', 'The medical wing is not an archive. Those volunteer records describe people who were still alive when the system was sealed.'],
        ['obj', 'Inspect the volunteer list and reach emergency routing'],
      ],
      weaponLocker: [['give', 'lm8'], ['say', 'Mara', 'LM-8 support weapon acquired. The large magazine helps hold a lane, but reloads take longer.']],
      volunteerList: [
        ['note', 'QUARANTINE VOLUNTEER LIST', 'Thirty-one entries. Several are marked TRANSFERRED rather than deceased. The interface status column was manually overwritten after the outage.'],
        ['choice', { id: 'kesselTrust', title: 'KESSEL’S ACCOUNT', body: 'Kessel can explain the overwritten list, but his explanation may not match the evidence.', opts: [
          { t: 'Demand the unedited record', do: [['flag', 'kesselTrust', 2], ['say', 'Elias', 'No more summaries. I want the original record.'], ['say', 'Kessel', 'Then you deserve to see the audit trail.']] },
          { t: 'Accept Kessel’s explanation for now', do: [['flag', 'kesselTrust', 1], ['say', 'Kessel', 'I will give you what I can verify. That is not the same as asking you to forgive me.']] },
        ]}],
        ['obj', 'Reach the emergency power console'],
      ],
      exit: [['say', 'Mara', 'Power is failing across the facility. The next route will be dark. Stay close to the emergency markers.'], ['end']],
    },
  },
  { // ------------------------------------------------------------------ 8: THE LONG NIGHT
    events: {
      entry: [],
      start: [
        ['stinger'], ['say', 'Mara', 'Power failure confirmed. I can keep one route lit, not the whole wing.'],
        ['if', 'spared', true, [['say', 'Warden', 'Sato here. I remember what you did at Frostline. I can hold the service junction for a minute.']], [['say', 'Mara', 'No Sato response. We do this without surface support.']]],
        ['if', 'kesselTrust', 2, [['say', 'Kessel', 'I am opening the emergency route. The original audit trail is yours.']], [['say', 'Kessel', 'The route is open. Do not mistake that for absolution.']]],
        ['obj', 'Restore emergency routing and reach the core approach'],
      ],
      powerConsole: [
        ['flag', 'radioRestored', true], ['note', 'EMERGENCY ROUTING', 'The emergency circuit is restored. A six-second carrier signal appears inside the noise floor, then vanishes.'],
        ['say', 'Mara', 'Routing restored. That carrier tone is the same six seconds we heard on the rail line. It is coming from the core.'],
      ],
      exit: [['say', 'Elias', 'No more doors between me and the truth.'], ['end']],
    },
  },
  { // ------------------------------------------------------------------ 9: BLACK VEIL
    events: {
      start: [
        ['say', 'Mara', 'The core is ahead. You have the evidence now. The final authorization is yours, Elias.'],
        ['if', 'spared', true,
          [['unlock', 'sideDoor4'], ['say', 'Warden', "This is Sato, the Warden you helped. Service room on the west side is open. Supplies are yours."]],
          [['say', 'Mara', 'The Wardens know you are coming. Expect company in the chamber.']]],
        ['obj', 'Reach the core vault'],
      ],
      enterCore: [['checkpoint', 1], ['obj', 'Hold the core chamber'], ['say', 'Elias', 'Everything I ran from is in that room.']],
      'cleared:fin1': [
        ['if', 'spared', true,
          [['show', 'core'], ['obj', 'Access the VEIL core']],
          [['spawn', 'amb'], ['say', 'Mara', 'More Wardens! They were waiting behind the sealed doors.'], ['obj', 'Survive the second wave']]],
      ],
      'cleared:amb': [['show', 'core'], ['obj', 'Access the VEIL core']],
      core: [
        ['stinger'],
        ['say', 'Dana', "Elias... you came back. I knew the doors would open one day."],
        ['say', 'Elias', "I'm sorry. I signed the order. I thought you were gone."],
        ['say', 'Dana', "You didn't know. None of us did. Please... don't let it hurt anymore."],
        ['choice', { id: 'finalAuthorization', title: 'BLACK VEIL · FINAL AUTHORIZATION', body: 'The core holds thirty-one stored minds. Your evidence and earlier choices shape what can be saved, destroyed, or exposed.', opts: [
          { t: 'PRESERVE / CONTAIN — extract the drive and contain the core', do: [['flag', 'fate', 'preserve'], ['say', 'Kessel', 'I will stabilize the rig. You have my word, though I have spent too many years asking you to trust it.']] },
          { t: 'DESTROY THE CORE — end VEIL, knowing the stored minds will be lost', do: [['flag', 'fate', 'purge'], ['say', 'Mara', 'Charges are armed. I will get you to the exit. I am sorry, Elias.']] },
          { t: 'EXPOSE VEIL — transmit the evidence and force the truth into the open', do: [['flag', 'fate', 'expose'], ['flag', 'exposeVEIL', true], ['say', 'Mara', 'Transmission queued. The evidence will matter only if it survives the facility.']] },
        ]}],
        ['say', 'Dana', 'I kept one final authorization hidden. If you leave with the drive, the system will follow you. I cannot let it reach the surface.'],
        ['say', 'Elias', 'Dana, wait—'],
        ['say', 'Mara', 'Elias, move! The core is locking down!'],
        ['flag', 'danaFate', 'dead'],
        ['note', 'DANA VOSS · FINAL RECORD', 'The final confrontation ends with Dana’s death. The record is incomplete; whether her last action was betrayal, protection, or both remains tied to the evidence Elias recovered.'],
        ['if', 'fate', 'preserve',
          [['say', 'Elias', "Hold on, Dana. I'm taking you home."]],
          [['say', 'Elias', 'Goodbye, Dana. Close your eyes.']]],
        ['end'],
      ],
    },
  },
];

export const ENDINGS = {
  quietDawn: { title: 'A QUIET DAWN', lines: ['The core is contained, and a portion of its stored minds survives on the extracted drive.', 'Sato’s crew helps the survivors reach the surface.', 'Elias carries the truth home, though no record can restore what was lost.', 'For the first time in eleven years, the signal falls silent.'] },
  truthSurvives: { title: 'THE TRUTH SURVIVES', lines: ['The consent file and the unedited logs leave the facility with Mara.', 'Kessel Holdings can no longer control the only surviving account of VEIL.', 'The survivors face a public reckoning rather than another sealed report.', 'Elias does not call it justice. He calls it a beginning.'] },
  ashesBelow: { title: 'ASHES BELOW', lines: ['The charges destroy the core and the system that held the thirty-one minds.', 'Some records are lost with it; the evidence Elias preserved is all that remains.', 'The escape is narrow, and not everyone makes it out.', 'On the ridge, the radio carries only wind.'] },
  newCustodian: { title: 'A NEW CUSTODIAN', lines: ['Elias leaves with the drive, but the access keys remain in Kessel’s hands.', 'VEIL survives under a new name and a new chain of command.', 'The people involved tell themselves the system is now safer.', 'The final transmission proves otherwise.'] },
  sixSeconds: { title: 'SIX SECONDS', lines: ['The core is gone, yet the carrier tone returns for exactly six seconds.', 'The records disagree about when the final transmission was made.', 'Mara cannot trace its source, and Elias cannot prove what he heard.', 'The screen fades before the signal resolves.'] },
  // Compatibility names for existing campaign callers and regression tests.
  preserve: { title: 'A QUIET DAWN', lines: ['The core is contained; the extracted drive carries what remains.', 'The truth survives, though it cannot repair every loss.', 'Elias leaves the facility with the signal finally quiet.'] },
  purge: { title: 'ASHES BELOW', lines: ['The core is destroyed and the facility falls silent.', 'Evidence survives only where Elias preserved it.', 'The cost of ending VEIL remains with the people who escaped.'] },
};

export function chooseEnding(choices = {}) {
  const evidence = !!choices.radioRestored && choices.archive === 'copy' && !!choices.nightLogFound;
  if (choices.fate === 'expose') return evidence ? 'truthSurvives' : 'newCustodian';
  if (choices.fate === 'purge' && evidence) return 'sixSeconds';
  if (choices.fate === 'purge') return 'ashesBelow';
  if (choices.fate === 'preserve' && choices.spared === true) return 'quietDawn';
  if (choices.fate === 'preserve' && evidence && choices.kesselTrust === 2) return 'truthSurvives';
  if (choices.fate === 'preserve' && choices.trustKessel === true && choices.archive !== 'copy') return 'newCustodian';
  if (choices.fate === 'preserve' && evidence) return 'truthSurvives';
  return choices.fate === 'preserve' ? 'newCustodian' : 'ashesBelow';
}

export const CREDITS = [
  ['BLACK VEIL', ''], ['Design, story, code', 'Claude (Anthropic)'], ['Built with', 'three.js, Web Audio API'],
  ['All art, audio and dialogue', 'Generated in code; no external assets'], ['Thank you for playing', ''],
];
