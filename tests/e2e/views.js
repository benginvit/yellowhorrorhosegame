// Fixed camera poses for the screenshot diffs (frozen, seed=1).
// level 1 = outdoors with the house (z = -25), level 3 = classroom ("seated" intro phase).
// yaw: radians, + = turn left (0 = facing -z).
export const VIEWS = [
  { name: 'house-front', level: 1, x: 0, z: 15, yaw: 0 },
  { name: 'house-corner', level: 1, x: -22, z: -2, yaw: -0.8 },
  { name: 'house-door', level: 1, x: 0, z: -6, yaw: 0 },
  { name: 'classroom-start', level: 3, x: 0, z: 2, yaw: 0 },
  { name: 'classroom-left', level: 3, x: -6, z: 4, yaw: -0.5 },
]

// Lighting checks (lighting.spec.js). Luma = Rec. 709, 0-255, of the canvas
// screenshot without HTML overlays. `shadowScene` names the scene for the
// castShadow count, `flicker` marks the poses used for the frozen-frame check.
export const LIGHT_VIEWS = [
  { name: 'outdoor-front', level: 1, x: 0, z: 15, yaw: 0, shadowScene: 'outdoor' },
  { name: 'outdoor-door', level: 1, x: 0, z: -6, yaw: 0, flicker: true },
  { name: 'outdoor-key', level: 1, x: 2, z: 0, yaw: -0.45 },
  { name: 'classroom-start', level: 3, x: 0, z: 2, yaw: 0, shadowScene: 'classroom', flicker: true },
  { name: 'house-interior', level: 2, inside: true, x: 0, z: -14, yaw: 0, shadowScene: 'house interior', flicker: true, lightsOnly: true },
]

export const LIGHT_LIMITS = {
  maxShadowCasters: 2,
  // Whole frame (no HTML overlays). Measured on the current lighting: mean 57-67,
  // p50 59-75, p95 80-158, black 0-4.6 %, white <= 0.16 %. With ambient = 0 the
  // classroom and house interior drop to mean 23 / black ~50 %.
  brightness: { meanMin: 40, meanMax: 110, p50Min: 30, p95Min: 60, p95Max: 220, blackShareMax: 0.1, whiteShareMax: 0.02 },
  // Region around the object (luma): contrast = p95 - p5. Measured key 59 / p95 73,
  // door 53 / p95 58 (ambient = 0: door 44 / 48). Door black share was 42.5 %
  // before the fill light at the door (BENG-13), 0.0 % after; limit 5 %.
  readability: {
    key: { contrastMin: 50, p95Min: 65 },
    door: { contrastMin: 48, p95Min: 52, blackShareMax: 0.05 },
  },
}
