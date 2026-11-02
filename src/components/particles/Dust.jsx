import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createRand } from '../../testMode'
import { HOUSE_INTERIOR_LIGHTING } from '../Lighting'
import { particleCount } from './common'

// Floating dust (BENG-27). One THREE.Points / one draw call. The grains live in
// a box around the camera: positions are wrapped around the camera in the
// vertex shader, so the box follows the player and the CPU only updates a few
// uniforms per frame. Brightness comes from the flashlight cone (camera
// position + view direction + angle/distance from Lighting.jsx); no extra light.

const DUST_COUNT = 600
const BOX = 14 // edge length of the dust volume (m)
const BOX_HEIGHT = 4
const STREAM_ID = 0x64757374 // 'dust'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPxScale;
  uniform vec3 uForward;
  uniform vec3 uBox;
  uniform float uCosOuter;
  uniform float uCosInner;
  uniform float uBase;
  uniform float uCone;
  attribute vec4 aSeed; // xyz start offset in [0,1), w size/phase
  varying float vAlpha;

  void main() {
    // Constant fall (cm/s) plus a bounded sway: speed never grows with uTime.
    vec3 vel = vec3(0.0, -0.024 - aSeed.w * 0.03, 0.0);
    vec3 sway = vec3(sin(uTime * 0.17 + aSeed.w * 40.0), 0.0, cos(uTime * 0.13 + aSeed.w * 25.0)) * 0.15;
    vec3 rel = aSeed.xyz * uBox + vel * uTime + sway - cameraPosition;
    rel = mod(rel + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 wp = cameraPosition + rel;

    float d = length(rel);
    float cosA = dot(rel / max(d, 0.001), uForward);
    float cone = smoothstep(uCosOuter, uCosInner, cosA) ;
    float edge = (1.0 - smoothstep(0.35, 0.5, d / uBox.x)) * (1.0 - smoothstep(0.35, 0.5, abs(rel.y) / uBox.y));
    vAlpha = (uBase + uCone * cone) * edge * smoothstep(0.4, 1.2, d);

    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_PointSize = clamp((0.05 + aSeed.w * 0.05) * uPxScale / -mv.z, 2.0, 9.0);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = (1.0 - smoothstep(0.0, 0.5, length(c))) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

// Mount only when PARTICLES_ENABLED (see Game.jsx): nothing is created when off.
function Dust({ flashlight = HOUSE_INTERIOR_LIGHTING.flashlight, base = 0.015 }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const count = particleCount(DUST_COUNT)

  const geometry = useMemo(() => {
    const rand = createRand(STREAM_ID)
    const seeds = new Float32Array(count * 4)
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand()
    const g = new THREE.BufferGeometry()
    // Points need a position attribute for the draw count; the shader ignores it.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    return g
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(() => {
    // No flashlight in the variant (classroom): no cone, only a faint ambient glimmer.
    const angle = flashlight?.angle ?? 0.5
    return {
      uTime: { value: 0 },
      uPxScale: { value: 1 },
      uForward: { value: new THREE.Vector3(0, 0, -1) },
      uBox: { value: new THREE.Vector3(BOX, BOX_HEIGHT, BOX) },
      uCosOuter: { value: Math.cos(angle) },
      // Same inner cone as three.js' SpotLight: cos(angle * (1 - penumbra)).
      uCosInner: { value: Math.cos(angle * (1 - (flashlight?.penumbra ?? 0.6))) },
      uBase: { value: base },
      uCone: { value: flashlight ? 1.0 : 0 },
      uColor: { value: new THREE.Color(flashlight?.color ?? '#ffe8d6') },
    }
  }, [flashlight, base])

  useFrame((state) => {
    const u = uniforms
    u.uTime.value = state.clock.elapsedTime
    camera.getWorldDirection(u.uForward.value)
    u.uPxScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  })

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default Dust
