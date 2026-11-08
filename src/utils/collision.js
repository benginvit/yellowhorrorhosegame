// Player collision: a circle (the player, seen from above) against axis-aligned
// boxes in the XZ plane. No physics engine: the move is resolved one axis at a
// time, so a move into a wall keeps its component along the wall (the player
// slides) and only the component into the wall is cut.
//
// Everything here is pure and deterministic: no state, no allocation beyond the
// returned object, the same inputs always give the same output (the e2e suite
// relies on that in frozen mode).

/** Radius of the player's collision circle (world units). Doorways are 1.5-2.5 wide. */
export const PLAYER_RADIUS = 0.35

// A circle that touches a box within this distance counts as touching, not as
// inside. Without it a circle parked exactly against a face (or, after a slide
// around a corner, within floating-point noise of one) could be mistaken for
// one that started inside the box and be let through.
const TOUCH_EPSILON = 1e-6

/**
 * Distance from `v` to the closed interval [min, max] (0 inside it).
 */
function gapToRange(v, min, max) {
  if (v < min) return min - v
  if (v > max) return v - max
  return 0
}

/**
 * True when the circle at (x, z) overlaps `box` ({ minX, maxX, minZ, maxZ }).
 * Touching (distance exactly radius, within floating-point noise) is not
 * overlapping: that is where resolveMovement parks a blocked circle.
 */
export function circleOverlapsBox(x, z, radius, box) {
  const dx = gapToRange(x, box.minX, box.maxX)
  const dz = gapToRange(z, box.minZ, box.maxZ)
  return dx * dx + dz * dz < radius * radius * (1 - TOUCH_EPSILON)
}

/**
 * Moves one coordinate by `delta` and stops it at the first box in the way.
 * `along` is the coordinate being moved and `across` the other (fixed) one.
 * Keys name the box fields of the moved axis (`min`/`max`) and the fixed axis
 * (`crossMin`/`crossMax`). Returns { value, nudge }: the resolved coordinate and
 * the tangential push on the cross axis a corner contact gives (0 at a flat
 * face or when nothing was hit).
 *
 * For a given cross offset the circle overlaps the box exactly when `along` is
 * inside (box.min - reach, box.max + reach), with reach = sqrt(r^2 - gap^2) -
 * full radius alongside the box, shrinking to 0 at the corners. Stopping at the
 * edge of that interval is what gives rounded corners: a player brushing a
 * corner slides around it instead of catching on it.
 *
 * A circle that already overlaps the box before the move (the player starts a
 * level standing in their own desk, or a box was placed on top of them) is never
 * blocked by it: the player can always walk out, but not back in.
 */
function resolveAxis(along, across, delta, boxes, radius, keys) {
  let target = along + delta
  let nudge = 0
  const r2 = radius * radius
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const crossMin = box[keys.crossMin]
    const crossMax = box[keys.crossMax]
    const gap = gapToRange(across, crossMin, crossMax)
    // Passes beside the box. A grazing contact (gap within floating-point noise of
    // the radius, reach ~ 0) counts as a miss too: sliding along one wall leaves
    // the circle exactly one radius from the end of a wall meeting it at a right
    // angle, and treating that as a hit wedged the player in the corner for good.
    const reach2 = r2 - gap * gap
    if (reach2 <= TOUCH_EPSILON * r2) continue
    const reach = Math.sqrt(reach2)
    const lo = box[keys.min] - reach
    const hi = box[keys.max] + reach
    if (along > lo + TOUCH_EPSILON && along < hi - TOUCH_EPSILON) continue // started inside: let it leave
    let stop
    if (delta > 0 && along <= lo + TOUCH_EPSILON && target > lo) stop = lo
    else if (delta < 0 && along >= hi - TOUCH_EPSILON && target < hi) stop = hi
    else continue
    // The part of the move this box cuts off. At a corner (gap > 0) the contact
    // normal is tilted, so that part has a component along the corner's arc: push
    // the circle that way on the cross axis, away from the box. Pushing straight
    // at a doorway jamb then slips into the doorway instead of resting on the
    // jamb's corner. At a flat face (gap = 0) there is nothing to deflect.
    const cut = Math.abs(target - stop)
    nudge = gap === 0 ? 0 : (across < crossMin ? -1 : 1) * cut * (reach * gap) / r2
    target = stop
  }
  return { value: target, nudge }
}

/**
 * Applies the tangential push of a corner contact on the cross axis, resolved
 * against the boxes like any move. If anything is in the way the push is dropped
 * entirely (rather than applied in part): between two jambs closer than the
 * circle's diameter a partial push would make the circle jitter from one corner
 * to the other.
 */
function applyNudge(across, along, nudge, boxes, radius, keys) {
  if (nudge === 0) return across
  const moved = resolveAxis(across, along, nudge, boxes, radius, keys).value
  return moved === across + nudge ? moved : across
}

const X_KEYS = { min: 'minX', max: 'maxX', crossMin: 'minZ', crossMax: 'maxZ' }
const Z_KEYS = { min: 'minZ', max: 'maxZ', crossMin: 'minX', crossMax: 'maxX' }

/**
 * Resolves a move of a circle (radius `radius`, centre `pos`) by `delta` against
 * `colliders` (array of { minX, maxX, minZ, maxZ }) and returns the new centre
 * { x, z }. The x component is resolved first, then z from the resolved x, so a
 * diagonal move into a wall slides along it; a move straight into the corner of a
 * box is deflected around the corner (see resolveAxis). Inputs are not mutated.
 *
 * Boxes may overlap each other (wall segments meeting at corners). Zero-size
 * boxes are valid. A zero `delta` returns `pos` unchanged (as a new object).
 */
export function resolveMovement(pos, delta, colliders, radius = PLAYER_RADIUS) {
  let x = pos.x
  let z = pos.z
  if (!colliders || colliders.length === 0) return { x: x + delta.x, z: z + delta.z }
  if (delta.x !== 0) {
    const r = resolveAxis(x, z, delta.x, colliders, radius, X_KEYS)
    x = r.value
    z = applyNudge(z, x, r.nudge, colliders, radius, Z_KEYS)
  }
  if (delta.z !== 0) {
    const r = resolveAxis(z, x, delta.z, colliders, radius, Z_KEYS)
    z = r.value
    x = applyNudge(x, z, r.nudge, colliders, radius, X_KEYS)
  }
  return { x, z }
}

/**
 * Helper for the level collider lists: a box from a centre and a full size,
 * the way the meshes are declared (position + boxGeometry args).
 */
export function boxAt(centerX, centerZ, sizeX, sizeZ) {
  return { minX: centerX - sizeX / 2, maxX: centerX + sizeX / 2, minZ: centerZ - sizeZ / 2, maxZ: centerZ + sizeZ / 2 }
}

/**
 * Helper for the level collider lists: the four walls of a rectangular room as
 * boxes of thickness `wall` centred on the wall planes `room` ({ minX, maxX, minZ,
 * maxZ }, the centre planes of the walls, as the meshes are positioned).
 * `openings` lists doorways to leave out: { side: 'minX'|'maxX'|'minZ'|'maxZ',
 * at: <coordinate along that wall>, width } - the wall on that side is split in two.
 * Sides listed in `omit` get no wall at all (an open front).
 */
export function roomWalls(room, wall, { openings = [], omit = [] } = {}) {
  const half = wall / 2
  const boxes = []
  const span = (side) => (side === 'minX' || side === 'maxX' ? [room.minZ - half, room.maxZ + half] : [room.minX - half, room.maxX + half])
  for (const side of ['minX', 'maxX', 'minZ', 'maxZ']) {
    if (omit.includes(side)) continue
    const [from, to] = span(side)
    // Split the wall's span at every opening on this side.
    let segments = [[from, to]]
    for (const o of openings.filter((o) => o.side === side)) {
      const next = []
      for (const [a, b] of segments) {
        const oa = o.at - o.width / 2
        const ob = o.at + o.width / 2
        if (ob <= a || oa >= b) next.push([a, b])
        else {
          if (oa > a) next.push([a, oa])
          if (ob < b) next.push([ob, b])
        }
      }
      segments = next
    }
    for (const [a, b] of segments) {
      if (side === 'minX' || side === 'maxX') boxes.push({ minX: room[side] - half, maxX: room[side] + half, minZ: a, maxZ: b })
      else boxes.push({ minX: a, maxX: b, minZ: room[side] - half, maxZ: room[side] + half })
    }
  }
  return boxes
}
