import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// All lighting/fog parameters live here, one named constant per variant.
// Shadow budget: at most 2 shadow-casting lights per scene (sun/ceiling
// directional + flashlight). Every pointLight elsewhere has castShadow off.

export const CLASSROOM_LIGHTING = {
  ambient: { color: '#ffe8d6', intensity: 0.22 },
  // Dim overhead light, the only shadow caster in the classroom.
  directional: {
    color: '#fff3d6',
    intensity: 0.35,
    position: [5, 8, 5],
    castShadow: true,
    shadowMapSize: [1024, 1024],
  },
  fog: { color: '#2a1f1a', near: 8, far: 30 },
  flashlight: null,
}

export const OUTDOOR_LIGHTING = {
  ambient: { color: '#8fa0c8', intensity: 0.16 },
  // Cold moonlight.
  directional: {
    color: '#9db4e0',
    intensity: 0.22,
    position: [50, 50, 50],
    castShadow: true,
    shadowMapSize: [2048, 2048],
    shadowCamera: 50,
  },
  // fogExp2 instead of a tighter near/far: density grows smoothly with
  // distance (no visible fog "wall" at the near plane) and swallows everything
  // beyond ~60 m, which hides the ground edge and keeps the dark mood.
  fog: { color: '#0a0f1a', density: 0.025 },
  flashlight: {
    color: '#fff1d0',
    intensity: 60,
    distance: 35,
    angle: 0.45,
    penumbra: 0.6,
    decay: 1.6,
    castShadow: true,
    shadowMapSize: 512,
  },
}

export const HOUSE_INTERIOR_LIGHTING = {
  ambient: { color: '#6a6078', intensity: 0.08 },
  directional: {
    color: '#9db4e0',
    intensity: 0.1,
    position: [50, 50, 50],
    castShadow: false,
    shadowMapSize: [1024, 1024],
    shadowCamera: 50,
  },
  fog: { color: '#05060a', density: 0.05 },
  flashlight: {
    color: '#fff1d0',
    intensity: 45,
    distance: 25,
    angle: 0.5,
    penumbra: 0.6,
    decay: 1.6,
    castShadow: true,
    shadowMapSize: 512,
  },
}

const VARIANTS = {
  classroom: CLASSROOM_LIGHTING,
  outdoor: OUTDOOR_LIGHTING,
  houseInterior: HOUSE_INTERIOR_LIGHTING,
}

const FORWARD = new THREE.Vector3()

/** Spotlight attached to the player's camera ("flashlight"). */
function Flashlight({ params }) {
  const camera = useThree((s) => s.camera)
  const light = useRef()

  useFrame(() => {
    const l = light.current
    if (!l) return
    camera.getWorldDirection(FORWARD)
    l.position.copy(camera.position)
    // The default target is not in the scene graph: update its matrix by hand.
    l.target.position.copy(camera.position).add(FORWARD)
    l.target.updateMatrixWorld()
  })

  return (
    <spotLight
      ref={light}
      color={params.color}
      intensity={params.intensity}
      distance={params.distance}
      angle={params.angle}
      penumbra={params.penumbra}
      decay={params.decay}
      castShadow={params.castShadow}
      shadow-mapSize={[params.shadowMapSize, params.shadowMapSize]}
      shadow-bias={-0.0005}
    />
  )
}

function Lighting({ variant }) {
  const p = VARIANTS[variant]
  const d = p.directional
  const s = d.shadowCamera

  return (
    <>
      <ambientLight color={p.ambient.color} intensity={p.ambient.intensity} />
      <directionalLight
        color={d.color}
        position={d.position}
        intensity={d.intensity}
        castShadow={d.castShadow}
        shadow-mapSize={d.shadowMapSize}
        {...(s && {
          'shadow-camera-left': -s,
          'shadow-camera-right': s,
          'shadow-camera-top': s,
          'shadow-camera-bottom': -s,
        })}
      />
      {p.fog.density !== undefined ? (
        <fogExp2 attach="fog" args={[p.fog.color, p.fog.density]} />
      ) : (
        <fog attach="fog" args={[p.fog.color, p.fog.near, p.fog.far]} />
      )}
      {p.flashlight && <Flashlight key={variant} params={p.flashlight} />}
    </>
  )
}

export default Lighting
