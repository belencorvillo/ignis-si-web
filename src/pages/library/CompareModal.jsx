import { useState } from 'react'
import { Citation, Modal, PsiId, SITag } from '../../shared/ui'
import { MediaPanel } from '../../shared/InvestigationDetail'
import { FUEL_PHASE_LABELS, RACK_LABELS, envelopeSummary, GRAVITY_REGIME_LABELS } from '../../shared/catalog'

const EMPTY = '—'
const list = (arr) => (arr.length ? [...arr].sort().join(', ') : EMPTY)

// Rows whose values are empty for every selected investigation are hidden
// (e.g. objectives/approach are optional and absent from catalogo_limpio.json).
const ROWS = [
  { key: 'objectives', label: 'Objectives', get: (i) => i.objectives || EMPTY, long: true },
  { key: 'approach', label: 'Approach', get: (i) => i.approach || EMPTY, long: true },
  { key: 'findings', label: 'Key findings', get: (i) => i.key_findings_summary || EMPTY, long: true, si: true },
  { key: 'project_type', label: 'Type', get: (i) => i.project_type.replace(' Investigation', '') },
  { key: 'hardware', label: 'Hardware', get: (i) => RACK_LABELS[i.hardware_rack].split(' (')[0] },
  { key: 'fuel', label: 'Fuel phase', get: (i) => FUEL_PHASE_LABELS[i.fuel_phase] },
  { key: 'fuels', label: 'Fuels tested', get: (i) => list(i.fuels_tested) },
  { key: 'pillars', label: 'Pillars', get: (i) => list(i.safety_pillars) },
  { key: 'o2', label: 'Oxygen', get: (i) => envelopeSummary(i.envelope).o2, num: true },
  { key: 'pressure', label: 'Pressure', get: (i) => envelopeSummary(i.envelope).pressure, num: true },
  { key: 'airflow', label: 'Airflow', get: (i) => envelopeSummary(i.envelope).airflow, num: true },
  { key: 'gravity', label: 'Gravity', get: (i) => GRAVITY_REGIME_LABELS[i.envelope.gravity_regime] },
  { key: 'sensors', label: 'Sensors', get: (i) => list(i.sensors_used) },
  { key: 'lunar', label: 'Lunar-relevant', get: (i) => (i.lunar_habitat_relevant ? 'Yes' : 'No') },
  { key: 'related', label: 'Related', get: (i) => list(i.related_psi_ids), num: true },
]

function Matrix({ rows, items, dim = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line align-top">
              <th scope="row" className="w-32 py-4 pr-4 text-left font-normal">
                <span className="label">{r.label}</span>
                {r.si && (
                  <span className="mt-1 block">
                    <SITag />
                  </span>
                )}
              </th>
              {items.map((i) => (
                <td key={i.psi_id} className={`py-4 pr-6 ${dim ? 'text-faint' : 'text-ink'} ${r.num ? 'num text-[13px]' : ''} ${r.long ? 'text-[14px] leading-relaxed text-muted' : ''}`}>
                  {r.get(i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function crossLinks(items) {
  const ids = new Set(items.map((i) => i.psi_id))
  const out = []
  for (const a of items)
    for (const id of a.related_psi_ids) {
      if (!ids.has(id)) continue
      const b = items.find((x) => x.psi_id === id)
      const ga = a.project_type === 'Ground Investigation'
      const gb = b.project_type === 'Ground Investigation'
      out.push({ from: a.psi_id, to: id, kind: ga !== gb ? 'ground ↔ flight' : ga ? 'ground ↔ ground' : 'flight ↔ flight' })
    }
  return out
}

export default function CompareModal({ open, onClose, items }) {
  const [showSame, setShowSame] = useState(false)
  if (!open) return null
  const changed = []
  const same = []
  for (const r of ROWS) {
    const values = new Set(items.map((i) => r.get(i)))
    if (values.size === 1 && values.has(EMPTY)) continue
    ;(values.size > 1 ? changed : same).push(r)
  }
  const links = crossLinks(items)

  return (
    <Modal open={open} onClose={onClose} title="Compare" wide>
      <div className="space-y-12">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="align-top">
                <th className="w-32" />
                {items.map((i) => (
                  <th key={i.psi_id} scope="col" className="pb-4 pr-6 text-left font-normal">
                    <PsiId id={i.psi_id} />
                    <span className="mt-1 block text-[16px] font-medium leading-snug text-ink">{i.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
          <h3 className="label mb-2 mt-4 !text-ink">What changed · {changed.length}</h3>
          <Matrix rows={changed} items={items} />
          {same.length > 0 && (
            <div className="mt-6">
              <button type="button" onClick={() => setShowSame((v) => !v)} aria-expanded={showSame} className="link text-[14px]">
                {showSame ? 'Hide' : 'Show'} what stayed the same ({same.length})
              </button>
              {showSame && (
                <div className="mt-4">
                  <Matrix rows={same} items={items} dim />
                </div>
              )}
            </div>
          )}
        </div>

        {links.length > 0 && (
          <section>
            <h3 className="label mb-3">Linked within this selection</h3>
            <ul className="flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={`${l.from}-${l.to}`} className="num rounded-full border border-line-strong px-3 py-1.5 text-[13px]">
                  {l.from} → {l.to} <span className="text-faint">{l.kind}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="label mb-4">Citations</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((i) => (
              <Citation key={i.psi_id} inv={i} />
            ))}
          </div>
        </section>

        <details>
          <summary className="link text-[14px]">Video & telemetry</summary>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {items.map((i) => (
              <div key={i.psi_id}>
                <PsiId id={i.psi_id} />
                <div className="mt-2">
                  <MediaPanel inv={i} />
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Modal>
  )
}
