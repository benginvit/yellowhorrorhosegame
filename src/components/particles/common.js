import { CANVAS_DPR } from '../../testMode'

// Master switch for every particle system (BENG-26). false = nothing is mounted.
export const PARTICLES_ENABLED = true

// Budget: ~1 500 particles per scene on desktop, half of that on mobile.
// Each system takes its share of PARTICLE_BUDGET via particleCount().
export const PARTICLE_BUDGET = 1500

const isMobile =
  typeof window !== 'undefined' &&
  ((window.matchMedia?.('(pointer: coarse)').matches ?? false) ||
    (typeof CANVAS_DPR === 'number' ? CANVAS_DPR : CANVAS_DPR[1]) < 2)

/** Particle count for a system with the given desktop count (halved on mobile). */
export function particleCount(desktopCount) {
  return isMobile ? Math.floor(desktopCount / 2) : desktopCount
}
