import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, PresentationControls, Stars, useGLTF } from '@react-three/drei'
// "Earth" by AirStudios (CC BY 4.0), optimized for the web — credited on the page and in the footer.
import earthUrl from './earth.glb?url'

const MODEL_RADIUS = 98 // radius of the globe in the model's own units
const SPIN_SPEED = 0.02 // radians per second, slow so Spain stays in view for a while
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Earth() {
  const { scene } = useGLTF(earthUrl)
  const spin = useRef()
  useFrame((_, dt) => {
    if (!reducedMotion && spin.current) spin.current.rotation.y += dt * SPIN_SPEED
  })
  return (
    // Starts with Spain (40° N, 4° W) facing the camera, north up; then turns around its own axis.
    // Angles measured from the model's texture: its north pole is +Y and Spain sits at (-0.74, 0.65, 0.18).
    <group rotation={[0.6857, 1.3386, 0.0202]}>
      <group ref={spin}>
        <Center scale={1 / MODEL_RADIUS}>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  )
}

/** Full-bleed stage for the Applications page: the Earth, draggable, slowly turning. */
export default function EarthStage() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ fov: 30, position: [0, 0, 5] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label="3D Earth">
        <ambientLight intensity={0.35} />
        <directionalLight position={[-4, 2, 3]} intensity={2.4} />
        <Stars radius={60} depth={30} count={1500} factor={2} fade speed={0.3} />
        <Suspense fallback={null}>
          <PresentationControls global={false} cursor speed={1.4} polar={[-0.6, 0.6]} azimuth={[-Infinity, Infinity]} damping={0.25}>
            <Earth />
          </PresentationControls>
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(earthUrl)
