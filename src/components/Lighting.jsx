import { useEffect, useMemo } from 'react'
import { createPortal, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLightFlicker } from '../utils/flicker'

// All lighting/fog parameters live here, one named constant per variant.
// Shadow budget: at most 2 shadow-casting lights per scene (sun/ceiling
// directional + flashlight; IKEA: directional only). Every pointLight elsewhere has castShadow off.

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
  // Weak cold fill from behind the player so characters read against the
  // dark ground without lifting the whole scene. No shadow.
  fill: { color: '#6f86c0', intensity: 0.9, position: [-30, 12, 40] },
  flashlight: {
    color: '#fff1d0',
    intensity: 60,
    distance: 35,
    angle: 0.45,
    penumbra: 0.6,
    decay: 1.6,
    castShadow: true,
    shadowMapSize: 512,
    shadowBias: -0.0005,
    shadowNormalBias: 0.02,
  },
}

// Weak warm fill in front of the outdoor house door (House.jsx) so the door
// reads (BENG-13). Never a shadow caster: the budget is max 2 per scene.
export const DOOR_FILL_LIGHT = {
  color: '#ffc86b',
  intensity: 6,
  distance: 10,
  decay: 2,
  position: [0, 3.5, 10], // house-local, in front of the door
}

export const HOUSE_INTERIOR_LIGHTING = {
  // Furniture and doors must read without the flashlight; the mood comes from
  // the contrast against the flashlight cone, not from black surroundings.
  ambient: { color: '#9a92b4', intensity: 0.75 },
  directional: {
    color: '#9db4e0',
    intensity: 0.2,
    position: [50, 50, 50],
    castShadow: false,
  },
  fog: { color: '#0b0c14', density: 0.008 },
  flashlight: {
    color: '#fff1d0',
    intensity: 45,
    distance: 25,
    angle: 0.5,
    penumbra: 0.6,
    decay: 1.6,
    castShadow: true,
    shadowMapSize: 512,
    shadowBias: -0.0005,
    shadowNormalBias: 0.02,
  },
}

// IKEA restaurant: bright cold fluorescent look. The only shadow caster is the directional
// (the player has no flashlight here). The kitchen light is a shadowless point light that
// flickers lightly (useLightFlicker; off in the frozen test build).
export const IKEA_LIGHTING = {
  ambient: { color: '#dfe8f5', intensity: 0.55 },
  directional: {
    color: '#e6f0ff',
    intensity: 0.5,
    position: [10, 20, 8],
    castShadow: true,
    shadowMapSize: [1024, 1024],
    shadowCamera: 32,
  },
  fog: { color: '#b9c4d2', near: 30, far: 80 },
  flashlight: null,
  kitchenLight: { color: '#cfe6ff', intensity: 60, distance: 22, decay: 2, position: [-16, 3.8, -11] },
}

const VARIANTS = {
  classroom: CLASSROOM_LIGHTING,
  ikea: IKEA_LIGHTING,
  outdoor: OUTDOOR_LIGHTING,
  houseInterior: HOUSE_INTERIOR_LIGHTING,
}

/**
 * Spotlight parented to the camera ("flashlight"). Light and target are
 * children of the camera, so they follow it without a per-frame copy (no
 * one-frame lag). The camera has to be in the scene graph for its children
 * to be rendered.
 */
function Flashlight({ params }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const target = useMemo(() => {
    const t = new THREE.Object3D()
    t.position.set(0, 0, -1)
    return t
  }, [])

  useEffect(() => {
    scene.add(camera)
    return () => scene.remove(camera)
  }, [scene, camera])

  const lightRef = useLightFlicker(params.intensity)

  return createPortal(
    <>
      <spotLight
        ref={lightRef}
        target={target}
        color={params.color}
        intensity={params.intensity}
        distance={params.distance}
        angle={params.angle}
        penumbra={params.penumbra}
        decay={params.decay}
        castShadow={params.castShadow}
        shadow-mapSize={[params.shadowMapSize, params.shadowMapSize]}
        shadow-bias={params.shadowBias}
        shadow-normalBias={params.shadowNormalBias}
      />
      <primitive object={target} />
    </>,
    camera,
  )
}

function KitchenLight({ params }) {
  const ref = useLightFlicker(params.intensity)
  return (
    <pointLight
      ref={ref}
      color={params.color}
      intensity={params.intensity}
      distance={params.distance}
      decay={params.decay}
      position={params.position}
    />
  )
}

function Lighting({ variant }) {
  const p = VARIANTS[variant] ?? OUTDOOR_LIGHTING
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
      {p.fill && (
        <directionalLight color={p.fill.color} intensity={p.fill.intensity} position={p.fill.position} />
      )}
      {p.fog.density !== undefined ? (
        <fogExp2 attach="fog" args={[p.fog.color, p.fog.density]} />
      ) : (
        <fog attach="fog" args={[p.fog.color, p.fog.near, p.fog.far]} />
      )}
      {p.kitchenLight && <KitchenLight params={p.kitchenLight} />}
      {p.flashlight && <Flashlight key={variant} params={p.flashlight} />}
    </>
  )
}

export default Lighting
