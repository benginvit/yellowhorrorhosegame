import { useEffect, useMemo } from 'react'
import { createPortal, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLightFlicker } from '../utils/flicker'

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

const VARIANTS = {
  classroom: CLASSROOM_LIGHTING,
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
      {p.flashlight && <Flashlight key={variant} params={p.flashlight} />}
    </>
  )
}

export default Lighting
