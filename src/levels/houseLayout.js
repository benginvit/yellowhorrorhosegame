// Layout of the yellow house: the exterior (House.jsx, outdoor levels), Astrid's
// interior (HouseInterior.jsx, level 2 with isInsideHouse) and its furniture
// (Furniture.jsx, placed in Game.jsx). The meshes and the collision boxes
// (src/levels/colliders/outdoor.js, houseInterior.js) are built from these same
// numbers, so they cannot drift apart. Local = relative to HOUSE_POSITION.

/** <group> position of both House and HouseInterior (world). */
export const HOUSE_POSITION = [0, 0, -25]

/** Exterior box (x and z) and its height. */
export const HOUSE_SIZE = 15
export const HOUSE_HEIGHT = 8

/** Front door (local): centred on x = 0 in the front wall (+z). z is its centre, in front of the wall face at HOUSE_SIZE / 2. */
export const HOUSE_DOOR = { width: 2.5, height: 4.5, depth: 0.3, z: 7.6 }
export const HOUSE_DOOR_FRAME = { width: 3, height: 5, depth: 0.2, z: 7.8 }

/** Interior: floor span, wall thickness and the local |x| / |z| of the wall centre planes. */
export const INTERIOR_SIZE = 14
export const INTERIOR_WALL = 0.2
export const INTERIOR_WALL_AT = 7

/**
 * Furniture positions (world, y = 0), as rendered in Game.jsx. The bed's foot
 * end (its front, +z, where the player crawls under it - levels/astridLayout.js)
 * is 1.9 from the front wall's inner face: room enough to stand in front of it
 * within BED_REACH (1.2). Against the wall (z = -20) the foot end was inside
 * the wall plane and could only be reached from outside the house.
 */
export const HOUSE_FURNITURE = {
  sofa: [-3, 0, -22],
  bookshelf: [3, 0, -24],
  table: [0, 0, -28],
  bed: [5, 0, -21.5],
}

/**
 * Footprint (width along x, depth along z) of each furniture type's main body
 * in Furniture.jsx. The bed is solid all round; it is reached from its foot
 * end (front) or its open long side towards the room (-x).
 */
export const FURNITURE_FOOTPRINT = {
  sofa: { w: 3, d: 1.2 },
  table: { w: 2, d: 1.5 },
  bookshelf: { w: 2, d: 0.5 },
  bed: { w: 2.5, d: 4 },
}
