// ── IGNIS-SI · Data export ──────────────────────────────────────────────────
// Turns the loaded PSI catalog into flat rows for CSV / JSON downloads, so the
// tested conditions can feed flammability and fire-scenario models.
// Nothing is computed or estimated here: every value comes straight from the
// catalog (null stays null), plus a unit conversion and the simulator's score.

import { citationFor } from '../../shared/catalog'

const PSI_TO_KPA = 6.894757
const kpa = (psi) => (psi == null ? null : Math.round(psi * PSI_TO_KPA * 100) / 100)

/** Column groups the user can switch on or off. `id` is always exported. */
export const COLUMN_GROUPS = [
  {
    id: 'id',
    label: 'Identification',
    hint: 'PSI ID, title, citation and link',
    locked: true,
    cols: [
      ['psi_id', (i) => i.psi_id],
      ['title', (i) => i.title],
      ['doi_citation', (i) => citationFor(i)],
      ['psi_url', (i) => i.psi_url],
    ],
  },
  {
    id: 'conditions',
    label: 'Test conditions',
    hint: 'Oxygen, pressure, airflow and gravity tested',
    cols: [
      ['o2_min_pct', (i) => i.envelope.o2_min_pct],
      ['o2_max_pct', (i) => i.envelope.o2_max_pct],
      ['pressure_min_psi', (i) => i.envelope.pressure_min_psi],
      ['pressure_max_psi', (i) => i.envelope.pressure_max_psi],
      ['pressure_min_kpa', (i) => kpa(i.envelope.pressure_min_psi)],
      ['pressure_max_kpa', (i) => kpa(i.envelope.pressure_max_psi)],
      ['airflow_min_cm_s', (i) => i.envelope.airflow_min_cms],
      ['airflow_max_cm_s', (i) => i.envelope.airflow_max_cms],
      ['gravity_regime', (i) => i.envelope.gravity_regime],
    ],
  },
  {
    id: 'experiment',
    label: 'Experiment',
    hint: 'Hardware, fuel and sensors',
    cols: [
      ['project_type', (i) => i.project_type],
      ['hardware_rack', (i) => i.hardware_rack],
      ['fuel_phase', (i) => i.fuel_phase],
      ['fuels_tested', (i) => i.fuels_tested],
      ['sensors_used', (i) => i.sensors_used],
    ],
  },
  {
    id: 'safety',
    label: 'Fire-safety tags',
    hint: 'Prevention, detection, suppression',
    cols: [
      ['safety_pillars', (i) => i.safety_pillars],
      ['lunar_habitat_relevant', (i) => i.lunar_habitat_relevant],
    ],
  },
  {
    id: 'text',
    label: 'Descriptions',
    hint: 'Variables compared and summary text',
    cols: [
      ['variables_compared', (i) => i.variables_compared],
      ['summary', (i) => i.key_findings_summary],
    ],
  },
]

/** Extra columns when the export is matched against the simulator conditions. */
export const MATCH_COLS = [
  ['match_score', (r) => r.score],
  ['match_status', (r) => r.status],
]

export const UNITS = {
  o2_min_pct: '% O2 by volume',
  o2_max_pct: '% O2 by volume',
  pressure_min_psi: 'psi',
  pressure_max_psi: 'psi',
  pressure_min_kpa: 'kPa (converted from psi)',
  pressure_max_kpa: 'kPa (converted from psi)',
  airflow_min_cm_s: 'cm/s',
  airflow_max_cm_s: 'cm/s',
  match_score: '0–100, IGNIS-SI explainable score (O2 35%, pressure 25%, gravity 25%, airflow 15%)',
}

export const CAVEAT =
  'Tested conditions come from the IGNIS-SI catalog built from PSI metadata. Check each value against its PSI page before using it in a model. Null means not reported.'

/** rows: [{ inv, score?, status? }] → [{ column: value }] */
export function buildRecords(rows, groups, withMatch) {
  const cols = COLUMN_GROUPS.filter((g) => g.locked || groups.includes(g.id)).flatMap((g) => g.cols)
  return rows.map((r) => {
    const rec = {}
    for (const [name, get] of cols) rec[name] = get(r.inv) ?? null
    if (withMatch) for (const [name, get] of MATCH_COLS) rec[name] = get(r) ?? null
    return rec
  })
}

const csvCell = (v) => {
  if (v == null) return ''
  const s = Array.isArray(v) ? v.join('; ') : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(records) {
  if (!records.length) return ''
  const head = Object.keys(records[0])
  return [head.join(','), ...records.map((r) => head.map((k) => csvCell(r[k])).join(','))].join('\r\n')
}

export function toJson(records, meta) {
  const units = Object.fromEntries(Object.keys(records[0] ?? {}).filter((k) => UNITS[k]).map((k) => [k, UNITS[k]]))
  return JSON.stringify({ ...meta, units, caveat: CAVEAT, count: records.length, investigations: records }, null, 2)
}

export function download(text, filename, type) {
  // UTF-8 BOM so Excel opens accents and symbols correctly.
  const blob = new Blob([type === 'text/csv' ? '﻿' + text : text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
