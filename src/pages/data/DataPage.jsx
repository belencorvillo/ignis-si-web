import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, CopyButton, PsiId } from '../../shared/ui'
import {
  FUEL_PHASES,
  FUEL_PHASE_LABELS,
  GRAVITY_REGIMES,
  GRAVITY_REGIME_LABELS,
  HARDWARE_RACKS,
  LUNAR_TARGET,
  SAFETY_PILLARS,
  SOURCE_LABELS,
} from '../../shared/catalog'
import { STATUS_META, rankInvestigations } from '../simulator/simulation'
import { CAVEAT, COLUMN_GROUPS, buildRecords, download, toCsv, toJson } from './exportData'

const RACK_SHORT = { 'CIR-ACME': 'ACME', 'CIR-MDCA': 'MDCA', 'MSG-SPICE': 'SPICE duct', Saffire: 'Saffire', 'Ground-CFD': 'Ground / CFD', Other: 'Other' }

/** Multi-select chips: none selected = no filter. */
function Chips({ label, options, value, onChange, format = (o) => o }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={`h-8 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-ink bg-ink text-ground' : 'border-line text-muted hover:border-line-strong hover:text-ink'}`}
            >
              {format(o)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Check({ checked, onChange, children, hint, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? 'cursor-default opacity-60' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#fc3d21]" />
      <span>
        <span className="block text-[14px] leading-snug text-ink">{children}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-faint">{hint}</span>}
      </span>
    </label>
  )
}

const fmt = (v) => (v == null ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v))

export default function DataPage({ investigations, params, source }) {
  const [pillars, setPillars] = useState([])
  const [phases, setPhases] = useState([])
  const [racks, setRacks] = useState([])
  const [regimes, setRegimes] = useState([])
  const [exploration, setExploration] = useState(false)
  const [match, setMatch] = useState(false)
  const [groups, setGroups] = useState(['conditions', 'experiment', 'safety'])

  const rows = useMemo(() => {
    let list = match ? rankInvestigations(investigations, params).filter((r) => r.status !== 'outside') : investigations.map((inv) => ({ inv }))
    list = list.filter(({ inv }) => {
      const e = inv.envelope
      if (pillars.length && !inv.safety_pillars.some((p) => pillars.includes(p))) return false
      if (phases.length && !phases.includes(inv.fuel_phase)) return false
      if (racks.length && !racks.includes(inv.hardware_rack)) return false
      if (regimes.length && !regimes.includes(e.gravity_regime)) return false
      if (exploration && !((e.o2_max_pct ?? 0) >= LUNAR_TARGET.o2MinPct || (e.pressure_min_psi ?? Infinity) <= LUNAR_TARGET.pressureMaxPsi)) return false
      return true
    })
    return list
  }, [investigations, params, match, pillars, phases, racks, regimes, exploration])

  const records = useMemo(() => buildRecords(rows, groups, match), [rows, groups, match])
  const columns = Object.keys(records[0] ?? {})
  const reset = () => {
    setPillars([])
    setPhases([])
    setRacks([])
    setRegimes([])
    setExploration(false)
    setMatch(false)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const base = `ignis-si_psi_conditions_${stamp}`
  const meta = {
    dataset: 'IGNIS-SI · PSI combustion investigations, tested conditions',
    source: 'NASA Physical Sciences Informatics (PSI) — https://psi.nasa.gov',
    catalog: SOURCE_LABELS[source]?.detail ?? null,
    exported_at: new Date().toISOString(),
    filters: {
      safety_pillars: pillars,
      fuel_phases: phases,
      hardware: racks,
      gravity_regimes: regimes,
      exploration_atmosphere: exploration ? `O2 >= ${LUNAR_TARGET.o2MinPct}% or pressure <= ${LUNAR_TARGET.pressureMaxPsi} psi tested` : null,
      matched_to_simulator: match ? params : null,
    },
  }
  const python = `import pandas as pd

df = pd.read_csv("${base}.csv")
# Oxygen and pressure each investigation tested
print(df[["psi_id", "o2_min_pct", "o2_max_pct", "pressure_min_psi", "pressure_max_psi"]])`

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-16 md:px-8 md:pt-24">
      <div className="label mb-4">Data · For predictive models</div>
      <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-[0.95]">
        Take the
        <br />
        data with you
      </h1>
      <p className="measure mt-5 text-muted">
        Filter the PSI combustion investigations and download the conditions they tested — oxygen, pressure, airflow and gravity — as a CSV or JSON
        file, ready for a flammability or fire-scenario model.
      </p>

      <div className="mt-16 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Filters — same card as the other panels */}
        <aside className="h-fit space-y-6 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-24">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-medium leading-snug tracking-normal">Choose your data</h2>
              <span className="label mt-1 block" aria-live="polite">
                {rows.length} of {investigations.length} investigations
              </span>
            </div>
            <button type="button" onClick={reset} className="link text-[13px] text-muted">
              Reset
            </button>
          </div>

          <Check
            checked={match}
            onChange={setMatch}
            hint={`${params.o2}% O₂ · ${params.pressure.toFixed(1)} psi · ${params.airflow} cm/s · ${params.gravity}g — drops investigations scored “Outside” and adds the score`}
          >
            Match my Simulator conditions
          </Check>
          <Check checked={exploration} onChange={setExploration} hint={`Tested at ≥ ${LUNAR_TARGET.o2MinPct}% O₂ or ≤ ${LUNAR_TARGET.pressureMaxPsi} psi`}>
            Exploration atmosphere only
          </Check>

          <Chips label="Safety pillar" options={SAFETY_PILLARS} value={pillars} onChange={setPillars} />
          <Chips label="Fuel" options={FUEL_PHASES} value={phases} onChange={setPhases} format={(o) => FUEL_PHASE_LABELS[o]} />
          <Chips label="Hardware" options={HARDWARE_RACKS} value={racks} onChange={setRacks} format={(o) => RACK_SHORT[o]} />
          <Chips label="Gravity" options={GRAVITY_REGIMES} value={regimes} onChange={setRegimes} format={(o) => GRAVITY_REGIME_LABELS[o]} />

          <fieldset className="space-y-3 border-t border-line pt-5">
            <legend className="mb-3 text-[13px] text-muted">Columns</legend>
            {COLUMN_GROUPS.map((g) => (
              <Check
                key={g.id}
                checked={g.locked || groups.includes(g.id)}
                disabled={g.locked}
                onChange={(on) => setGroups((v) => (on ? [...v, g.id] : v.filter((x) => x !== g.id)))}
                hint={g.hint}
              >
                {g.label}
              </Check>
            ))}
          </fieldset>
        </aside>

        {/* Download + preview */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="light" disabled={!records.length} onClick={() => download(toCsv(records), `${base}.csv`, 'text/csv')}>
              <Download size={15} aria-hidden="true" /> Download CSV
            </Button>
            <Button disabled={!records.length} onClick={() => download(toJson(records, meta), `${base}.json`, 'application/json')}>
              <Download size={15} aria-hidden="true" /> Download JSON
            </Button>
            <span className="num text-[12px] text-faint">
              {records.length} rows · {columns.length} columns
            </span>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-max text-left text-[13px]">
              <thead className="bg-surface">
                <tr>
                  {columns.map((c) => (
                    <th key={c} scope="col" className="num whitespace-nowrap border-b border-line px-3 py-2.5 text-[11px] font-normal text-faint">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.psi_id} className="border-b border-line last:border-0 hover:bg-white/[0.03]">
                    {columns.map((c) => (
                      <td key={c} className={`max-w-[260px] truncate px-3 py-2.5 ${c === 'psi_id' ? '' : 'text-muted'}`} title={fmt(r[c])}>
                        {c === 'psi_id' ? <PsiId id={r[c]} /> : c === 'match_status' ? STATUS_META[r[c]]?.label : fmt(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!records.length && <p className="px-4 py-10 text-center text-muted">No investigation matches these filters.</p>}
          </div>

          <div className="mt-10 grid gap-8 xl:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="label">Load it in Python</span>
                <CopyButton text={python} label="Copy code" />
              </div>
              <pre className="num overflow-x-auto rounded-2xl border border-line bg-surface p-4 text-[12px] leading-relaxed text-muted">{python}</pre>
            </div>
            <div className="space-y-3 text-[14px] text-muted">
              <span className="label block">Before you model</span>
              <p>{CAVEAT}</p>
              <p>Every row keeps its PSI ID and DOI citation — cite the investigations you use. Units: % O₂ by volume, psi (and kPa), cm/s.</p>
              <p>
                There is no partial-gravity combustion data in PSI yet: 0g and 1g results bound the Moon and Mars, and E-FIELD flames are only a proxy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
