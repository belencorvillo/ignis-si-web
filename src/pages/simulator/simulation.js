// ── IGNIS · Simulator logic: presets, sources, match scoring, hazard rules ──
// Owned by the Simulator page. Nothing outside src/pages/simulator imports this.

import { GRAVITY_REGIME_LABELS, LUNAR_TARGET } from '../../shared/catalog'

export const SLIDER_LIMITS = {
  o2: { min: 21, max: 85, step: 1 },
  pressure: { min: 4.3, max: 14.7, step: 0.1 },
  airflow: { min: 0, max: 30, step: 0.5 },
}

export const GRAVITY_LEVELS = [
  { value: 0, short: '0g', name: 'Microgravity (orbit)' },
  { value: 0.16, short: '0.16g', name: 'Moon (1/6g)' },
  { value: 0.38, short: '0.38g', name: 'Mars (3/8g)' },
  { value: 1, short: '1.0g', name: 'Earth' },
]

/** 3D viewport modes. */
export const VIEW_MODES = {
  cabin: { id: 'cabin', label: 'Spacecraft Cabin', short: 'Cabin' },
  habitat: { id: 'habitat', label: 'Planetary Habitat', short: 'Habitat' },
  chamber: { id: 'chamber', label: 'Combustion Chamber Flame', short: 'Flame' },
}

// ── Mission presets and their justification ──────────────────────────────────
// Every value below is traceable to a source listed in `sources`, except the
// airflow defaults, which are illustrative and flagged as such in the UI.

export const SOURCES = {
  eawg: {
    label: 'NASA/TP-2010-216134 — Exploration Atmospheres Working Group final report (Oct 2010)',
    url: 'https://purl.fdlp.gov/GPO/gpo7190',
  },
  abercromby2022: {
    label: 'Abercromby et al., NASA DCS strategic plan (AsMA 2022)',
    url: 'https://ntrs.nasa.gov/api/citations/20220005709/downloads/AsMA%202022%20-%20Abercromby%20-%20DCS%20Strategic%20Plan%20v2.pdf',
  },
  garbino2022: {
    label: 'Garbino et al., Exploration Atmospheres (AsMA 2022)',
    url: 'https://ntrs.nasa.gov/api/citations/20220005716/downloads/AsMA%202022%20-%20Garbino%20-%20Exploration%20Atmospheres%20v2.pdf',
  },
  evaOps: {
    label: 'Gernhardt et al., EVA operations (NASA, 2013)',
    url: 'https://nasa.gov/wp-content/uploads/2023/03/gernhardt-eva-ops-chp-5.4-2013.pdf',
  },
  moonFacts: { label: 'NASA NSSDC Moon fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
  marsFacts: { label: 'NASA NSSDC Mars fact sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
  psi10: { label: 'PSI-10 · ACME Flame Design', url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-10' },
  psi159: { label: 'PSI-159 · ACME Cool Flames Investigation with Gases (catalog envelope)', url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-159' },
}

/**
 * Quick mission presets. `why` is the one-line rationale shown in the info
 * dialog; `notes` flags anything that is an assumption rather than a source.
 */
export const MISSION_PRESETS = [
  {
    id: 'flame',
    name: 'ISS air, fans off',
    detail: '21% O₂ · 14.7 psi · 0g · still air',
    params: { o2: 21, pressure: 14.7, airflow: 0, gravity: 0 },
    mode: 'chamber',
    why: 'Standard station air with no ventilation: the classic microgravity flame. Without buoyancy or airflow it burns as a slow, dim, blue sphere controlled only by diffusion, as studied by ACME Flame Design.',
    sources: ['evaOps', 'psi10'],
    notes: 'Starting point of the Flame view.',
  },
  {
    id: 'iss',
    name: 'ISS cabin',
    detail: '21% O₂ · 14.7 psi · 0g',
    params: { o2: 21, pressure: 14.7, airflow: 8, gravity: 0 },
    mode: 'cabin',
    why: 'The space station keeps a sea-level atmosphere: about 14.7 psia with roughly 21% oxygen, in microgravity.',
    sources: ['evaOps'],
    notes: 'No natural convection in orbit, so fans circulate the air; the airflow value is an illustrative default.',
  },
  {
    id: 'lunar',
    name: 'Lunar base / rover',
    detail: '34% O₂ · 8.2 psi · 1/6g',
    params: { o2: 34, pressure: 8.2, airflow: 5, gravity: 0.16 },
    mode: 'habitat',
    why: 'NASA’s recommended exploration atmosphere for EVA-intensive missions. The working group first proposed 8.0 psia / 32% O₂; a 2012 re-evaluation moved it to 8.2 psia / 34% O₂ to reduce hypoxic stress.',
    sources: ['eawg', 'abercromby2022', 'garbino2022', 'moonFacts'],
    notes: 'Recommended, not required: NASA leaves the exact set point to vehicle providers.',
  },
  {
    id: 'mars',
    name: 'Mars habitat',
    detail: '34% O₂ · 8.2 psi · 3/8g',
    params: { o2: 34, pressure: 8.2, airflow: 5, gravity: 0.38 },
    mode: 'habitat',
    why: 'Same exploration atmosphere as the lunar case, at Martian gravity.',
    sources: ['garbino2022', 'marsFacts'],
    notes: 'We found no NASA document fixing a Mars-specific habitat atmosphere; this reuses the 8.2 psia / 34% O₂ recommendation.',
  },
  {
    id: 'eva',
    name: 'Spacesuit',
    detail: '85% O₂ (100% capped) · 4.3 psi',
    params: { o2: 85, pressure: 4.3, airflow: 2, gravity: 0 },
    mode: 'cabin',
    why: 'The ISS spacesuit (EMU) runs at 4.3 psia of pure oxygen. The simulator caps it at 85%, the highest oxygen level in the PSI catalog, so the evidence is never extrapolated.',
    sources: ['evaOps', 'psi159'],
    notes: '100% O₂ itself is outside every tested envelope.',
  },
  {
    id: 'cfig',
    name: 'Oxygen extreme',
    detail: '85% O₂ · 14.7 psi · 0g',
    params: { o2: 85, pressure: 14.7, airflow: 0, gravity: 0 },
    mode: 'chamber',
    why: 'The upper end of the ACME Cool Flames with Gases envelope in the catalog (PSI-159), where inverse “inside-out” flames become relevant.',
    sources: ['psi159'],
    notes: 'A laboratory limit case, not a habitat atmosphere.',
  },
]

const byId = Object.fromEntries(MISSION_PRESETS.map((p) => [p.id, p]))
export const presetById = (id) => byId[id]

/** Conditions each scene starts with when selected. */
export const SCENE_DEFAULTS = { chamber: 'flame', cabin: 'iss', habitat: 'mars' }

/** Surface sites offered under the Habitat scene. */
export const HABITAT_SITES = [
  { value: 'lunar', label: 'Moon' },
  { value: 'mars', label: 'Mars' },
]

/** The page opens on the Cabin scene with ISS cabin conditions. */
export const DEFAULT_MODE = 'cabin'
export const DEFAULT_PARAMS = byId.iss.params

// ── Explainable match score ──────────────────────────────────────────────────
/** Visible, deterministic weights (sum = 1). */
export const SCORE_WEIGHTS = { o2: 0.35, pressure: 0.25, gravity: 0.25, airflow: 0.15 }

/**
 * How well each gravity regime informs each target gravity level.
 * 0g and 1g data *bound* partial gravity; E-FIELD proxies approximate it.
 */
export const GRAVITY_FIT = {
  '0g_microgravity': { 0: 1, 0.16: 0.6, 0.38: 0.5, 1: 0.15 },
  partial_g_proxy: { 0: 0.6, 0.16: 1, 0.38: 1, 1: 0.6 },
  '1g_ground_reference': { 0: 0.15, 0.16: 0.5, 0.38: 0.6, 1: 1 },
}

function axisFit(value, min, max, span) {
  if (min == null && max == null) return { score: 0.5, inside: false, unknown: true, dist: null }
  const lo = min ?? max
  const hi = max ?? min
  if (value >= lo - 1e-9 && value <= hi + 1e-9) return { score: 1, inside: true, unknown: false, dist: 0 }
  const dist = value < lo ? lo - value : value - hi
  return { score: Math.max(0, 1 - dist / (span * 0.5)), inside: false, unknown: false, dist }
}

/**
 * Score one investigation against the simulator parameters.
 * Returns { score (0-100), status, axes, reasons } — every number is traceable.
 */
export function scoreInvestigation(inv, { o2, pressure, airflow, gravity }) {
  const e = inv.envelope
  const axes = {
    o2: axisFit(o2, e.o2_min_pct, e.o2_max_pct, SLIDER_LIMITS.o2.max - SLIDER_LIMITS.o2.min),
    pressure: axisFit(pressure, e.pressure_min_psi, e.pressure_max_psi, SLIDER_LIMITS.pressure.max - SLIDER_LIMITS.pressure.min),
    airflow: axisFit(airflow, e.airflow_min_cms, e.airflow_max_cms, SLIDER_LIMITS.airflow.max - SLIDER_LIMITS.airflow.min),
  }
  const gFit = GRAVITY_FIT[e.gravity_regime]?.[gravity] ?? 0.5
  axes.gravity = { score: gFit, inside: gFit === 1, unknown: false, dist: null }

  const raw = Object.entries(SCORE_WEIGHTS).reduce((sum, [k, w]) => sum + w * axes[k].score, 0)
  const score = Math.round(raw * 100)

  const envInside = axes.o2.inside && axes.pressure.inside && axes.airflow.inside
  const partialTarget = gravity > 0 && gravity < 1
  let status
  if (envInside && axes.gravity.inside) status = 'covers'
  else if (envInside && partialTarget && e.gravity_regime !== 'partial_g_proxy') status = 'bounds'
  else if (score >= 50) status = 'partial'
  else status = 'outside'

  const reasons = []
  const label = { o2: 'O₂', pressure: 'Pressure', airflow: 'Airflow' }
  for (const k of ['o2', 'pressure', 'airflow']) {
    const a = axes[k]
    if (a.unknown) reasons.push(`${label[k]}: not reported (scored 50%)`)
    else if (a.inside) reasons.push(`${label[k]}: inside tested range`)
    else reasons.push(`${label[k]}: ${+a.dist.toFixed(1)} outside tested range`)
  }
  reasons.push(
    `Gravity: ${GRAVITY_REGIME_LABELS[e.gravity_regime]} → ${Math.round(gFit * 100)}% fit for ${gravity}g`,
  )
  return { score, status, axes, reasons }
}

export const STATUS_META = {
  covers: { label: 'Covers', tone: 'emerald', hint: 'Envelope contains all selected conditions.' },
  bounds: { label: 'Bounds', tone: 'cyan', hint: 'Envelope matches; result bounds the partial-g target from 0g or 1g.' },
  partial: { label: 'Partial', tone: 'amber', hint: 'Some conditions fall outside the tested envelope.' },
  outside: { label: 'Outside', tone: 'slate', hint: 'Mostly outside the tested envelope.' },
}

export function rankInvestigations(list, params) {
  return list
    .map((inv) => ({ inv, ...scoreInvestigation(inv, params) }))
    .sort((a, b) => b.score - a.score || Number(b.inv.lunar_habitat_relevant) - Number(a.inv.lunar_habitat_relevant))
}

// ── Heuristic hazard index (illustrative, deterministic) ─────────────────────
export function hazardLevel({ o2, pressure }) {
  if (o2 >= 40) return { level: 'critical', label: 'Critical', color: '#EF4444' }
  if (o2 >= LUNAR_TARGET.o2MinPct || (o2 > 21 && pressure <= LUNAR_TARGET.pressureMaxPsi))
    return { level: 'elevated', label: 'Elevated', color: '#F59E0B' }
  if (pressure <= LUNAR_TARGET.pressureMaxPsi) return { level: 'watch', label: 'Watch', color: '#38BDF8' }
  return { level: 'nominal', label: 'Nominal', color: '#10B981' }
}

/** Lowest pressure (psi) any investigation in the catalog was tested at, or null. */
export function minTestedPressure(investigations) {
  const values = investigations.map((i) => i.envelope.pressure_min_psi).filter((v) => v != null)
  return values.length ? Math.min(...values) : null
}

/**
 * Deterministic rule-based watch-outs for the current conditions, most important first.
 * `catalog.minPressure` comes from the active catalog, so the evidence-gap warning follows the data.
 */
export function advisory({ o2, pressure, airflow, gravity }, catalog = {}) {
  const out = []
  if (gravity > 0 && gravity < 1)
    out.push('No fire has been tested at lunar or Martian gravity. These results are bracketed by orbit (0g) and ground (1g) experiments, plus the PSI-22 electric-field proxy. LUCI and FM2 pending.')
  if (catalog.minPressure != null && pressure < catalog.minPressure)
    out.push(`No experiment in this catalog was tested below ${catalog.minPressure} psi, so every match at ${pressure.toFixed(1)} psi is extrapolated in pressure.`)
  if (o2 >= LUNAR_TARGET.o2MinPct)
    out.push(`O₂ ≥ ${LUNAR_TARGET.o2MinPct}%: exploration-atmosphere regime — material flammability screening must be performed at this O₂ level, not at 21%.`)
  if (o2 >= 70)
    out.push('Near the PSI 85% O₂ test limit: inverse (inside-out) and cool-flame regimes observed in ACME CFI-G become relevant.')
  if (pressure <= LUNAR_TARGET.pressureMaxPsi)
    out.push(`Pressure ≤ ${LUNAR_TARGET.pressureMaxPsi} psi: reduced-pressure / elevated-O₂ cabin as targeted for lunar bases and pressurized rovers.`)
  if (gravity === 0 && airflow < 1)
    out.push('Quiescent 0g: no buoyant plume — smoke does not rise to ceiling detectors; detection relies on ventilation transport.')
  if (gravity === 0 && airflow >= 5)
    out.push('Forced ventilation in 0g sustains flames that would self-extinguish in still air — consider fan shutdown in fire response.')
  if (!out.length) out.push('Conditions resemble standard ISS cabin air; existing 0g fire-safety data apply directly.')
  return out
}

/** Flame regime label + supporting evidence for the procedural flame view. */
export function flameRegime({ o2, airflow, gravity }) {
  if (o2 >= 75) return { name: 'Inverse (inside-out) flame', ref: 'ACME CFI-G · PSI-159' }
  if (gravity === 0 && airflow < 1) return { name: 'Spherical diffusion flame (0g)', ref: 'ACME Flame Design · PSI-10' }
  if (gravity === 0) return { name: 'Forced-flow flame, tilted downstream', ref: 'SPICE / BASS-II · PSI-107, PSI-25' }
  if (gravity < 1) return { name: 'Partial-g buoyant flame (bounded)', ref: '0g ↔ 1g, E-FIELD proxy · PSI-22' }
  return { name: 'Buoyant teardrop flame (1g reference)', ref: 'Ground reference' }
}

