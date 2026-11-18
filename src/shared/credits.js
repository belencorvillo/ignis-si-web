// ── IGNIS · Third-party asset credits ───────────────────────────────────────
// Shown in the Habitat scene (CC BY requires attribution) and in the footer.
// Checked against the Sketchfab API on 2026-11-14.

const sk = (title, slug, author) => ({
  title,
  url: `https://sketchfab.com/3d-models/${slug}`,
  author,
  authorUrl: null,
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  modified: 'Optimized for the web.',
})

export const MODEL_CREDITS = {
  habitat: {
    title: '“Mars One” Mission – Base',
    url: 'https://sketchfab.com/3d-models/mars-one-mission-base-83ced347037f47aba8473147d65df074',
    author: 'admone',
    authorUrl: 'https://sketchfab.com/admone',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modified: 'Scaled, recoloured for lunar and Martian surfaces, translucency and hazard overlays added.',
  },
  earth: {
    title: '“Earth”',
    url: 'https://skfb.ly/6Uy6v',
    author: 'AirStudios',
    authorUrl: null,
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modified: 'Optimized for the web (compressed textures and geometry).',
  },
  cabin: {
    title: 'Apollo 11 Command Module (Combined)',
    url: 'https://sketchfab.com/3d-models/apollo-11-command-module-combined-372bb6781922471cada4e0a9bd5c61fb',
    author: 'Smithsonian Institution',
    authorUrl: 'https://sketchfab.com/Smithsonian',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    modified: null,
  },

  // Objects shown in the Applications pop-ups (CC BY 4.0, optimized for the web).
  smokeDetector: sk('“Simple smoke detector”', 'simple-smoke-detector-8db756d4c1564f3197f2415ec2ef7fec', 'Sousinho'),
  valve: sk('“Valve II”', 'valve-ii-08a002755c784c889b8818eac15060ee', 'Víctor Hernández'),
  pressureGauge: sk('“Pressure gauge”', 'pressure-gauge-95cf5b63b15549a2a173bb480577b6a9', 'takeboncog'),
  extinguisher: sk('“Fire Extinguisher”', 'fire-extinguisher-5676b179b3b744c0aaae53a3dcea2300', 'Loïc'),
  // Credits read from each model's own glTF metadata (asset.extras).
  firefighter: { ...sk('“Firefighter”', 'firefighter-964fa8b171df41dd8fe6b1305da24812', 'doctortex'), authorUrl: 'https://sketchfab.com/doctortex', modified: 'Arms lowered from the T-pose.' },
  airTank: { ...sk('“Simple Oxygen Tank”', 'simple-oxygen-tank-b549fd81fdae40948cfb4c36df8c230e', 'Blender3D'), authorUrl: 'https://sketchfab.com/Blender3D', modified: null },
}
