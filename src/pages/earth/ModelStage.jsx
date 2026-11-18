import { Suspense, useMemo } from 'react'
import { Box3, Color, LinearSRGBColorSpace, MeshStandardMaterial, Quaternion, Sphere, SRGBColorSpace, Vector3 } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Canvas } from '@react-three/fiber'
import { Center, ContactShadows, PresentationControls, useGLTF } from '@react-three/drei'

/**
 * three.js dropped KHR_materials_pbrSpecularGlossiness, so models exported that way
 * (e.g. the firefighter) load untextured. This maps their diffuse colour and texture
 * onto a standard material, which is all these small previews need.
 */
const specGlossPlugin = (parser) => {
  const extOf = (i) => parser.json.materials?.[i]?.extensions?.KHR_materials_pbrSpecularGlossiness
  return {
    name: 'KHR_materials_pbrSpecularGlossiness',
    getMaterialType: (i) => (extOf(i) ? MeshStandardMaterial : null),
    extendMaterialParams(i, params) {
      const ext = extOf(i)
      if (!ext) return Promise.resolve()
      const [r, g, b, a] = ext.diffuseFactor ?? [1, 1, 1, 1]
      params.color = new Color().setRGB(r, g, b, LinearSRGBColorSpace)
      params.opacity = a
      params.metalness = 0
      params.roughness = 1 - 0.6 * (ext.glossinessFactor ?? 1)
      return ext.diffuseTexture ? parser.assignTexture(params, 'map', ext.diffuseTexture, SRGBColorSpace) : Promise.resolve()
    },
  }
}
const extendLoader = (loader) => loader.register(specGlossPlugin)

/** Lowers the arms of a T-posed Mixamo rig so the figure stands naturally. */
function relaxArms(model) {
  model.updateMatrixWorld(true)
  const bone = (re) => {
    let found
    model.traverse((o) => o.isBone && re.test(o.name) && (found = o))
    return found
  }
  for (const side of ['Left', 'Right']) {
    const arm = bone(new RegExp(`${side}Arm(_\\d+)?$`))
    const hand = bone(new RegExp(`${side}Hand(_\\d+)?$`))
    if (!arm || !hand) continue
    const from = hand.getWorldPosition(new Vector3()).sub(arm.getWorldPosition(new Vector3())).normalize()
    const to = new Vector3(0.2 * (Math.sign(from.x) || 1), -1, 0.08).normalize()
    const turn = new Quaternion().setFromUnitVectors(from, to)
    const parent = arm.parent.getWorldQuaternion(new Quaternion()).invert()
    arm.quaternion.copy(parent.multiply(turn).multiply(arm.getWorldQuaternion(new Quaternion())))
    model.updateMatrixWorld(true)
  }
}

function Model({ url, rotation, pose }) {
  const { scene } = useGLTF(url, true, true, extendLoader)
  // Models carry their own node transforms, so measure their real size once loaded.
  const { model, radius } = useMemo(() => {
    // SkeletonUtils.clone keeps rigged models bound to their own copied skeleton.
    const model = cloneSkinned(scene)
    if (pose === 'relaxed') relaxArms(model)
    model.updateMatrixWorld(true)
    const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere())
    return { model, radius: sphere.radius || 1 }
  }, [scene, pose])
  return (
    <group rotation={rotation}>
      <Center scale={1 / radius}>
        <primitive object={model} />
      </Center>
    </group>
  )
}

/** One application's 3D object, centred and still; the user can drag to turn it. Fills its parent. */
export default function ModelStage({ url, rotation = [0, 0, 0], pose, label }) {
  return (
    <Canvas camera={{ fov: 28, position: [0, 0, 5.2] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label={label}>
      <hemisphereLight args={['#dfe8ff', '#1a1c22', 1.1]} />
      <directionalLight position={[-3, 3, 4]} intensity={2.4} />
      <directionalLight position={[4, -2, 2]} intensity={0.8} color="#7aa3f5" />
      <Suspense fallback={null}>
        <PresentationControls global={false} cursor speed={1.3} polar={[-0.4, 0.4]} azimuth={[-Infinity, Infinity]} damping={0.25}>
          <Model url={url} rotation={rotation} pose={pose} />
        </PresentationControls>
        <ContactShadows position={[0, -1.25, 0]} opacity={0.45} scale={4} blur={2.6} far={2} color="#000000" />
      </Suspense>
    </Canvas>
  )
}
