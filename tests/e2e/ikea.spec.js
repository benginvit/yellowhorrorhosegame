import { test, expect } from '@playwright/test'
import { trackErrors, openFrozen, replayCdnFonts, expectNoErrors, setCamera, useAt, serveAndDrink, AT_TRAY, AT_TABLE, AT_STATION } from './helpers.js'

// IKEA level (level 4, Rasmus) on the frozen clock. Only the "test" project matches this file (playwright.config.js).
// The kiosk is driven through its data-testid hooks (see OrderKiosk.jsx). The IKEA
// scene renders slowly on software GL, so every test gets a long timeout and most
// clock steps use a coarse dt (1/20); the exact step size does not matter, the game
// timers fire from advance() on the frozen clock.

test.setTimeout(240_000)

const ADVANCE = (page, seconds, dt = 1 / 20) =>
  page.evaluate(([s, step]) => window.__YHH_TEST_MODE__.advance(Math.round(s / step), step), [seconds, dt])

/**
 * Steps the clock through the 8 s intro until the kiosk is up. The intro effect can register its
 * timer on the frozen clock only after the next advance(), so the last bit is a few small steps (capped).
 */
async function waitForOrdering(page) {
  await ADVANCE(page, 7)
  const start = page.getByTestId('ikea-start')
  for (let i = 0; i < 6 && !(await start.isVisible()); i++) await ADVANCE(page, 0.25)
  await expect(start).toBeVisible()
}

/** Opens level 4 and steps the clock until the kiosk is up. */
async function toOrdering(page) {
  await openFrozen(page, { level: 4 })
  await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible()
  await waitForOrdering(page)
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

test.describe('ikea-serving', () => {
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

  test('drink phase: the wrong drink (cola) -> lost -> game over "Fel dryck!"', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'drink' })
    await useAt(page, AT_STATION)
    await page.getByTestId('ikea-drink-cola').click()
    await ADVANCE(page, 2) // Rasmus is still running at the player
    await expect(page.locator('.game-over-screen')).toHaveCount(0)
    await ADVANCE(page, 1)
    await expect(page.locator('.game-over-screen')).toBeVisible()
    await expect(page.getByTestId('ikea-lose-reason')).toHaveText('Fel dryck!')
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
    await ADVANCE(page, 0.1) // the next frame sees the table as a target
    await expect(page.getByTestId('ikea-use-hint')).toBeVisible()
    await page.keyboard.press('KeyF')
    await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDrink') // 'drink'
    expectNoErrors(errors)
  })
})

test.describe('ikea-outcomes', () => {
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
    await openFrozen(page, { level: 4 })
    await expect(page.locator('.hud-item').first()).toContainText('Rasmus')
    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible() // intro
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)
    await waitForOrdering(page)
    await expect(page.getByTestId('ikea-rasmus-bar')).toHaveAttribute('style', /width: [0-2]%/) // the 40 s start here (the intro polling may overshoot by a tick)
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
