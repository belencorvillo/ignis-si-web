// Local "semantic" search: tokenization + domain synonym expansion + weighted
// field matching. Runs entirely in the browser — no generative model involved.

const SYNONYMS = [
  ['droplet', 'liquid', 'liquid_droplet', 'mdca', 'flex', 'fuel droplet'],
  ['gas', 'gaseous', 'acme', 'diffusion', 'propane', 'butane', 'ethylene', 'methane'],
  ['solid', 'fabric', 'plastic', 'pmma', 'nomex', 'cotton', 'material', 'materials', 'textile'],
  ['smoke', 'aerosol', 'particulate', 'particle', 'detection', 'detector', 'sensor', 'same', 'daft'],
  ['extinguish', 'extinction', 'extinguishment', 'suppression', 'suppressant', 'co2', 'mist', 'water', 'helium', 'diluent', 'nitrogen'],
  ['prevent', 'prevention', 'flammability', 'ignition', 'limit', 'limits'],
  ['moon', 'lunar', 'artemis', 'rover', 'habitat', 'luci'],
  ['mars', 'martian'],
  ['gravity', 'microgravity', '0g', 'partial', 'buoyancy', 'buoyant', 'proxy', 'e-field', 'electric'],
  ['airflow', 'flow', 'ventilation', 'forced', 'spice', 'duct', 'velocity'],
  ['oxygen', 'o2', 'enriched', 'cfi', 'cool', 'cool flame'],
  ['soot', 'radiation', 'luminosity'],
  ['spread', 'flame spread', 'bass', 'saffire'],
]

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with', 'what', 'how', 'is', 'are', 'does', 'do', 'at'])

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[₂]/g, '2')
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

function expand(token) {
  const out = new Set([token])
  for (const group of SYNONYMS) {
    if (group.some((g) => g === token || (token.length > 3 && g.startsWith(token)))) group.forEach((g) => out.add(g))
  }
  return [...out]
}

const FIELDS = [
  ['psi_id', 4],
  ['title', 3],
  ['objectives', 2],
  ['approach', 1.5],
  ['key_findings_summary', 1.5],
  ['hardware_rack', 2],
  ['fuel_phase', 2],
  ['safety_pillars', 2],
  ['fuels_tested', 1.5],
  ['variables_compared', 1],
  ['earth_spinoff_applications', 1],
]

function fieldText(inv, key) {
  const v = inv[key]
  return (Array.isArray(v) ? v.join(' ') : String(v || '')).toLowerCase()
}

/** Returns a relevance score ≥ 0 (0 = no match). */
export function searchScore(inv, query) {
  const tokens = tokenize(query)
  if (!tokens.length) return 1
  let total = 0
  for (const tok of tokens) {
    const variants = expand(tok)
    let best = 0
    for (const [key, w] of FIELDS) {
      const text = fieldText(inv, key)
      for (const v of variants) {
        if (text.includes(v)) best = Math.max(best, v === tok ? w : w * 0.6)
      }
    }
    if (inv.lunar_habitat_relevant && ['moon', 'lunar', 'habitat', 'rover'].includes(tok)) best = Math.max(best, 2)
    total += best
  }
  return total
}
