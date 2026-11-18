// ── IGNIS-SI · Applications page content ───────────────────────────────────
// Two blocks, as asked by the Flame in Freefall challenge:
//   1. Next-generation fire safety controls and equipment (crew habitats)
//   2. Fire safety on Earth
// Only documented NASA work, each card backed by the linked sources.
// `match` selects the PSI investigations listed as evidence (null = none apply).

// 3D objects for the pop-ups (CC BY 4.0, credited in the pop-up and the footer — see shared/credits.js).
import smokeDetectorUrl from './smoke-detector.glb?url'
import valveUrl from './valve.glb?url'
import gaugeUrl from './pressure-gauge.glb?url'
import extinguisherUrl from './fire-extinguisher.glb?url'
import tankUrl from './simple_oxygen_tank.glb?url'
import firefighterUrl from './firefighter.glb?url'

export const BLOCKS = {
  equipment: {
    title: 'Next-generation fire safety controls and equipment',
    short: 'Next-gen equipment',
    lede: 'For spacecraft, space stations, lunar and Martian bases and pressurized rovers.',
  },
  earth: {
    title: 'Fire safety on Earth',
    short: 'On Earth',
    lede: 'What spaceflight fire research has already given back — and what it could give next.',
  },
}

const SRC = {
  same: { label: 'NASA — Smoke Aerosol Measurement Experiment (SAME) overview', href: 'https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf' },
  sameSae: { label: 'Urban et al. — Smoke particle sizes in low gravity and implications for spacecraft smoke detector design (SAE 2009-01-2468)', href: 'https://saemobilus.sae.org/content/2009-01-2468' },
  fwmNtrs: { label: 'NASA NTRS — Fine water mist portable fire extinguisher for the ISS', href: 'https://ntrs.nasa.gov/citations/20130011664' },
  fwmMines: { label: 'Colorado School of Mines — Fighting fire with fine water mist', href: 'https://www.minesnewsroom.com/news/fighting-fire-fine-water-mist' },
  fwmSpinoff: { label: 'Colorado School of Mines — NASA Spinoff showcases the ISS water-mist extinguishers', href: 'https://space.mines.edu/nasa-spinoff-magazine-showcases-mines-water-mist-iss-extinguishers' },
  saffire: { label: 'NASA Glenn — Largest fire experiment in space (Saffire)', href: 'https://www.nasa.gov/news-release/nasa-glenn-successfully-ignites-largest-fire-experiment-in-space' },
  eawg: { label: 'NASA/TP-2010-216134 — Exploration Atmospheres Working Group final report', href: 'https://purl.fdlp.gov/GPO/gpo7190' },
  // The three Spinoff articles below are the ones listed in the challenge's own Resources tab.
  tanks: { label: 'NASA Spinoff — Fireman’s Air Tanks (1976)', href: 'https://spinoff.nasa.gov/node/9582' },
  detector: { label: 'NASA Spinoff — Fire Detector (1978)', href: 'https://spinoff.nasa.gov/node/9407' },
  attire: { label: 'NASA Spinoff — New Technology for the Fire Attire (1982)', href: 'https://spinoff.nasa.gov/node/9918' },
  tanksNasa: { label: 'NASA — Spaceship storage tanks take off on Earth', href: 'https://www.nasa.gov/technology/tech-transfer-spinoffs/spaceship-storage-tanks-take-off-on-earth/' },
  pbiSpace: { label: 'Space.com — Out of NASA tragedy, better fireproof clothes', href: 'https://space.com/10671-space-spinoff-technology-fireproof-clothing.html' },
}

const isSmoke = (i) => /\b(SAME|DAFT)\b|smoke|aerosol|dust/i.test(i.title)
const isSuppression = (i) => /extingu|suppression/i.test(i.title)
const isSolids = (i) => i.fuel_phase === 'Solid' || i.hardware_rack === 'Saffire'

export const APPLICATIONS = [
  /* ── 1 · Next-generation controls and equipment ─────────────────────── */
  {
    id: 'detectors',
    model: { credit: 'smokeDetector', url: smokeDetectorUrl, rotation: [Math.PI + 0.6, 0, 0] },
    block: 'equipment',
    title: 'Smoke detectors sized for microgravity',
    lede: 'Alarms tuned to orbital smoke.',
    body:
      'SAME burned spacecraft materials (Teflon, Kapton, cellulose, silicone rubber) on the ISS and measured their smoke without returning samples. A substantial share of particles was below 500 nm, and the current ISS and Shuttle detectors flew alongside for comparison — data meant to shape the detectors of future vehicles.',
    sources: [SRC.same, SRC.sameSae],
    match: isSmoke,
  },
  {
    id: 'suppression',
    model: { credit: 'valve', url: valveUrl, rotation: [0.35, 0, 0] },
    block: 'equipment',
    title: 'Clean-agent suppression for crew cabins',
    lede: 'Put fires out, keep the air clean.',
    body:
      'The ISS replaced its CO₂ extinguishers with fine-water-mist units in 2015–2016, because CO₂ creates a hazardous breathing environment in a closed cabin. A next-generation unit is being developed for Orion. FLEX and BASS measured how diluents and agents extinguish droplet and solid-fuel flames in microgravity.',
    sources: [SRC.fwmNtrs, SRC.fwmMines],
    match: isSuppression,
  },
  {
    id: 'materials',
    model: { credit: 'pressureGauge', url: gaugeUrl, rotation: [0.15, 0, 0] },
    block: 'equipment',
    title: 'Material screening for exploration atmospheres',
    lede: 'Tested at habitat oxygen levels.',
    body:
      'Saffire burned samples far larger than any earlier space fire test to check microgravity flammability limits and NASA’s material selection criteria. Lunar and Martian habitats are expected to run at 34% O₂ and 8.2 psi, where materials burn more readily — and no investigation in this catalog was tested below 10.2 psi.',
    sources: [SRC.saffire, SRC.eawg],
    match: isSolids,
  },

  /* ── 2 · Fire safety on Earth ───────────────────────────────────────── */
  {
    id: 'earthDetector',
    model: { credit: 'smokeDetector', url: smokeDetectorUrl, rotation: [Math.PI + 0.6, 0, 0] },
    block: 'earth',
    title: 'Fire detectors that ignore dust',
    lede: 'Fewer false alarms, even in mines.',
    body:
      'The Brunswick Incipient Fire Detector, first used in Space Shuttle orbiters, samples the air for combustion particles and tells them apart from dust, so it raises fewer false alarms. Linked sensors can watch large areas such as mines and warn of a fire before flame and smoke appear. On the ISS, SAME and DAFT later measured smoke and dust particles in microgravity.',
    sources: [SRC.detector],
    match: isSmoke,
  },
  {
    id: 'mist',
    model: { credit: 'extinguisher', url: extinguisherUrl, rotation: [0.15, 0, 0] },
    block: 'earth',
    title: 'Fine-water-mist extinguishers',
    lede: 'Less water, no toxic agent.',
    body:
      'Developed by Colorado School of Mines, ADA Technologies and NASA Glenn for the ISS, the fine-water-mist extinguisher mixes micro-atomized water with nitrogen and was featured in NASA Spinoff as space technology with uses on Earth.',
    sources: [SRC.fwmSpinoff, SRC.fwmMines],
    match: isSuppression,
  },
  {
    id: 'tanks',
    model: { credit: 'airTank', url: tankUrl, rotation: [0.1, 0, 0] },
    block: 'earth',
    title: 'Lighter air tanks for firefighters',
    lede: 'More air, less weight on the back.',
    body:
      'NASA’s Johnson Space Center and Scott Aviation developed lightweight firefighter air tanks: an aluminium liner wrapped in resin-impregnated glass fibre that also avoids corrosion. The backpack carried 30 minutes of air for 20 pounds, 13 pounds less than the tanks of the time.',
    note: 'Pressure-vessel technology, not combustion research — no PSI investigation applies.',
    sources: [SRC.tanks, SRC.tanksNasa],
    match: null,
  },
  {
    id: 'clothing',
    model: { credit: 'firefighter', url: firefighterUrl, rotation: [0, 0, 0], pose: 'relaxed' },
    block: 'earth',
    title: 'Fire-resistant protective clothing',
    lede: 'Fabrics that refuse to burn.',
    body:
      'Through Project FIRES, NASA and the U.S. Fire Administration, with Marshall Space Flight Center as technical lead, applied the lightweight, fire-resistant materials developed after Apollo for spacesuits and spacecraft to firefighter gear. PBI fibre, created after the Apollo 1 fire, is still used in turnout gear today. Solid-material flammability data in PSI (BASS, Saffire) continue that line of research.',
    sources: [SRC.attire, SRC.pbiSpace],
    match: isSolids,
  },
]
