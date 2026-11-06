// Test mode for deterministic rendering (screenshot diffs, frame-time budgets).
//
// Everything that is test-only lives inside `if (import.meta.env.VITE_TEST_MODE === '1')`
// blocks. Vite replaces that expression at build time, so a normal build
// (without VITE_TEST_MODE=1) drops the branches entirely, including the
// __YHH_TEST_MODE__ marker string. Do NOT hoist the check into a variable or
// reference test-only strings outside of such a block.
//
// Level start (?level=N, ?inside=1) is NOT test-only: it is also read in a build
// with VITE_LEVEL_SELECT=1 (staging, see "Level select" below). Seed, freeze and
// the test probes stay behind VITE_TEST_MODE.
//
// Query params (only read in test builds):
//   ?seed=<n>   seed for the PRNG exposed as `rand()` (default 1)
//   ?phase=ordering  start the IKEA level in 'ordering' instead of 'intro'
//   ?freeze=1   freeze time: the Canvas runs with frameloop="never", so no
//               useFrame callback runs and nothing animates on its own.
//               Exactly one frame is rendered once the scene has mounted
//               (delta 0, clock.elapsedTime 0); further frames only happen
//               when a test calls advance(). The start-pose timers (classroom
//               intro, Astrid's wake-up, snore bubbles, candy spawn) run on that
//               clock too; see "Timers" below for what still uses the wall clock.
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
//   ready         true once the scene has mounted and a frame has been rendered;
//                 false again from the moment that Canvas unmounts (game over,
//                 restart, level change) until the next Canvas is ready
//   advance(frames = 1, dt = 1/60)  freeze only: render `frames` frames, each
//                 advancing clock.elapsedTime by dt and passing dt to useFrame,
//                 and move the frozen test clock (timers fire) by frames * dt.
//                 Returns true. While no Canvas is live (ready false) it only
//                 moves the test clock, renders nothing and returns false.
//   setTime(t)    freeze only: set clock.elapsedTime without rendering (moves the
//                 test clock forward by the difference); false and no effect
//                 while no Canvas is live
//   emit(type)    fire a sound event ('hit', 'jumpscare', 'astrid'): light dip, particle burst
//
// Canvas remount (game over -> restart, classroom -> IKEA, IKEA -> Selma): gl,
// camera and scene always belong to the live Canvas, which the probe's cleanup
// retires. The frozen test clock is global: advance() keeps moving it (so the
// next level's start-pose timers fire) even in the moment between the old Canvas
// retiring and the next one's onCreated, which a test stepping through a level
// change relies on. R3F force-loses the old WebGL context
// (WEBGL_lose_context.loseContext) 500 ms after a Canvas unmounts. On the software
// GL stack the e2e suite runs on (SwiftShader) that one synchronous call blocks
// the page's main thread for 10-25 s locally and 50+ s on the CI runner: no
// requestAnimationFrame, no evaluate(), no clicks, so whatever a test does at that
// moment looks hung (BENG-91). Test builds therefore skip the forced loss and let
// garbage collection release the old context: that destruction is asynchronous
// and never blocks the main thread (measured: no stall at all, and the page-close
// cost is the same as before). Prod builds are unchanged (R3F's default loss on
// unmount).
//
// Timers: game code that must follow the test clock uses setTimer / clearTimer /
// setTimerInterval instead of setTimeout / setInterval. In prod and in test builds
// without ?freeze=1 they are the plain browser timers. With ?freeze=1 they run on
// the frozen clock: a timer fires inside advance()/setTime() once the accumulated
// test time (sum of dt, monotone across Canvas remounts) has passed its due time,
// never from the wall clock. Still on the wall clock (event-driven or audio only,
// not in any start pose): blood splatter (App.jsx, BloodSplatter.jsx), the success
// voice line (App.jsx), Jumpscare.jsx, cat meows (Character.jsx, Math.random).
// IS_FROZEN is true only with ?freeze=1 (test builds).
//
// Level select (VITE_LEVEL_SELECT=1, staging builds only; never prod): enables
// ?level=N (and ?inside=1) plus the level buttons on the start screen (UI.jsx),
// nothing else: no seed, no frozen clock, no test API. The game plays like prod.
// The __YHH_LEVEL_SELECT__ marker string lives only inside the
// `if (import.meta.env.VITE_LEVEL_SELECT === '1')` gates (here and in UI.jsx) so a
// prod build drops it; scripts/check-prod-bundle.sh fails the prod build otherwise.
//   ?level=N    start at level N (1..levels.length) when "Start" is pressed
//   ?inside=1   with Astrid's level: start inside the house

import { useEffect } from 'react'
import { emitSoundEvent } from './utils/sounds'
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
let frozen = false
// Frozen-clock timer scheduler (see "Timers" above). null unless ?freeze=1.
let virtualTimers = null
// Level start requested in the URL (?level=N, ?inside=1), read in test builds and
// level-select builds. null in prod builds and when ?level is absent/invalid; the
// range check against the level list happens in getStartOverrides().
let levelRequest = null
// ?phase=ordering (IKEA): skip the intro camera shot so e2e views can use fixed poses. Test builds only.
let ikeaStartPhase = 'intro'
let makeRand = () => Math.random
// Replaced inside the gate below; stays a no-op component in prod builds.
let TestModeProbe = () => null
// Test builds only (see "Canvas remount" above): unsubscribe of the current Canvas'
// per-frame gl.info reset.
let unsubscribeInfoReset = null
// R3F state of the live Canvas (test builds, ?freeze=1): what advance()/setTime() drive.
let liveState = null

if (import.meta.env.VITE_TEST_MODE === '1') {
  const params = new URLSearchParams(window.location.search)
  const parsed = parseInt(params.get('seed') ?? '1', 10)
  const seed = Number.isNaN(parsed) ? 1 : parsed
  const freeze = params.get('freeze') === '1'
  if (params.get('phase') === 'ordering') ikeaStartPhase = 'ordering'
  source = mulberry32(seed)

  if (freeze) {
    frameloop = 'never'
    frozen = true

    // Timers on the frozen clock. `now` is accumulated test time in ms (sum of the forward
    // steps: dt of advance(), forward movement of setTime()). It only ever grows, also when a Canvas remounts and its
    // R3F clock restarts at 0 (level change).
    let now = 0
    let nextId = 1
    const timers = new Map() // id -> { fn, due, every }
    virtualTimers = {
      set(fn, ms, every = null) {
        const id = nextId++
        timers.set(id, { fn, due: now + Math.max(0, ms || 0), every })
        return id
      },
      clear(id) {
        timers.delete(id)
      },
      tick(dtMs) {
        const target = now + dtMs
        for (;;) {
          let nextTimerId = null
          for (const [id, t] of timers) {
            if (t.due <= target && (nextTimerId === null || t.due < timers.get(nextTimerId).due)) nextTimerId = id
          }
          if (nextTimerId === null) break
          const t = timers.get(nextTimerId)
          // The callback sees its own due time, so timers it creates are relative to that
          // and the result does not depend on the step size.
          now = Math.max(now, t.due)
          if (t.every === null) timers.delete(nextTimerId)
          else t.due += Math.max(1, t.every)
          t.fn()
        }
        now = target
      },
    }
  }
  makeRand = (streamId) => mulberry32((seed ^ streamId) >>> 0)

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
    emit: emitSoundEvent, // fire a sound event ('hit', 'jumpscare', 'astrid') without playing the game
  }
  window.__YHH_TEST__ = window.__YHH_TEST_MODE__
  if (freeze) {
    // Render on the live Canvas (if any) and always move the frozen test clock: on a level
    // change the next Canvas' onCreated can land a moment after the old one retired, and a
    // test that steps the clock right through the change (ikea.spec.js level chain) needs
    // the new level's start-pose timers to keep counting in that window.
    window.__YHH_TEST_MODE__.advance = (frames = 1, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        if (liveState) liveState.advance(liveState.clock.elapsedTime + dt)
        virtualTimers.tick(dt * 1000)
      }
      return liveState !== null
    }
    window.__YHH_TEST_MODE__.setTime = (t) => {
      if (!liveState) return false
      virtualTimers.tick(Math.max(0, t - liveState.clock.elapsedTime) * 1000)
      liveState.clock.elapsedTime = t
      return true
    }
  }

  // Rendered inside <Canvas> after the scene content, so its effect runs once
  // the content has been committed. Its cleanup retires the Canvas from the API.
  TestModeProbe = function TestModeProbe() {
    const get = useThree((s) => s.get)
    useEffect(() => {
      const api = window.__YHH_TEST_MODE__
      const gl = get().gl
      // This Canvas is unmounting (game over, restart, level change). Guarded by
      // renderer identity: on a level change the next Canvas' onCreated can run
      // before this (passive) cleanup, and must not be undone.
      const retire = () => {
        if (api.gl !== gl) return
        api.ready = false
        liveState = null
      }
      if (freeze) {
        get().advance(get().clock.elapsedTime)
        api.ready = true
        return retire
      }
      let frames = 0
      const unsubscribe = addAfterEffect(() => {
        if (++frames >= 2) {
          api.ready = true
          unsubscribe()
        }
      })
      return () => {
        unsubscribe()
        retire()
      }
    }, [get])
    return null
  }
}

// Shared level start: test builds and level-select (staging) builds. Both operands
// are build-time literals, so a prod build drops this block.
if (import.meta.env.VITE_TEST_MODE === '1' || import.meta.env.VITE_LEVEL_SELECT === '1') {
  const params = new URLSearchParams(window.location.search)
  const level = parseInt(params.get('level') ?? '', 10)
  if (level >= 1) levelRequest = { level, inside: params.get('inside') === '1' }
}

if (import.meta.env.VITE_LEVEL_SELECT === '1') {
  // Marker for scripts/check-prod-bundle.sh; also lets e2e tell the build apart.
  window.__YHH_LEVEL_SELECT__ = true
}

export { TestModeProbe }

/**
 * Game state applied on top of INITIAL_STATE when the game starts at a level:
 * currentLevel plus that level's start phase, chosen by level NAME (Kerstin ->
 * classroom intro 'seated', Rasmus -> IKEA 'intro'; Astrid + ?inside=1 -> inside
 * the house). `level` defaults to the URL's ?level=N (test / level-select builds);
 * the start-screen level buttons pass it explicitly. Values outside
 * 1..levels.length (and prod builds, where ?level is never read) give {} so the
 * game starts on level 1.
 */
export function getStartOverrides(levels, level = levelRequest?.level) {
  if (!Number.isInteger(level) || level < 1 || level > levels.length) return {}
  const overrides = { currentLevel: level }
  const name = levels[level - 1]?.name
  if (name === 'Kerstin') overrides.classroomIntroPhase = 'seated'
  if (name === 'Rasmus') overrides.ikeaPhase = ikeaStartPhase
  if (name === 'Astrid' && levelRequest?.inside && level === levelRequest.level) overrides.isInsideHouse = true
  return overrides
}

/** Drop-in replacement for Math.random() where it affects visuals/animation. */
export function rand() {
  return source()
}

/**
 * Independent PRNG stream (seeded from ?seed in test builds, Math.random in
 * prod) for visuals that must not shift the game's rand() sequence.
 */
export function createRand(streamId) {
  return makeRand(streamId)
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

/** True only in a test build with ?freeze=1 (always false in prod). */
export const IS_FROZEN = frozen

/** 'always' (R3F default) except in test mode with ?freeze=1. */
export const CANVAS_FRAMELOOP = frameloop

/** setTimeout that follows the frozen test clock with ?freeze=1. */
export function setTimer(fn, ms) {
  return virtualTimers ? virtualTimers.set(fn, ms) : setTimeout(fn, ms)
}

/** clearTimeout counterpart of setTimer. */
export function clearTimer(id) {
  if (virtualTimers) virtualTimers.clear(id)
  else clearTimeout(id)
}

/** setInterval that follows the frozen test clock with ?freeze=1. Clear with clearTimerInterval. */
export function setTimerInterval(fn, ms) {
  return virtualTimers ? virtualTimers.set(fn, ms, ms) : setInterval(fn, ms)
}

/** clearInterval counterpart of setTimerInterval. */
export function clearTimerInterval(id) {
  if (virtualTimers) virtualTimers.clear(id)
  else clearInterval(id)
}

/** Pass to <Canvas onCreated>. No-op in prod builds. */
export function onCanvasCreated(state) {
  if (import.meta.env.VITE_TEST_MODE === '1') {
    const api = window.__YHH_TEST_MODE__
    api.gl = state.gl
    api.camera = state.camera
    api.scene = state.scene
    api.ready = false

    // See "Canvas remount" above: R3F calls this 500 ms after the Canvas unmounts,
    // and on SwiftShader the forced loss blocks the main thread for 10-50 s. The
    // old context is left to garbage collection instead.
    state.gl.forceContextLoss = () => {}

    // Post-FX is bypassed in test builds (HorrorEffects returns null), but keep
    // the per-frame reset: with the default autoReset only the last gl.render()
    // call would count if a frame ever has several. Reset once per frame instead.
    // Only the live Canvas' reset stays subscribed (the effect list is global).
    state.gl.info.autoReset = false
    unsubscribeInfoReset?.()
    unsubscribeInfoReset = addEffect(() => state.gl.info.reset())

    if (api.freeze) liveState = state // advance()/setTime() are defined once, see the gate above
  }
}
