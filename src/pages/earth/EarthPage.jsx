import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react'
import { CiteInline, Popover, PsiId, Segmented } from '../../shared/ui'
import { MODEL_CREDITS } from '../../shared/credits'
import EarthStage from './EarthStage'
import ModelStage from './ModelStage'
import { APPLICATIONS, BLOCKS } from './applications'

// iOS-like sheet curve: fast start, long soft landing.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ── Small pieces ────────────────────────────────────────────────────────── */

/** Evidence list: PSI ID, title and citation. */
function Evidence({ linked, onOpen }) {
  const [all, setAll] = useState(false)
  const shown = all ? linked : linked.slice(0, 3)
  return (
    <div>
      <ul className="border-t border-line">
        {shown.map((inv) => (
          <li key={inv.psi_id} className="flex items-center justify-between gap-4 border-b border-line py-2.5">
            <button type="button" onClick={() => onOpen(inv)} className="group flex min-w-0 items-baseline gap-3 text-left">
              <PsiId id={inv.psi_id} className="shrink-0" />
              <span className="truncate text-[14px] text-muted transition-colors group-hover:text-ink">{inv.title}</span>
            </button>
            <CiteInline inv={inv} />
          </li>
        ))}
      </ul>
      {linked.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="link mt-3 text-[13px] text-muted">
          {all ? 'Show fewer' : `+ ${linked.length - 3} more`}
        </button>
      )}
    </div>
  )
}

function Credit({ credit, align = 'left' }) {
  const c = MODEL_CREDITS[credit]
  if (!c) return null
  return (
    <Popover
      label="3D model credit"
      align={align}
      triggerClassName="pointer-events-auto inline-flex h-6 items-center rounded-full border border-line-strong px-2 text-[11px] text-muted transition-colors hover:border-ink hover:text-ink"
      trigger="CC BY"
    >
      <p className="text-[14px] leading-relaxed text-ink">
        <a href={c.url} target="_blank" rel="noreferrer" className="link">
          {c.title}
        </a>{' '}
        by {c.author} on Sketchfab, licensed{' '}
        <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="link">
          {c.license}
        </a>
        .
      </p>
      {c.modified && <p className="mt-2 text-[13px] text-muted">Modified: {c.modified}</p>}
    </Popover>
  )
}

/* ── Application sheet ───────────────────────────────────────────────────── */

/**
 * Full-height sheet that grows out of the row that opened it (clip-path, so
 * nothing is stretched) and shrinks back into it on close.
 */
function AppSheet({ app, origin, investigations, onNavigate, onClose, onOpenDetail }) {
  const sheet = useRef(null)
  const backdrop = useRef(null)
  const closing = useRef(false)
  const linked = app.match ? investigations.filter(app.match) : []
  const index = APPLICATIONS.indexOf(app)
  const prev = APPLICATIONS[(index - 1 + APPLICATIONS.length) % APPLICATIONS.length]
  const next = APPLICATIONS[(index + 1) % APPLICATIONS.length]

  // Clip-path inset that makes the sheet cover exactly the origin row.
  const insetFor = (rect) => {
    const s = sheet.current.getBoundingClientRect()
    if (!rect) return `inset(${s.height * 0.06}px ${s.width * 0.06}px round 28px)`
    return `inset(${rect.top - s.top}px ${s.right - rect.right}px ${s.bottom - rect.bottom}px ${rect.left - s.left}px round 16px)`
  }

  useLayoutEffect(() => {
    if (reducedMotion()) return
    sheet.current.animate([{ clipPath: insetFor(origin) }, { clipPath: 'inset(0px 0px 0px 0px round 28px)' }], { duration: 640, easing: EASE })
    backdrop.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    if (reducedMotion()) return onClose()
    // The row may have moved (or changed block) since; measure it again.
    const row = [...document.querySelectorAll(`[data-app="${app.id}"]`)].find((el) => el.getClientRects().length)
    const rect = row ? row.getBoundingClientRect() : null
    sheet.current.querySelector('[data-content]')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' })
    backdrop.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' })
    sheet.current.animate([{ clipPath: 'inset(0px 0px 0px 0px round 28px)' }, { clipPath: insetFor(rect) }], { duration: 460, easing: EASE, fill: 'forwards' })
    // A timer rather than `animation.finished`: it also closes if frames are paused (hidden tab).
    setTimeout(onClose, 470)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, app.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') onNavigate(next.id)
      if (e.key === 'ArrowLeft') onNavigate(prev.id)
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [close, next.id, prev.id, onNavigate])

  // New application: back to the top of the text.
  const scroller = useRef(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [app.id])

  return (
    <div className="fixed inset-0 z-50">
      <div ref={backdrop} className="absolute inset-0 bg-ground/70 backdrop-blur-xl" onClick={close} aria-hidden="true" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={app.title}
        className="absolute inset-2 overflow-y-auto overscroll-contain rounded-[28px] border border-line bg-surface md:inset-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden"
      >
        {/* Object */}
        <div className="relative h-[40vh] min-h-[260px] bg-[radial-gradient(ellipse_at_50%_45%,rgb(122_163_245/0.10),transparent_65%)] lg:h-full">
          {app.model && <ModelStage key={app.id} url={app.model.url} rotation={app.model.rotation} pose={app.model.pose} label={`3D model for ${app.title}`} />}
          <span className="label pointer-events-none absolute left-6 top-6 md:left-8 md:top-8">{BLOCKS[app.block].short}</span>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 p-6 md:p-8">
            {app.model && <Credit credit={app.model.credit} />}
            <span className="label hidden md:inline">Drag to turn</span>
          </div>
        </div>

        {/* Text */}
        <div ref={scroller} className="relative lg:overflow-y-auto lg:overscroll-contain">
          <div key={app.id} data-content className="sheet-in px-6 pb-12 pt-8 md:px-12 md:pt-24 xl:px-16">
            <h2 className="max-w-[16ch] text-[clamp(34px,4vw,56px)] font-light leading-[1.02]">{app.title}</h2>
            <p className="mt-4 text-[19px] leading-snug text-muted">{app.lede}</p>
            <p className="measure mt-8 text-[16px] leading-relaxed text-ink/85">{app.body}</p>


            <section className="mt-10">
              <h3 className="label mb-3">PSI evidence</h3>
              {linked.length > 0 ? (
                <Evidence linked={linked} onOpen={onOpenDetail} />
              ) : (
                <p className="text-[14px] text-faint">{app.note ?? 'No PSI investigation in this catalog applies directly.'}</p>
              )}
            </section>

            <section className="mt-10">
              <h3 className="label mb-3">Sources</h3>
              <ul className="space-y-2">
                {app.sources.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noreferrer" className="link inline-flex items-start gap-1 text-[14px] text-muted">
                      {s.label} <ArrowUpRight size={12} className="mt-1 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* Previous · next · close */}
        <div className="fixed right-5 top-5 z-10 flex gap-2 md:right-9 md:top-9 lg:absolute lg:right-6 lg:top-6">
          {[
            { label: `Previous: ${prev.title}`, icon: ArrowLeft, onClick: () => onNavigate(prev.id) },
            { label: `Next: ${next.title}`, icon: ArrowRight, onClick: () => onNavigate(next.id) },
            { label: 'Close', icon: X, onClick: close },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={label}
              title={label}
              className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-ground/70 text-ink backdrop-blur transition-colors hover:border-ink"
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Explore panel ───────────────────────────────────────────────────────── */

/** Same card as the Simulator and Library panels: title, status line, segmented control, content. */
function ExplorePanel({ block, setBlock, onOpen }) {
  const items = APPLICATIONS.filter((a) => a.block === block)
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-medium leading-snug tracking-normal">Explore the applications</h2>
      </div>

      <Segmented
        label="Application block"
        size="sm"
        value={block}
        onChange={setBlock}
        options={Object.entries(BLOCKS).map(([value, b]) => ({ value, label: b.short }))}
      />
      <p className="mt-3 text-[13px] leading-snug text-muted">{BLOCKS[block].lede}</p>

      <ul key={block} className="sheet-in mt-4 divide-y divide-line border-t border-line">
        {items.map((a, k) => (
          <li key={a.id}>
            <button
              type="button"
              data-app={a.id}
              onClick={(e) => onOpen(a.id, e.currentTarget.getBoundingClientRect())}
              className="group grid w-full grid-cols-[20px_1fr_auto] items-center gap-3 py-3 text-left"
            >
              {/* Light display numeral, like a printed table of contents */}
              <span className="font-display text-[24px] font-extralight leading-none text-faint transition-colors group-hover:text-ink" aria-hidden="true">
                {k + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] leading-snug text-ink/90 transition-colors group-hover:text-ink">{a.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-faint">{a.lede}</span>
              </span>
              <ArrowRight size={14} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function EarthPage({ investigations, onOpenDetail }) {
  const [block, setBlock] = useState('equipment')
  const [openId, setOpenId] = useState(null)
  const open = APPLICATIONS.find((a) => a.id === openId)

  const [origin, setOrigin] = useState(null)
  const openApp = (id, rect) => {
    setOrigin(rect)
    setOpenId(id)
  }
  // Moving through the sheet keeps the panel in sync, so it closes back into the right row.
  const navigate = useCallback((id) => {
    const app = APPLICATIONS.find((a) => a.id === id)
    setBlock(app.block)
    setOpenId(id)
  }, [])
  const close = useCallback(() => setOpenId(null), [])

  const panel = <ExplorePanel block={block} setBlock={setBlock} onOpen={openApp} />

  return (
    <>
      {/* Stage — same layout as Simulator and Library */}
      <section aria-label="Applications" className="relative overflow-hidden lg:h-[calc(100svh-64px)] lg:min-h-[680px]">
        <div className="relative h-[640px] lg:absolute lg:inset-0 lg:h-auto">
          <EarthStage />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[560px] max-w-full bg-gradient-to-r from-ground/90 via-ground/60 to-transparent" aria-hidden="true" />

          <div className="pointer-events-none relative z-20 mx-auto flex h-full max-w-[1440px] flex-col px-4 pt-8 md:px-8 md:pt-12">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="pointer-events-auto rise">
                <div className="label mb-4 flex items-center gap-3">
                  <span>Applications · From orbit to Earth</span>
                  <Credit credit="earth" />
                </div>
                <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-[0.95]">
                  Flames
                  <br />
                  in orbit,
                  <br />
                  safety
                  <br />
                  on Earth
                </h1>
                <p className="mt-5 hidden max-w-[36ch] text-muted sm:block">
                  What microgravity fire research gives to next-generation spacecraft — and back to fire safety on Earth.
                </p>
              </div>
              <div className="pointer-events-auto hidden w-[320px] lg:block">{panel}</div>
            </div>

            <span className="label pointer-events-none absolute bottom-4 left-8 hidden md:block lg:bottom-8">Drag our home to turn it</span>
          </div>
        </div>

        {/* Mobile: panel below the stage */}
        <div className="px-4 py-6 lg:hidden">{panel}</div>
      </section>

      {open && (
        <AppSheet
          app={open}
          origin={origin}
          investigations={investigations}
          onNavigate={navigate}
          onClose={close}
          onOpenDetail={(inv) => {
            setOpenId(null)
            onOpenDetail(inv)
          }}
        />
      )}
    </>
  )
}
