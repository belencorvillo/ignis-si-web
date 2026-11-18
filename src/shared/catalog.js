// ── IGNIS · Shared PSI catalog: loader, enums, labels, citations ─────────────
// Used by every page. Change with care: Simulator, Library and On Earth all
// depend on these exports.
//
// Load order (first one that returns a non-empty, valid list wins):
//   1. FastAPI backend (VITE_API_URL, default http://localhost:8000)
//   2. contracts/data/catalogo_limpio.json   (final dataset from Person 2)
//   3. contracts/data/mock_catalogo.json    (always-available fallback)
//
// The contract files are read as raw text (not JSON-imported) so that a UTF-8
// BOM — which the current mock file has — never breaks parsing.

// Vite resolves this at build time; files that do not exist yet are simply absent.
const contractFiles = import.meta.glob('../../contracts/data/*.json', {
  query: '?raw',
  import: 'default',
})

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const API_PATHS = ['/investigations', '/api/investigations']
const API_TIMEOUT_MS = 1500

// ── Enums (mirror contracts/types.ts) ─────────────────────────────────────────
export const PROJECT_TYPES = [
  'Microgravity Investigation',
  'Reduced Gravity Investigation',
  'Ground Investigation',
]
export const SAFETY_PILLARS = ['Prevention', 'Detection', 'Suppression']
export const HARDWARE_RACKS = ['CIR-ACME', 'CIR-MDCA', 'MSG-SPICE', 'Saffire', 'Ground-CFD', 'Other']
export const FUEL_PHASES = ['Solid', 'Liquid_Droplet', 'Gaseous', 'Multi-phase']
export const GRAVITY_REGIMES = ['0g_microgravity', 'partial_g_proxy', '1g_ground_reference']

export const FUEL_PHASE_LABELS = {
  Solid: 'Solid',
  Liquid_Droplet: 'Liquid droplet',
  Gaseous: 'Gaseous',
  'Multi-phase': 'Multi-phase',
}
export const GRAVITY_REGIME_LABELS = {
  '0g_microgravity': '0g microgravity',
  partial_g_proxy: 'Partial-g proxy',
  '1g_ground_reference': '1g ground reference',
}
export const RACK_LABELS = {
  'CIR-ACME': 'CIR · ACME (gaseous flames)',
  'CIR-MDCA': 'CIR · MDCA (liquid droplets)',
  'MSG-SPICE': 'MSG · SPICE (forced-flow duct)',
  Saffire: 'Saffire (large-scale, Cygnus)',
  'Ground-CFD': 'Ground / CFD reference',
  Other: 'Other',
}

// ── Domain constants (CLAUDE.md §3) ───────────────────────────────────────────
export const LUNAR_TARGET = { o2MinPct: 30, pressureMaxPsi: 10.2 }
export const EARTH_ATM = { o2: 21, pressure: 14.7 }
export const EVA_SUIT = { o2: 100, pressure: 4.3 }
export const PSI_O2_TEST_LIMIT = 85

// ── Normalization ─────────────────────────────────────────────────────────────
function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toStrArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function toStrOrNull(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Coerce one raw record into the PSIInvestigation shape. Returns null if unusable. */
export function normalizeInvestigation(raw) {
  if (!raw || typeof raw !== 'object' || !raw.psi_id) return null
  const env = raw.envelope || {}
  return {
    psi_id: String(raw.psi_id).trim(),
    title: toStrOrNull(raw.title) || String(raw.psi_id),
    psi_url: toStrOrNull(raw.psi_url),
    doi_citation: toStrOrNull(raw.doi_citation),
    objectives: toStrOrNull(raw.objectives),
    approach: toStrOrNull(raw.approach),
    project_type: pickEnum(raw.project_type, PROJECT_TYPES, 'Microgravity Investigation'),
    safety_pillars: toStrArray(raw.safety_pillars).filter((p) => SAFETY_PILLARS.includes(p)),
    hardware_rack: pickEnum(raw.hardware_rack, HARDWARE_RACKS, 'Other'),
    fuel_phase: pickEnum(raw.fuel_phase, FUEL_PHASES, 'Multi-phase'),
    fuels_tested: toStrArray(raw.fuels_tested),
    envelope: {
      o2_min_pct: toNum(env.o2_min_pct),
      o2_max_pct: toNum(env.o2_max_pct),
      pressure_min_psi: toNum(env.pressure_min_psi),
      pressure_max_psi: toNum(env.pressure_max_psi),
      airflow_min_cms: toNum(env.airflow_min_cms),
      airflow_max_cms: toNum(env.airflow_max_cms),
      gravity_regime: pickEnum(env.gravity_regime, GRAVITY_REGIMES, '0g_microgravity'),
    },
    lunar_habitat_relevant: Boolean(raw.lunar_habitat_relevant),
    sensors_used: toStrArray(raw.sensors_used),
    variables_compared: toStrOrNull(raw.variables_compared),
    key_findings_summary: toStrOrNull(raw.key_findings_summary),
    earth_spinoff_applications: toStrArray(raw.earth_spinoff_applications),
    related_psi_ids: toStrArray(raw.related_psi_ids),
    video_filename: toStrOrNull(raw.video_filename),
  }
}

function parseJsonText(text) {
  return JSON.parse(String(text).replace(/^﻿/, ''))
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.investigations)) return payload.investigations
  if (payload && Array.isArray(payload.items)) return payload.items
  return null
}

function normalizeList(payload) {
  const list = extractList(payload)
  if (!list) return []
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const inv = normalizeInvestigation(raw)
    if (inv && !seen.has(inv.psi_id)) {
      seen.add(inv.psi_id)
      out.push(inv)
    }
  }
  return out
}

async function loadContractFile(name) {
  const key = Object.keys(contractFiles).find((k) => k.endsWith(`/${name}`))
  if (!key) return []
  try {
    return normalizeList(parseJsonText(await contractFiles[key]()))
  } catch (err) {
    console.warn(`[IGNIS-SI] Could not parse ${name}:`, err)
    return []
  }
}

async function loadFromBackend() {
  for (const path of API_PATHS) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal })
      if (!res.ok) continue
      const list = normalizeList(await res.json())
      if (list.length) return list
    } catch {
      // Backend not running — silently fall through to the static contracts.
    } finally {
      clearTimeout(timer)
    }
  }
  return []
}

/**
 * Load the catalog. Resolves to `{ investigations, source }` where `source`
 * is one of 'backend' | 'catalogo_limpio' | 'mock'.
 */
export async function loadInvestigations() {
  // Online demo (GitHub Pages): no local backend, so the bundled catalog is read directly.
  // Calling localhost from a public site would make Chrome ask visitors for local-network access.
  if (!import.meta.env.PROD) {
    const backend = await loadFromBackend()
    if (backend.length) return { investigations: backend, source: 'backend' }
  }

  const clean = await loadContractFile('catalogo_limpio.json')
  if (clean.length) return { investigations: clean, source: 'catalogo_limpio' }

  const mock = await loadContractFile('mock_catalogo.json')
  return { investigations: mock, source: 'mock' }
}

export const SOURCE_LABELS = {
  backend: { label: 'Live API', detail: `FastAPI backend · ${API_BASE}`, tone: 'emerald' },
  catalogo_limpio: { label: 'Clean catalog', detail: 'contracts/data/catalogo_limpio.json', tone: 'cyan' },
  mock: { label: 'Mock catalog', detail: 'contracts/data/mock_catalogo.json (fallback)', tone: 'amber' },
}

// ── CV telemetry (Person 3) — optional ───────────────────────────────────────
const telemetryFiles = import.meta.glob('../../contracts/data/cv_telemetry/*.json', {
  query: '?raw',
  import: 'default',
})

/** Find and parse a CV telemetry curve for an investigation, or null. */
export async function loadTelemetry(inv) {
  const keys = Object.keys(telemetryFiles)
  if (!keys.length) return null
  const id = inv.psi_id.toLowerCase().replace(/[^a-z0-9]/g, '')
  const stem = inv.video_filename ? inv.video_filename.replace(/\.[^.]+$/, '').toLowerCase() : null
  const key = keys.find((k) => {
    const file = k.split('/').pop().toLowerCase()
    return (stem && file.startsWith(stem)) || file.replace(/[^a-z0-9]/g, '').includes(id)
  })
  if (!key) return null
  try {
    const payload = parseJsonText(await telemetryFiles[key]())
    const points = Array.isArray(payload) ? payload : payload.points || payload.telemetry
    return Array.isArray(points) && points.length ? { file: key.split('/').pop(), points } : null
  } catch {
    return null
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────
export function formatRange(min, max, unit) {
  if (min == null && max == null) return 'n/a'
  if (min == null || max == null || min === max) return `${min ?? max} ${unit}`
  return `${min}–${max} ${unit}`
}

export function envelopeSummary(env) {
  return {
    o2: formatRange(env.o2_min_pct, env.o2_max_pct, '% O₂'),
    pressure: formatRange(env.pressure_min_psi, env.pressure_max_psi, 'psi'),
    airflow: formatRange(env.airflow_min_cms, env.airflow_max_cms, 'cm/s'),
    gravity: GRAVITY_REGIME_LABELS[env.gravity_regime],
  }
}

export function citationFor(inv) {
  return inv.doi_citation || `${inv.psi_id}: ${inv.title}. NASA Physical Sciences Informatics (PSI).${inv.psi_url ? ` ${inv.psi_url}` : ''}`
}

export function isLunarZone({ o2, pressure }) {
  return o2 >= LUNAR_TARGET.o2MinPct || pressure <= LUNAR_TARGET.pressureMaxPsi
}

export function gravityRegimeFor(g) {
  if (g <= 0.001) return '0g_microgravity'
  if (g >= 0.999) return '1g_ground_reference'
  return 'partial_g_proxy'
}

/** Short DOI link for compact citations (falls back to the PSI page). */
export function shortDoi(inv) {
  const m = inv.doi_citation?.match(/https?:\/\/(?:dx\.)?doi\.org\/(\S+?)\.?$/)
  if (m) return { href: `https://doi.org/${m[1]}`, text: `doi:${m[1]}` }
  if (inv.psi_url) return { href: inv.psi_url, text: inv.psi_id }
  return null
}
