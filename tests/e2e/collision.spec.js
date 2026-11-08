import { test, expect } from '@playwright/test'
import { openFrozen, setCamera, startGame, waitReady, replayCdnFonts, trackErrors, expectNoErrors } from './helpers.js'

// Player collision (src/utils/collision.js, src/levels/colliders/*): walls and
// furniture block, doorways let the player through, a move into a wall slides
// along it and corners do not trap the player. Test build, frozen clock: the
// player walks by holding keys over advance() frames (Player.jsx: 5 units/s, yaw
// 0 = facing -z, so W = -z, S = +z, A = -x, D = +x) at 20 fps steps (0.25 units
// per frame: a stop lands on the obstacle regardless of the step, and software
// GL renders every frame). Positions are the camera's.
//
// Fonts: drei <Text> (Astrid's snore bubbles, the classroom) suspends the scene
// until its font has loaded: every level with text replays the committed font
// fixture (replayCdnFonts) so the tests do not depend on the CDN. On level 2 the
// first bubble mounts one render after the scene (Character.jsx renders them
// once its ref is set), so the already-mounted scene is hidden by <Suspense>
// until the font is in, and a hidden scene has no frame callbacks: keys held
// then do nothing. waitSnoreText waits for the bubble's glyphs before walking.
//
// Levels: 2 outside (Astrid sleeps outdoors, nothing chases; the house door
// enters without a key, so the door tests use level 1 away from the cat's start)
// and 2 inside (the hide timer runs: every test stays under Astrid's 4 s wake-up),
// 3 (classroom, 'seated' intro: the shots come after 7 s of test time).
// and 4 (IKEA, phase 'serve': the player is free to walk and the walls, tables and drink station block).

const RADIUS = 0.35 // PLAYER_RADIUS
const FPS = 20

const advance = (page, frames) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n, 1 / 20), frames)
const position = (page) =>
  page.evaluate(() => {
    const p = window.__YHH_TEST_MODE__.camera.position
    return { x: p.x, z: p.z }
  })

/** Holds `keys` for `seconds` of frozen time and releases them. */
async function walk(page, keys, seconds) {
  for (const k of keys) await page.keyboard.down(k)
  await advance(page, Math.round(seconds * FPS))
  for (const k of keys) await page.keyboard.up(k)
}

/**
 * Level 2 only: waits until Astrid's first snore bubble (<Text>) has its glyph
 * geometry, i.e. the font is loaded, the Suspense boundary has resolved and the
 * scene (with the Player's frame callback) is shown again. Renders frames with
 * dt = 0 meanwhile so React commits land; the frozen clock does not move.
 */
async function waitSnoreText(page) {
  await page.waitForFunction(() => {
    const api = window.__YHH_TEST_MODE__
    api.advance(1, 0)
    let synced = false
    api.scene.traverse((o) => {
      const g = o.geometry
      if (g?.isInstancedBufferGeometry && g.attributes.position && Number.isFinite(g.instanceCount)) synced = true
    })
    return synced
  }, null, { timeout: 30_000, polling: 100 })
}

/** Puts the player at (x, z) and renders one frame so the pose is committed. */
async function placeAt(page, x, z) {
  await setCamera(page, x, z)
  await advance(page, 1)
}

const near = (value, expected, tolerance = 0.01) => expect(Math.abs(value - expected), `expected ${value} to be within ${tolerance} of ${expected}`).toBeLessThanOrEqual(tolerance)

test.describe('collision: outdoors (the house)', () => {
  // House.jsx: front wall face at z = -17.5, x in [-7.5, 7.5]; door opening x in [-1.25, 1.25], door front at z = -17.1.
  const FRONT_FACE = -17.5
  const DOOR_FRONT = -17.1
  const openOutside = async (page, level) => {
    await replayCdnFonts(page)
    await openFrozen(page, { level })
    if (level === 2) await waitSnoreText(page)
  }

  test('walking straight at the front wall stops the player at the wall', async ({ page }) => {
    const errors = trackErrors(page)
    await openOutside(page, 2)
    await placeAt(page, 4, -16)
    await walk(page, ['KeyW'], 0.5) // 2.5 units: would end at z = -18.5, inside the house
    const p = await position(page)
    near(p.z, FRONT_FACE + RADIUS)
    near(p.x, 4)
    expectNoErrors(errors)
  })

  test('the closed door blocks without the key (level 1)', async ({ page }) => {
    const errors = trackErrors(page)
    await openOutside(page, 1)
    await placeAt(page, 0, -14) // 8.9 from the cat's start (-8, -18): no hit within this walk
    await walk(page, ['KeyW'], 0.7)
    const p = await position(page)
    near(p.z, DOOR_FRONT + RADIUS)
    near(p.x, 0)
    expectNoErrors(errors)
  })

  test('a diagonal move into the wall slides along it', async ({ page }) => {
    const errors = trackErrors(page)
    await openOutside(page, 2)
    await placeAt(page, 3, -15)
    await walk(page, ['KeyW', 'KeyD'], 0.6) // -z blocked after 0.43 s, +x keeps going (3 units, still along the wall)
    const p = await position(page)
    near(p.z, FRONT_FACE + RADIUS)
    near(p.x, 6)
    expectNoErrors(errors)
  })

  test('sliding along a wall carries the player around its outside corner', async ({ page }) => {
    const errors = trackErrors(page)
    await openOutside(page, 2)
    await placeAt(page, 9, -30) // east of the house (east face x = 7.5), moving south-west
    await walk(page, ['KeyW', 'KeyA'], 1.2)
    const p = await position(page)
    expect(p.z, 'passed the south-east corner (z = -32.5)').toBeLessThan(-32.5 - RADIUS)
    expect(p.x, 'went around it, behind the house').toBeLessThan(7.5)
    expectNoErrors(errors)
  })
})

test.describe("collision: Astrid's house", () => {
  // HouseInterior.jsx: front wall plane z = -18 (0.2 thick), doorway x in [-1.25, 1.25]; table at (0, -28) 2 x 1.5;
  // bed at (5, -21.5) 2.5 x 4: x in [3.75, 6.25], foot end (front) at z = -19.5.
  const FRONT_OUTER_FACE = -17.9
  const TABLE_FRONT = -27.25
  const BED_SIDE = 3.75
  const BED_FOOT = -19.5
  const open = async (page) => {
    await replayCdnFonts(page)
    await openFrozen(page, { level: 2, inside: true })
    await waitSnoreText(page)
  }

  test('the doorway lets the player in', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 0, -16)
    await walk(page, ['KeyW'], 1)
    const p = await position(page)
    expect(p.z, 'inside the house').toBeLessThan(-19)
    near(p.x, 0)
    expectNoErrors(errors)
  })

  test('walking in through the door puts the player inside the room, facing in', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 2 }) // outside
    await waitSnoreText(page)
    await placeAt(page, 0, -15) // 2.4 from the door: inside the entry trigger
    await advance(page, 5)
    await page.waitForFunction(() => { window.__YHH_TEST_MODE__.advance(1, 0); return window.__YHH_TEST_MODE__.camera.position.z < -18.5 }, null, { timeout: 30_000, polling: 100 })
    await waitSnoreText(page)
    const entry = await position(page)
    expect(entry.z, 'inside the front wall (inner face z = -18.1)').toBeLessThan(-18.1 - RADIUS)
    near(entry.x, 0)
    const facing = await page.evaluate(() => {
      const { x, y, z, w } = window.__YHH_TEST_MODE__.camera.quaternion // forward = q * (0, 0, -1)
      return { x: -2 * (x * z + w * y), z: -(1 - 2 * (x * x + y * y)) }
    })
    near(facing.x, 0, 0.05) // yaw 0: looking straight into the room (-z)
    near(facing.z, -1, 0.05)
    await walk(page, ['KeyW'], 0.5)
    const moved = await position(page)
    expect(moved.z, 'free to walk on into the room').toBeLessThan(entry.z - 1)
    expectNoErrors(errors)
  })

  test('the wall beside the doorway blocks', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, -4, -16)
    await walk(page, ['KeyW'], 0.6)
    const p = await position(page)
    near(p.z, FRONT_OUTER_FACE + RADIUS)
    expectNoErrors(errors)
  })

  test('the table blocks', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 0, -26)
    await walk(page, ['KeyW'], 0.5)
    const p = await position(page)
    near(p.z, TABLE_FRONT + RADIUS)
    expectNoErrors(errors)
  })

  test('the bed blocks from its long side', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 2.5, -21.5)
    await walk(page, ['KeyD'], 0.5)
    const p = await position(page)
    near(p.x, BED_SIDE - RADIUS)
    near(p.z, -21.5)
    expectNoErrors(errors)
  })

  test('the bed blocks from its foot end, and the hide prompt shows there (BENG-108)', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 5, -18.5) // between the front wall (inner face z = -18.1) and the foot end
    await walk(page, ['KeyW'], 0.5)
    const p = await position(page)
    near(p.z, BED_FOOT + RADIUS)
    near(p.x, 5)
    // BedInteraction: within BED_REACH (1.2) of the foot end's middle (5, -19.5) the "crawl in" prompt is up.
    await advance(page, 2)
    await expect(page.getByTestId('hide-prompt')).toBeVisible()
    expectNoErrors(errors)
  })

  test('an inside corner stops the player, who can walk back out', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, -5.5, -30) // towards the back-left corner (inner faces x = -6.9, z = -31.9)
    await walk(page, ['KeyW', 'KeyA'], 0.6)
    const corner = await position(page)
    near(corner.x, -6.9 + RADIUS)
    near(corner.z, -31.9 + RADIUS)
    await walk(page, ['KeyS', 'KeyD'], 0.3)
    const out = await position(page)
    near(out.x, corner.x + 1.5)
    near(out.z, corner.z + 1.5)
    expectNoErrors(errors)
  })
})

test.describe('collision: classroom', () => {
  // Classroom.jsx: desks 1.2 x 0.7 at x in {-6,-3,0,3,6}, z in {-4,-1,2}, chair back to z + 0.875; teacher's desk z in [-7, -5.3]; door at x = 8.85 (0.1 thick), z in [3.25, 4.75].
  const open = async (page) => {
    await replayCdnFonts(page)
    await openFrozen(page, { level: 3 })
  }

  test('a student desk blocks', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 0, 0.5) // between the player's desk (z = 2) and the desk at (0, -1), whose chair back ends at z = -0.125
    await walk(page, ['KeyW'], 0.5)
    const p = await position(page)
    near(p.z, -0.125 + RADIUS)
    near(p.x, 0)
    expectNoErrors(errors)
  })

  test("the teacher's desk blocks", async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 0, -4.8)
    await walk(page, ['KeyW'], 0.5)
    const p = await position(page)
    near(p.z, -5.3 + RADIUS)
    expectNoErrors(errors)
  })

  test('the player can walk out of their own desk at the start', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page) // the camera starts at (0, 1.6, 2), the centre of the player's desk
    await walk(page, ['KeyS'], 0.5)
    const p = await position(page)
    near(p.z, 4.5)
    await walk(page, ['KeyW'], 0.5) // ... and cannot walk back into it
    near((await position(page)).z, 2.35 + RADIUS)
    expectNoErrors(errors)
  })

  test('the closed exit door blocks without the key', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 7.5, 4)
    await walk(page, ['KeyD'], 0.5)
    const p = await position(page)
    near(p.x, 8.8 - RADIUS) // the door, not the 8.5 clamp of inClassroom
    near(p.z, 4)
    expectNoErrors(errors)
  })
})

test.describe('collision: IKEA', () => {
  // IkeaStore.jsx: side walls on x = 14 and z = 12 (0.2 thick, planes at the room edge); the table at (9, 6) is 2.2 wide with its
  // chairs (x 7.9..10.1) and z 4.8..7.2; Rasmus' table (4.25, 1.2) is z 0.4..2.0; the drink station cabinet block ends at x = -2.5.
  // IKEA_BOUNDS (x -9..13, z 1.8..11) clamps the player first on the +x and +z sides, so the outer walls are covered by the unit tests.
  const open = async (page) => {
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'serve' })
  }

  test('a restaurant table blocks, with its chairs', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 9, 3.2)
    await walk(page, ['KeyS'], 0.5) // 2.5 units: would end at z = 5.7, on the table
    const p = await position(page)
    near(p.z, 4.8 - RADIUS)
    near(p.x, 9)
    expectNoErrors(errors)
  })

  test("Rasmus' table blocks, and can be reached from its end", async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 4.25, 3.5)
    await walk(page, ['KeyW'], 0.5)
    const p = await position(page)
    near(p.z, 2.0 + RADIUS)
    near(p.x, 4.25)
    expect(Math.hypot(p.x - 4.25, p.z - 1.2), 'within the interaction range (1.5) of the table').toBeLessThan(1.5)
    expectNoErrors(errors)
  })

  test('the drink station blocks from the side its screen faces', async ({ page }) => {
    const errors = trackErrors(page)
    await open(page)
    await placeAt(page, 0, 6)
    await walk(page, ['KeyA'], 0.5)
    const p = await position(page)
    near(p.x, -2.5 + RADIUS)
    near(p.z, 6)
    expectNoErrors(errors)
  })
})

test.describe('collision: ?colliders=1 debug wireframes', () => {
  const countBoxes = (page) =>
    page.evaluate(() => {
      let n = 0
      window.__YHH_TEST_MODE__.scene.traverse((o) => {
        if (o.name === 'collider-debug-box') n++
      })
      return n
    })

  test('draws one wireframe box per collider in the classroom', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await page.goto('/?seed=1&freeze=1&level=3&colliders=1')
    await startGame(page)
    await waitReady(page)
    await advance(page, 1)
    // 5 wall segments + door + 15 desks + teacher's desk + bookshelf (levels/colliders/classroom.js)
    expect(await countBoxes(page)).toBe(23)
    expectNoErrors(errors)
  })

  test('draws nothing without the flag', async ({ page }) => {
    await replayCdnFonts(page)
    await openFrozen(page, { level: 3 })
    expect(await countBoxes(page)).toBe(0)
  })
})
