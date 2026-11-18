import { CopyButton, Modal, PsiId } from './ui'
import { SOURCE_LABELS, citationFor } from './catalog'

export default function CiteModal({ open, onClose, investigations, source }) {
  const all = investigations.map((i) => `[${i.psi_id}] ${citationFor(i)}`).join('\n\n')
  return (
    <Modal open={open} onClose={onClose} title="Cite active datasets">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[14px] text-muted">
          {investigations.length} investigations · NASA Physical Sciences Informatics · <span className="num text-[13px]">{SOURCE_LABELS[source]?.detail}</span>
        </p>
        <CopyButton text={all} label="Copy all citations" />
      </div>
      <ol className="border-t border-line">
        {investigations.map((i) => {
          const c = citationFor(i)
          return (
            <li key={i.psi_id} className="grid grid-cols-[72px_1fr_auto] items-start gap-4 border-b border-line py-4">
              <PsiId id={i.psi_id} className="pt-0.5" />
              <p className="text-[14px] leading-relaxed text-muted">{c}</p>
              <CopyButton text={c} compact label={`Copy citation for ${i.psi_id}`} />
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
