import { useMemo, useState } from 'react'
import { ArrowDown, ChevronDown, ExternalLink, ScanEye } from 'lucide-react'
import Viewport3D from './Viewport3D'
import { Citation, CiteInline, Modal, More, Popover, PsiId, SectionHead, Segmented } from '../../shared/ui'
import { MODEL_CREDITS } from '../../shared/credits'
import { GRAVITY_REGIME_LABELS, LUNAR_TARGET, RACK_LABELS, SAFETY_PILLARS, isLunarZone } from '../../shared/catalog'
import {
  GRAVITY_LEVELS,
  HABITAT_SITES,
  MISSION_PRESETS,
  SCENE_DEFAULTS,
  SCORE_WEIGHTS,
  SLIDER_LIMITS,
  SOURCES,
  STATUS_META,
  VIEW_MODES,
  advisory,
  flameRegime,
  hazardLevel,
  minTestedPressure,
  presetById,
  rankInvestigations,
} from './simulation'

const STATUS_TEXT = { covers: 'text-ink', bounds: 'text-sky', partial: 'text-ember', outside: 'text-faint' }
const STATUS_LEGEND = {
  covers: 'Tested under your exact conditions.',
  bounds: 'Matches your atmosphere; tested at 0g or 1g, so it brackets your Moon/Mars gravity.',
  partial: 'Some conditions fall outside what was tested. Score 50 or more.',
  outside: 'Most conditions fall well outside what was tested. Score below 50.',
}
const MODE_OPTIONS = [
  { value: 'chamber', label: 'Flame', title: VIEW_MODES.chamber.label },
  { value: 'cabin', label: 'Cabin', title: VIEW_MODES.cabin.label },
  { value: 'habitat', label: 'Habitat', title: VIEW_MODES.habitat.label },
]
const HAZARD_DOT = { nominal: 'bg-sky', watch: 'bg-sky', elevated: 'bg-ember', critical: 'bg-nasa-red' }

// Ranking rows visible before "Show all".
const TOP_N = 3
const pct = (v, { min, max }) => ((v - min) / (max - min)) * 100
const shortTitle = (t) => t.replace(/\s*\(.*?\)\s*/g, ' ').trim()

/* ── Stage overlays ──────────────────────────────────────────────────────── */

function Control({ label, value, unit, children, pct }) {
  return (
    <label className="block min-w-0" style={{ '--p': `${pct}%` }}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="num text-[15px] text-ink">
          {value}
          <span className="ml-1 text-[12px] text-faint">{unit}</span>
        </span>
      </span>
      {children}
    </label>
  )
}

function OrbitLines() {
  // Decorative trajectory lines, in the spirit of the poster references.
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#f2efe9" strokeOpacity="0.07">
        <ellipse cx="720" cy="430" rx="640" ry="190" transform="rotate(-12 720 430)" />
        <ellipse cx="720" cy="430" rx="420" ry="420" />
      </g>
      <circle cx="1270" cy="300" r="3" fill="#f2efe9" fillOpacity="0.5" />
      <circle cx="300" cy="610" r="2" fill="#f2efe9" fillOpacity="0.35" />
    </svg>
  )
}

function EnvironmentInfo({ open, onClose, onUse }) {
  return (
    <Modal open={open} onClose={onClose} title="Where the environments come from">
      <p className="measure mb-8 text-[15px] text-muted">
        Each scene starts from one of these environments. Oxygen, pressure and gravity come from published sources; airflow values are
        illustrative defaults, not measurements. You can load any of them into the sliders.
      </p>
      <ol className="border-t border-line">
        {MISSION_PRESETS.map((p) => (
          <li key={p.id} className="border-b border-line py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[19px] font-medium">{p.name}</h3>
              <span className="num text-[13px] text-muted">
                {p.params.o2}% O₂ · {p.params.pressure} psi · {p.params.gravity}g
              </span>
            </div>
            <p className="mt-2 text-[15px] text-ink">{p.why}</p>
            {p.notes && <p className="mt-2 text-[14px] text-faint">{p.notes}</p>}
            <button
              type="button"
              onClick={() => {
                onUse(p)
                onClose()
              }}
              className="link mt-3 text-[14px]"
            >
              Use these values
            </button>
            <ul className="mt-3 space-y-1">
              {p.sources.map((k) => (
                <li key={k}>
                  <a href={SOURCES[k].url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-[13px] text-muted">
                    {SOURCES[k].label} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] text-faint">
        Gravity: Moon 1.62 m/s² ≈ 0.16g, Mars 3.71 m/s² ≈ 0.38g (NASA NSSDC fact sheets). The lunar-zone threshold (O₂ ≥ 30% or ≤ 10.2 psi)
        follows the project’s domain constants.
      </p>
    </Modal>
  )
}

/** Compact environment controls. Right of the scene on desktop, below it on mobile. */
function EnvironmentPanel({ params, setParams, presetId, useValues, className = '' }) {
  const [info, setInfo] = useState(false)
  const set = (key) => (e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))
  const current = presetId ? presetById(presetId)?.name : null
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium leading-snug tracking-normal">Configure your own environment</h2>
          <span className="label mt-1 block">{current ?? 'Custom'}</span>
        </div>
        <button
          type="button"
          onClick={() => setInfo(true)}
          aria-label="Where the environment values come from"
          title="Where the environment values come from"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-[13px] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          ?
        </button>
      </div>
      <div className="grid gap-3">
        <Control label="Oxygen" value={params.o2} unit="%" pct={pct(params.o2, SLIDER_LIMITS.o2)}>
          <input type="range" {...SLIDER_LIMITS.o2} value={params.o2} onChange={set('o2')} aria-label="Oxygen concentration" />
        </Control>
        <Control label="Pressure" value={params.pressure.toFixed(1)} unit="psi" pct={pct(params.pressure, SLIDER_LIMITS.pressure)}>
          <input type="range" {...SLIDER_LIMITS.pressure} value={params.pressure} onChange={set('pressure')} aria-label="Cabin pressure" />
        </Control>
        <Control label="Airflow" value={params.airflow} unit="cm/s" pct={pct(params.airflow, SLIDER_LIMITS.airflow)}>
          <input type="range" {...SLIDER_LIMITS.airflow} value={params.airflow} onChange={set('airflow')} aria-label="Forced airflow" />
        </Control>
        <div>
          <span className="mb-1.5 block text-[13px] text-muted">Gravity</span>
          <Segmented
            label="Gravity level"
            size="sm"
            value={params.gravity}
            onChange={(g) => setParams((p) => ({ ...p, gravity: g }))}
            options={GRAVITY_LEVELS.map((g) => ({ value: g.value, label: g.short, title: g.name }))}
          />
        </div>
      </div>
      <EnvironmentInfo open={info} onClose={() => setInfo(false)} onUse={useValues} />
    </div>
  )
}

function Stage({ params, setParams, mode, selectScene, site, selectSite, presetId, useValues, xray, setXray }) {
  const regime = flameRegime(params)
  const hz = hazardLevel(params)
  const lunar = isLunarZone(params)
  // Live readouts: under the title on desktop, at the bottom of the scene on mobile.
  const hud = (
    <>
          {mode === 'chamber' ? (
        <div>
          <dt className="label">Flame regime</dt>
          <dd className="mt-1 text-ink">{regime.name}</dd>
          <dd className="num text-[12px] text-faint">{regime.ref}</dd>
        </div>
      ) : (
        <div>
          <dt className="label">Cabin hazard</dt>
          <dd className="mt-1 flex items-center gap-2 text-ink">
            <span className={`h-2 w-2 rounded-full ${HAZARD_DOT[hz.level]} ${hz.level === 'critical' ? 'pulse-dot' : ''}`} aria-hidden="true" />
            {hz.label}
          </dd>
        </div>
      )}
      {lunar && (
        <div>
          <dt className="label">Exploration atmosphere</dt>
          <dd className="mt-1 text-ember">
            O₂ ≥ {LUNAR_TARGET.o2MinPct}% or ≤ {LUNAR_TARGET.pressureMaxPsi} psi
          </dd>
        </div>
      )}
    </>
  )

  return (
    <section aria-label="Digital twin" className="relative overflow-hidden lg:h-[calc(100svh-64px)] lg:min-h-[680px]">
      <div className="relative h-[640px] lg:absolute lg:inset-0 lg:h-auto">
      <OrbitLines />
      <Viewport3D params={params} mode={mode} xray={xray} />
      {mode === 'habitat' && (
        // Keeps the overlay text legible over bright surface terrain.
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[640px] max-w-full bg-gradient-to-r from-ground/85 via-ground/50 to-transparent" aria-hidden="true" />
      )}

      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1440px] flex-col px-4 pt-8 md:px-8 md:pt-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="pointer-events-auto rise">
            {/* Fixed height: the badge on the right only appears in some scenes, so the title never shifts. */}
            <div className="label mb-4 flex h-6 items-center gap-3">
              <span>Digital twin · {VIEW_MODES[mode].label}</span>
              {mode === 'habitat' && <ModelCredit credit={MODEL_CREDITS.habitat} />}
              {mode === 'chamber' && <SIDisclosure />}
            </div>
            <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-[0.95]">
              Flame in
              <br />
              freefall
            </h1>
            <p className="mt-5 hidden max-w-[34ch] text-muted sm:block">Set a habitat atmosphere. Watch the flame respond, and see which experiments back it up.</p>
            <dl className="mt-28 hidden w-fit gap-5 text-[14px] lg:grid">{hud}</dl>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            {mode !== 'chamber' && (
              <button
                type="button"
                onClick={() => setXray((v) => !v)}
                aria-pressed={xray}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                  xray ? 'border-line-strong text-ink' : 'border-line text-faint hover:text-ink'
                }`}
                title="Translucent hull to reveal interior indicators"
              >
                <ScanEye size={14} aria-hidden="true" /> X-ray
              </button>
            )}
            <div className="flex flex-col items-end gap-2">
              <Segmented label="Scene" value={mode} onChange={selectScene} options={MODE_OPTIONS} />
              {mode === 'habitat' && (
                <div className="rise">
                  <Segmented label="Surface" size="sm" value={site} onChange={selectSite} options={HABITAT_SITES} />
                </div>
              )}
            </div>
          </div>
          <EnvironmentPanel
            params={params}
            setParams={setParams}
            presetId={presetId}
            useValues={useValues}
            className="hidden w-[300px] lg:block"
          />
          </div>
        </div>

        {/* HUD on mobile: bottom of the scene, away from the flame */}
        <dl className="pointer-events-auto mb-6 mt-auto grid w-fit gap-4 text-[14px] lg:hidden">{hud}</dl>

        {/* Jump to the evidence below — kept to a single quiet control */}
        <a
          href="#ranking-title"
          className="pointer-events-auto absolute bottom-4 right-4 hidden h-10 items-center gap-2 rounded-full border border-line-strong bg-ground px-4 text-[14px] text-ink transition-colors hover:border-ink md:right-8 lg:bottom-8 lg:inline-flex"
        >
          See relevant experiments <ArrowDown size={14} aria-hidden="true" />
        </a>

        <span className="label pointer-events-none absolute bottom-4 left-8 hidden md:block lg:bottom-8">Illustrative, not CFD · click scene to zoom</span>
      </div>
      </div>

      {/* Mobile: controls sit below the scene */}
      <div className="px-4 py-6 lg:hidden">
        <EnvironmentPanel params={params} setParams={setParams} presetId={presetId} useValues={useValues} />
        <a
          href="#ranking-title"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[15px] text-ink transition-colors hover:border-ink"
        >
          See relevant experiments <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

/* ── Ranking ─────────────────────────────────────────────────────────────── */

function ScoreBar({ value }) {
  return (
    <span className="block h-px w-full bg-line-strong">
      <span className="block h-px bg-ink transition-[width] duration-500" style={{ width: `${value}%` }} />
    </span>
  )
}

function RankRow({ row, rank, onOpen }) {
  const [open, setOpen] = useState(false)
  const { inv, score, status, axes, reasons } = row
  return (
    <li className="border-b border-line">
      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-x-4 gap-y-1 py-5 md:grid-cols-[36px_88px_1fr_96px_120px_44px]">
        <span className="num text-[13px] text-faint">{String(rank).padStart(2, '0')}</span>
        <PsiId id={inv.psi_id} className="hidden md:block" />
        <span className="min-w-0">
          <button type="button" onClick={() => onOpen(inv)} className="text-left text-[16px] text-ink hover:underline hover:decoration-nasa-red hover:underline-offset-4">
            <span className="num mr-2 text-[13px] md:hidden">{inv.psi_id}</span>
            {shortTitle(inv.title)}
          </button>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-faint">
            <span>{RACK_LABELS[inv.hardware_rack].split(' (')[0]}</span>
            <span>{GRAVITY_REGIME_LABELS[inv.envelope.gravity_regime]}</span>
            <CiteInline inv={inv} />
          </span>
        </span>
        <span className={`hidden text-[14px] md:block ${STATUS_TEXT[status]}`} title={STATUS_META[status].hint}>
          {STATUS_META[status].label}
        </span>
        <span className="flex items-center gap-3">
          <span className="num w-10 text-right text-[22px] text-ink">{score}</span>
          <span className="hidden w-16 md:block">
            <ScoreBar value={score} />
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Why ${inv.psi_id} scores ${score}`}
          className="col-start-3 row-start-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-faint hover:bg-raised hover:text-ink md:col-start-6"
        >
          <ChevronDown size={16} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="rise grid gap-8 pb-8 md:grid-cols-[1fr_1fr] md:pl-[136px]">
          <div>
            <div className="label mb-3">Why this score</div>
            <ul className="space-y-3">
              {Object.entries(SCORE_WEIGHTS).map(([k, w], i) => (
                <li key={k} className="grid grid-cols-[80px_1fr_56px] items-center gap-3 text-[14px]">
                  <span className="text-muted">{k === 'o2' ? 'Oxygen' : k[0].toUpperCase() + k.slice(1)}</span>
                  <ScoreBar value={axes[k].score * 100} />
                  <span className="num text-right text-[13px] text-faint">× {w}</span>
                  <span className="col-span-3 -mt-2 text-[13px] text-faint">{reasons[i]}</span>
                </li>
              ))}
            </ul>
          </div>
          <Citation inv={inv} />
        </div>
      )}
    </li>
  )
}

/** Popover explaining the row status labels. */
function StatusKey() {
  return (
    <Popover
      label="Status key"
      triggerClassName="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3 text-[13px] text-muted transition-colors hover:border-ink hover:text-ink"
      trigger={
        <>
          Status key
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]" aria-hidden="true">
            ?
          </span>
        </>
      }
    >
      <dl className="space-y-3 text-[14px]">
        {Object.entries(STATUS_LEGEND).map(([k, text]) => (
          <div key={k}>
            <dt className={`font-medium ${STATUS_TEXT[k]}`}>{STATUS_META[k].label}</dt>
            <dd className="text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  )
}

/** CC BY attribution for the habitat model (required by its license). */
function ModelCredit({ credit }) {
  return (
    <Popover
      label="3D model credit"
      align="left"
      triggerClassName="pointer-events-auto inline-flex h-6 items-center rounded-full border border-line-strong px-2 text-[11px] text-muted transition-colors hover:border-ink hover:text-ink"
      trigger={credit.license.replace(' 4.0', '')}
    >
      <p className="text-[14px] leading-relaxed text-ink">
        <a href={credit.url} target="_blank" rel="noreferrer" className="link">
          {credit.title}
        </a>{' '}
        by{' '}
        <a href={credit.authorUrl} target="_blank" rel="noreferrer" className="link">
          {credit.author}
        </a>{' '}
        on Sketchfab, licensed{' '}
        <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="link">
          {credit.license}
        </a>
        .
      </p>
      {credit.modified && <p className="mt-2 text-[13px] text-muted">Modified: {credit.modified}</p>}
    </Popover>
  )
}

/** SI-use disclosure for the procedural flame (Space Apps rule: label everything made with SI). */
function SIDisclosure() {
  return (
    <Popover
      label="SI-generated visual"
      align="left"
      triggerClassName="pointer-events-auto inline-flex h-6 items-center rounded-full border border-line-strong px-2 text-[11px] text-muted transition-colors hover:border-ink hover:text-ink"
      trigger="BY SI"
    >
      <p className="label mb-2">SI-assisted visual</p>
      <p className="text-[14px] leading-relaxed text-ink">
        This flame model was generated with SI (AI) assistance. Its shape, colour, soot particles and regime labels were coded by an AI assistant
        from the flame behaviours described in PSI investigations (ACME, SPICE, BASS).
      </p>
      <p className="mt-2 text-[13px] text-muted">Illustrative only — not a CFD simulation and not experimental footage.</p>
    </Popover>
  )
}

function Ranking({ ranked, params, onOpen }) {
  const [pillar, setPillar] = useState('All')
  const [all, setAll] = useState(false)
  const rows = pillar === 'All' ? ranked : ranked.filter((r) => r.inv.safety_pillars.includes(pillar))
  const shown = all ? rows : rows.slice(0, TOP_N)
  const minPressure = useMemo(() => minTestedPressure(ranked.map((r) => r.inv)), [ranked])
  const notes = advisory(params, { minPressure })

  return (
    <section id="ranking" className="mx-auto max-w-[1440px] px-4 py-24 md:px-8 md:py-32">
      {/* Anchor for "See relevant experiments": lands the title just below the fixed header. */}
      <div id="ranking-title" className="scroll-mt-[88px]" />
      <SectionHead
        title="What the experiments say"
        right={
          <div className="flex flex-wrap items-center gap-3">
            <StatusKey />
            <Segmented label="Safety pillar" size="sm" value={pillar} onChange={setPillar} options={['All', ...SAFETY_PILLARS].map((p) => ({ value: p, label: p }))} />
          </div>
        }
      >
        {ranked.length} PSI investigations, ranked by how closely they tested your conditions.
      </SectionHead>


      <div className="grid gap-16 lg:grid-cols-[1fr_300px]">
        <div>
          <ol className="border-t border-line">
            {shown.map((r, i) => (
              <RankRow key={r.inv.psi_id} row={r} rank={i + 1} onOpen={onOpen} />
            ))}
          </ol>
          {!rows.length && <p className="py-10 text-muted">No investigations in this pillar.</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {rows.length > TOP_N ? (
              <button type="button" onClick={() => setAll((v) => !v)} className="link text-[15px]">
                {all ? `Show top ${TOP_N}` : `Show all ${rows.length}`}
              </button>
            ) : (
              <span />
            )}
            <More summary="How the score works">
              <p className="measure text-[14px] text-muted">
                Each investigation’s tested envelope is compared with your conditions. Oxygen weighs {SCORE_WEIGHTS.o2 * 100}%, pressure{' '}
                {SCORE_WEIGHTS.pressure * 100}%, gravity {SCORE_WEIGHTS.gravity * 100}% and airflow {SCORE_WEIGHTS.airflow * 100}%. Inside the range
                scores full marks; outside decays with distance. 0g and 1g data <em>bound</em> partial gravity rather than cover it.
              </p>
            </More>
          </div>
        </div>

        <aside aria-label="Watch-outs">
          <div className="label mb-4">Watch-outs</div>
          <ul className="space-y-5 border-l border-line pl-5">
            {notes.slice(0, 2).map((n) => (
              <li key={n} className="text-[15px] text-muted">
                {n}
              </li>
            ))}
          </ul>
          {notes.length > 2 && (
            <More summary={`${notes.length - 2} more`} className="mt-4 pl-5">
              <ul className="space-y-4">
                {notes.slice(2).map((n) => (
                  <li key={n} className="text-[15px] text-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </More>
          )}
          <p className="label mt-6 pl-5 normal-case tracking-normal">Rule-based, no generative model.</p>
        </aside>
      </div>
    </section>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SimulatorPage({ investigations, params, setParams, mode, setMode, onOpenDetail }) {
  const [presetId, setPresetId] = useState(SCENE_DEFAULTS[mode] ?? null)
  const [site, setSite] = useState(SCENE_DEFAULTS.habitat)
  const [xray, setXray] = useState(false)
  const ranked = useMemo(() => rankInvestigations(investigations, params), [investigations, params])

  const load = (id) => {
    setPresetId(id)
    setParams(presetById(id).params)
  }
  // Picking a scene loads its starting conditions; Habitat starts on the chosen surface.
  const selectScene = (m) => {
    setMode(m)
    setXray(false)
    load(m === 'habitat' ? site : SCENE_DEFAULTS[m])
  }
  const selectSite = (id) => {
    setSite(id)
    setXray(false)
    load(id)
  }
  // From the info dialog: load values into the sliders without changing the scene.
  const useValues = (p) => load(p.id)
  const setManual = (fn) => {
    setPresetId(null)
    setParams(fn)
  }

  return (
    <>
      <Stage
        params={params}
        setParams={setManual}
        mode={mode}
        selectScene={selectScene}
        site={site}
        selectSite={selectSite}
        presetId={presetId}
        useValues={useValues}
        xray={xray}
        setXray={setXray}
      />
      <Ranking ranked={ranked} params={params} onOpen={onOpenDetail} />
    </>
  )
}
