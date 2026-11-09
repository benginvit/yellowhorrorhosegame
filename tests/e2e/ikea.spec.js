import { test, expect } from '@playwright/test'
import { trackErrors, openFrozen, replayCdnFonts, expectNoErrors, setCamera, useAt, serveAndDrink, expectCarrying, AT_TRAY, AT_TABLE, AT_STATION } from './helpers.js'
import { rasmusPositionAt, RASMUS_SEAT_POS, IKEA_ORDER_SECONDS, IKEA_BOUNDS, IKEA_DRINK_ASK_MS, IKEA_WRONG_DRINK_MS, DRINKS, CORRECT_DRINK } from '../../src/levels/ikeaLayout.js'

// IKEA level (level 4, Rasmus) on the frozen clock. Only the "test" project matches this file (playwright.config.js).
// The kiosk is driven through its data-testid hooks (see OrderKiosk.jsx). The IKEA
// scene renders slowly on software GL, so every test gets a long timeout and most
// clock steps use a coarse dt (1/20); the exact step size does not matter, the game
// timers fire from advance() on the frozen clock.

test.setTimeout(240_000)

const IKEA_WRONG_DRINK_SECONDS = IKEA_WRONG_DRINK_MS / 1000

const ADVANCE = (page, seconds, dt = 1 / 20) =>
  page.evaluate(([s, step]) => window.__YHH_TEST_MODE__.advance(Math.round(s / step), step), [seconds, dt])

/**
 * Steps the frozen clock through the 8 s intro until the kiosk is up (the level chain only;
 * every other test starts in 'ordering' with ?phase=). The intro effect registers its timer on the frozen clock only
 * after the next advance(), so after the 8 s the clock goes on in small steps. The loop is bounded by clock time
 * (10 s of steps), never by wall-clock time.
 */
async function waitForOrdering(page) {
  await ADVANCE(page, 7)
  const start = page.getByTestId('ikea-start')
  for (let i = 0; i < 40 && !(await start.isVisible()); i++) await ADVANCE(page, 0.25)
  await expect(start).toBeVisible()
}

/** Opens level 4 straight in 'ordering' (kiosk up, 40 s countdown started). */
async function toOrdering(page) {
  await openFrozen(page, { level: 4, phase: 'ordering' })
  await expect(page.getByTestId('ikea-start')).toBeVisible()
}

/**
 * Plays the kiosk flow. The three interruptions come in a seeded order, so answer whichever
 * shows up. `sausage` answers the sausage offer with Yes (it must then be removed again).
 */
async function orderMeatballs(page, { sausage = false, tap = false } = {}) {
  const press = (id) => (tap ? page.getByTestId(id).tap() : page.getByTestId(id).click())
  await press('ikea-start')
  await press('ikea-category-main')
  if (tap) await expect(page.getByTestId('ikea-dish-meatballs')).toBeInViewport() // reachable without scrolling on a phone
  await press('ikea-dish-meatballs')
  for (let i = 0; i < 12; i++) await press('ikea-qty-plus')
  await press('ikea-qty-next')
  await press('ikea-side-mash')
  for (let i = 0; i < 3; i++) {
    const sausageBtn = page.getByTestId(sausage ? 'ikea-sausage-yes' : 'ikea-sausage-no')
    const familyNo = page.getByTestId('ikea-family-no')
    const loading = page.getByTestId('ikea-loading')
    await expect(sausageBtn.or(familyNo).or(loading)).toBeVisible()
    // Wait until the answered step is gone: the kiosk needs a frame to draw the next one.
    if (await loading.isVisible()) { await ADVANCE(page, 100 / 60, 1 / 60); await expect(loading).toHaveCount(0) }
    else if (await sausageBtn.isVisible()) { await press(sausage ? 'ikea-sausage-yes' : 'ikea-sausage-no'); await expect(sausageBtn).toHaveCount(0) }
    else { await press('ikea-family-no'); await expect(familyNo).toHaveCount(0) }
  }
  await expect(page.getByTestId('ikea-cart')).toBeVisible()
}

/** World position of the visual Rasmus (the group named "rasmus") and of the camera. */
const positions = (page) =>
  page.evaluate(() => {
    const api = window.__YHH_TEST_MODE__
    const r = api.scene.getObjectByName('rasmus')
    return { x: r.position.x, z: r.position.z, camX: api.camera.position.x, camZ: api.camera.position.z }
  })

test.describe('ikea-serving', () => {
  test('ordering: Rasmus walks toward the player in view, in front of the camera at progress 0.5', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'ordering' })
    // The whole walk (RASMUS_PATH) seen from the kiosk pose: his head is inside the view frustum for >= 80 % of it.
    const samples = Array.from({ length: 51 }, (_, i) => rasmusPositionAt(i / 50))
    const inView = await page.evaluate((points) => {
      const cam = window.__YHH_TEST_MODE__.camera
      cam.updateMatrixWorld()
      let n = 0
      for (const [x, , z] of points) {
        const v = cam.position.clone().set(x, 1.5, z).project(cam)
        if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) n++
      }
      return n / points.length
    }, samples)
    expect(inView, 'share of RASMUS_PATH inside the view from the kiosk').toBeGreaterThanOrEqual(0.8)

    await ADVANCE(page, IKEA_ORDER_SECONDS / 2) // ikeaTimeLeft 40 -> 20: progress 0.5
    await ADVANCE(page, 0.5, 1 / 60) // the visual Rasmus eases onto the logical position
    const r = await positions(page)
    const expected = rasmusPositionAt(0.5)
    expect(r.z, 'Rasmus is in front of the player (z < camera z)').toBeLessThan(r.camZ)
    expect(Math.hypot(r.x - expected[0], r.z - expected[2]), 'visual Rasmus sits on the logical path position').toBeLessThan(0.5)
    const onScreen = await page.evaluate(([x, z]) => {
      const cam = window.__YHH_TEST_MODE__.camera
      const v = cam.position.clone().set(x, 1.5, z).project(cam)
      return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
    }, [r.x, r.z])
    expect(onScreen, 'Rasmus is on screen at progress 0.5').toBe(true)
    expectNoErrors(errors)
  })

  test('serve: Rasmus walks to his seat and reports it (onIkeaRasmusSeated) before the fallback timer', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'serve' })
    await useAt(page, AT_TRAY) // tray in hand; he is still walking (ikeaObjServeWait)
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeWait')
    await ADVANCE(page, 2.5) // well before App's 4 s fallback: only Rasmus himself can have reported the seat
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeTable')
    const r = await positions(page)
    expect(Math.hypot(r.x - RASMUS_SEAT_POS[0], r.z - RASMUS_SEAT_POS[2]), 'Rasmus is at RASMUS_SEAT_POS').toBeLessThan(0.1)
    expectNoErrors(errors)
  })

  test('drink phase: lingonberry -> deliverDrink -> glass on the table -> level complete', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDrink')
    await useAt(page, AT_STATION)
    await expect(page.getByTestId('ikea-drink-menu')).toBeVisible()
    await page.getByTestId('ikea-drink-lingon').click()
    await expect(page.getByTestId('ikea-drink-menu')).toHaveCount(0)
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDeliverDrink') // deliverDrink
    await useAt(page, AT_TABLE)
    await expect(page.locator('.victory-screen')).toHaveCount(0) // 'won': level complete follows after ~4 s
    await ADVANCE(page, 4.5)
    await expect(page.locator('.victory-screen')).toBeVisible()
    expectNoErrors(errors)
  })

  test('drink phase: Rasmus\' "Lingondryck!" caption shows after ~2 s', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    await expect(page.getByTestId('ikea-subtitle')).toHaveCount(0)
    await ADVANCE(page, 2.5)
    await expect(page.getByTestId('ikea-subtitle')).toHaveText('Lingondryck!')
    await ADVANCE(page, 3.5)
    await expect(page.getByTestId('ikea-subtitle')).toHaveCount(0)
    expectNoErrors(errors)
  })

  test('drink menu: 8 buttons in order, no close button', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    await useAt(page, AT_STATION)
    const ids = await page.locator('[data-testid^="ikea-drink-"]:not([data-testid="ikea-drink-menu"])').evaluateAll((els) => els.map((e) => e.dataset.testid))
    expect(ids).toEqual(['water', 'sparkling', 'lemonade', 'elderflower', 'lingon', 'raspberry', 'cola', 'colaLight'].map((d) => `ikea-drink-${d}`))
    await expect(page.getByTestId('ikea-drink-close')).toHaveCount(0)
    expectNoErrors(errors)
  })

  // Every wrong drink ends the same way; cola (the neighbour of the right row) and raspberry (the look-alike) are the two the task names.
  for (const drink of ['cola', 'raspberry']) {
    test(`drink phase: the wrong drink (${drink}) -> lost -> Rasmus runs and stabs -> game over "Fel dryck!"`, async ({ page }) => {
      expect(DRINKS).toContain(drink)
      expect(drink).not.toBe(CORRECT_DRINK)
      const errors = trackErrors(page)
      await replayCdnFonts(page)
      await openFrozen(page, { level: 4, phase: 'drink' })
      await useAt(page, AT_STATION)
      await page.getByTestId(`ikea-drink-${drink}`).click()
      await expect(page.getByTestId('ikea-drink-menu')).toHaveCount(0)
      await expectCarrying(page, null) // a wrong drink is not handed over
      // The player cannot walk away while he runs (movement stopped, position kept: not teleported to PLAYER_START).
      const before = await positions(page)
      await page.keyboard.down('KeyW')
      await ADVANCE(page, 1)
      await page.keyboard.up('KeyW')
      await ADVANCE(page, IKEA_WRONG_DRINK_SECONDS - 1.5) // Rasmus is still running at the player, 0.5 s before the stab
      const after = await positions(page)
      expect([after.camX, after.camZ], 'the player did not move with W held').toEqual([before.camX, before.camZ])
      expect(Math.hypot(after.x - after.camX, after.z - after.camZ), 'Rasmus has reached the player').toBeLessThan(1.5)
      await expect(page.locator('.game-over-screen')).toHaveCount(0)
      await expect(page.locator('.victory-screen')).toHaveCount(0)
      await ADVANCE(page, 1.5) // past IKEA_WRONG_DRINK_MS in total: the stab and the game over
      await expect(page.locator('.game-over-screen')).toBeVisible()
      await expect(page.getByTestId('ikea-lose-reason')).toHaveText('Fel dryck!') // loseReason 'wrongDrink'
      await expect(page.locator('.victory-screen')).toHaveCount(0)
      expectNoErrors(errors)
    })
  }

  test('the drink station is not usable until Rasmus has said "Lingondryck" (ikeaDrinkAsked)', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    // ?phase=drink presets ikeaDrinkAsked, so the gate is reached through the real serve -> drink hand-off.
    await openFrozen(page, { level: 4, phase: 'serve' })
    await useAt(page, AT_TRAY)
    await ADVANCE(page, 4.5) // he is seated
    await useAt(page, AT_TABLE) // tray served: 'drink' starts, the clip is ~2 s away
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDrink')
    await expect(page.getByTestId('ikea-subtitle')).toHaveCount(0)

    await setCamera(page, ...AT_STATION)
    await ADVANCE(page, 0.2)
    await expect(page.getByTestId('ikea-use-hint'), 'no target at the station before he has asked').toHaveCount(0)
    await page.keyboard.press('KeyF')
    await ADVANCE(page, 0.1)
    await expect(page.getByTestId('ikea-drink-menu')).toHaveCount(0)
    await expect(page.getByTestId('ikea-subtitle')).toHaveCount(0) // still before the ask

    await ADVANCE(page, IKEA_DRINK_ASK_MS / 1000) // he says "Lingondryck"
    await expect(page.getByTestId('ikea-subtitle')).toHaveText('Lingondryck!')
    await setCamera(page, ...AT_STATION)
    await ADVANCE(page, 0.1)
    await expect(page.getByTestId('ikea-use-hint')).toBeVisible()
    await page.keyboard.press('KeyF')
    await expect(page.getByTestId('ikea-drink-menu')).toBeVisible()
    expectNoErrors(errors)
  })

  test('serving is blocked until Rasmus has sat down', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'serve' })
    await useAt(page, AT_TRAY)
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeWait') // tray in hand, he is still walking
    await setCamera(page, ...AT_TABLE)
    await ADVANCE(page, 0.2)
    await expect(page.getByTestId('ikea-use-hint')).toHaveCount(0) // no target at the table yet
    await page.keyboard.press('KeyF')
    await ADVANCE(page, 0.1)
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeWait') // still 'serve'
    await ADVANCE(page, 4.5) // he sits down
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeTable')
    await ADVANCE(page, 0.1) // the table was already the near target (ikeaNearTarget is reported whatever the state); seated makes it usable, a frame lets React commit the hint
    await expect(page.getByTestId('ikea-use-hint')).toBeVisible()
    await page.keyboard.press('KeyF')
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDrink') // 'drink'
    expectNoErrors(errors)
  })
})

test.describe('ikea-serving bounds', () => {
  // The player is clamped to IKEA_BOUNDS every frame (Player.jsx). Each case starts ~1.2 units inside one edge,
  // walks at it with a held key (yaw 0 faces -z: W = -z, S = +z, A = -x, D = +x) and must stop exactly on the edge.
  const EDGES = [
    { name: 'north (the counter side)', key: 'KeyW', from: [-6, IKEA_BOUNDS.minZ + 1.2], axis: 'z', edge: IKEA_BOUNDS.minZ, side: 'min' },
    { name: 'south', key: 'KeyS', from: [-6, IKEA_BOUNDS.maxZ - 1.2], axis: 'z', edge: IKEA_BOUNDS.maxZ, side: 'max' },
    { name: 'west', key: 'KeyA', from: [IKEA_BOUNDS.minX + 1.2, 6], axis: 'x', edge: IKEA_BOUNDS.minX, side: 'min' },
    { name: 'east', key: 'KeyD', from: [IKEA_BOUNDS.maxX - 1.2, 6], axis: 'x', edge: IKEA_BOUNDS.maxX, side: 'max' },
  ]
  for (const e of EDGES) {
    test(`the player cannot walk out of the restaurant: ${e.name} edge`, async ({ page }) => {
      const errors = trackErrors(page)
      await replayCdnFonts(page)
      await openFrozen(page, { level: 4, phase: 'drink' })
      await setCamera(page, ...e.from)
      await ADVANCE(page, 0.1)
      await page.keyboard.down(e.key)
      await ADVANCE(page, 4) // far more than the 1.2 units to the edge
      await page.keyboard.up(e.key)
      await ADVANCE(page, 0.1)
      const r = await positions(page)
      const got = e.axis === 'x' ? r.camX : r.camZ
      const start = e.axis === 'x' ? e.from[0] : e.from[1]
      expect(Math.abs(got - start), 'the player walked').toBeGreaterThan(1)
      expect(got, `stopped on the ${e.name} edge`).toBeCloseTo(e.edge, 1)
      expectNoErrors(errors)
    })
  }

  test('a position far outside the restaurant is pulled back inside on the next frame', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    for (const [x, z] of [[-40, -40], [40, 40], [-40, 40], [40, -40]]) {
      await setCamera(page, x, z)
      await ADVANCE(page, 0.1)
      const r = await positions(page)
      expect(r.camX).toBeGreaterThanOrEqual(IKEA_BOUNDS.minX - 1e-6)
      expect(r.camX).toBeLessThanOrEqual(IKEA_BOUNDS.maxX + 1e-6)
      expect(r.camZ).toBeGreaterThanOrEqual(IKEA_BOUNDS.minZ - 1e-6)
      expect(r.camZ).toBeLessThanOrEqual(IKEA_BOUNDS.maxZ + 1e-6)
    }
    expectNoErrors(errors)
  })
})

test.describe('ikea-outcomes', () => {
  test('early order (progress ~0.2): Rasmus still reaches his seat and reports it before the 4 s fallback', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)
    await ADVANCE(page, 3) // the kiosk flow below steps the clock up to ~5 s more (loading screens)
    await orderMeatballs(page)
    const width = await page.getByTestId('ikea-rasmus-bar').evaluate((el) => parseFloat(el.style.width))
    expect(width, 'the order finishes early, Rasmus far down the path').toBeLessThanOrEqual(25)
    await page.getByTestId('ikea-pay').click()
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', /ikeaObjServe/)
    await useAt(page, AT_TRAY) // <= 0.6 s of the clock
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeWait')
    await ADVANCE(page, 3) // 3.1-3.6 s since 'serve': only Rasmus himself can have reported (fallback at 4 s)
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeTable')
    const r = await positions(page)
    expect(Math.hypot(r.x - RASMUS_SEAT_POS[0], r.z - RASMUS_SEAT_POS[2]), 'Rasmus is at RASMUS_SEAT_POS').toBeLessThan(0.1)
    expectNoErrors(errors)
  })

  test('win: order via the kiosk -> serve -> drink -> won -> level complete -> level 5 Selma', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)
    await orderMeatballs(page)
    await page.getByTestId('ikea-pay').click()
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', /ikeaObjServe/) // the "order done" panel is gone in 'serve'
    await expect(page.getByTestId('ikea-done')).toHaveCount(0)
    await expect(page.locator('.victory-screen')).toHaveCount(0) // 'serve' follows: tray, table, drink, glass
    await serveAndDrink(page)
    await page.locator('.victory-screen .restart-btn').click()
    await expect(page.locator('.hud-item').first()).toContainText('5: Selma')
    expectNoErrors(errors)
  })

  test('loss: Rasmus arrives after 40 s -> game over; looking back does not stop the countdown', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'ordering' })
    await expect(page.locator('.hud-item').first()).toContainText('Rasmus')
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    await expect(page.getByTestId('ikea-rasmus-bar')).toHaveAttribute('style', /width: 0%/) // the 40 s start here
    await expect(page.locator('.game-over-screen')).toHaveCount(0)

    await page.getByTestId('ikea-look-back').click() // looking back pauses the order, not the countdown
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)
    await page.getByTestId('ikea-look-back').click()
    await expect(page.getByTestId('ikea-start')).toBeVisible()

    await ADVANCE(page, 39) // 40 s not yet out
    await expect(page.locator('.game-over-screen')).toHaveCount(0)
    await ADVANCE(page, 1.5)
    await expect(page.locator('.game-over-screen')).toBeVisible()
    expectNoErrors(errors)
  })
})

test.describe('ikea-kiosk', () => {
  test('wrong choices give a back button, the quantity must be exactly 16, the sausage blocks payment until removed', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)

    await page.getByTestId('ikea-start').click()
    await page.getByTestId('ikea-category-drinks').click() // wrong
    await expect(page.getByTestId('ikea-error')).toBeVisible()
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-category-main').click()
    await page.getByTestId('ikea-dish-salmon').click() // wrong
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-dish-meatballs').click()

    const next = page.getByTestId('ikea-qty-next')
    await expect(page.getByTestId('ikea-qty-value')).toHaveText('4')
    await expect(next).toBeDisabled()
    for (let i = 0; i < 11; i++) await page.getByTestId('ikea-qty-plus').click()
    await expect(page.getByTestId('ikea-qty-value')).toHaveText('15')
    await expect(next).toBeDisabled() // 15 is not enough
    await page.getByTestId('ikea-qty-plus').click()
    await expect(page.getByTestId('ikea-qty-value')).toHaveText('16')
    await expect(next).toBeEnabled()
    await page.getByTestId('ikea-qty-plus').click()
    await expect(next).toBeDisabled() // 17 is too many
    await page.getByTestId('ikea-qty-minus').click()
    await next.click()

    await page.getByTestId('ikea-side-fries').click() // wrong
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-side-mash').click()
    // The sausage is added when answering Yes; Pay stays blocked until it is removed.
    for (let i = 0; i < 3; i++) {
      const yes = page.getByTestId('ikea-sausage-yes')
      const familyNo = page.getByTestId('ikea-family-no')
      const loading = page.getByTestId('ikea-loading')
      await expect(yes.or(familyNo).or(loading)).toBeVisible()
      if (await loading.isVisible()) { await ADVANCE(page, 100 / 60, 1 / 60); await expect(loading).toHaveCount(0) }
      else if (await yes.isVisible()) { await yes.click(); await expect(yes).toHaveCount(0) }
      else { await familyNo.click(); await expect(familyNo).toHaveCount(0) }
    }
    await expect(page.getByTestId('ikea-pay')).toBeDisabled()
    await page.getByTestId('ikea-cart-remove-sausage').click()
    await expect(page.getByTestId('ikea-pay')).toBeEnabled()
    expectNoErrors(errors)
  })

  test('kiosk: meatballs are no. 3 of the main courses', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)
    await page.getByTestId('ikea-start').click()
    await page.getByTestId('ikea-category-main').click()
    await expect(page.getByTestId('ikea-dish-hotdog')).toBeVisible() // evaluateAll does not wait for the list to render
    const ids = await page.locator('[data-testid^="ikea-dish-"]').evaluateAll((els) => els.map((e) => e.dataset.testid))
    expect(ids).toEqual(['salmon', 'veggie', 'meatballs', 'chicken', 'hotdog'].map((d) => `ikea-dish-${d}`))
    // Side panel: the right ~40 % of the screen, the 3D view stays free on the left.
    const box = await page.locator('.ikea-side-panel').boundingBox()
    expect(box.x).toBeGreaterThan(1280 * 0.55)
    expect(page.viewportSize().width - (box.x + box.width)).toBeLessThanOrEqual(1)
    await expect(page.getByTestId('ikea-vignette')).toBeVisible()
    expectNoErrors(errors)
  })

  test('looking back (Space held) hides the kiosk and blocks input; releasing restores it', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)
    await page.getByTestId('ikea-start').click()
    await page.getByTestId('ikea-category-main').click()
    await expect(page.getByTestId('ikea-dish-meatballs')).toBeVisible()

    await page.keyboard.down('Space')
    await expect(page.getByTestId('ikea-dish-meatballs')).toHaveCount(0)
    await expect(page.getByTestId('ikea-pay')).toHaveCount(0)
    await page.keyboard.up('Space')
    await expect(page.getByTestId('ikea-dish-meatballs')).toBeVisible() // progress kept
    expectNoErrors(errors)
  })
})

test.describe('ikea-mobile (touch)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 740 } })

  test('the win flow works with touch in a phone viewport', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await toOrdering(page)
    await orderMeatballs(page, { tap: true })
    await expect(page.getByTestId('ikea-pay')).toBeInViewport()
    const panel = await page.locator('.ikea-side-panel').boundingBox()
    expect(panel.y, 'the panel sits in the bottom half').toBeGreaterThanOrEqual(740 / 2 - 1)
    await page.getByTestId('ikea-pay').tap()
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', /ikeaObjServe/)
    await serveAndDrink(page, { tap: true }) // incl. the "Use" button instead of F
    expectNoErrors(errors)
  })
})

test.describe('ikea-mobile drink (touch)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 740 } })

  test('"Use" button and drink menu work with touch: every drink is reachable, the wrong one loses', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    await useAt(page, AT_STATION, { tap: true }) // the on-screen "Use" button
    await expect(page.getByTestId('ikea-drink-menu')).toBeVisible()
    for (const d of DRINKS) await expect(page.getByTestId(`ikea-drink-${d}`), `${d} is on screen without scrolling`).toBeInViewport()
    await page.getByTestId('ikea-drink-raspberry').tap()
    await expect(page.getByTestId('ikea-drink-menu')).toHaveCount(0)
    await ADVANCE(page, IKEA_WRONG_DRINK_SECONDS + 1)
    await expect(page.locator('.game-over-screen')).toBeVisible()
    await expect(page.getByTestId('ikea-lose-reason')).toHaveText('Fel dryck!')
    expectNoErrors(errors)
  })
})

test.describe('level chain classroom (3) -> IKEA (4)', () => {
  test('finishing the classroom starts IKEA; ordering leads on to serving', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 3 })
    const hud = page.locator('.hud-item').first()
    await expect(hud).toContainText('3: Kerstin')
    const setCamera = (x, z) => page.evaluate(([px, pz]) => window.__YHH_TEST_MODE__.camera.position.set(px, 1.6, pz), [x, z])
    // Intro: shots at 7 s, candy 3 s later, Kerstin active at 12.5 s. React must commit each phase before
    // the next timer is registered on the frozen clock, so step in 0.25 s slices. The students eat some
    // candy pieces: visit them in order and wait for the HUD (without stepping the clock) after each.
    for (let i = 0; i < 52; i++) await ADVANCE(page, 0.25)
    const hasKey = page.locator('.hud-item.has-key')
    const candy = [[-6, -4], [-2, -4], [3, -4], [6, -3], [-5, -1], [0, -1], [5, 0], [-6, 2], [3, 3], [-3, 4]]
    for (const [x, z] of candy) {
      await setCamera(x, z)
      await ADVANCE(page, 0.1)
      if (await expect(hasKey).toHaveCount(1, { timeout: 1000 }).then(() => true, () => false)) break
    }
    await expect(hasKey).toHaveCount(1)
    await setCamera(8.85, 4) // the classroom door
    await expect
      .poll(async () => { await ADVANCE(page, 0.25); return hud.textContent() }, { timeout: 30_000 })
      .toContain('4: Rasmus')

    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible()
    await waitForOrdering(page)
    await orderMeatballs(page)
    await page.getByTestId('ikea-pay').click()
    // The ordering leads on to serving. Walking to the tray needs rendered frames and this chain
    // has no live Canvas for advance() once the level has changed (it returns false), so the serve
    // flow itself is covered by the other tests; here only the hand-off into 'serve' is checked.
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', /ikeaObjServe/)
    await ADVANCE(page, 4.5) // Rasmus' seat fallback timer
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeTray')
    expectNoErrors(errors)
  })

})

test.describe('ending after level 7', () => {
  test('the ending says "7 characters"', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 7 })
    const setCamera = (x, z) => page.evaluate(([px, pz]) => window.__YHH_TEST_MODE__.camera.position.set(px, 1.6, pz), [x, z])
    await setCamera(8, -10) // the key
    await ADVANCE(page, 0.1, 1 / 20)
    await expect(page.locator('.hud-item.has-key')).toHaveCount(1)
    await setCamera(0, -17.4) // the house door (world z = -25 + 7.6)
    await ADVANCE(page, 0.1, 1 / 20)
    await expect(page.locator('.victory-screen')).toContainText('alla 7 karaktärerna')
    expectNoErrors(errors)
  })
})
