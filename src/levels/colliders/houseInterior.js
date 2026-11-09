// Collision boxes of Astrid's house (level 2, isInsideHouse): the inner walls
// (HouseInterior.jsx) with the front doorway, and the furniture (Furniture.jsx
// at the positions Game.jsx renders). Built from src/levels/houseLayout.js, the
// same numbers the meshes use.
import { boxAt, roomWalls } from '../../utils/collision'
import { HOUSE_POSITION, HOUSE_DOOR, INTERIOR_WALL, INTERIOR_WALL_AT, HOUSE_FURNITURE, FURNITURE_FOOTPRINT } from '../houseLayout'

const [hx, , hz] = HOUSE_POSITION

/** Back, left, right and the front wall split around the doorway (the same width as the front door). */
export const INTERIOR_WALLS = roomWalls(
  { minX: hx - INTERIOR_WALL_AT, maxX: hx + INTERIOR_WALL_AT, minZ: hz - INTERIOR_WALL_AT, maxZ: hz + INTERIOR_WALL_AT },
  INTERIOR_WALL,
  { openings: [{ side: 'maxZ', at: hx, width: HOUSE_DOOR.width }] },
)

/**
 * One box per piece of furniture, its main body's footprint. The bed is solid
 * on every side (see FURNITURE_FOOTPRINT): the way to it is its open long side.
 */
export const INTERIOR_FURNITURE = Object.entries(HOUSE_FURNITURE).map(([type, [x, , z]]) => ({
  name: type,
  ...boxAt(x, z, FURNITURE_FOOTPRINT[type].w, FURNITURE_FOOTPRINT[type].d),
}))

export const HOUSE_INTERIOR_COLLIDERS = [...INTERIOR_WALLS, ...INTERIOR_FURNITURE]
