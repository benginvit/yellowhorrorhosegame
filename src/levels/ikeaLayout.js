// Layout contract for the IKEA level (Rasmus, level 4). Shared by the placeholder
// scene in Game.jsx and the stage 2 environment / Rasmus / kiosk work.
// All positions are [x, y, z] in world units (y = floor level), the player's
// eye height is 1.6. The kiosk is at the origin; the player stands in front of
// it on +z and looks toward -z (yaw 0).

// Seconds from Rasmus leaving the knife shelf until he reaches the player.
export const IKEA_ORDER_SECONDS = 40

export const PLAYER_START = [0, 1.6, 3]
export const PLAYER_START_YAW = 0

export const KIOSK_POS = [0, 0, 0]
export const ASTRID_POS = [1.4, 0, 3]

// The knife shelf in the kitchen department, far from the kiosk.
export const KNIFE_SHELF_POS = [-16, 0, -14]

// Rasmus' walk from the knife shelf to the kiosk (waypoints, first = shelf, last = beside the player).
export const RASMUS_PATH = [
  KNIFE_SHELF_POS,
  [-16, 0, -4],
  [-8, 0, -1],
  [-8, 0, 5],
  [-1.2, 0, 3.4],
]

// Intro shot of the kitchen department: camera position and what it looks at.
export const INTRO_CAMERA = {
  position: [-8, 1.7, -6],
  target: [-16, 1.3, -14],
}

// Cumulative path length at each waypoint, for rasmusPositionAt.
const SEGMENT_ENDS = []
let totalLength = 0
for (let i = 1; i < RASMUS_PATH.length; i++) {
  const [ax, , az] = RASMUS_PATH[i - 1]
  const [bx, , bz] = RASMUS_PATH[i]
  totalLength += Math.hypot(bx - ax, bz - az)
  SEGMENT_ENDS.push(totalLength)
}

/** Rasmus' position at `progress` (0 = knife shelf, 1 = at the player), clamped, at constant speed along RASMUS_PATH. */
export function rasmusPositionAt(progress) {
  const p = Math.min(1, Math.max(0, progress))
  const target = p * totalLength
  let i = 0
  while (i < SEGMENT_ENDS.length - 1 && SEGMENT_ENDS[i] < target) i++
  const start = i === 0 ? 0 : SEGMENT_ENDS[i - 1]
  const len = SEGMENT_ENDS[i] - start
  const t = len === 0 ? 1 : (target - start) / len
  const a = RASMUS_PATH[i]
  const b = RASMUS_PATH[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
