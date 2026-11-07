// Unit tests for src/utils/collision.js (pure, no DOM). Run: npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveMovement, circleOverlapsBox, boxAt, roomWalls, PLAYER_RADIUS } from '../../src/utils/collision.js'

const R = 0.35
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} to be within ${eps} of ${expected}`)

// A wall in front of the player: x in [-5, 5], z in [-10.1, -9.9] (the player comes from +z).
const WALL = { minX: -5, maxX: 5, minZ: -10.1, maxZ: -9.9 }

test('no colliders: the move is applied as is', () => {
  assert.deepEqual(resolveMovement({ x: 1, z: 2 }, { x: 0.5, z: -0.25 }, []), { x: 1.5, z: 1.75 })
  assert.deepEqual(resolveMovement({ x: 1, z: 2 }, { x: 0.5, z: -0.25 }, null), { x: 1.5, z: 1.75 })
})

test('zero delta returns the same position as a new object', () => {
  const pos = { x: 1, z: 2 }
  const out = resolveMovement(pos, { x: 0, z: 0 }, [WALL])
  assert.deepEqual(out, pos)
  assert.notEqual(out, pos)
})

test('pure: inputs are not mutated', () => {
  const pos = { x: 0, z: -9 }
  const delta = { x: 0, z: -2 }
  const boxes = [{ ...WALL }]
  resolveMovement(pos, delta, boxes, R)
  assert.deepEqual(pos, { x: 0, z: -9 })
  assert.deepEqual(delta, { x: 0, z: -2 })
  assert.deepEqual(boxes, [WALL])
})

test('walking straight into a wall stops the circle touching it', () => {
  const out = resolveMovement({ x: 0, z: -8 }, { x: 0, z: -5 }, [WALL], R)
  near(out.z, WALL.maxZ + R)
  assert.equal(out.x, 0)
  assert.equal(circleOverlapsBox(out.x, out.z, R, WALL), false)
})

test('a move that does not reach the wall is not shortened', () => {
  const out = resolveMovement({ x: 0, z: -8 }, { x: 0, z: -1 }, [WALL], R)
  assert.deepEqual(out, { x: 0, z: -9 })
})

test('moving away from a wall the circle is touching is free', () => {
  const start = { x: 0, z: WALL.maxZ + R }
  const out = resolveMovement(start, { x: 0, z: 1 }, [WALL], R)
  near(out.z, start.z + 1)
})

test('pressing into a wall frame after frame is stable (no drift, no creep through)', () => {
  let pos = { x: 0, z: -8 }
  for (let i = 0; i < 1000; i++) pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [WALL], R)
  near(pos.z, WALL.maxZ + R)
  assert.equal(circleOverlapsBox(pos.x, pos.z, R, WALL), false)
})

test('diagonal move into a wall slides along it', () => {
  const out = resolveMovement({ x: 0, z: -9 }, { x: 1, z: -2 }, [WALL], R)
  assert.equal(out.x, 1) // the component along the wall is kept
  near(out.z, WALL.maxZ + R) // the component into the wall is cut
})

test('a doorway in the wall lets the circle through, the wall beside it does not', () => {
  const room = { minX: -5, maxX: 5, minZ: -10, maxZ: 0 }
  const walls = roomWalls(room, 0.2, { openings: [{ side: 'minZ', at: 0, width: 2 }] })
  const through = resolveMovement({ x: 0, z: -8 }, { x: 0, z: -5 }, walls, R)
  assert.equal(through.z, -13)
  const blocked = resolveMovement({ x: 2, z: -8 }, { x: 0, z: -5 }, walls, R)
  near(blocked.z, -10 + 0.1 + R)
  // Too wide for the doorway: a circle of radius 1.1 does not fit through a 2-wide gap.
  const tooWide = resolveMovement({ x: 0, z: -8 }, { x: 0, z: -5 }, walls, 1.1)
  assert.ok(tooWide.z > -10)
})

test('rounded corners: brushing the end of a wall slides around it instead of catching', () => {
  // Wall end at x = 5. The circle passes at x = 5.2 (within the radius, beyond the corner).
  let pos = { x: 5.2, z: -8 }
  for (let i = 0; i < 100; i++) pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [WALL], R)
  assert.ok(pos.z < WALL.minZ - R, `expected to get past the wall end, stuck at z=${pos.z}`)
  assert.ok(pos.x >= 5.2, 'the slide pushes away from the corner, never into it')
  assert.equal(circleOverlapsBox(pos.x, pos.z, R, WALL), false)
})

test('a straight push at a flat face is not deflected sideways', () => {
  let pos = { x: 1.5, z: -8 }
  for (let i = 0; i < 100; i++) pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [WALL], R)
  assert.equal(pos.x, 1.5)
  near(pos.z, WALL.maxZ + R)
})

test('between two jambs closer than the diameter the circle rests without jitter', () => {
  const left = { minX: -5, maxX: -0.3, minZ: -10.1, maxZ: -9.9 }
  const right = { minX: 0.3, maxX: 5, minZ: -10.1, maxZ: -9.9 } // 0.6 gap, diameter 0.7
  let pos = { x: 0, z: -8 }
  const seen = []
  for (let i = 0; i < 100; i++) {
    pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [left, right], R)
    seen.push(pos.x)
  }
  assert.ok(pos.z > -9.9, 'does not fit through')
  assert.ok(seen.every((x) => Math.abs(x) < 1e-9), `x jittered: ${seen.slice(-5)}`)
})

test('sliding along a wall past the end of a wall meeting it at a right angle does not wedge', () => {
  // The yellow house seen from outside: east wall and back wall share the corner (7.5, -32.5).
  const east = { minX: 6.5, maxX: 7.5, minZ: -32.5, maxZ: -17.5 }
  const back = { minX: -7.5, maxX: 7.5, minZ: -32.5, maxZ: -31.5 }
  let pos = { x: 9, z: -24 }
  for (let i = 0; i < 60; i++) pos = resolveMovement(pos, { x: -0.25, z: -0.25 }, [east, back], R)
  assert.ok(pos.z < -32.5 - R, `expected to get past the corner, at ${JSON.stringify(pos)}`)
  assert.ok(pos.x < 7.5, `expected to go around it, at ${JSON.stringify(pos)}`)
  for (const b of [east, back]) assert.equal(circleOverlapsBox(pos.x, pos.z, R, b), false)
})

test('an inside corner stops both axes, and backing out of it is free', () => {
  const room = { minX: -5, maxX: 5, minZ: -10, maxZ: 0 }
  const walls = roomWalls(room, 0.2)
  let pos = { x: -3, z: -7 }
  for (let i = 0; i < 200; i++) pos = resolveMovement(pos, { x: -5 / 60, z: -5 / 60 }, walls, R)
  near(pos.x, -5 + 0.1 + R)
  near(pos.z, -10 + 0.1 + R)
  const back = resolveMovement(pos, { x: 1, z: 1 }, walls, R)
  near(back.x, pos.x + 1)
  near(back.z, pos.z + 1)
})

test('a circle that starts inside a box can leave it but not re-enter', () => {
  const desk = boxAt(0, 2, 1.2, 0.7)
  let pos = { x: 0, z: 2 } // the player's own desk in the classroom
  for (let i = 0; i < 20; i++) pos = resolveMovement(pos, { x: 0, z: 5 / 60 }, [desk], R)
  assert.ok(pos.z > desk.maxZ + R, `expected to walk out, at z=${pos.z}`)
  for (let i = 0; i < 40; i++) pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [desk], R)
  near(pos.z, desk.maxZ + R)
})

test('overlapping boxes (wall segments meeting at a corner) do not open a gap', () => {
  const a = { minX: -5, maxX: 0, minZ: -10.1, maxZ: -9.9 }
  const b = { minX: -0.5, maxX: 5, minZ: -10.1, maxZ: -9.9 }
  let pos = { x: -0.2, z: -8 }
  for (let i = 0; i < 100; i++) pos = resolveMovement(pos, { x: 0, z: -5 / 60 }, [a, b], R)
  near(pos.z, -9.9 + R)
})

test('a long random walk never ends inside a box', () => {
  // Deterministic LCG so the test is reproducible.
  let seed = 12345
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  const room = { minX: -7, maxX: 7, minZ: -7, maxZ: 7 }
  const boxes = [...roomWalls(room, 0.2, { openings: [{ side: 'maxZ', at: 0, width: 2.5 }] }), boxAt(0, -3, 2, 1.5), boxAt(5, 5, 2.5, 4), boxAt(-3, 3, 3, 1.2)]
  let pos = { x: 0, z: 0 }
  for (let i = 0; i < 20000; i++) {
    pos = resolveMovement(pos, { x: rnd() * 0.12, z: rnd() * 0.12 }, boxes, R)
    for (const b of boxes) assert.equal(circleOverlapsBox(pos.x, pos.z, R, b), false, `step ${i}: inside ${JSON.stringify(b)} at ${JSON.stringify(pos)}`)
  }
})

test('deterministic: the same inputs give the same output', () => {
  const boxes = [WALL, boxAt(2, -5, 1, 1)]
  const a = resolveMovement({ x: 1.7, z: -4.2 }, { x: 0.3, z: -0.6 }, boxes, PLAYER_RADIUS)
  const b = resolveMovement({ x: 1.7, z: -4.2 }, { x: 0.3, z: -0.6 }, boxes, PLAYER_RADIUS)
  assert.deepEqual(a, b)
})

test('boxAt builds the box of a mesh from centre and size', () => {
  assert.deepEqual(boxAt(1, -2, 4, 2), { minX: -1, maxX: 3, minZ: -3, maxZ: -1 })
})

test('roomWalls: four walls, openings split a wall, omit drops one', () => {
  const room = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }
  assert.equal(roomWalls(room, 0.2).length, 4)
  const withDoor = roomWalls(room, 0.2, { openings: [{ side: 'maxX', at: 0, width: 0.5 }] })
  assert.equal(withDoor.length, 5)
  const right = withDoor.filter((b) => b.minX === 0.9)
  assert.deepEqual(right.map((b) => [b.minZ, b.maxZ]), [[-1.1, -0.25], [0.25, 1.1]])
  assert.equal(roomWalls(room, 0.2, { omit: ['maxZ'] }).length, 3)
  // An opening wider than the wall removes it entirely.
  assert.equal(roomWalls(room, 0.2, { openings: [{ side: 'minZ', at: 0, width: 10 }] }).length, 3)
})
