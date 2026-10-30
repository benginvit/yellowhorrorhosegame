// Test mode for deterministic rendering (screenshot diffs, frame-time budgets).
//
// Everything that is test-only lives inside `if (import.meta.env.VITE_TEST_MODE === '1')`
// blocks. Vite replaces that expression at build time, so a normal build
// (without VITE_TEST_MODE=1) drops the branches entirely, including the
// __YHH_TEST_MODE__ marker string. Do NOT hoist the check into a variable or
// reference test-only strings outside of such a block.
//
// Query params (only read in test builds):
//   ?seed=<n>   seed for the PRNG exposed as `rand()` (default 1)
//   ?freeze=1   freeze time: the Canvas runs with frameloop="never", so no
//               useFrame callback runs and nothing animates on its own.
//               Exactly one frame is rendered once the scene has mounted
//               (delta 0, clock.elapsedTime 0); further frames only happen
//               when a test calls advance().
//
// Test API (test builds only): window.__YHH_TEST_MODE__ (alias window.__YHH_TEST__)
//   seed, freeze  parsed params
//   rand()        the seeded PRNG
//   gl            WebGLRenderer of the current Canvas. gl.info.render/memory =
//                 the whole frame (autoReset is off and info is reset once
//                 before each frame, see onCanvasCreated). Post-FX
//                 (HorrorEffects) is bypassed in test builds, so this is the
//                 scene without post-FX.
//   camera        the Canvas' camera (tests set position/rotation, then advance())
//   scene         the Canvas' THREE.Scene
//   ready         true once the scene has mounted and a frame has been rendered
//   advance(frames = 1, dt = 1/60)  freeze only: render `frames` frames, each
//                 advancing clock.elapsedTime by dt and passing dt to useFrame
//   setTime(t)    freeze only: set clock.elapsedTime without rendering

import { useEffect } from 'react'
import { addAfterEffect, addEffect, useThree } from '@react-three/fiber'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let source = Math.random
let frameloop = 'always'
// Test-only start overrides merged into the game state when "Start" is pressed
// (?level=<1-6>, ?inside=1 for the Astrid house interior). null in prod builds.
let startOverrides = null
// Replaced inside the gate below; stays a no-op component in prod builds.
let TestModeProbe = () => null

if (import.meta.env.VITE_TEST_MODE === '1') {
  const params = new URLSearchParams(window.location.search)
  const parsed = parseInt(params.get('seed') ?? '1', 10)
  const seed = Number.isNaN(parsed) ? 1 : parsed
  const freeze = params.get('freeze') === '1'

  source = mulberry32(seed)

  const level = parseInt(params.get('level') ?? '', 10)
  if (level >= 1 && level <= 6) {
    startOverrides = { currentLevel: level }
    // Level 3 is the classroom; its intro starts in the 'seated' phase.
    if (level === 3) startOverrides.classroomIntroPhase = 'seated'
    if (level === 2 && params.get('inside') === '1') startOverrides.isInsideHouse = true
  }
  if (freeze) frameloop = 'never'

  window.__YHH_TEST_MODE__ = {
    seed,
    freeze,
    rand: () => source(),
    gl: null,
    camera: null,
    scene: null,
    ready: false,
    advance: () => {},
    setTime: () => {},
  }
  window.__YHH_TEST__ = window.__YHH_TEST_MODE__

  // Rendered inside <Canvas> after the scene content, so its effect runs once
  // the content has been committed.
  TestModeProbe = function TestModeProbe() {
    const get = useThree((s) => s.get)
    useEffect(() => {
      const api = window.__YHH_TEST_MODE__
      if (freeze) {
        get().advance(get().clock.elapsedTime)
        api.ready = true
        return undefined
      }
      let frames = 0
      const unsubscribe = addAfterEffect(() => {
        if (++frames >= 2) {
          api.ready = true
          unsubscribe()
        }
      })
      return unsubscribe
    }, [get])
    return null
  }
}

export { TestModeProbe }

/** Extra game state applied on Start (test builds only, else {}). */
export function getStartOverrides() {
  return startOverrides ?? {}
}

/** Drop-in replacement for Math.random() where it affects visuals/animation. */
export function rand() {
  return source()
}

/** Canvas dpr: [1, 2] in prod, fixed 1 in test mode (stable pixel output). */
export const CANVAS_DPR = import.meta.env.VITE_TEST_MODE === '1' ? 1 : [1, 2]

/**
 * Shared renderer settings for every <Canvas>. Test build: post-FX is bypassed
 * (see HorrorEffects), so the canvas' own MSAA is used and e2e screenshots/perf
 * show the plain scene. Prod: antialias off, MSAA comes from the EffectComposer.
 */
export const CANVAS_GL = {
  antialias: import.meta.env.VITE_TEST_MODE === '1',
  powerPreference: 'high-performance',
}

/** 'always' (R3F default) except in test mode with ?freeze=1. */
export const CANVAS_FRAMELOOP = frameloop

/** Pass to <Canvas onCreated>. No-op in prod builds. */
export function onCanvasCreated(state) {
  if (import.meta.env.VITE_TEST_MODE === '1') {
    const api = window.__YHH_TEST_MODE__
    api.gl = state.gl
    api.camera = state.camera
    api.scene = state.scene
    api.ready = false

    // Post-FX is bypassed in test builds (HorrorEffects returns null), but keep
    // the per-frame reset: with the default autoReset only the last gl.render()
    // call would count if a frame ever has several. Reset once per frame instead.
    state.gl.info.autoReset = false
    addEffect(() => state.gl.info.reset())

    if (api.freeze) {
      api.advance = (frames = 1, dt = 1 / 60) => {
        for (let i = 0; i < frames; i++) {
          state.advance(state.clock.elapsedTime + dt)
        }
      }
      api.setTime = (t) => {
        state.clock.elapsedTime = t
      }
    }
  }
}
