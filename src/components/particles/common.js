import * as THREE from 'three'
import { IS_FROZEN, createRand } from '../../testMode'

// Shared bits for the particle systems (ADR on BENG-26): master switch, per-device
// budget, freeze flag and the soft point sprite material used by Ash.jsx (BENG-28).
// Dust.jsx (BENG-27) only uses particleCount().

// Master switch for every particle system (BENG-26). false = callers do not mount any system.
// Test builds only: ?particles=0 turns it off, so the real mount path can be tested.
export const PARTICLES_ENABLED = !(import.meta.env.VITE_TEST_MODE === '1' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('particles') === '0')

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

/** False in a frozen test build: particles keep their seeded start layout, two frames are identical. Test builds: ?freeze=1&animate=1 moves them with the test clock (advance()). */
export const PARTICLES_ANIMATE = !IS_FROZEN || (import.meta.env.VITE_TEST_MODE === '1' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('animate') === '1')

export { createRand }

/** Wraps v into [-half, half) (toroidal volume around the camera). */
export function wrap(v, half) {
  const size = half * 2
  return ((((v + half) % size) + size) % size) - half
}

// One soft, round, unlit sprite per vertex. Size attribute `aSize` is the sprite
// diameter in world metres (perspective-scaled via uScale, see updatePointScale),
// `aSeed` (0..1) varies the alpha per particle. Takes the scene fog colour, so distant
// sprites take on the fogExp2 tint (fog_fragment changes colour, not alpha; alpha is
// the near fade, the ground fade and the edge fade at the wrap boundary below).
const VERT = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uScale;
uniform vec2 uNearFade;
uniform vec3 uHalf; // half extents of the wrap box around the camera (y = 0: no vertical fade)
uniform float uCenterY; // world y of the box centre (the y wrap is not camera-relative)
varying float vFade;
varying vec2 vHeight; // world y of the sprite centre, sprite diameter in metres
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float dist = max(-mvPosition.z, 0.1);
  gl_PointSize = clamp(aSize * uScale / dist, 1.0, 512.0);
  // Edge fade over the outer 30 % of the box (as edge in Dust.jsx), so a sprite that
  // wraps to the opposite side is invisible when it jumps instead of popping.
  vec3 rel = abs(vec3(wp.x - cameraPosition.x, wp.y - uCenterY, wp.z - cameraPosition.z));
  float edge = (1.0 - smoothstep(0.7, 1.0, rel.x / uHalf.x)) * (1.0 - smoothstep(0.7, 1.0, rel.z / uHalf.z));
  // Vertical: only the outer 10 % (0.45 m of the 9 m ash box), so the ash at ground level in
  // the flashlight cone stays; the bottom is also covered by the ground fade.
  if (uHalf.y > 0.0) edge *= 1.0 - smoothstep(0.9, 1.0, rel.y / uHalf.y);
  vFade = smoothstep(uNearFade.x, uNearFade.y, dist) * edge * (0.55 + 0.45 * aSeed);
  vHeight = vec2(wp.y, aSize);
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
   * half: [hx, hy, hz] half extents of the wrap box for the edge fade (hy 0 = none), centerY: its y centre.
   */
  constructor({ color, opacity, blending = THREE.NormalBlending, nearFade = [0.5, 2], groundFade = [-1, 0], half = [1e9, 0, 1e9], centerY = 0 }) {
    super({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uScale: { value: 1 },
          uNearFade: { value: new THREE.Vector2(nearFade[0], nearFade[1]) },
          uGroundFade: { value: new THREE.Vector2(groundFade[0], groundFade[1]) },
          uHalf: { value: new THREE.Vector3(half[0], half[1], half[2]) },
          uCenterY: { value: centerY },
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
