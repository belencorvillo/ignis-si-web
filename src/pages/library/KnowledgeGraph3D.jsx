import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { GROUP_STYLE, isInvestigationTag, nodeInfo, nodeKind, nodeLabel } from './graphStyle'

/*
  Live 3D knowledge graph.

  Data: the nodes and edges embedded in /galaxia_obsidian.html, the file the
  backend (nube.py) already generates — regenerating it updates this view.
  Highlighting: the same file IDs the Library search computes. No search
  logic lives here; this is presentation only.

  Interaction: drag a node and the graph reacts (live force simulation),
  hover to focus a node and its neighbours, drag empty space to orbit,
  click into the scene to enable zoom, click a node to see its information.
*/

const GRAPH_URL = `${import.meta.env.BASE_URL}galaxia_obsidian.html`

/* ── Data ─────────────────────────────────────────────────────────────── */

function parseGraph(html) {
  const grab = (name) => {
    const m = html.match(new RegExp(`${name}\\s*=\\s*new vis\\.DataSet\\((\\[[\\s\\S]*?\\])\\);`))
    return m ? JSON.parse(m[1]) : []
  }
  const nodes = grab('nodes').map((n) => ({ id: String(n.id), label: n.label ?? String(n.id), group: n.group, title: n.title ?? '' }))
  const ids = new Set(nodes.map((n) => n.id))
  const edges = grab('edges')
    .map((e) => ({ from: String(e.from), to: String(e.to) }))
    .filter((e) => ids.has(e.from) && ids.has(e.to))

  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const degree = new Array(nodes.length).fill(0)
  const adjacency = nodes.map(() => new Set())
  edges.forEach((e) => {
    const a = index.get(e.from)
    const b = index.get(e.to)
    degree[a]++
    degree[b]++
    adjacency[a].add(b)
    adjacency[b].add(a)
  })
  const enriched = nodes.map((n, i) => {
    const kind = nodeKind(n)
    const isPsi = isInvestigationTag(n)
    const base = kind !== 'tag' ? 0.2 : isPsi ? 0.15 : 0.1
    return {
      ...n,
      kind,
      isPsi,
      color: GROUP_STYLE[kind].color,
      text: nodeLabel(n),
      info: nodeInfo(n),
      radius: base * (1 + Math.min(degree[i], 10) * 0.05),
    }
  })
  return { nodes: enriched, edges: edges.map((e) => ({ a: index.get(e.from), b: index.get(e.to) })), index, adjacency }
}

/* ── Shared textures ──────────────────────────────────────────────────── */

let glowTexture
function getGlow() {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.15, 'rgba(255,255,255,0.75)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.18)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  glowTexture = new THREE.CanvasTexture(c)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  return glowTexture
}

/* ── Force simulation (runs every frame, reheats on drag) ─────────────── */

// Tuned offline so the graph settles at a radius of ~5 units in ~2–3 s.
const SIM = { repulsion: 0.25, spring: 0.1, rest: 0.8, gravity: 0.06, decay: 0.86, minDist2: 0.3, maxSpeed: 0.25 }

function useSimulation(graph) {
  return useMemo(() => {
    let seed = 11
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    const pos = graph.nodes.map(() => new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(0.35))
    const vel = graph.nodes.map(() => new THREE.Vector3())
    // Settle the layout before the first frame so the graph appears calm (no wobble);
    // the camera intro provides the motion instead.
    const sim = { pos, vel, alpha: 1, pinned: -1 }
    for (let k = 0; k < 420; k++) stepSimulation(sim, graph)
    vel.forEach((v) => v.set(0, 0, 0))
    sim.alpha = 0.06
    return sim
  }, [graph])
}

const tmp = new THREE.Vector3()
function stepSimulation(sim, graph) {
  const { pos, vel } = sim
  const n = pos.length
  const a = sim.alpha
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      tmp.subVectors(pos[i], pos[j])
      const d2 = Math.max(tmp.lengthSq(), SIM.minDist2)
      tmp.multiplyScalar((SIM.repulsion * a) / (d2 * Math.sqrt(d2)))
      vel[i].add(tmp)
      vel[j].sub(tmp)
    }
  }
  for (const e of graph.edges) {
    tmp.subVectors(pos[e.b], pos[e.a])
    const d = tmp.length() || 0.001
    tmp.multiplyScalar(((d - SIM.rest) * SIM.spring * a) / d)
    vel[e.a].add(tmp)
    vel[e.b].sub(tmp)
  }
  for (let i = 0; i < n; i++) {
    if (i === sim.pinned) {
      vel[i].set(0, 0, 0)
      continue
    }
    vel[i].addScaledVector(pos[i], -SIM.gravity * a)
    vel[i].multiplyScalar(SIM.decay)
    if (vel[i].lengthSq() > SIM.maxSpeed * SIM.maxSpeed) vel[i].setLength(SIM.maxSpeed)
    pos[i].add(vel[i])
  }
  // Cool down, but never fully freeze: a little life keeps it breathing.
  sim.alpha = Math.max(sim.alpha * 0.992, 0.06)
}

/* ── Scene pieces ─────────────────────────────────────────────────────── */

const WHITE = new THREE.Color('#ffffff')
const RED = new THREE.Color('#fc3d21')

function GraphNode({ node, groupRef, state, showLabel, onPointerDown, onPointerMove, onPointerUp, onOver, onOut }) {
  const core = useRef()
  const halo = useRef()
  const target = state === 'match' ? 1.8 : state === 'focus' ? 1.45 : state === 'neighbor' ? 1.15 : 1
  const opacity = state === 'dim' ? 0.12 : 1

  useFrame((s, dt) => {
    if (!core.current) return
    const k = 1 - Math.exp(-dt * 10)
    const pulse = state === 'match' ? 1 + 0.12 * Math.sin(s.clock.elapsedTime * 4) : 1
    const next = THREE.MathUtils.lerp(core.current.scale.x, target, k)
    core.current.scale.setScalar(next)
    halo.current.scale.setScalar(node.radius * 5 * next * pulse)
    core.current.material.opacity = THREE.MathUtils.lerp(core.current.material.opacity, opacity, k)
    const haloTarget = { dim: 0.02, idle: 0.14, neighbor: 0.22, focus: 0.32, match: 0.45 }[state]
    halo.current.material.opacity = THREE.MathUtils.lerp(halo.current.material.opacity, haloTarget, k)
  })

  return (
    <group ref={groupRef}>
      <sprite ref={halo}>
        <spriteMaterial map={getGlow()} color={state === 'match' ? RED : node.color} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh
        ref={core}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={onOver}
        onPointerOut={onOut}
      >
        <sphereGeometry args={[node.radius, 32, 24]} />
        <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={node.kind === 'txt' ? 0.75 : 0.22} roughness={0.5} metalness={0.05} transparent opacity={1} />
      </mesh>
      {showLabel && (
        <Html position={[0, node.radius + 0.12, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none', transform: 'translateY(-70%)' }}>
          <span
            className={`block whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] leading-none transition-opacity duration-200 ${
              state === 'match'
                ? 'border-nasa-red/70 bg-ground text-ink'
                : state === 'focus'
                  ? 'border-ink/40 bg-ground text-ink'
                  : state === 'dim'
                    ? 'border-transparent bg-transparent text-faint opacity-30'
                    : 'border-line-strong bg-ground/80 text-muted'
            }`}
          >
            {node.text}
          </span>
        </Html>
      )}
    </group>
  )
}

function GraphScene({ graph, highlightIds, selected, onPick, onArrive, zoom }) {
  const sim = useSimulation(graph)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls)
  const groups = useRef([])
  const [hovered, setHovered] = useState(-1)
  const drag = useRef({ index: -1, plane: new THREE.Plane(), moved: 0, start: new THREE.Vector3() })
  const [dragging, setDragging] = useState(false)

  /* Focus: search matches and the hovered node, plus their neighbours. */
  const matched = useMemo(() => new Set(highlightIds.map((id) => graph.index.get(String(id))).filter((i) => i !== undefined)), [highlightIds, graph])
  const focus = useMemo(() => {
    const f = new Set(matched)
    if (hovered >= 0) f.add(hovered)
    if (selected >= 0) f.add(selected)
    return f
  }, [matched, hovered, selected])
  const neighbors = useMemo(() => {
    const s = new Set()
    focus.forEach((i) => graph.adjacency[i].forEach((j) => !focus.has(j) && s.add(j)))
    return s
  }, [focus, graph])
  const stateOf = (i) => (matched.has(i) ? 'match' : focus.has(i) ? 'focus' : neighbors.has(i) ? 'neighbor' : focus.size ? 'dim' : 'idle')

  /* Edges: fat lines with per-vertex colour gradients. */
  const lines = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(new Float32Array(graph.edges.length * 6))
    geo.setColors(new Float32Array(graph.edges.length * 6))
    const mat = new LineMaterial({ vertexColors: true, linewidth: 1.4, transparent: true, opacity: 0.7, depthWrite: false })
    const obj = new LineSegments2(geo, mat)
    obj.frustumCulled = false
    return obj
  }, [graph])
  useEffect(() => () => {
    lines.geometry.dispose()
    lines.material.dispose()
  }, [lines])
  useEffect(() => {
    lines.material.resolution.set(size.width, size.height)
  }, [lines, size])

  /* Particles flowing along edges (two per edge). */
  const particles = useMemo(() => {
    const count = graph.edges.length * 2
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const mat = new THREE.PointsMaterial({ size: 0.08, map: getGlow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    const phase = Array.from({ length: count }, (_, i) => (i * 0.6180339) % 1)
    return { pts, phase }
  }, [graph])
  useEffect(() => () => {
    particles.pts.geometry.dispose()
    particles.pts.material.dispose()
  }, [particles])

  /* Recolour edges and particles when focus changes. */
  useEffect(() => {
    const ec = lines.geometry.attributes.instanceColorStart.data
    const pc = particles.pts.geometry.attributes.color
    const ca = new THREE.Color()
    const cb = new THREE.Color()
    graph.edges.forEach((e, i) => {
      const hot = focus.has(e.a) || focus.has(e.b)
      const redHot = matched.has(e.a) || matched.has(e.b)
      ca.set(graph.nodes[e.a].color).lerp(WHITE, 0.25)
      cb.set(graph.nodes[e.b].color).lerp(WHITE, 0.25)
      if (redHot) {
        ca.copy(RED)
        cb.copy(RED).lerp(WHITE, 0.2)
      } else if (hot) {
        ca.lerp(WHITE, 0.4)
        cb.lerp(WHITE, 0.4)
      }
      const f = focus.size ? (hot ? 0.95 : 0.1) : 0.5
      ec.array.set([ca.r * f, ca.g * f, ca.b * f, cb.r * f, cb.g * f, cb.b * f], i * 6)
      const pf = focus.size ? (hot ? 0.8 : 0.02) : 0.35
      pc.setXYZ(i * 2, ca.r * pf, ca.g * pf, ca.b * pf)
      pc.setXYZ(i * 2 + 1, cb.r * pf, cb.g * pf, cb.b * pf)
    })
    ec.needsUpdate = true
    pc.needsUpdate = true
  }, [lines, particles, graph, focus, matched])

  /* Camera flights: the opening glide-out and the fly-to on node click. */
  const flight = useRef(null)
  const homeDist = useRef(null)
  const prevSelected = useRef(-1)
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    if (!controls || homeDist.current == null) return
    const currentDist = camera.position.distanceTo(controls.target)
    if (selected >= 0) {
      flight.current = { t: 0, dur: 1.1, fromTarget: controls.target.clone(), fromDist: currentDist, toDist: 3.2, toNode: selected }
    } else if (prevSelected.current >= 0) {
      flight.current = { t: 0, dur: 1.1, fromTarget: controls.target.clone(), fromDist: currentDist, toDist: homeDist.current, toNode: -1 }
    }
    prevSelected.current = selected
  }, [selected, controls, camera])

  /* Per-frame: physics, node positions, edge and particle geometry, camera focus. */
  const look = useMemo(() => new THREE.Vector3(), [])
  useFrame((s, delta) => {
    // Advance by elapsed time (60 steps/s), so slow or throttled frames don't slow the layout.
    const steps = Math.min(10, Math.max(1, Math.round(delta * 60)))
    for (let k = 0; k < steps; k++) stepSimulation(sim, graph)
    const { pos } = sim
    groups.current.forEach((g, i) => g && g.position.copy(pos[i]))

    const ep = lines.geometry.attributes.instanceStart.data
    const pp = particles.pts.geometry.attributes.position
    const t = s.clock.elapsedTime
    graph.edges.forEach((e, i) => {
      const A = pos[e.a]
      const B = pos[e.b]
      ep.array.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6)
      for (let k = 0; k < 2; k++) {
        const u = (t * 0.22 + particles.phase[i * 2 + k]) % 1
        pp.setXYZ(i * 2 + k, A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, A.z + (B.z - A.z) * u)
      }
    })
    ep.needsUpdate = true
    pp.needsUpdate = true

    if (controls) {
      if (matched.size) {
        look.set(0, 0, 0)
        matched.forEach((i) => look.add(pos[i]))
        look.divideScalar(matched.size)
      } else look.set(0, 0, 0)

      // First frame: start right inside the graph and glide out to the resting distance.
      if (homeDist.current == null) {
        homeDist.current = camera.position.distanceTo(controls.target)
        tmpDir.subVectors(camera.position, controls.target).normalize()
        camera.position.copy(controls.target).addScaledVector(tmpDir, 2.2)
        flight.current = { t: 0, dur: 2.6, fromTarget: controls.target.clone(), fromDist: 2.2, toDist: homeDist.current, toNode: -1 }
      }

      const f = flight.current
      if (f) {
        f.t = Math.min(1, f.t + delta / f.dur)
        const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2 // easeInOutCubic
        tmpDir.subVectors(camera.position, controls.target).normalize()
        controls.target.lerpVectors(f.fromTarget, f.toNode >= 0 ? pos[f.toNode] : look, e)
        camera.position.copy(controls.target).addScaledVector(tmpDir, THREE.MathUtils.lerp(f.fromDist, f.toDist, e))
        if (f.t >= 1) {
          if (f.toNode >= 0) onArrive?.(f.toNode)
          flight.current = null
        }
      } else if (selected >= 0) {
        controls.target.lerp(pos[selected], 0.1) // keep the selected node centred as the graph breathes
      } else {
        controls.target.lerp(look, 0.04)
      }
      controls.autoRotate = hovered < 0 && selected < 0 && !dragging && !flight.current
      controls.update()
    }
  })

  /* Dragging: move the node on a camera-facing plane; the springs do the rest. */
  const onDown = (i) => (e) => {
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const d = drag.current
    d.index = i
    d.moved = 0
    d.start.copy(sim.pos[i])
    d.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmp).clone(), sim.pos[i])
    sim.pinned = i
    sim.alpha = Math.max(sim.alpha, 0.5)
    if (controls) controls.enabled = false
    setDragging(true)
    document.body.style.cursor = 'grabbing'
  }
  const onMove = (i) => (e) => {
    const d = drag.current
    if (d.index !== i) return
    e.stopPropagation()
    const hit = new THREE.Vector3()
    if (e.ray.intersectPlane(d.plane, hit)) {
      sim.pos[i].copy(hit)
      d.moved = Math.max(d.moved, hit.distanceTo(d.start))
      sim.alpha = Math.max(sim.alpha, 0.35)
    }
  }
  const onUp = (i) => (e) => {
    const d = drag.current
    if (d.index !== i) return
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    if (d.moved < 0.08) onPick(i)
    d.index = -1
    sim.pinned = -1
    if (controls) controls.enabled = true
    setDragging(false)
    document.body.style.cursor = hovered >= 0 ? 'grab' : ''
  }

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  return (
    <>
      <fog attach="fog" args={['#08090c', 9, 26]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 7]} intensity={1.8} />
      <directionalLight position={[-6, -4, -5]} intensity={0.5} color="#7aa3f5" />
      <Stars radius={60} depth={25} count={1400} factor={2.2} fade speed={0.4} />
      <primitive object={lines} />
      <primitive object={particles.pts} />
      {graph.nodes.map((node, i) => {
        const state = stateOf(i)
        // During a search only the highlighted nodes (and the one you point at) carry a label,
        // so the result reads clearly; otherwise investigations and the hovered neighbourhood do.
        const showLabel = matched.size
          ? state === 'match' || i === hovered || i === selected
          : state === 'focus' || state === 'neighbor' // only around the hovered / selected node
        return (
          <GraphNode
            key={node.id}
            node={node}
            groupRef={(el) => (groups.current[i] = el)}
            state={state}
            showLabel={showLabel}
            onPointerDown={onDown(i)}
            onPointerMove={onMove(i)}
            onPointerUp={onUp(i)}
            onOver={(e) => {
              e.stopPropagation()
              setHovered(i)
              if (!dragging) document.body.style.cursor = 'grab'
            }}
            onOut={() => {
              setHovered((h) => (h === i ? -1 : h))
              if (!dragging) document.body.style.cursor = ''
            }}
          />
        )
      })}
      <OrbitControls makeDefault enableDamping enablePan={false} enableZoom={zoom} minDistance={4} maxDistance={26} autoRotateSpeed={0.45} />
    </>
  )
}

/** Thin ring marking the node the camera has flown to (it sits at the canvas centre). */
function TargetRing() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -ml-7 -mt-7 h-14 w-14" aria-hidden="true">
      <span className="ring-in block h-full w-full rounded-full border border-ink/50" />
    </div>
  )
}

export default function KnowledgeGraph3D({ highlightIds = [], matchInfo = {}, onFocus, cameraZ = 10.8 }) {
  const [graph, setGraph] = useState(null)
  const [selected, setSelected] = useState(-1)
  // The label appears only once the camera has finished flying to the node.
  const [arrived, setArrived] = useState(-1)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(GRAPH_URL)
      .then((r) => r.text())
      .then((html) => alive && setGraph(parseGraph(html)))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!graph || selected < 0 || arrived !== selected) {
      onFocus?.(null)
      return
    }
    const node = graph.nodes[selected]
    onFocus?.({
      node,
      kindLabel: node.isPsi ? 'Investigation' : GROUP_STYLE[node.kind].label,
      match: matchInfo[node.id],
      neighbors: [...graph.adjacency[selected]].map((j) => ({ index: j, id: graph.nodes[j].id, text: graph.nodes[j].text, color: graph.nodes[j].color })),
      pick: (j) => pickRef.current(j),
      close: () => closeRef.current(),
    })
  }, [graph, selected, arrived, matchInfo, onFocus])

  const pick = (i) => {
    if (i === selected) return // already there: keep the label open
    setArrived(-1)
    setSelected(i)
  }
  const close = () => {
    setArrived(-1)
    setSelected(-1)
  }
  // Stable handles for the page-side details panel.
  const pickRef = useRef(pick)
  const closeRef = useRef(close)
  useLayoutEffect(() => {
    pickRef.current = pick
    closeRef.current = close
  })

  return (
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 48%, #12151d 0%, #0b0d12 45%, #08090c 80%)' }}
      onPointerDown={() => setZoom(true)}
      onPointerLeave={() => setZoom(false)}
    >
      {error && <p className="flex h-full items-center justify-center text-[14px] text-faint">The knowledge graph could not be loaded.</p>}
      {!error && !graph && <p className="label flex h-full items-center justify-center">Loading knowledge graph…</p>}
      {graph && graph.nodes.length > 0 && (
        <Canvas
          camera={{ position: [0, 1.3, cameraZ], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          aria-label="3D knowledge graph of PSI raw files and tags"
          onPointerMissed={close}
        >
          <GraphScene graph={graph} highlightIds={highlightIds} selected={selected} onPick={pick} onArrive={setArrived} zoom={zoom} />
        </Canvas>
      )}
      {/* Soft vignette to frame the scene */}
      <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: 'inset 0 0 120px 40px #08090c' }} aria-hidden="true" />
      {graph && selected >= 0 && arrived === selected && <TargetRing />}
    </div>
  )
}
