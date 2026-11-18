import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Search, X, Sparkles } from 'lucide-react'
import { Button, CiteInline, PsiId, SITag, SectionHead } from '../../shared/ui'
import { FUEL_PHASES, FUEL_PHASE_LABELS, HARDWARE_RACKS, RACK_LABELS, SAFETY_PILLARS, envelopeSummary } from '../../shared/catalog'
import CompareModal from './CompareModal'
import { getYoloVideo } from '../../shared/yoloVideos'
import KnowledgeGraph3D from './KnowledgeGraph3D'
import NodeDetails from './NodeDetails'
import { GROUP_STYLE } from './graphStyle'

const MAX_COMPARE = 4

const THINKING_STEPS = [
  'Analyzing semantic intent of your query...',
  'Computing embeddings and vector similarity across PSI...',
  'Correlating experiments and raw files in the knowledge graph...',
]

/** Full-width select for the search panel. */
function PanelSelect({ label, value, onChange, options, render = (o) => o }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-full border border-line-strong bg-ground px-3 text-[13px] text-ink outline-none transition-colors hover:border-ink focus-visible:border-nasa-red"
      >
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? render(o)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Row({ inv, selected, canSelect, onToggle, onOpen }) {
  const env = envelopeSummary(inv.envelope)
  const media = getYoloVideo(inv.psi_id)
  const mediaLabel = media ? (media.isImage ? 'Photo' : 'Video') : inv.video_filename ? 'Video' : null

  return (
    <li className={`group grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-b border-line py-6 md:grid-cols-[96px_1fr_220px_48px] ${selected ? 'bg-raised/40' : ''}`}>
      <PsiId id={inv.psi_id} className="hidden pt-0.5 md:block" />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(inv)}
          className="text-left text-[17px] leading-snug text-ink hover:underline hover:decoration-nasa-red hover:underline-offset-4"
        >
          <span className="num mr-2 text-[13px] md:hidden">{inv.psi_id}</span>
          {inv.title}
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-faint">
          <span>{inv.safety_pillars.join(' · ')}</span>
          <span aria-hidden="true">/</span>
          <span>{FUEL_PHASE_LABELS[inv.fuel_phase]}</span>
          <span aria-hidden="true">/</span>
          <span>{inv.project_type.replace(' Investigation', '')}</span>
          <CiteInline inv={inv} />
          {mediaLabel && (
            <span className="inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-[12px] text-muted">
              {mediaLabel}
            </span>
          )}
        </div>
      </div>
      <div className="num col-span-2 grid grid-cols-3 gap-2 text-[13px] text-muted md:col-span-1 md:grid-cols-1 md:gap-0.5">
        <span>{env.o2}</span>
        <span>{env.pressure}</span>
        <span className="text-faint">{env.gravity}</span>
      </div>
      <label
        className="col-start-2 row-start-1 flex h-11 w-11 cursor-pointer items-center justify-center md:col-start-4"
        title={selected ? 'Remove from comparison' : 'Add to comparison'}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={!canSelect && !selected}
          onChange={() => onToggle(inv.psi_id)}
          aria-label={`Compare ${inv.psi_id}`}
          className="h-4 w-4 accent-[#fc3d21]"
        />
      </label>
    </li>
  )
}

function OllamaThinkingIndicator() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % THINKING_STEPS.length)
    }, 1100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-nasa-red">
          <Sparkles size={15} className="animate-pulse" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <span>Semantic search</span>
            <span className="inline-flex items-center gap-1 pt-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-nasa-red [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-nasa-red [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-nasa-red" />
            </span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-muted transition-opacity duration-300">
            {THINKING_STEPS[stepIndex]}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage({ investigations, onOpenDetail }) {
  const [inputQuery, setInputQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [ollamaData, setOllamaData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  // Online demo (GitHub Pages): the SI search needs the local FastAPI + Ollama backend.
  const [offlineNotice, setOfflineNotice] = useState(false)

  const [pillar, setPillar] = useState('All')
  const [rack, setRack] = useState('All')
  const [fuel, setFuel] = useState('All')
  const [scope, setScope] = useState('All')
  const [selected, setSelected] = useState([])
  const [comparing, setComparing] = useState(false)

  const iframeRef = useRef(null)
  // Node the graph camera has flown to (shown in the left column instead of the title).
  const [graphFocus, setGraphFocus] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const abortControllerRef = useRef(null)

  const compareItems = useMemo(
    () => selected.map((id) => investigations.find((i) => i.psi_id === id)).filter(Boolean),
    [selected, investigations]
  )

  const syncGraphHighlight = useCallback((data) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return

    if (!data || !data.files?.length) {
      win.postMessage({ type: 'RESET_HIGHLIGHT' }, '*')
      return
    }

    const nodeIds = data.files.map((f) => String(f[0]))
    const scores = Object.fromEntries(data.files.map((f) => [String(f[0]), f[4]]))

    win.postMessage(
      {
        type: 'HIGHLIGHT_NODES',
        nodeIds,
        scores,
      },
      '*'
    )
  }, [])

  useEffect(() => {
    syncGraphHighlight(ollamaData)
  }, [ollamaData, syncGraphHighlight])

  const cancelOrClearSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsSearching(false)
    setInputQuery('')
    setActiveQuery('')
    setOllamaData(null)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const trimmed = inputQuery.trim()

    if (!trimmed) {
      cancelOrClearSearch()
      return
    }
    setOfflineNotice(true)
    return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setActiveQuery(trimmed)
    setIsSearching(true)
    setOllamaData(null)

    try {
      const res = await fetch(`http://localhost:8000/buscar?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
      const data = await res.json()
      if (!controller.signal.aborted) {
        setOllamaData(data)
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error connecting to Ollama FastAPI:', error)
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
        setIsSearching(false)
      }
    }
  }

  const results = useMemo(() => {
    let filtered = investigations
      .filter((i) => pillar === 'All' || i.safety_pillars.includes(pillar))
      .filter((i) => rack === 'All' || i.hardware_rack === rack)
      .filter((i) => fuel === 'All' || i.fuel_phase === fuel)
      .filter((i) => scope === 'All' || (scope === 'Ground' ? i.project_type === 'Ground Investigation' : i.project_type !== 'Ground Investigation'))

    if (activeQuery) {
      if (!ollamaData) return []
      const scores = new Map(ollamaData.experiments.map((e) => [e[0], e[4]]))
      filtered = filtered
        .filter((inv) => scores.has(inv.psi_id))
        .sort((a, b) => scores.get(b.psi_id) - scores.get(a.psi_id))
    }

    return filtered
  }, [investigations, activeQuery, pillar, rack, fuel, scope, ollamaData])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s))

  // Presentation only: the same file IDs that syncGraphHighlight sends to the graph.
  const graphHighlightIds = useMemo(() => (ollamaData?.files?.length ? ollamaData.files.map((f) => String(f[0])) : []), [ollamaData])
  // Search details per raw file, shown in the graph's node card instead of a text list.
  const graphMatchInfo = useMemo(
    () => Object.fromEntries((ollamaData?.files ?? []).map((f) => [String(f[0]), { description: f[2], score: f[4], matches: f[5] }])),
    [ollamaData],
  )
  const openPsiTag = (node) => {
    if (!node.id.startsWith('psi:')) return
    const inv = investigations.find((i) => i.psi_id === node.id.slice(4))
    if (inv) onOpenDetail(inv)
  }

  const hasActiveSearch = Boolean(inputQuery || activeQuery || isSearching)
  const filteredUI = hasActiveSearch || pillar !== 'All' || rack !== 'All' || fuel !== 'All' || scope !== 'All'
  const isSearchCompleted = Boolean(activeQuery && ollamaData && !isSearching)
  // After a search, the two most relevant matches are shown directly; the rest stay collapsed.
  const TOP_MATCHES = 2
  const topMatches = isSearchCompleted ? results.slice(0, TOP_MATCHES) : []
  const listed = isSearchCompleted ? results.slice(TOP_MATCHES) : results
  useEffect(() => {
    if (isSearchCompleted) setListOpen(false)
  }, [isSearchCompleted])

  const reset = () => {
    cancelOrClearSearch()
    setPillar('All')
    setRack('All')
    setFuel('All')
    setScope('All')
  }

  /* ── Layout mirrors the Simulator: title left, 3D graph as the stage, search panel right. ── */
  const statusLine = offlineNotice
    ? 'SI search runs locally — not available in this online demo'
    : isSearching
    ? 'Searching…'
    : isSearchCompleted
      ? `${results.length} matches · ${ollamaData?.files?.length ?? 0} files lit in the graph`
      : `${investigations.length} investigations`

  const searchPanel = (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-medium leading-snug tracking-normal">Search the library</h2>
        <span className="label mt-1 block" aria-live="polite">
          {statusLine}
        </span>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 transition-colors focus-within:border-nasa-red">
          <Search size={16} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="e.g. spherical flame, psi10…"
            aria-label="Search investigations"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
          {hasActiveSearch && (
            <button
              type="button"
              onClick={cancelOrClearSearch}
              aria-label={isSearching ? 'Stop search' : 'Clear search'}
              title={isSearching ? 'Stop search' : 'Clear search'}
              className="-mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button type="submit" variant="light" disabled={isSearching || !inputQuery.trim()} className="w-full">
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {isSearching && (
        <div className="mt-3 [&>div]:mb-0">
          <OllamaThinkingIndicator />
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <PanelSelect label="Pillar" value={pillar} onChange={setPillar} options={['All', ...SAFETY_PILLARS]} />
        <PanelSelect
          label="Where"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'All', label: 'All' },
            { value: 'Flight', label: 'In orbit' },
            { value: 'Ground', label: 'Ground' },
          ]}
        />
        <PanelSelect label="Hardware" value={rack} onChange={setRack} options={['All', ...HARDWARE_RACKS]} render={(o) => (o === 'All' ? 'All' : RACK_LABELS[o].split(' (')[0])} />
        <PanelSelect label="Fuel" value={fuel} onChange={setFuel} options={['All', ...FUEL_PHASES]} render={(o) => (o === 'All' ? 'All' : FUEL_PHASE_LABELS[o])} />
      </div>
      {filteredUI && (
        <button type="button" onClick={reset} className="mt-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          <X size={13} aria-hidden="true" /> Clear search and filters
        </button>
      )}
    </div>
  )

  const legend = (
    <>
      <div>
        <dt className="label">Knowledge graph</dt>
        <dd className="mt-2">
          <ul className="space-y-1.5 text-[14px] text-muted">
            {Object.values(GROUP_STYLE).map((g) => (
              <li key={g.label} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                {g.label}
              </li>
            ))}
          </ul>
        </dd>
      </div>
      {ollamaData?.files?.length > 0 && (
        <div>
          <dt className="label">Search</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 text-ink">
            <span className="pulse-dot h-2 w-2 rounded-full bg-nasa-red" aria-hidden="true" />
            {ollamaData.files.length} files highlighted
          </dd>
          <dd className="mt-1">
            <SITag />
          </dd>
        </div>
      )}
    </>
  )

  return (
    <>
      <section aria-label="Knowledge graph" className="relative overflow-hidden lg:h-[calc(100svh-64px)] lg:min-h-[680px]">
        <div className="relative h-[640px] lg:absolute lg:inset-0 lg:h-auto">
          {/* Resting distance 15.3: two mouse-wheel zoom steps closer than 17 (0.95² ≈ 0.9). */}
          <KnowledgeGraph3D
            highlightIds={graphHighlightIds}
            matchInfo={graphMatchInfo}
            onFocus={setGraphFocus}
            cameraZ={15.3}
          />
          {/* Keeps the title legible over the graph, as in the Simulator's habitat view. */}
          {/* Denser while node details are open, so their text never mixes with the graph. */}
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 max-w-full bg-gradient-to-r transition-[width] duration-500 ${
              graphFocus ? 'w-[720px] from-ground from-40% via-ground/85 to-transparent' : 'w-[560px] from-ground/90 via-ground/60 to-transparent'
            }`}
            aria-hidden="true"
          />

          <div className="pointer-events-none relative z-20 mx-auto flex h-full max-w-[1440px] flex-col px-4 pt-8 md:px-8 md:pt-12">
            <div className="flex flex-wrap items-start justify-between gap-6">
              {graphFocus ? (
                <div key={graphFocus.node.id} className="pointer-events-auto">
                  <NodeDetails focus={graphFocus} onOpenInvestigation={openPsiTag} />
                </div>
              ) : (
              <div className="pointer-events-auto rise">
                <div className="label mb-4">Library · NASA PSI</div>
                <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-[0.95]">
                  Combustion
                  <br />
                  Science
                  <br />
                  Catalogue
                </h1>
                <p className="mt-5 hidden max-w-[34ch] text-muted sm:block">Search microgravity fire experiments in plain words, and watch their raw data light up.</p>
                <dl className="mt-12 hidden w-fit gap-5 text-[14px] lg:grid">{legend}</dl>
              </div>
              )}
              <div className="pointer-events-auto hidden w-[300px] lg:block">{searchPanel}</div>
            </div>

            <dl className="pointer-events-auto mb-6 mt-auto grid w-fit gap-4 text-[14px] lg:hidden">{legend}</dl>

            <a
              href="#library-results-title"
              className="pointer-events-auto absolute bottom-4 right-4 hidden h-10 items-center gap-2 rounded-full border border-line-strong bg-ground px-4 text-[14px] text-ink transition-colors hover:border-ink md:right-8 lg:bottom-8 lg:inline-flex"
            >
              {isSearchCompleted ? 'See the results' : 'See all investigations'} <ChevronDown size={14} aria-hidden="true" />
            </a>
            <span className={`label pointer-events-none absolute bottom-4 left-8 hidden lg:bottom-8 ${graphFocus ? '' : 'md:block'}`}>
              Click a node for details · drag to move · click scene to zoom
            </span>
          </div>
        </div>

        {/* Mobile: search panel sits below the graph */}
        <div className="space-y-6 px-4 py-6 lg:hidden">
          {graphFocus && <NodeDetails key={graphFocus.node.id} focus={graphFocus} onOpenInvestigation={openPsiTag} />}
          {searchPanel}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pb-40 pt-24 md:px-8 md:pt-32">
        <div id="library-results-title" className="scroll-mt-[88px]" />
        <SectionHead title={isSearchCompleted ? 'Search results' : 'All investigations'}>
          {isSearchCompleted
            ? `The two most relevant matches for “${activeQuery}”; the rest are one click away.`
            : 'Every investigation in the active PSI catalog. Search to rank them by relevance.'}
        </SectionHead>

        {topMatches.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="label">Most relevant</span>
              <SITag />
            </div>
            <ol className="border-t border-line">
              {topMatches.map((inv) => (
                <Row
                  key={inv.psi_id}
                  inv={inv}
                  selected={selected.includes(inv.psi_id)}
                  canSelect={selected.length < MAX_COMPARE}
                  onToggle={toggle}
                  onOpen={onOpenDetail}
                />
              ))}
            </ol>
          </div>
        )}

        {listed.length > 0 && (
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-controls="investigation-list"
            className="group flex w-full items-center justify-between gap-6 rounded-2xl border border-line bg-surface px-6 py-6 text-left transition-colors hover:border-line-strong md:px-8"
          >
            <span>
              <span className="label block">{isSearchCompleted ? 'Other matches' : 'Investigations'}</span>
              <span className="mt-1 block text-[clamp(24px,3vw,34px)] font-medium text-ink">
                <span className="num">{listed.length}</span>
                <span className="text-faint">{isSearchCompleted ? ' more' : ` of ${investigations.length}`}</span>
              </span>
              <span className="mt-1 block text-[14px] text-muted">{listOpen ? 'Hide the list' : 'Show the list'}</span>
            </span>
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink transition-colors group-hover:border-ink">
              <ChevronDown size={20} className={`transition-transform duration-200 ${listOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </span>
          </button>
        )}

        <div id="investigation-list" hidden={!listOpen || !listed.length} aria-live="polite">
          <ol className="mt-2 border-t border-line">
            {listed.map((inv) => (
              <Row
                key={inv.psi_id}
                inv={inv}
                selected={selected.includes(inv.psi_id)}
                canSelect={selected.length < MAX_COMPARE}
                onToggle={toggle}
                onOpen={onOpenDetail}
              />
            ))}
          </ol>
        </div>

        {!results.length && !isSearching && (
          <p className="py-16 text-muted">
            No matches found.{' '}
            <button type="button" onClick={reset} className="link">
              Clear filters
            </button>
          </p>
        )}
      </section>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="num text-[14px] text-ink">{selected.join(' · ')}</span>
              <button type="button" onClick={() => setSelected([])} className="text-[14px] text-faint hover:text-ink">
                Clear
              </button>
            </div>
            <Button variant="primary" disabled={selected.length < 2} onClick={() => setComparing(true)}>
              {selected.length < 2 ? 'Pick one more to compare' : `Compare ${selected.length}`}
            </Button>
          </div>
        </div>
      )}
      <CompareModal open={comparing && compareItems.length >= 2} onClose={() => setComparing(false)} items={compareItems} />
    </>
  )
}
