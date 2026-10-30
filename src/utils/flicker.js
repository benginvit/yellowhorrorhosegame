import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { createRand, IS_FROZEN } from '../testMode'
import { onSoundEvent } from './sounds'

// Light flicker: a faint baseline plus dips tied to sound events.
//
// Photosensitivity (WCAG 2.3.1): no hard on/off. Intensity is a smooth
// multiplier that never goes below 1 - MAX_DIP_DEPTH (0.5; baseline and dip are
// not multiplied, the lower of the two applies), and a dip is ignored while the previous one is still running, so there are at most
// 1 / DIP_SECONDS (= 2) dips per second, below the limit of 3.
// Set FLICKER_ENABLED to false to turn all flicker off.
export const FLICKER_ENABLED = true

// Baseline changes ~8 times/s; keep each change well under WCAG's 10 % luminance
// threshold, otherwise every change would count as a flash. Enforced by the clamp.
const MAX_BASELINE_DEPTH = 0.09
const MAX_DIP_DEPTH = 0.5
const BASELINE_DEPTH = Math.min(0.06, MAX_BASELINE_DEPTH) // fraction of intensity
const BASELINE_STEP = 0.12 // seconds between new random baseline targets
const BASELINE_SMOOTHING = 8 // 1/s, how fast the baseline follows its target
const DIP_SECONDS = 0.5
const DIP_ATTACK = 0.12 // seconds to reach the bottom of a dip
const DIP_DEPTH = { jumpscare: MAX_DIP_DEPTH, hit: 0.3 }

// Flicker is off in a frozen test build so the frame stays byte-identical.
const active = FLICKER_ENABLED && !IS_FROZEN

// Own seeded stream (testMode), so flicker never shifts the game's rand() sequence.
const STREAM_ID = 0x6c696768 // 'ligh'

let pendingDip = null // depth of a dip waiting for its first frame
let dipDepth = 0
let dipStart = -Infinity
let nextStep = 0
let target = 1
let level = 1
let lastTime = null
let lastClock = null
let factor = 1
let flickerRand = null

// A new Canvas (restart after game over / win) has a fresh clock starting at 0.
function resetState(clock) {
  pendingDip = null
  dipDepth = 0
  dipStart = -Infinity
  nextStep = 0
  target = 1
  level = 1
  lastTime = null
  lastClock = clock
  factor = 1
  flickerRand = createRand(STREAM_ID)
}

if (active) {
  onSoundEvent((type) => {
    const depth = DIP_DEPTH[type]
    if (depth !== undefined) pendingDip = Math.max(pendingDip ?? 0, depth)
  })
}

// Computed once per frame (memoised on time), shared by all lights.
function flickerFactor(clock) {
  const time = clock.elapsedTime
  // Different clock, or time going backwards: start over and drop queued dips.
  if (clock !== lastClock || (lastTime !== null && time < lastTime)) resetState(clock)
  if (time === lastTime) return factor
  const dt = lastTime === null ? 0 : Math.max(0, time - lastTime)
  lastTime = time

  if (time >= nextStep) {
    target = 1 - BASELINE_DEPTH * flickerRand()
    nextStep = time + BASELINE_STEP
  }
  level += (target - level) * Math.min(1, dt * BASELINE_SMOOTHING)

  if (pendingDip !== null) {
    if (time - dipStart >= DIP_SECONDS) {
      dipDepth = pendingDip
      dipStart = time
    }
    pendingDip = null
  }

  const t = (time - dipStart) / DIP_SECONDS
  let dip = 0
  if (t >= 0 && t < 1) {
    const a = DIP_ATTACK / DIP_SECONDS
    // Smooth down, then smooth back up (raised cosine, no steps).
    const k = t < a ? t / a : 1 - (t - a) / (1 - a)
    dip = dipDepth * 0.5 * (1 - Math.cos(Math.PI * k))
  }

  factor = Math.min(level, 1 - dip)
  return factor
}

/** Scales ref.current.intensity by the flicker factor every frame. */
export function useLightFlicker(base) {
  const ref = useRef()
  useFrame((state) => {
    if (!active || !ref.current) return
    ref.current.intensity = base * flickerFactor(state.clock)
  })
  return ref
}
