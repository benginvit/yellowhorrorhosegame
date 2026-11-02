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
