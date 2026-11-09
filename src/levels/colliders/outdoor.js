// Collision boxes of the outdoor levels (1-2 before entering, 5-7): the yellow
// house (House.jsx). Built from src/levels/houseLayout.js, the same numbers the
// meshes use. There are no other large objects outdoors: the ground is a plane,
// the key is picked up and the characters are not solid (no NPC collision).
import { boxAt, roomWalls } from '../../utils/collision'
import { HOUSE_POSITION, HOUSE_SIZE, HOUSE_DOOR, HOUSE_DOOR_FRAME } from '../houseLayout'

const [hx, , hz] = HOUSE_POSITION
const half = HOUSE_SIZE / 2
// The exterior is one solid box, so the "walls" can be as thick as they like:
// 1 unit, with their outer faces on the box faces. The only opening is where
// the door is.
const EXTERIOR_WALL = 1

/** The four exterior walls, the front one split around the door opening. */
export const HOUSE_WALLS = roomWalls(
  { minX: hx - half + EXTERIOR_WALL / 2, maxX: hx + half - EXTERIOR_WALL / 2, minZ: hz - half + EXTERIOR_WALL / 2, maxZ: hz + half - EXTERIOR_WALL / 2 },
  EXTERIOR_WALL,
  { openings: [{ side: 'maxZ', at: hx, width: HOUSE_DOOR.width }] },
)

/**
 * The closed front door (door + frame, from the wall face to the frame's front).
 * It fills the opening: the player cannot walk into the house here. Entering is
 * House.jsx's proximity trigger (within 3 of the door, i.e. before touching it),
 * for the Astrid level or once the key is found; without the key the door blocks.
 */
export const HOUSE_DOOR_COLLIDER = {
  ...boxAt(hx, 0, HOUSE_DOOR_FRAME.width, 0),
  minZ: hz + half,
  maxZ: hz + HOUSE_DOOR_FRAME.z + HOUSE_DOOR_FRAME.depth / 2,
}

export const OUTDOOR_COLLIDERS = [...HOUSE_WALLS, HOUSE_DOOR_COLLIDER]
