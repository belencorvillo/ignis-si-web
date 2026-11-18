// App shell: header, navigation, footer and state shared across pages.
// Each tab lives in its own folder under src/pages/ — see src/README.md.
import { useCallback, useEffect, useState } from 'react'
import SimulatorPage from './pages/simulator/SimulatorPage'
import LibraryPage from './pages/library/LibraryPage'
import EarthPage from './pages/earth/EarthPage'
import DataPage from './pages/data/DataPage'
import AboutPage from './pages/about/AboutPage'
import CiteModal from './shared/CiteModal'
import InvestigationDetail from './shared/InvestigationDetail'
import { Button } from './shared/ui'
import { loadInvestigations } from './shared/catalog'
import { MODEL_CREDITS } from './shared/credits'
import { DEFAULT_MODE, DEFAULT_PARAMS } from './pages/simulator/simulation'

const PAGES = [
  { id: 'simulator', label: 'Simulator' },
  { id: 'library', label: 'Library' },
  { id: 'earth', label: 'Applications' },
]

function Wordmark() {
  // Project wordmark only — no NASA insignia, logotype or mission patches.
  return (
    <span className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <ellipse cx="11" cy="11" rx="10" ry="3.6" fill="none" stroke="currentColor" strokeOpacity="0.35" transform="rotate(-24 11 11)" />
        <circle cx="11" cy="11" r="3.4" fill="#fc3d21" />
      </svg>
      <span className="whitespace-nowrap font-display text-[17px] font-semibold tracking-tight">IGNIS-SI</span>
    </span>
  )
}

export default function App() {
  const [page, setPage] = useState('simulator')
  const [data, setData] = useState({ investigations: [], source: null, loading: true })
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [mode, setMode] = useState(DEFAULT_MODE)
  const [detail, setDetail] = useState(null)
  const [citeOpen, setCiteOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadInvestigations()
      .then((r) => alive && setData({ ...r, loading: false }))
      .catch(() => alive && setData({ investigations: [], source: null, loading: false }))
    return () => {
      alive = false
    }
  }, [])

  const { investigations, source } = data
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeCite = useCallback(() => setCiteOpen(false), [])
  const go = (id) => {
    setPage(id)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="grain min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-line bg-ground">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] md:px-8">
          <button type="button" onClick={() => go('simulator')} aria-label="IGNIS-SI home" className="justify-self-start rounded-full">
            <Wordmark />
          </button>
          <nav aria-label="Main" className="flex items-center gap-1">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                aria-current={page === p.id ? 'page' : undefined}
                className={`h-10 whitespace-nowrap rounded-full px-2.5 text-[14px] transition-colors duration-150 sm:text-[15px] md:px-4 ${
                  page === p.id ? 'text-ink' : 'text-faint hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <div className="hidden items-center gap-1 justify-self-end sm:flex">
            <Button variant="secondary" className="h-9 px-4 text-[14px]" onClick={() => setCiteOpen(true)} disabled={!investigations.length}>
              Cite data
            </Button>
            <button
              type="button"
              onClick={() => go('data')}
              aria-current={page === 'data' ? 'page' : undefined}
              className={`h-9 whitespace-nowrap rounded-full px-4 text-[14px] transition-colors duration-150 ${page === 'data' ? 'text-ink' : 'text-faint hover:text-ink'}`}
            >
              Get data
            </button>
            <button
              type="button"
              onClick={() => go('about')}
              aria-current={page === 'about' ? 'page' : undefined}
              className={`h-9 whitespace-nowrap rounded-full px-4 text-[14px] transition-colors duration-150 ${page === 'about' ? 'text-ink' : 'text-faint hover:text-ink'}`}
            >
              About us
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="pt-16">
        {page === 'about' && <AboutPage />}
        {page !== 'about' && data.loading && <div className="label flex h-[60vh] items-center justify-center">Loading PSI catalog…</div>}
        {page !== 'about' && !data.loading && !investigations.length && (
          <div className="mx-auto max-w-xl px-6 py-32 text-center text-muted">
            No investigations could be loaded. Check the backend, catalogo_limpio.json or mock_catalogo.json.
          </div>
        )}
        {page !== 'about' && !data.loading && investigations.length > 0 && (
          <>
            {page === 'simulator' && (
              <SimulatorPage
                investigations={investigations}
                params={params}
                setParams={setParams}
                mode={mode}
                setMode={setMode}
                onOpenDetail={setDetail}
              />
            )}
            {page === 'library' && <LibraryPage investigations={investigations} onOpenDetail={setDetail} />}
            {page === 'data' && <DataPage investigations={investigations} params={params} source={source} />}
            {page === 'earth' && <EarthPage investigations={investigations} onOpenDetail={setDetail} />}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
          <div className="grid gap-6 md:grid-cols-2 md:gap-12">
            <p className="text-[14px] text-muted">
              Rocket engines and propellants are out of scope: their high flow velocities make combustion effectively gravity-independent.
            </p>
            <p className="text-[14px] text-muted">
              Data from NASA Physical Sciences Informatics (PSI). Content marked “SI-assisted analysis” was produced with super intelligence (SI)
              assistance. Built for NASA Space Apps 2026 — not an official NASA product.
            </p>
          </div>
          <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-faint">
            <span className="label mr-2">3D models</span>
            {[MODEL_CREDITS.cabin, MODEL_CREDITS.habitat, ...Object.values(MODEL_CREDITS).filter((c) => c !== MODEL_CREDITS.cabin && c !== MODEL_CREDITS.habitat)].map((c, i) => (
              <span key={c.url}>
                {i > 0 && ' · '}
                <a href={c.url} target="_blank" rel="noreferrer" className="link text-faint">
                  {c.title}
                </a>{' '}
                by{' '}
                {c.authorUrl ? (
                  <a href={c.authorUrl} target="_blank" rel="noreferrer" className="link text-faint">
                    {c.author}
                  </a>
                ) : (
                  c.author
                )}{' '}
                (
                <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="link text-faint">
                  {c.license}
                </a>
                {c.modified ? ', modified' : ''})
              </span>
            ))}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-faint">
            <span className="label mr-2">Development</span>
            This website was built with the assistance of AI coding agents. Its design, data and scientific content were directed and reviewed by
            the team.
          </p>
          {/* On phones the header buttons are hidden, so they live here. */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 sm:hidden">
            <button type="button" onClick={() => setCiteOpen(true)} className="link text-[14px]">
              Cite data
            </button>
            <button type="button" onClick={() => go('data')} className="link text-[14px]">
              Get data
            </button>
            <button type="button" onClick={() => go('about')} className="link text-[14px]">
              About us
            </button>
          </div>
        </div>
      </footer>

      {detail && <InvestigationDetail inv={detail} catalog={investigations} onClose={closeDetail} onOpen={setDetail} />}
      <CiteModal open={citeOpen} onClose={closeCite} investigations={investigations} source={source} />
    </div>
  )
}
