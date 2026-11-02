import * as THREE from 'three'
import { IS_FROZEN, createRand } from '../../testMode'

// Shared bits for the particle systems (ADR on BENG-26): master switch, per-device
// budget, freeze flag and the soft point sprite material used by Ash.jsx (BENG-28).
// Dust.jsx (BENG-27) only uses particleCount().

// Master switch for every particle system (BENG-26). false = callers do not mount any system.
export const PARTICLES_ENABLED = true

// Budget: ~1 500 particles per scene on desktop, half of that on mobile.
// Each system takes its share of PARTICLE_BUDGET via particleCount().
export const PARTICLE_BUDGET = 1500

// Device property only (not the configured CANVAS_DPR), so test builds and CI
// perf measure the desktop budget.
const isMobile = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

/** Particle count for a system with the given desktop count (halved on mobile). */
export function particleCount(desktopCount) {
  return isMobile ? Math.floor(desktopCount / 2) : desktopCount
}

/** False in a frozen test build: particles keep their seeded start layout, two frames are identical. */
export const PARTICLES_ANIMATE = !IS_FROZEN

export { createRand }

/** Wraps v into [-half, half) (toroidal volume around the camera). */
export function wrap(v, half) {
  const size = half * 2
  return ((((v + half) % size) + size) % size) - half
}

// One soft, round, unlit sprite per vertex. Size attribute `aSize` is the sprite
// diameter in world metres (perspective-scaled via uScale, see updatePointScale),
// `aSeed` (0..1) varies the alpha per particle. Takes the scene fog, so distant
// sprites dissolve into fogExp2 instead of floating in front of it.
const VERT = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uScale;
uniform vec2 uNearFade;
varying float vFade;
varying vec2 vHeight; // world y of the sprite centre, sprite diameter in metres
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mvPosition.z, 0.1);
  gl_PointSize = clamp(aSize * uScale / dist, 1.0, 512.0);
  vFade = smoothstep(uNearFade.x, uNearFade.y, dist) * (0.55 + 0.45 * aSeed);
  vHeight = vec2((modelMatrix * vec4(position, 1.0)).y, aSize);
  // A fully faded sprite is culled here (centre outside clip space) instead of rasterising
  // and discarding every one of its fragments.
  gl_Position = vFade > 0.0 ? projectionMatrix * mvPosition : vec4(2.0, 2.0, 2.0, 1.0);
  #include <fog_vertex>
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform vec2 uGroundFade;
varying float vFade;
varying vec2 vHeight;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.3, 1.0, d);
  // Fade out towards the ground plane (approximate world height of this texel), so a
  // sprite that dips below the ground thins out instead of being cut by the depth test.
  float y = vHeight.x + (0.5 - gl_PointCoord.y) * vHeight.y;
  a *= a * uOpacity * vFade * smoothstep(uGroundFade.x, uGroundFade.y, y);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export class SoftPointsMaterial extends THREE.ShaderMaterial {
  /**
   * nearFade: [from, to] metres, sprites closer than `from` are invisible (no giant clipped
   * points). groundFade: [y0, y1] world metres, alpha goes from 0 at y0 to full at y1.
   */
  constructor({ color, opacity, blending = THREE.NormalBlending, nearFade = [0.5, 2], groundFade = [-1, 0] }) {
    super({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uScale: { value: 1 },
          uNearFade: { value: new THREE.Vector2(nearFade[0], nearFade[1]) },
          uGroundFade: { value: new THREE.Vector2(groundFade[0], groundFade[1]) },
        },
      ]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
      fog: true,
    })
  }
}

const bufferSize = new THREE.Vector2()

/** Per frame: pixels per world metre at 1 m, so aSize is a world size for this camera and buffer. */
export function updatePointScale(material, gl, camera) {
  gl.getDrawingBufferSize(bufferSize)
  material.uniforms.uScale.value = bufferSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
}
