import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, Edges, Html, OrbitControls, Sparkles, Stars, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { isLunarZone } from '../../shared/catalog'
import { hazardLevel } from './simulation'

const MODEL_URLS = {
  cabin: import.meta.env.BASE_URL + 'models/command_module.glb',
  habitat: import.meta.env.BASE_URL + 'models/surface_habitat.glb',
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Derived, normalized flame-shape drivers from the simulator sliders. */
function flameTargets({ o2, pressure, airflow, gravity }) {
  return {
    buoy: Math.sqrt(clamp01(gravity)), // 0g → 0, 1/6g → 0.4, 3/8g → 0.62, 1g → 1
    flow: clamp01(airflow / 30),
    o2n: clamp01((o2 - 21) / 64),
    pn: clamp01((pressure - 4.3) / 10.4),
    invert: smoothstep(70, 85, o2),
  }
}

/* ═══════════════════════════ Procedural flame ═══════════════════════════ */

const flameVertex = /* glsl */ `
  uniform float uTime;
  uniform float uBuoy;
  uniform float uFlow;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vH;
  void main() {
    vec3 p = position;
    float h = clamp((p.y + 1.0) * 0.5, 0.0, 1.0);
    float flick = sin(p.y * 6.0 + uTime * 9.0) * 0.035 + sin(p.x * 7.0 - uTime * 6.5) * 0.025;
    p += normal * flick * (0.25 + uBuoy + uFlow);
    float up = max(p.y, 0.0);
    p.y += up * up * uBuoy * 2.4 + up * uBuoy * 0.7;
    float taper = 1.0 - uBuoy * 0.7 * smoothstep(0.15, 1.0, h);
    p.x *= taper;
    p.z *= taper;
    float hh = p.y + 1.0;
    p.x += uFlow * (hh * hh * 0.2 + max(p.x, 0.0) * 1.1);
    p.z *= 1.0 - uFlow * 0.25;
    vH = h;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const flameFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uInvert;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vH;
  void main() {
    float fres = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir)));
    float normalA = pow(1.0 - fres, 1.4);
    float invA = pow(fres, 1.1) * 1.3;
    float a = mix(normalA, invA, uInvert);
    float t = mix(fres, 1.0 - fres, uInvert);
    vec3 col = mix(uCore, uEdge, clamp(t + vH * 0.25, 0.0, 1.0)) * uIntensity;
    gl_FragColor = vec4(col, clamp(a * uOpacity, 0.0, 1.0));
  }
`

const LAYERS = [
  { scale: 1.0, opacity: 0.55 },
  { scale: 0.78, opacity: 0.7 },
  { scale: 0.5, opacity: 0.95 },
]

const C = {
  edge0: new THREE.Color('#2f6bff'),
  core0: new THREE.Color('#a7c8ff'),
  edge1: new THREE.Color('#ff5a0a'),
  core1: new THREE.Color('#ffe7a0'),
  white: new THREE.Color('#ffffff'),
  inv: new THREE.Color('#7df9ff'),
}

function ProceduralFlame({ params }) {
  const targetRef = useRef(flameTargets(params))
  useLayoutEffect(() => {
    targetRef.current = flameTargets(params)
  }, [params])
  const cur = useRef(null)
  const groupRef = useRef()
  const lightRef = useRef()
  const scratch = useMemo(() => ({ edge: new THREE.Color(), core: new THREE.Color() }), [])

  const materials = useMemo(
    () =>
      LAYERS.map(
        (l) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uBuoy: { value: 0 },
              uFlow: { value: 0 },
              uCore: { value: new THREE.Color() },
              uEdge: { value: new THREE.Color() },
              uIntensity: { value: 1 },
              uOpacity: { value: l.opacity },
              uInvert: { value: 0 },
            },
            vertexShader: flameVertex,
            fragmentShader: flameFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [],
  )
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const k = 1 - Math.exp(-dt * 3.5)
    const t = targetRef.current
    if (!cur.current) cur.current = { ...t }
    const s = cur.current
    for (const key of Object.keys(t)) s[key] += (t[key] - s[key]) * k

    scratch.edge.copy(C.edge0).lerp(C.edge1, s.buoy)
    scratch.core.copy(C.core0).lerp(C.core1, s.buoy).lerp(C.white, s.o2n * 0.55)
    scratch.edge.lerp(C.inv, s.invert * 0.6)
    const intensity = (0.45 + 1.25 * s.o2n + 0.25 * s.pn) * (0.55 + 0.45 * Math.max(s.buoy, s.flow))

    materials.forEach((m, i) => {
      const u = m.uniforms
      u.uTime.value = state.clock.elapsedTime + i * 0.7
      u.uBuoy.value = s.buoy
      u.uFlow.value = s.flow
      u.uInvert.value = s.invert
      u.uCore.value.copy(scratch.core)
      u.uEdge.value.copy(scratch.edge)
      u.uIntensity.value = intensity * (i === LAYERS.length - 1 ? 1.25 : 1)
    })

    if (groupRef.current) groupRef.current.scale.setScalar(0.55 + 0.45 * s.o2n)
    if (lightRef.current) {
      lightRef.current.color.copy(scratch.edge).lerp(scratch.core, 0.5)
      lightRef.current.intensity = 6 + 30 * intensity * (0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 13))
    }
  })

  return (
    <group>
      <group ref={groupRef}>
        {LAYERS.map((l, i) => (
          <mesh key={i} scale={l.scale} material={materials[i]}>
            <sphereGeometry args={[1, 64, 48]} />
          </mesh>
        ))}
      </group>
      <pointLight ref={lightRef} position={[0, 0.6, 0]} distance={9} decay={1.6} />
    </group>
  )
}

const SOOT_COUNT = 700

function SootParticles({ params }) {
  const targetRef = useRef(flameTargets(params))
  useLayoutEffect(() => {
    targetRef.current = flameTargets(params)
  }, [params])
  const pointsRef = useRef()

  const data = useMemo(() => {
    const positions = new Float32Array(SOOT_COUNT * 3)
    const colors = new Float32Array(SOOT_COUNT * 3)
    const jitter = new Float32Array(SOOT_COUNT * 3)
    const ages = new Float32Array(SOOT_COUNT)
    const lifes = new Float32Array(SOOT_COUNT)
    const soot = new THREE.Color('#5b4636')
    const ember = new THREE.Color('#ff9a4a')
    const c = new THREE.Color()
    for (let i = 0; i < SOOT_COUNT; i++) {
      positions[i * 3 + 1] = 1000
      ages[i] = Math.random() * 3
      lifes[i] = 1.5 + Math.random() * 2.5
      jitter[i * 3] = (Math.random() - 0.5) * 0.4
      jitter[i * 3 + 1] = (Math.random() - 0.5) * 0.4
      jitter[i * 3 + 2] = (Math.random() - 0.5) * 0.4
      c.copy(soot).lerp(ember, Math.random() < 0.25 ? 0.9 : Math.random() * 0.3)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    return { positions, colors, jitter, ages, lifes }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const { buoy, flow, o2n } = targetRef.current
    const active = clamp01(0.04 + flow * 0.95 + buoy * 0.45 + o2n * 0.15)
    const { positions: p, jitter: j, ages, lifes } = data
    const scale = 0.55 + 0.45 * o2n
    for (let i = 0; i < SOOT_COUNT; i++) {
      ages[i] += dt
      const i3 = i * 3
      if (ages[i] > lifes[i]) {
        ages[i] = 0
        if (Math.random() < active) {
          const th = Math.random() * Math.PI * 2
          const r = 0.4 * scale
          p[i3] = Math.cos(th) * r + flow * 0.5
          p[i3 + 1] = (0.2 + buoy * 1.2) * scale + Math.random() * 0.3
          p[i3 + 2] = Math.sin(th) * r
        } else {
          p[i3 + 1] = 1000
          continue
        }
      }
      if (p[i3 + 1] > 500) continue
      p[i3] += (flow * 2.6 + j[i3] * (0.3 + (1 - flow))) * dt
      p[i3 + 1] += (buoy * 1.5 + j[i3 + 1] * 0.5) * dt
      p[i3 + 2] += j[i3 + 2] * 0.5 * dt
      if (Math.abs(p[i3]) > 3.2 || p[i3 + 1] > 3 || Math.hypot(p[i3], p[i3 + 2]) > 3.2) p[i3 + 1] = 1000
    }
    if (pointsRef.current) pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.85} depthWrite={false} sizeAttenuation />
    </points>
  )
}

const FLOW_ARROWS = 16

function FlowField({ airflow, color = '#c9d6f2', box = [5, 3, 3] }) {
  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(
    () => Array.from({ length: FLOW_ARROWS }, () => [Math.random(), (Math.random() - 0.5) * box[1], (Math.random() - 0.5) * box[2]]),
    [box],
  )
  useFrame((state) => {
    if (!ref.current) return
    const speed = airflow / 30
    const t = state.clock.elapsedTime
    seeds.forEach(([phase, y, z], i) => {
      const x = (((phase + t * speed * 0.35) % 1) - 0.5) * box[0]
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, -Math.PI / 2)
      dummy.scale.setScalar(speed > 0.01 ? 0.6 + speed : 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, FLOW_ARROWS]} frustumCulled={false}>
      <coneGeometry args={[0.025, 0.12, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} />
    </instancedMesh>
  )
}

const CHAMBER_POSTS = [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * Math.PI * 2)

function ChamberScene({ params, zoom }) {
  // Transparent background so the page's orbit lines read through.
  return (
    <>
      <ambientLight intensity={0.25} />
      <Stars radius={60} depth={30} count={900} factor={2} fade speed={0.3} />
      {/* Minimal test chamber: two rings + six hairline posts */}
      {[-2.4, 2.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.6, 0.008, 6, 128]} />
          <meshBasicMaterial color="#f2efe9" transparent opacity={0.28} />
        </mesh>
      ))}
      {CHAMBER_POSTS.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6]}>
          <cylinderGeometry args={[0.006, 0.006, 4.8, 4]} />
          <meshBasicMaterial color="#f2efe9" transparent opacity={0.12} />
        </mesh>
      ))}
      {/* Porous spherical burner + fuel feed (ACME-style) */}
      <mesh>
        <sphereGeometry args={[0.1, 24, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -1.3, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.3, 12]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      <group scale={1.5}>
        <ProceduralFlame params={params} />
        <SootParticles params={params} />
      </group>
      <FlowField airflow={params.airflow} box={[5, 4, 4]} />
      <OrbitControls makeDefault enableDamping enableZoom={zoom} minDistance={4} maxDistance={18} enablePan={false} autoRotate autoRotateSpeed={0.35} />
    </>
  )
}

/* ═══════════════════════════ GLB-based scenes ═══════════════════════════ */

// Surface look. The habitat GLB uses unlit, texture-baked materials, so lights
// can't recolour it. Instead every material's texture is desaturated in the
// shader (uSurfaceDesat = 1 on the Moon, 0 on Mars) towards a cool lunar grey.
const SURFACE_UNIFORMS = { uSurfaceDesat: { value: 0 }, uSurfaceTint: { value: new THREE.Color('#c3c8d1') } }
const DESAT_MAP_FRAGMENT = THREE.ShaderChunk.map_fragment.replace(
  'diffuseColor *= sampledDiffuseColor;',
  `float ignisLum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( ignisLum ) * uSurfaceTint, uSurfaceDesat );
  diffuseColor *= sampledDiffuseColor;`,
)

function patchSurfaceShader(material) {
  if (material.userData.ignisSurfacePatched) return
  material.userData.ignisSurfacePatched = true
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfaceDesat = SURFACE_UNIFORMS.uSurfaceDesat
    shader.uniforms.uSurfaceTint = SURFACE_UNIFORMS.uSurfaceTint
    shader.fragmentShader =
      `uniform float uSurfaceDesat;\nuniform vec3 uSurfaceTint;\n` + shader.fragmentShader.replace('#include <map_fragment>', DESAT_MAP_FRAGMENT)
  }
  material.customProgramCacheKey = () => 'ignis-surface'
  material.needsUpdate = true
}
const MARS_TINT = new THREE.Color('#ffc890')
const WHITE = new THREE.Color('#ffffff')
const HAZARD_ORANGE = new THREE.Color('#ff5a1f')

function forEachMaterial(mesh, fn) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  mats.forEach((m) => m && fn(m))
}

/**
 * Loads a GLB and normalizes it to `size` scene units.
 * With `focusCore`, meshes far larger than the typical part (e.g. a terrain
 * skirt) are excluded from the fit and treated as terrain, so the camera,
 * scale and hazard overlay frame the actual habitat modules.
 */
function NormalizedModel({ url, size = 5, xray = false, focusCore = false, terrain = null, hazardGlow = false, onFit }) {
  const { scene } = useGLTF(url)

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true)
    const meshes = []
    scene.traverse((o) => o.isMesh && meshes.push(o))
    const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m))
    const sizes = boxes.map((bx) => {
      const v = bx.getSize(new THREE.Vector3())
      return Math.max(v.x, v.y, v.z)
    })
    const median = [...sizes].sort((x, y) => x - y)[Math.floor(sizes.length / 2)] || 1
    const core = new THREE.Box3()
    const terrainMeshes = []
    const coreMeshes = []
    meshes.forEach((m, i) => {
      if (focusCore && sizes[i] > median * 5) terrainMeshes.push(m)
      else {
        core.union(boxes[i])
        coreMeshes.push(m)
      }
    })
    if (core.isEmpty()) core.setFromObject(scene)
    const s = core.getSize(new THREE.Vector3())
    const c = core.getCenter(new THREE.Vector3())
    const k = size / Math.max(s.x, s.y, s.z, 1e-6)
    return { scale: k, center: c, dims: [s.x * k, s.y * k, s.z * k], terrainMeshes, coreMeshes }
  }, [scene, size, focusCore])

  useLayoutEffect(() => {
    onFit?.({ dims: fit.dims, hasTerrain: fit.terrainMeshes.length > 0 })
  }, [fit, onFit])

  // X-ray: translucent hull to reveal interior indicators (never applied to terrain).
  useEffect(() => {
    const skip = new Set(fit.terrainMeshes)
    scene.traverse((o) => {
      if (!o.isMesh || skip.has(o)) return
      forEachMaterial(o, (m) => {
        if (!m.userData.ignisOrig) m.userData.ignisOrig = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }
        const orig = m.userData.ignisOrig
        m.transparent = xray ? true : orig.transparent
        m.opacity = xray ? Math.min(orig.opacity, 0.28) : orig.opacity
        m.depthWrite = xray ? false : orig.depthWrite
        m.needsUpdate = true
      })
    })
  }, [scene, xray, fit])

  // Surface look: grey lunar regolith (whole model desaturated) vs. warm Martian soil.
  useEffect(() => {
    if (!terrain) return
    scene.traverse((o) => o.isMesh && forEachMaterial(o, patchSurfaceShader))
    SURFACE_UNIFORMS.uSurfaceDesat.value = terrain === 'moon' ? 1 : 0
    fit.terrainMeshes.forEach((mesh) => forEachMaterial(mesh, (m) => m.color?.copy(terrain === 'mars' ? MARS_TINT : WHITE)))
  }, [scene, fit, terrain])

  // Hazard glow: pulse module materials toward orange (works for lit and unlit materials).
  const glowOn = useRef(false)
  useFrame((state) => {
    if (!hazardGlow && !glowOn.current) return
    const pulse = hazardGlow ? 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3)) : 0
    fit.coreMeshes.forEach((mesh) =>
      forEachMaterial(mesh, (m) => {
        if (!m.color) return
        if (!m.userData.ignisColor) m.userData.ignisColor = m.color.clone()
        m.color.copy(m.userData.ignisColor).lerp(HAZARD_ORANGE, pulse)
      }),
    )
    glowOn.current = hazardGlow
  })

  if (!focusCore) {
    return (
      <group scale={fit.scale}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    )
  }
  return (
    <group scale={fit.scale}>
      <group position={[-fit.center.x, -fit.center.y, -fit.center.z]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

/** Rotation (radians) that turns the command module's hatch window towards the camera. */
const CABIN_YAW = 0.55

const HAZARD_SPOTS = [
  [0.22, 0.08, 0.12],
  [-0.18, -0.12, 0.16],
  [0.02, 0.2, -0.18],
  [-0.05, -0.02, -0.05],
]

function HazardMarkers({ dims, color, rate }) {
  const refs = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const pulse = 0.5 + 0.5 * Math.sin(t * rate + i * 1.7)
      m.scale.setScalar(0.12 + pulse * 0.14)
      m.material.opacity = 0.35 + pulse * 0.55
    })
  })
  return HAZARD_SPOTS.map((p, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} position={[p[0] * dims[0], p[1] * dims[1], p[2] * dims[2]]}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  ))
}

function CabinScene({ params, xray, zoom }) {
  const [dims, setDims] = useState([5, 4, 4])
  const onFit = useCallback((f) => setDims(f.dims), [])
  const hz = hazardLevel(params)
  const rate = { nominal: 1.5, watch: 2.5, elevated: 4, critical: 7 }[hz.level]
  return (
    <>
      <color attach="background" args={['#08090c']} />
      <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.3} />
      <hemisphereLight args={['#cfe3ff', '#1e293b', 1.1]} />
      <directionalLight position={[6, 8, 5]} intensity={2.2} />
      <directionalLight position={[-6, -2, -4]} intensity={0.6} color="#7aa3f5" />
      {/* Yaw only, so the hatch window faces the default camera; size and tilt unchanged. */}
      <group rotation={[0, CABIN_YAW, 0]}>
        <NormalizedModel url={MODEL_URLS.cabin} size={5} xray={xray} onFit={onFit} />
      </group>
      <HazardMarkers dims={dims} color={hz.color} rate={rate} />
      <pointLight position={[0, 0, 0]} color={hz.color} intensity={hz.level === 'nominal' ? 2 : 12} distance={6} />
      <FlowField airflow={params.airflow} color="#7aa3f5" box={[dims[0] * 0.8, dims[1] * 0.5, dims[2] * 0.5]} />
      <OrbitControls makeDefault enableDamping enableZoom={zoom} minDistance={1.5} maxDistance={16} enablePan={false} />
    </>
  )
}

const SURFACE = {
  moon: { bg: '#05070c', ground: '#5f6670', light: '#e3ebf7', fill: '#94a3b8', dust: '#cbd5e1', name: 'Lunar surface (1/6g)' },
  mars: { bg: '#140904', ground: '#8a4a22', light: '#ffc58a', fill: '#c2410c', dust: '#f59e0b', name: 'Martian surface (3/8g)' },
}

function HabitatHazardOverlay({ dims }) {
  // Outline only: a filled box would tint the whole surface orange.
  const ref = useRef()
  useFrame((state) => {
    const line = ref.current?.children[0]
    if (line?.material) line.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3))
  })
  return (
    <mesh ref={ref} scale={[dims[0] * 1.08, dims[1] * 1.12, dims[2] * 1.08]}>
      <boxGeometry />
      <meshBasicMaterial visible={false} />
      <Edges color="#ff8c42" transparent />
    </mesh>
  )
}

function HabitatScene({ params, xray, zoom }) {
  const [fit, setFit] = useState({ dims: [5, 2, 5], hasTerrain: false })
  const dims = fit.dims
  const isMars = params.gravity > 0.27
  const surface = isMars ? SURFACE.mars : SURFACE.moon
  const hazard = isLunarZone(params)
  return (
    <>
      <color attach="background" args={[surface.bg]} />
      {surface === SURFACE.moon && <Stars radius={80} depth={40} count={3000} factor={3} fade speed={0.2} />}
      <fog attach="fog" args={[surface.bg, 14, 40]} />
      <hemisphereLight args={[surface.light, surface.ground, 0.8]} />
      <directionalLight position={[8, 10, 4]} intensity={2.6} color={surface.light} />
      <ambientLight intensity={0.25} color={surface.fill} />
      <NormalizedModel url={MODEL_URLS.habitat} size={6} xray={xray} focusCore terrain={isMars ? 'mars' : 'moon'} hazardGlow={hazard} onFit={setFit} />
      {!fit.hasTerrain && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -dims[1] / 2 - 0.01, 0]}>
          <circleGeometry args={[30, 64]} />
          <meshStandardMaterial color={surface.ground} roughness={1} />
        </mesh>
      )}
      <Sparkles count={80} scale={[14, 3, 14]} size={2} speed={0.2} color={surface.dust} opacity={0.5} />
      {hazard && <HabitatHazardOverlay dims={dims} />}
      <OrbitControls makeDefault enableDamping enableZoom={zoom} minDistance={1.5} maxDistance={16} enablePan={false} maxPolarAngle={Math.PI / 2 - 0.05} />
    </>
  )
}

/* ═══════════════════════════ Shell & overlays ═══════════════════════════ */

function LoadingOverlay() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="label num">Loading model {progress.toFixed(0)}%</span>
    </div>
  )
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <Html center>
          <p className="w-64 text-center text-[14px] text-muted">This 3D model could not load. Try the flame view.</p>
        </Html>
      )
    return this.props.children
  }
}

/** Full-bleed 3D stage. Overlays (HUD, controls) are composed by the parent. */
const CAMERAS = {
  chamber: { position: [6.6, 2, 9.6], fov: 40 },
  cabin: { position: [4.8, 2.57, 5.66], fov: 45 }, // = previous framing × 0.95³ (three mouse-wheel zoom steps)
  habitat: { position: [3.2, 1.6, 4.2], fov: 45 },
}

/**
 * Full-bleed 3D stage. Overlays (HUD, controls) are composed by the parent.
 * Wheel/pinch zoom only activates after the user clicks into the scene, so the
 * page keeps scrolling normally until then.
 */
export default function Viewport3D({ params, mode, xray = true }) {
  const [zoom, setZoom] = useState(false)
  return (
    <div className="absolute inset-0" onPointerDown={() => setZoom(true)} onPointerLeave={() => setZoom(false)}>
      <Canvas key={mode} camera={CAMERAS[mode]} dpr={[1, 2]} gl={{ antialias: true }} aria-label="3D view of the selected scene">
        <SceneErrorBoundary>
          <Suspense fallback={null}>
            {mode === 'chamber' && <ChamberScene params={params} zoom={zoom} />}
            {mode === 'cabin' && <CabinScene params={params} xray={xray} zoom={zoom} />}
            {mode === 'habitat' && <HabitatScene params={params} xray={xray} zoom={zoom} />}
          </Suspense>
        </SceneErrorBoundary>
      </Canvas>
      <LoadingOverlay />
    </div>
  )
}
