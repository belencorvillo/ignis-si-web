import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowUpRight, Maximize2, X } from 'lucide-react'
import { More, SITag } from '../../shared/ui'
import { getYoloVideo } from '../../shared/yoloVideos'

/** PSI ID a node belongs to: the investigation tag ("psi:PSI-69") or a file named after it ("PSI-69_…"). */
const psiIdOf = (node) => (node.id.startsWith('psi:') ? node.id.slice(4) : node.id.match(/^PSI-\d+/i)?.[0]?.toUpperCase() ?? null)

// iOS-like curve, same as the Applications sheet.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Title bar shared by the inline card and the enlarged view (keeps the SI label visible in both). */
function MediaHeader({ media, children }) {
  const si = media.model && media.model !== 'None'
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2 text-[12px]">
      <span className="flex min-w-0 items-center gap-3">
        <span className="truncate font-medium text-ink">{media.title}</span>
        {si && <SITag />}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {si && <span className="num rounded-full border border-nasa-red/40 bg-nasa-red/10 px-2 py-0.5 text-[11px] text-nasa-red">{media.model}</span>}
        {children}
      </span>
    </div>
  )
}

/**
 * Enlarged media, centred on screen (not full screen). It grows out of the inline
 * card (FLIP: measured from its rect, animated with a transform) and shrinks back on close.
 */
function MediaLightbox({ media, from, startAt, poster, onClose }) {
  const box = useRef(null)
  const backdrop = useRef(null)
  const video = useRef(null)
  const closing = useRef(false)

  const flipFrom = () => {
    const to = box.current.getBoundingClientRect()
    const r = from()
    if (!r) return 'scale(0.9)'
    return `translate(${r.left - to.left}px, ${r.top - to.top}px) scale(${r.width / to.width}, ${r.height / to.height})`
  }

  // The box is a fixed 16:9 size, so it can be measured before the video loads and the
  // opening FLIP mirrors the closing one exactly.
  useLayoutEffect(() => {
    if (video.current && !media.isImage) {
      video.current.currentTime = startAt
      video.current.play().catch(() => {})
    }
    if (reducedMotion()) return
    box.current.animate([{ transform: flipFrom(), borderRadius: '16px' }, { transform: 'none', borderRadius: '20px' }], { duration: 620, easing: EASE })
    backdrop.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const t = video.current?.currentTime ?? startAt
    if (reducedMotion()) return onClose(t)
    box.current.animate([{ transform: 'none' }, { transform: flipFrom() }], { duration: 460, easing: EASE, fill: 'forwards' })
    backdrop.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' })
    // A timer rather than `animation.finished`: it also closes if frames are paused (hidden tab).
    setTimeout(() => onClose(t), 470)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, startAt])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={media.title}>
      <div ref={backdrop} className="absolute inset-0 bg-ground/75 backdrop-blur-xl" onClick={close} aria-hidden="true" />
      <div ref={box} style={{ transformOrigin: '0 0' }} className="relative w-[min(1100px,88vw,calc((78vh-41px)*16/9))] overflow-hidden rounded-[20px] border border-line-strong bg-[#07080b] shadow-2xl">
        <MediaHeader media={media}>
          <button type="button" onClick={close} aria-label="Close enlarged video" title="Close" className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink">
            <X size={15} aria-hidden="true" />
          </button>
        </MediaHeader>
        {media.isImage ? (
          <img src={media.src} alt={media.title} className="aspect-video w-full bg-black object-contain" />
        ) : (
          <video ref={video} src={media.src} poster={poster} controls muted loop playsInline preload="auto" className="aspect-video w-full bg-black object-contain" />
        )}
      </div>
    </div>,
    document.body,
  )
}

/** YOLO-processed media for the node's investigation (SI-generated, so labelled). */
function YoloMedia({ media }) {
  const [ok, setOk] = useState(true)
  const [big, setBig] = useState(null) // { startAt } while enlarged
  const card = useRef(null)
  const inline = useRef(null)

  const enlarge = () => {
    const v = inline.current
    const t = v?.currentTime ?? 0
    v?.pause()
    // Current frame as the poster of the enlarged video, so it grows with the picture instead of a black box.
    let poster
    try {
      if (v?.videoWidth) {
        const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight })
        c.getContext('2d').drawImage(v, 0, 0)
        poster = c.toDataURL('image/jpeg', 0.85)
      }
    } catch {
      poster = undefined
    }
    setBig({ startAt: t, poster })
  }
  const shrink = useCallback((t) => {
    setBig(null)
    if (inline.current) {
      inline.current.currentTime = t
      inline.current.play().catch(() => {})
    }
  }, [])

  return (
    <>
      <div ref={card} className={`overflow-hidden rounded-2xl border border-line-strong bg-[#07080b] transition-opacity duration-200 ${big ? 'opacity-0' : ''}`}>
        <MediaHeader media={media}>
          {ok && (
            <button type="button" onClick={enlarge} aria-label="Enlarge video" title="Enlarge" className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink">
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          )}
        </MediaHeader>
        {!ok ? (
          <p className="px-3.5 py-6 text-[13px] text-faint">
            Media file not found · <span className="num">public{media.src}</span>
          </p>
        ) : media.isImage ? (
          <button type="button" onClick={enlarge} className="block w-full" aria-label="Enlarge image">
            <img src={media.src} alt={media.title} onError={() => setOk(false)} className="max-h-[280px] w-full bg-black object-contain" />
          </button>
        ) : (
          <video
            ref={inline}
            src={media.src}
            controls
            controlsList="nofullscreen"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            onError={() => setOk(false)}
            className="aspect-video w-full bg-black object-contain"
          />
        )}
      </div>
      {big && <MediaLightbox media={media} startAt={big.startAt} poster={big.poster} from={() => card.current?.getBoundingClientRect()} onClose={shrink} />}
    </>
  )
}

/**
 * Details of the node the camera has flown to. Rendered in the left column of
 * the Library stage, in place of the page title, so the graph stays uncovered.
 * `focus` comes from KnowledgeGraph3D's onFocus callback.
 */
export default function NodeDetails({ focus, onOpenInvestigation }) {
  const { node, kindLabel, match, neighbors, pick, close } = focus
  const [expanded, setExpanded] = useState(false)
  const isFile = node.kind !== 'tag'
  const summary = node.info.summary ?? match?.description
  const media = getYoloVideo(psiIdOf(node))

  return (
    <div className="rise max-w-[440px]">
      <button type="button" onClick={close} className="label mb-4 inline-flex items-center gap-2 transition-colors hover:!text-ink">
        <ArrowLeft size={13} aria-hidden="true" /> Back to the catalogue
      </button>

      <span className="label flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: node.color }} aria-hidden="true" />
        {kindLabel}
      </span>
      <h2 className="mt-3 break-words text-[clamp(26px,2.8vw,42px)] font-light leading-[1.05] text-ink">{node.info.title ?? node.text}</h2>
      {isFile && <p className="num mt-3 break-all text-[12px] text-faint">{node.label}</p>}

      <div className="mt-6 max-h-[42vh] space-y-5 overflow-y-auto overscroll-contain pr-2">
        {match && (
          <p className="num border-l-2 border-nasa-red pl-3 text-[12px] leading-relaxed text-muted">
            <span className="text-nasa-red">Search match</span>
            {match.score != null && <> · score {match.score}</>}
            {match.matches && (
              <>
                <br />
                {String(match.matches)}
              </>
            )}
          </p>
        )}

        {media && <YoloMedia key={media.src} media={media} />}

        {summary && (
          <div>
            <SITag />
            <p className={`mt-2 text-[16px] leading-relaxed text-ink/85 ${expanded ? '' : 'line-clamp-3'}`}>{summary}</p>
            <button type="button" onClick={() => setExpanded((v) => !v)} className="link mt-1 text-[14px] text-muted">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        <More
          summary={
            <span className="flex items-baseline gap-2">
              <span className="label">Connected</span>
              <span className="num text-[12px] text-faint">{neighbors.length}</span>
            </span>
          }
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {neighbors.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => pick(n.index)} className="inline-flex items-center gap-1.5 text-[14px] text-ink/80 transition-colors hover:text-ink">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.color }} aria-hidden="true" />
                  {n.text}
                </button>
              </li>
            ))}
          </ul>
        </More>

        {node.isPsi && (
          <button type="button" onClick={() => onOpenInvestigation?.(node)} className="link inline-flex items-center gap-1 text-[15px] text-ink">
            Open investigation <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
