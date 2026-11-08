// Collision boxes of the IKEA level (level 4, Rasmus): the four outer walls, the
// restaurant tables with their chairs, the serving counter and tray rack, the
// kiosk, the drink station and the kitchen department (IkeaStore.jsx,
// DrinkStation.jsx). Built from src/levels/ikeaLayout.js, the same numbers the
// meshes use. Astrid and Rasmus are not solid (no NPC collision). While serving,
// IKEA_BOUNDS keeps the player on the restaurant side, so the kitchen department
// and the kiosk behind the counter are out of reach; they block all the same.
import { boxAt, roomWalls } from '../../utils/collision'
import {
  IKEA_ROOM, IKEA_WALL, IKEA_TABLES, TABLE_DEPTH, CHAIR_SIZE, CHAIR_OFFSET_X, COUNTER, TRAY_RACK, TRAY_POS, KIOSK_POS, KIOSK_SIZE,
  DRINK_STATION_POS, DRINK_STATION_FACING, DRINK_STATION_FOOTPRINT, KITCHEN_UNITS, KITCHEN_ISLANDS, KNIFE_SHELF, KNIFE_SHELF_POS,
} from '../ikeaLayout'

export const IKEA_WALLS = roomWalls(IKEA_ROOM, IKEA_WALL)

/**
 * One box per table, covering the table top and the chairs on both sides: the gap
 * between a chair and the table (0.15) and between two chairs is too narrow for the
 * player's circle, so there is nothing to walk into between them.
 */
export const IKEA_TABLE_COLLIDERS = IKEA_TABLES.map(({ x, z, length, chairDz }) => {
  const reach = CHAIR_OFFSET_X + CHAIR_SIZE / 2
  const half = Math.max(length / 2, Math.max(...chairDz.map(Math.abs)) + CHAIR_SIZE / 2)
  return { name: `table-${x}-${z}`, ...boxAt(x, z, Math.max(TABLE_DEPTH, 2 * reach), 2 * half) }
})

export const COUNTER_COLLIDER = { name: 'counter', ...boxAt(0, TRAY_POS[2], COUNTER.w, COUNTER.d) }
export const TRAY_RACK_COLLIDER = { name: 'tray-rack', ...boxAt(TRAY_RACK.position[0], TRAY_RACK.position[2], TRAY_RACK.w, TRAY_RACK.d) }
export const KIOSK_COLLIDER = { name: 'kiosk', ...boxAt(KIOSK_POS[0], KIOSK_POS[2], KIOSK_SIZE[0], KIOSK_SIZE[2]) }

/**
 * The drink station: its footprint (station frame: cabinet, drip tray, cup shelf)
 * turned to face DRINK_STATION_FACING, as DrinkStation.jsx rotates it
 * (rotation y = atan2(facing x, facing z)): a local point (lx, lz) lands at
 * (px + lx cos + lz sin, pz - lx sin + lz cos).
 */
export const DRINK_STATION_COLLIDER = (() => {
  const yaw = Math.atan2(DRINK_STATION_FACING[0], DRINK_STATION_FACING[2])
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const { minX, maxX, minZ, maxZ } = DRINK_STATION_FOOTPRINT
  const corners = [[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]].map(([lx, lz]) => [
    DRINK_STATION_POS[0] + lx * cos + lz * sin,
    DRINK_STATION_POS[2] - lx * sin + lz * cos,
  ])
  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  return { name: 'drink-station', minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
})()

export const KITCHEN_COLLIDERS = [
  ...KITCHEN_UNITS.xs.map((x) => ({ name: `kitchen-${x}`, ...boxAt(x, KITCHEN_UNITS.z, KITCHEN_UNITS.w, KITCHEN_UNITS.d) })),
  ...KITCHEN_ISLANDS.positions.map(([x, z]) => ({ name: `island-${x}-${z}`, ...boxAt(x, z, KITCHEN_ISLANDS.w, KITCHEN_ISLANDS.d) })),
  (() => {
    const z = KNIFE_SHELF_POS[2] + KNIFE_SHELF.offsetZ
    return { name: 'knife-shelf', minX: KNIFE_SHELF_POS[0] - KNIFE_SHELF.w / 2, maxX: KNIFE_SHELF_POS[0] + KNIFE_SHELF.w / 2, minZ: z + KNIFE_SHELF.minZ, maxZ: z + KNIFE_SHELF.maxZ }
  })(),
]

export const IKEA_COLLIDERS = [
  ...IKEA_WALLS,
  ...IKEA_TABLE_COLLIDERS,
  COUNTER_COLLIDER,
  TRAY_RACK_COLLIDER,
  KIOSK_COLLIDER,
  DRINK_STATION_COLLIDER,
  ...KITCHEN_COLLIDERS,
]
