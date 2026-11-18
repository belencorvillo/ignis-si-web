import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronRight, Copy, ExternalLink, X } from 'lucide-react'
import { citationFor, shortDoi } from './catalog'

/* ── Buttons ─────────────────────────────────────────────────────────────── */

const BTN_BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-[background-color,color,border-color,transform] duration-150 ease-[var(--ease-out-soft)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40'

/** Exactly one primary (filled NASA Red) button per view. */
export function Button({ variant = 'secondary', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-nasa-red text-ground hover:bg-nasa-red-hover font-semibold',
    light: 'bg-ink text-ground hover:bg-white font-semibold',
    secondary: 'border border-line-strong text-ink hover:border-ink',
    ghost: 'text-muted hover:text-ink px-3',
  }
  return (
    <button type="button" className={`${BTN_BASE} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function IconButton({ label, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-raised hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Segmented control (radio-group semantics). */
export function Segmented({ label, options, value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 'h-8 text-[13px] px-3' : 'h-10 text-sm px-4'
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-ground/80 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`${h} whitespace-nowrap rounded-full font-medium transition-colors duration-150 ${
              active ? 'bg-ink text-ground' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Small marks ─────────────────────────────────────────────────────────── */

export function PsiId({ id, className = '' }) {
  return <span className={`num text-[13px] text-ink ${className}`}>{id}</span>
}

export function Tag({ children, tone = 'default', title }) {
  const tones = {
    default: 'text-muted border-line-strong',
    red: 'text-nasa-red border-nasa-red/40',
    sky: 'text-sky border-sky/40',
    ember: 'text-ember border-ember/40',
  }
  return (
    <span title={title} className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] leading-none whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Required disclosure on SI-generated content. */
export function SITag() {
  return (
    <span
      className="label inline-flex items-center gap-1.5 !text-sky"
      title="Generated or classified with super intelligence (SI) assistance. Verify against the cited PSI source."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-sky" aria-hidden="true" />
      SI-assisted analysis
    </span>
  )
}

/* ── Citations ───────────────────────────────────────────────────────────── */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function CopyButton({ text, label = 'Copy citation', compact = false }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation()
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }
      }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full text-[13px] text-muted transition-colors duration-150 hover:text-ink ${
        compact ? 'h-8 w-8 justify-center hover:bg-raised' : 'h-8 px-3 border border-line hover:border-line-strong'
      }`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {!compact && (copied ? 'Copied' : 'Copy')}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Citation copied' : ''}
      </span>
    </button>
  )
}

/** Inline, low-noise citation: PSI ID + DOI link + copy. Used in lists. */
export function CiteInline({ inv }) {
  const doi = shortDoi(inv)
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {doi && (
        <a
          href={doi.href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="num truncate text-[12px] text-faint transition-colors hover:text-ink"
          title={citationFor(inv)}
        >
          {doi.text}
        </a>
      )}
      <CopyButton text={citationFor(inv)} compact label={`Copy citation for ${inv.psi_id}`} />
    </span>
  )
}

/** Full "Cite this investigation" block. Used in detail views. */
export function Citation({ inv }) {
  const text = citationFor(inv)
  return (
    <figure className="rounded-2xl border border-line p-4">
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span className="label">Cite this investigation · {inv.psi_id}</span>
        <span className="flex items-center gap-1">
          {inv.psi_url && (
            <a
              href={inv.psi_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] text-muted hover:text-ink"
            >
              PSI <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          <CopyButton text={text} />
        </span>
      </figcaption>
      <p className="text-[14px] leading-relaxed text-muted">{text}</p>
    </figure>
  )
}

/* ── Layout helpers ──────────────────────────────────────────────────────── */

export function SectionHead({ index, title, children, right }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        {index && <div className="label mb-3">{index}</div>}
        <h2 className="text-[clamp(28px,4vw,44px)] font-medium">{title}</h2>
        {children && <p className="measure mt-3 text-muted">{children}</p>}
      </div>
      {right}
    </div>
  )
}

/** Small anchored popover (closes on outside click or Escape). */
export function Popover({ label, trigger, triggerClassName = '', align = 'right', className = 'w-[320px]', children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={id} aria-label={label} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`rise absolute top-full z-30 mt-2 rounded-2xl border border-line-strong bg-surface p-5 text-left font-sans normal-case tracking-normal ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${className}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** Progressive disclosure — keeps detail one click away instead of on screen. */
export function More({ summary, children, className = '' }) {
  return (
    <details className={`group ${className}`}>
      <summary className="inline-flex min-h-8 items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-ink">
        <ChevronRight size={14} className="chev" aria-hidden="true" />
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ground/85 px-4 py-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`rise mx-auto w-full rounded-3xl border border-line bg-surface ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="text-xl font-medium">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, label, children }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ground/70" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="slide-in h-full w-full max-w-[560px] overflow-y-auto overscroll-contain border-l border-line bg-surface"
      >
        {children}
      </aside>
    </div>
  )
}
