import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { SectionHead } from '../../shared/ui'
import { TEAM } from './team'

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** Small round photo from public/team/<id>.jpg, falling back to initials. */
function Avatar({ person }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <span className="num inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-[14px] text-muted" aria-hidden="true">
        {initials(person.name)}
      </span>
    )
  return (
    <img
      src={`${import.meta.env.BASE_URL}team/${person.id}.jpg`}
      alt=""
      width="48"
      height="48"
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
    />
  )
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-16 md:px-8 md:pt-24">
      <SectionHead title="About us" />

      <div className="grid gap-16 lg:grid-cols-[1fr_1fr]">
        <div className="measure space-y-5 text-[18px] leading-relaxed text-muted">
          <p className="text-ink">
            We are robotics and electronics engineers with a shared passion for space.
          </p>
          <p>
            We built IGNIS-SI for the NASA Space Apps Challenge 2026, answering the “Flame in Freefall” challenge: turning decades of microgravity
            combustion experiments into fire-safety insight for spacecraft, lunar bases and future Mars habitats.
          </p>
        </div>

        <ul className="border-t border-line">
          {TEAM.map((p) => (
            <li key={p.id} className="flex items-center gap-4 border-b border-line py-5">
              <Avatar person={p} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] text-ink">{p.name}</p>
                {p.line && <p className="text-[14px] text-muted">{p.line}</p>}
              </div>
              <a
                href={p.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label={`${p.name} on LinkedIn`}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[14px] text-ink transition-colors hover:border-ink"
              >
                LinkedIn <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
