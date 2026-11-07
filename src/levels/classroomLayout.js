// Layout of the classroom (Classroom.jsx, ClassroomExit.jsx). The meshes and the
// collision boxes (src/levels/colliders/classroom.js) are built from these same
// numbers, so they cannot drift apart. All coordinates are world coordinates.

/** Centre planes of the four walls (the meshes are positioned on them). The floor spans the same rectangle. */
export const CLASSROOM = { minX: -9, maxX: 9, minZ: -8, maxZ: 6.1 }
export const CLASSROOM_WALL = 0.2
export const CLASSROOM_HEIGHT = 4

/** Exit door on the right wall; ClassroomExit.jsx triggers near its centre. */
export const CLASSROOM_DOOR = { x: 8.85, y: 1.5, z: 4, width: 1.5, height: 3, depth: 0.1 }

/** Student desks: one at every (x, z) of the grid. The player sits at PLAYER_DESK (no chair there). */
export const DESK_COLUMNS_X = [-6, -3, 0, 3, 6]
export const DESK_ROWS_Z = [-4, -1, 2]
export const PLAYER_DESK = { x: 0, z: 2 }
/** Desk top (width along x, depth along z) and the chair behind it (+z), relative to the desk centre. */
export const DESK_TOP = { w: 1.2, d: 0.7 }
export const STUDENT_CHAIR = { w: 0.65, seatZ: 0.55, seatD: 0.6, backZ: 0.85, backD: 0.05 }

/** Teacher's desk at the front, with its chair behind it (+z), relative to the group position. */
export const TEACHER_DESK = { position: [0, 0, -6.5], w: 2.5, d: 1, chair: { z: 0.8, size: 0.8 } }

/** Bookshelf against the back wall. */
export const CLASSROOM_BOOKSHELF = { position: [-7, 1, 5.8], w: 3, d: 0.4 }
