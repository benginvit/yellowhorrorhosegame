// Collision boxes of the classroom (level 3): the walls with the exit door
// (Classroom.jsx, ClassroomExit.jsx), the student desks with their chairs, the
// teacher's desk and the bookshelf. Built from src/levels/classroomLayout.js,
// the same numbers the meshes use.
import { boxAt, roomWalls } from '../../utils/collision'
import {
  CLASSROOM, CLASSROOM_WALL, CLASSROOM_DOOR, DESK_COLUMNS_X, DESK_ROWS_Z, PLAYER_DESK, DESK_TOP, STUDENT_CHAIR, TEACHER_DESK, CLASSROOM_BOOKSHELF,
} from '../classroomLayout'

/** The four walls, the right one split around the door opening. */
export const CLASSROOM_WALLS = roomWalls(CLASSROOM, CLASSROOM_WALL, {
  openings: [{ side: 'maxX', at: CLASSROOM_DOOR.z, width: CLASSROOM_DOOR.width }],
})

/**
 * The closed exit door in that opening. Leaving is ClassroomExit.jsx's proximity
 * trigger (within 2.5 of the door once the player has the key, before touching
 * it); without the key the door blocks.
 */
export const CLASSROOM_DOOR_COLLIDER = { name: 'door', ...boxAt(CLASSROOM_DOOR.x, CLASSROOM_DOOR.z, CLASSROOM_DOOR.depth, CLASSROOM_DOOR.width) }

/**
 * One box per student desk: the desk top plus, where there is a chair, the chair
 * behind it (the player's own desk has none). The player starts standing in
 * their desk's box; resolveMovement lets a circle leave a box it starts in.
 */
export const STUDENT_DESKS = DESK_ROWS_Z.flatMap((z) =>
  DESK_COLUMNS_X.map((x) => {
    const isPlayerDesk = x === PLAYER_DESK.x && z === PLAYER_DESK.z
    const top = boxAt(x, z, DESK_TOP.w, DESK_TOP.d)
    if (isPlayerDesk) return { name: 'player-desk', ...top }
    const backZ = z + STUDENT_CHAIR.backZ + STUDENT_CHAIR.backD / 2
    return { name: `desk-${x}-${z}`, ...top, maxZ: Math.max(top.maxZ, backZ) }
  }),
)

/** Teacher's desk and chair as one box. */
export const TEACHER_DESK_COLLIDER = (() => {
  const [x, , z] = TEACHER_DESK.position
  const desk = boxAt(x, z, TEACHER_DESK.w, TEACHER_DESK.d)
  const chair = boxAt(x, z + TEACHER_DESK.chair.z, TEACHER_DESK.chair.size, TEACHER_DESK.chair.size)
  return {
    name: 'teacher-desk',
    minX: Math.min(desk.minX, chair.minX),
    maxX: Math.max(desk.maxX, chair.maxX),
    minZ: Math.min(desk.minZ, chair.minZ),
    maxZ: Math.max(desk.maxZ, chair.maxZ),
  }
})()

export const BOOKSHELF_COLLIDER = { name: 'bookshelf', ...boxAt(CLASSROOM_BOOKSHELF.position[0], CLASSROOM_BOOKSHELF.position[2], CLASSROOM_BOOKSHELF.w, CLASSROOM_BOOKSHELF.d) }

export const CLASSROOM_COLLIDERS = [...CLASSROOM_WALLS, CLASSROOM_DOOR_COLLIDER, ...STUDENT_DESKS, TEACHER_DESK_COLLIDER, BOOKSHELF_COLLIDER]
