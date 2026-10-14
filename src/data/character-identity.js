// Canonical visual identity + asset-readiness manifest. Story facts are limited to those established in project data/docs;
// unspecified physical traits are explicitly marked as design targets, not existing canon.
export const CHARACTER_IDENTITIES = {
  eliasVoss: {
    id: 'eliasVoss', name: 'Elias Voss', status: 'canonical-protagonist', tier: 'hero',
    canon: ['former military rescue specialist', 'arrives at Frostline after a transmission in Dana’s voice', 'signed the Level 4 seal order believing the level was clear'],
    designTarget: { age: 'late 30s to mid 40s (confirm against approved timeline)', silhouette: 'practical rescue specialist; layered cold-weather jacket, field trousers, rugged boots; no superhero bulk', palette: ['slate', 'weathered charcoal', 'muted rescue orange used sparingly'], face: 'individualized natural asymmetry; restrained fatigue, not a permanently angry expression', hair: 'short, practical, weather-exposed; not helmet-shaped', footwear: 'structured outdoor/rescue boot with tread and reinforced toe' },
    variants: ['frostline-intact', 'white-valley-weathered', 'kalder-field', 'under-rails-dust', 'descent-worn', 'archive-neutral', 'quarantine-protective-only-if-canon', 'long-night-wet-dirty', 'black-veil-campaign-worn'],
    implementation: 'PARTIAL_PROCEDURAL_BLOCKOUT_ASSET; base GLB and OBJ/MTL plus elias_voss_uv.glb with generated per-part UVs/procedural base-color maps exist under public/models/characters; no verified rig/skin weights; hero asset is not loaded into gameplay and player remains first-person'
  },
  danaVoss: {
    id: 'danaVoss', name: 'Dana Voss', status: 'canonical-story-character', tier: 'major',
    canon: ['Elias’s wife', 'volunteered for the VEIL Phase 3 interface', 'asked that Elias not be told until transfer was stable', 'appears through voice/recordings and the final story event'],
    designTarget: { silhouette: 'recognizable, understated civilian/research-professional profile only where timeline supports it', palette: ['muted blue-grey', 'warm neutral', 'worn off-white'], face: 'unique face and hair identity shared across timeline variants', hair: 'specific style remains an art decision pending a canonical face reference', footwear: 'timeline-appropriate practical shoes, not combat boots by default' },
    variants: ['earlier-everyday', 'consent-record-timeline', 'research-if-canon', 'recovered-recording', 'final-chapter', 'memory-world-if-shown'],
    implementation: 'PARTIAL_STATIC_BLOCKOUT; public/models/characters/dana_voss_blockout.glb exists with generated per-part UVs; no facial rig, skeletal skinning, unique production sculpt, or gameplay integration'
  },
  maraVale: {
    id: 'maraVale', name: 'Mara Vale', status: 'canonical-story-character', tier: 'major',
    canon: ['radio handler connected to the carrier signal and investigation', 'post-game White Valley explorer label'],
    designTarget: { silhouette: 'field-capable communications/investigation worker; light functional layers, compact radio/headset only if visible', palette: ['cold grey', 'desaturated blue', 'small amber signal detail'], face: 'distinct from Dana; no assumed family history beyond established dialogue', hair: 'practical, recognizable outline', footwear: 'weather-appropriate field boots' },
    variants: ['radio-presence', 'investigation-if-rendered', 'memory-world-explorer'],
    implementation: 'PARTIAL_STATIC_BLOCKOUT; public/models/characters/mara_vale_blockout.glb exists with generated per-part UVs and headset blockout; no facial rig, skeletal skinning, unique production sculpt, or gameplay integration'
  },
  hale: {
    id: 'hale', name: 'Marcus Hale', status: 'canonical-mentioned-character', tier: 'supporting',
    canon: ['member of Rescue Team Bravo roster with Elias and T. Rowan', 'Mara asks about Hale'],
    designTarget: { silhouette: 'rescue-team-compatible practical field clothing; individual face and proportions must be authored before production', palette: ['rescue slate', 'weathered olive', 'muted orange detail'], footwear: 'rescue boots' },
    variants: ['year-zero-rescue-team'], implementation: 'NOT_MODELED; canonical details are sparse'
  },
  maren: {
    id: 'maren', name: 'Maren Hale', status: 'continuity-foreshadowed-reveal-not-fully-implemented', tier: 'supporting',
    canon: ['continuity document foreshadows Mara as Maren Hale; full reveal remains unimplemented'],
    designTarget: { silhouette: 'must be authored separately from Mara while allowing a believable family resemblance only if confirmed', palette: ['desaturated teal', 'charcoal', 'soft neutral'], footwear: 'timeline- and role-appropriate practical footwear' },
    variants: ['timeline-to-be-confirmed'], implementation: 'NOT_MODELED; full reveal is not implemented in current story'
  }
};

export const FACTION_VISUALS = {
  warden: { name: 'Wardens', palette: ['charcoal', 'weathered olive', 'low-saturation red-orange marker'], garments: ['layered weather shell', 'reinforced field trousers', 'rugged tactical boots', 'role-specific vest'], variation: 'fit, wear, headgear and pouches vary deterministically by spawn seed; insignia remains restrained' },
  drifter: { name: 'Drifters', palette: ['faded earth', 'old denim', 'repaired dark fabric'], garments: ['repaired layers', 'mismatched outerwear', 'mixed practical footwear'], variation: 'resource-driven, reused clothing; no uniform military silhouette' },
  fractured: { name: 'Fractured survivors', palette: ['muted neutral', 'faded institutional colors'], garments: ['ordinary clothing with restrained wear'], variation: 'posture/condition varies by actual AI/story state; avoid one universal distressed look' },
  collector: { name: 'Collectors', palette: ['dusty brown', 'olive', 'weathered grey'], garments: ['utility layers', 'carrying strap or bag only where gameplay supports it'], variation: 'equipment placement reflects scavenging role' },
  returned: { name: 'Returned', palette: ['reuse prior character palette'], garments: ['retain recognizable base outfit'], variation: 'change only state-backed dirt, injury, or equipment' },
  veilResearch: { name: 'VEIL researchers and technicians', palette: ['off-white', 'cool grey', 'desaturated blue'], garments: ['role-specific workwear; protective wear only in supported locations'], variation: 'research, archive, engineering and medical roles must not share one default costume' },
  kesselHoldings: { name: 'Kessel Holdings', palette: ['charcoal', 'navy', 'restrained corporate grey'], garments: ['business, security or fieldwork clothing appropriate to role'], variation: 'not all staff wear black suits; role and access level determine outfit' },
  friendlySurvivor: { name: 'Friendly survivors and allies', palette: ['mixed faded personal colors'], garments: ['individual civilian layers and practical shoes'], variation: 'personal history and resource access, not a shared faction uniform' }
};

export const CHAPTER_APPEARANCE = {
  c1: { label: 'Frostline', wear: 0.08, notes: 'intact cold-weather layers; light snow exposure' },
  v1: { label: 'The White Valley', wear: 0.16, notes: 'deterministic weathering; snow accumulation is not currently rendered on character meshes' },
  c2: { label: 'Kalder Ridge', wear: 0.22, notes: 'field equipment remains practical; no random outfit reset' },
  b2: { label: 'Under the Rails', wear: 0.36, notes: 'dust and industrial grime are design targets; no state-driven overlay integration yet' },
  c3: { label: 'The Descent', wear: 0.46, notes: 'campaign wear target only; visual state is not yet wired to save data' },
  c5: { label: 'The Archive', wear: 0.49, notes: 'preserve silhouette and equipment continuity' },
  c6: { label: 'Quarantine', wear: 0.54, notes: 'protective equipment only if the scene/story requires it' },
  c7: { label: 'The Long Night', wear: 0.67, notes: 'moisture/dirt target; no actual wetness shader' },
  c4: { label: 'Black Veil', wear: 0.78, notes: 'most campaign-worn target; currently documentation only' }
};

// Paths and readiness are explicit so the runtime never mistakes blockouts for final rigged assets.
export const CHARACTER_ASSETS = {
  eliasVoss: { url: '/public/models/characters/elias_voss_uv.glb', status: 'STATIC_BLOCKOUT_WITH_PER_PART_UV; NOT_SKINNED' },
  danaVoss: { url: '/public/models/characters/dana_voss_blockout.glb', status: 'STATIC_BLOCKOUT_WITH_PER_PART_UV; NOT_SKINNED' },
  maraVale: { url: '/public/models/characters/mara_vale_blockout.glb', status: 'STATIC_BLOCKOUT_WITH_PER_PART_UV; NOT_SKINNED' },
  veilResearch: { url: '/public/models/characters/veil_research_faction_blockout.glb', status: 'STATIC_BLOCKOUT_WITH_PER_PART_UV; RUNTIME_FALLBACK_REPLACEMENT_ENABLED; NOT_SKINNED' },
  factions: { warden: '/public/models/characters/warden_faction_blockout.glb', drifter: '/public/models/characters/drifter_faction_blockout.glb', fractured: '/public/models/characters/fractured_faction_blockout.glb', collector: '/public/models/characters/collector_faction_blockout.glb', veilResearch: '/public/models/characters/veil_research_faction_blockout.glb', kesselSecurity: '/public/models/characters/kessel_security_faction_blockout.glb', friendlySurvivor: '/public/models/characters/friendly_survivor_faction_blockout.glb' }
};
