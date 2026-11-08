// Layout contract for hiding under the bed in Astrid's house (level 2). Positions are world units [x, y, z] (y = floor level).
// The bed is placed by Game.jsx at HOUSE_FURNITURE.bed (levels/houseLayout.js, shared with the mesh and the collision
// box); Furniture.jsx draws it with its foot end (the front) facing +z, toward the front door.
import { HOUSE_FURNITURE, FURNITURE_FOOTPRINT } from './houseLayout'

export const BED_POS = HOUSE_FURNITURE.bed
// Middle of the bed's foot end: the spot the reach is measured from.
export const BED_FRONT = [BED_POS[0], BED_POS[2] + FURNITURE_FOOTPRINT.bed.d / 2]
// Horizontal distance from BED_FRONT within which the "crawl in" button is shown.
export const BED_REACH = 1.2

// Where the camera lies under the bed (eye height 0.25, 0.8 toward the foot end) and which way it looks: out past the foot end (+z).
export const UNDER_BED_POSE = { position: [BED_POS[0], 0.25, BED_POS[2] + 0.8], yaw: Math.PI }
// Seconds the camera takes to move in under the bed / back out.
export const HIDE_TRANSITION_SECONDS = 0.5
// How far (radians) the player can look to either side while under the bed.
export const UNDER_BED_YAW_RANGE = 0.9
// The view starts tilted up a little, so the underside of the bed (frame, slats) shows above the gap under the sheet.
export const UNDER_BED_PITCH = 0.2
export const UNDER_BED_PITCH_RANGE = 0.35

/** True when the horizontal position (x, z) is within reach of the bed's foot end. */
export function nearBed(x, z) {
  return Math.hypot(x - BED_FRONT[0], z - BED_FRONT[1]) <= BED_REACH
}
