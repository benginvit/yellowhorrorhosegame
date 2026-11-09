// Unit tests for the IKEA collision boxes (src/levels/colliders/ikea.js): walls and
// tables block, and the serving flow (tray -> Rasmus' table -> drink station) can
// be reached on foot. Run: npm run test:unit
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

register('./resolve-js-hook.mjs', import.meta.url)
const { resolveMovement, circleOverlapsBox, PLAYER_RADIUS } = await import('../../src/utils/collision.js')
const layout = await import('../../src/levels/ikeaLayout.js')
const { IKEA_COLLIDERS, IKEA_TABLE_COLLIDERS, DRINK_STATION_COLLIDER } = await import('../../src/levels/colliders/ikea.js')

const { IKEA_BOUNDS, PLAYER_START, INTERACT_RANGE, nearestInteractable, RASMUS_TABLE_POS, DRINK_STATION_POS, TRAY_POS } = layout
const blocked = (x, z) => IKEA_COLLIDERS.some((b) => circleOverlapsBox(x, z, PLAYER_RADIUS, b))
const walk = (from, delta) => resolveMovement(from, delta, IKEA_COLLIDERS, PLAYER_RADIUS)

test('the four outer walls block', () => {
  const { minX, maxX, minZ, maxZ } = layout.IKEA_ROOM
  const half = layout.IKEA_WALL / 2
  assert.ok(walk({ x: 0, z: maxZ - 1 }, { x: 0, z: 3 }).z <= maxZ - half - PLAYER_RADIUS + 1e-9)
  assert.ok(walk({ x: maxX - 1, z: 5 }, { x: 3, z: 0 }).x <= maxX - half - PLAYER_RADIUS + 1e-9)
  assert.ok(walk({ x: minX + 1, z: 5 }, { x: -3, z: 0 }).x >= minX + half + PLAYER_RADIUS - 1e-9)
  assert.ok(walk({ x: 0, z: minZ + 1 }, { x: 0, z: -3 }).z >= minZ + half + PLAYER_RADIUS - 1e-9)
})

test('a restaurant table (with its chairs) blocks', () => {
  const t = IKEA_TABLE_COLLIDERS.find((b) => b.name === 'table-9-6')
  const out = walk({ x: (t.minX + t.maxX) / 2, z: t.minZ - 1 }, { x: 0, z: 3 })
  assert.ok(Math.abs(out.z - (t.minZ - PLAYER_RADIUS)) < 1e-9, `stopped at ${out.z}`)
})

test('the drink station blocks from the side its screen faces', () => {
  const out = walk({ x: DRINK_STATION_COLLIDER.maxX + 1.5, z: DRINK_STATION_POS[2] }, { x: -3, z: 0 })
  assert.ok(Math.abs(out.x - (DRINK_STATION_COLLIDER.maxX + PLAYER_RADIUS)) < 1e-9, `stopped at ${out.x}`)
})

test('the player starts clear of every box', () => {
  assert.equal(blocked(PLAYER_START[0], PLAYER_START[2]), false)
})

// Flood fill over the walkable floor inside IKEA_BOUNDS (0.1 grid, the player's circle against every box).
function reachable() {
  const STEP = 0.1
  const key = (i, j) => `${i},${j}`
  const seen = new Set([key(Math.round(PLAYER_START[0] / STEP), Math.round(PLAYER_START[2] / STEP))])
  const queue = [[Math.round(PLAYER_START[0] / STEP), Math.round(PLAYER_START[2] / STEP)]]
  const cells = []
  while (queue.length) {
    const [i, j] = queue.pop()
    cells.push([i * STEP, j * STEP])
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = (i + di) * STEP
      const z = (j + dj) * STEP
      if (x < IKEA_BOUNDS.minX || x > IKEA_BOUNDS.maxX || z < IKEA_BOUNDS.minZ || z > IKEA_BOUNDS.maxZ) continue
      if (seen.has(key(i + di, j + dj)) || blocked(x, z)) continue
      seen.add(key(i + di, j + dj))
      queue.push([i + di, j + dj])
    }
  }
  return cells
}

test('tray, Rasmus\' table and the drink station can each be used from floor the player can walk to', () => {
  const cells = reachable()
  for (const id of ['tray', 'table', 'drinkStation']) {
    assert.ok(cells.some(([x, z]) => nearestInteractable(x, z) === id), `no reachable spot within ${INTERACT_RANGE} of the ${id}`)
  }
})

test('the spots the e2e flow uses (helpers.js AT_*) are reachable and in range', () => {
  const cells = reachable()
  const at = (pos, [px, , pz]) => cells.some(([x, z]) => Math.hypot(x - pos[0], z - pos[1]) < 0.06) && Math.hypot(pos[0] - px, pos[1] - pz) <= INTERACT_RANGE
  assert.ok(at([0, 2.2], TRAY_POS), 'tray')
  assert.ok(at([4.25, 2.4], RASMUS_TABLE_POS), 'table')
  assert.ok(at([-2, 6], DRINK_STATION_POS), 'drink station')
})

test('the open floor between the counter, the tables and the station is one connected area', () => {
  const cells = reachable()
  const has = (x, z) => cells.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 0.06)
  assert.ok(has(-3, 4.6) && has(10, 3) && has(11.5, 9), 'start area reaches the far tables\' aisles')
})
