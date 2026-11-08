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
// Kiosk footprint [width, height, depth] and the direction its screen faces (toward the player).
export const KIOSK_SIZE = [1, 2, 0.6]
export const KIOSK_FACING = [0, 0, 1]
// Where the tray with the 16 meatballs appears (on the counter by the kiosk).
export const TRAY_POS = [0, 1, 0.9]
// Where Rasmus sits down and eats when the order is complete.
export const RASMUS_SEAT_POS = [3.4, 0, 1.2]
// His table is this far to the right (+x) of the seat; he sits facing it.
export const RASMUS_TABLE_OFFSET_X = 0.85
// Where the tray and, later, the glass are put down: the table to the right of Rasmus' seat.
export const RASMUS_TABLE_POS = [RASMUS_SEAT_POS[0] + RASMUS_TABLE_OFFSET_X, 0, RASMUS_SEAT_POS[2]]
export const ASTRID_POS = [1.4, 0, 3]

// The drink station (a screen with the drink menu), 8-10 units from Rasmus' table. The screen faces +x, toward the tables.
export const DRINK_STATION_POS = [-3, 0, 6]
export const DRINK_STATION_FACING = [1, 0, 0]

// Rectangle the player is kept inside while serving (the restaurant side; the counter at the kiosk is outside it).
export const IKEA_BOUNDS = { minX: -9, maxX: 13, minZ: 1.8, maxZ: 11 }

// The store's shell: the centre planes of the four walls (the meshes are positioned on them; the floor and ceiling span the
// same rectangle). IKEA_BOUNDS keeps the player well inside it while serving.
export const IKEA_ROOM = { minX: -26, maxX: 14, minZ: -24, maxZ: 12 }
export const IKEA_WALL = 0.2

// Restaurant tables (IkeaStore.jsx draws them, levels/colliders/ikea.js blocks them). Tables run along z, `length` long and
// TABLE_DEPTH wide, with a chair on both long sides at CHAIR_OFFSET_X from the table's centre for every entry of `chairDz`.
export const TABLE_DEPTH = 0.9
export const TABLE_HEIGHT = 0.75
export const CHAIR_SIZE = 0.5
export const CHAIR_OFFSET_X = 0.85
const LONG_TABLE = { length: 2.4, chairDz: [-0.8, 0, 0.8] }
// Rasmus' table is shorter: the player uses it from the end facing the counter, and its centre (RASMUS_TABLE_POS) must be
// within INTERACT_RANGE of a spot just outside the furniture, a circle's radius (0.35) off the end of the table.
const RASMUS_TABLE = { length: 1.6, chairDz: [-0.5, 0, 0.5] }
export const IKEA_TABLES = [
  // Rows at x = 5 and 9; (5, -1) would touch Rasmus' table.
  ...[5, 9].flatMap((x) => [-13, -9, -5, -1, 6].filter((z) => !(x === 5 && z === -1)).map((z) => ({ x, z, ...LONG_TABLE }))),
  // Rasmus sits at RASMUS_SEAT_POS when the order is complete: his table is RASMUS_TABLE_OFFSET_X to the right of the seat,
  // and the chair at the seat itself (facing +x) is the one he sits on.
  { x: RASMUS_TABLE_POS[0], z: RASMUS_TABLE_POS[2], ...RASMUS_TABLE },
]
// [x, z, rotY] of every chair: left of the table, facing +x, and right of it, facing -x.
export const IKEA_CHAIRS = IKEA_TABLES.flatMap(({ x, z, chairDz }) =>
  chairDz.flatMap((dz) => [[x - CHAIR_OFFSET_X, z + dz, Math.PI / 2], [x + CHAIR_OFFSET_X, z + dz, -Math.PI / 2]]),
)

// Serving counter by the kiosk (centred on x = 0 and TRAY_POS z) and the tray rack beside it. w is along x, d along z.
export const COUNTER = { w: 3.2, d: 0.9 }
export const TRAY_RACK = { position: [-3.2, 0, 0.8], w: 1.4, d: 0.7 }

// Drink station footprint relative to DRINK_STATION_POS in the station's own frame (+z = the way its screen faces): the
// cabinet, the drip tray in front and the cup shelf at its side (+x).
export const DRINK_STATION_FOOTPRINT = { minX: -0.61, maxX: 0.96, minZ: -0.31, maxZ: 0.5 }

// Kitchen department: fitted kitchens along the back wall, display islands and the knife shelf. w is along x, d along z.
export const KITCHEN_UNITS = { xs: [-24, -20.5, -13, -9.5], w: 3.05, d: 0.85, z: IKEA_ROOM.minZ + 0.45 }
export const KITCHEN_ISLANDS = { positions: [[-21.5, -13], [-11, -17.5], [-21.5, -7]], w: 3.1, d: 1.3 }
// The shelf's group sits offsetZ from KNIFE_SHELF_POS (just behind it); minZ/maxZ span the back panel and the shelves in it.
export const KNIFE_SHELF = { w: 2.4, offsetZ: -0.8, minZ: -0.1, maxZ: 0.45 }

// Drink menu, in the order shown. Only CORRECT_DRINK delivers; every other choice is a loss ('wrongDrink').
export const DRINKS = ['water', 'sparkling', 'lemonade', 'elderflower', 'lingon', 'raspberry', 'cola', 'colaLight']
export const CORRECT_DRINK = 'lingon'

// Interaction reach (world units, horizontal distance) for the F key / "Use" button.
export const INTERACT_RANGE = 1.5

// 'drink' starts: Rasmus says "Lingondryck" this long after (ms); then ikeaDrinkAsked is true.
export const IKEA_DRINK_ASK_MS = 2000
// After a wrong drink Rasmus runs at the player this long (ms) before the jumpscare and game over.
export const IKEA_WRONG_DRINK_MS = 2500

/**
 * The interactable closest to the player within INTERACT_RANGE (horizontal distance), whatever the game state.
 * @returns {null|'tray'|'table'|'drinkStation'}
 */
export function nearestInteractable(x, z) {
  let best = null
  let bestDist = INTERACT_RANGE
  for (const [id, pos] of [['tray', TRAY_POS], ['table', RASMUS_TABLE_POS], ['drinkStation', DRINK_STATION_POS]]) {
    const d = Math.hypot(pos[0] - x, pos[2] - z)
    if (d <= bestDist) {
      best = id
      bestDist = d
    }
  }
  return best
}

/**
 * The target the player can actually use now: the nearby interactable (see nearestInteractable) if the game state allows it.
 *  - 'tray'         ikeaPhase 'serve', nothing carried;
 *  - 'table'        'serve' with the tray in hand AND Rasmus seated (serving is blocked until he sits), or
 *                   'deliverDrink' with the glass in hand;
 *  - 'drinkStation' ikeaPhase 'drink' and Rasmus has asked for the drink (ikeaDrinkAsked: the "Lingondryck" clip has played).
 * @returns {null|'tray'|'table'|'drinkStation'}
 */
export function validInteractTarget(near, { ikeaPhase, ikeaCarrying, ikeaRasmusSeated, ikeaDrinkAsked }) {
  if (near === 'tray') return ikeaPhase === 'serve' && ikeaCarrying === null ? near : null
  if (near === 'table') {
    const serving = ikeaPhase === 'serve' && ikeaCarrying === 'tray' && ikeaRasmusSeated
    return serving || (ikeaPhase === 'deliverDrink' && ikeaCarrying === 'drink') ? near : null
  }
  if (near === 'drinkStation') return ikeaPhase === 'drink' && ikeaDrinkAsked ? near : null
  return null
}

// The knife shelf in the kitchen department, far from the kiosk.
export const KNIFE_SHELF_POS = [-16, 0, -14]

// Rasmus' walk from the knife shelf to the kiosk (waypoints, first = shelf, last = just in front of and to the left of the
// player). The player looks along -z (yaw 0), so the whole walk stays within about 40 degrees of the view axis: he is in
// sight the entire time, never behind the player. The last two legs pass between the tray rack (x -3.9..-2.5) and the counter.
export const RASMUS_PATH = [
  KNIFE_SHELF_POS,
  [-9, 0, -9],
  [-4, 0, -4],
  [-2.05, 0, -0.5],
  [-2.05, 0, 1.9],
  [-0.9, 0, 1.9],
]

// NOTE: rasmusPositionAt / rasmusDistanceAt give the *logical* position. The visual
// Rasmus (Rasmus.jsx) eases toward it in useFrame, because ikeaTimeLeft only ticks
// every 0.25 s. Gameplay (distance meter, footsteps) reads the logical value.

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

/** Total length of RASMUS_PATH in world units. */
export const RASMUS_PATH_LENGTH = totalLength

/** Walked distance in world units at `progress` (0..1, clamped). */
export function rasmusDistanceAt(progress) {
  return Math.min(1, Math.max(0, progress)) * totalLength
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
