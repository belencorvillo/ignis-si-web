import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Citation, Drawer, IconButton, More, PsiId, SITag, Tag } from './ui'
import { FUEL_PHASE_LABELS, RACK_LABELS, envelopeSummary, loadTelemetry } from './catalog'
import { getYoloVideo } from './yoloVideos'

/** Video / CV telemetry preview. Shows YOLO processed media and telemetry curves when available. */
export function MediaPanel({ inv }) {
  const [telemetry, setTelemetry] = useState(null)
  const [videoOk, setVideoOk] = useState(true)
  const yoloMedia = getYoloVideo(inv?.psi_id)
  // Media processed by a detection model (e.g. YOLO) is SI-generated and must be labelled as such.
  const siProcessed = Boolean(yoloMedia?.model && yoloMedia.model !== 'None')

  useEffect(() => {
    let alive = true
    setVideoOk(true)
    loadTelemetry(inv).then((t) => alive && setTelemetry(t))
    return () => {
      alive = false
    }
  }, [inv])

  if (!yoloMedia && !inv.video_filename && !telemetry) {
    return <p className="text-[14px] text-faint">No video or CV telemetry yet.</p>
  }

  return (
    <div className="space-y-4">
      {yoloMedia && (
        <div className="overflow-hidden rounded-2xl border border-line-strong bg-[#07080b]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate font-medium text-ink">{yoloMedia.title}</span>
              {siProcessed && <SITag />}
            </span>
            {siProcessed && (
              <span className="shrink-0 rounded-full border border-[#fc3d21]/40 bg-[#fc3d21]/10 px-2 py-0.5 font-mono text-[11px] text-[#fc3d21]">
                {yoloMedia.model}
              </span>
            )}
          </div>

          {yoloMedia.isImage ? (
            <a href={yoloMedia.src} target="_blank" rel="noreferrer" title="Open full-size image">
              <img
                src={yoloMedia.src}
                alt={yoloMedia.title}
                className="max-h-[460px] w-full bg-black object-contain"
              />
            </a>
          ) : (
            <video
              src={yoloMedia.src}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-contain"
            >
              Your browser does not support HTML5 video.
            </video>
          )}
        </div>
      )}

      {inv.video_filename &&
        (videoOk ? (
          <video
            src={`/videos/${inv.video_filename}`}
            controls
            muted
            playsInline
            preload="metadata"
            onError={() => setVideoOk(false)}
            className="aspect-video w-full rounded-2xl bg-black"
          />
        ) : (
          <p className="text-[14px] text-faint">
            Video not published yet · <span className="num">{inv.video_filename}</span>
          </p>
        ))}

      {telemetry && (
        <div>
          <div className="mb-2">
            <SITag />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry.points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="time_s" tick={{ fill: '#7d818a', fontSize: 11 }} tickLine={false} />
                <YAxis yAxisId="d" tick={{ fill: '#7d818a', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="s" orientation="right" domain={[0, 1]} tick={{ fill: '#7d818a', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#151821', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, fontSize: 12 }} />
                <Line yAxisId="d" dataKey="equivalent_diameter_mm" name="Diameter (mm)" stroke="#f2a541" dot={false} />
                <Line yAxisId="s" dataKey="sphericity_index" name="Sphericity" stroke="#7aa3f5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="num mt-1 text-[12px] text-faint">CV-extracted · {telemetry.file}</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-1 text-[17px] text-ink">{value}</dd>
    </div>
  )
}

export default function InvestigationDetail({ inv, catalog, onClose, onOpen }) {
  if (!inv) return null
  const env = envelopeSummary(inv.envelope)
  const byId = new Map(catalog.map((x) => [x.psi_id, x]))
  const hasDetails = inv.fuels_tested.length || inv.sensors_used.length || inv.variables_compared || inv.approach

  return (
    <Drawer open onClose={onClose} label={`Investigation ${inv.psi_id}`}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-3">
        <PsiId id={inv.psi_id} />
        <IconButton label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="space-y-10 px-6 py-8">
        <header>
          <div className="label mb-3">{inv.project_type}</div>
          <h2 className="text-[28px] font-medium leading-tight">{inv.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {inv.safety_pillars.map((p) => (
              <Tag key={p}>{p}</Tag>
            ))}
            {inv.lunar_habitat_relevant && <Tag tone="ember">Lunar-relevant</Tag>}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6">
          <Stat label="Oxygen" value={env.o2} />
          <Stat label="Pressure" value={env.pressure} />
          <Stat label="Airflow" value={env.airflow} />
          <Stat label="Gravity" value={env.gravity} />
          <Stat label="Hardware" value={RACK_LABELS[inv.hardware_rack].split(' (')[0]} />
          <Stat label="Fuel" value={FUEL_PHASE_LABELS[inv.fuel_phase]} />
        </dl>

        {inv.objectives && <p className="text-[16px] text-muted">{inv.objectives}</p>}

        {inv.key_findings_summary && (
          <section>
            <SITag />
            <p className="mt-3 text-[16px] leading-relaxed text-ink">{inv.key_findings_summary}</p>
          </section>
        )}

        <Citation inv={inv} />

        {hasDetails ? (
          <More summary="Method & instruments">
            <dl className="space-y-4 text-[15px]">
              {inv.approach && (
                <div>
                  <dt className="label">Approach</dt>
                  <dd className="mt-1 text-muted">{inv.approach}</dd>
                </div>
              )}
              {inv.fuels_tested.length > 0 && (
                <div>
                  <dt className="label">Fuels</dt>
                  <dd className="mt-1 text-muted">{inv.fuels_tested.join(', ')}</dd>
                </div>
              )}
              {inv.sensors_used.length > 0 && (
                <div>
                  <dt className="label">Sensors</dt>
                  <dd className="mt-1 text-muted">{inv.sensors_used.join(', ')}</dd>
                </div>
              )}
              {inv.variables_compared && (
                <div>
                  <dt className="label">Variables</dt>
                  <dd className="num mt-1 text-[13px] text-muted">{inv.variables_compared}</dd>
                </div>
              )}
            </dl>
          </More>
        ) : null}

        {inv.earth_spinoff_applications.length > 0 && (
          <More summary="Applications on Earth">
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-muted">
              {inv.earth_spinoff_applications.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </More>
        )}

        {inv.related_psi_ids.length > 0 && (
          <section>
            <div className="label mb-3">Related</div>
            <ul className="flex flex-wrap gap-2">
              {inv.related_psi_ids.map((id) => {
                const rel = byId.get(id)
                return (
                  <li key={id}>
                    {rel ? (
                      <button
                        type="button"
                        onClick={() => onOpen(rel)}
                        title={rel.title}
                        className="num inline-flex h-9 items-center rounded-full border border-line-strong px-3 text-[13px] text-ink hover:border-ink"
                      >
                        {id} · {rel.project_type === 'Ground Investigation' ? 'ground' : 'flight'}
                      </button>
                    ) : (
                      <span className="num inline-flex h-9 items-center px-3 text-[13px] text-faint" title="Not in the current catalog">
                        {id}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <More summary="Video & telemetry">
          <MediaPanel inv={inv} />
        </More>
      </div>
    </Drawer>
  )
}