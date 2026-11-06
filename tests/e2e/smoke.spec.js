import { test, expect } from '@playwright/test'
import { GAME_CANVAS, trackErrors, startGame, openFrozen, waitTextSynced, replayCdnFonts, canvasColourCount, expectNoErrors } from './helpers.js'


// Plays the kiosk flow; the three interruptions come in a seeded order, so answer whichever shows up.
async function orderMeatballs(page, { sausage = false } = {}) {
  await page.getByTestId('ikea-start').click()
  await page.getByTestId('ikea-category-main').click()
  await page.getByTestId('ikea-dish-meatballs').click()
  for (let i = 0; i < 12; i++) await page.getByTestId('ikea-qty-plus').click()
  await page.getByTestId('ikea-qty-next').click()
  await page.getByTestId('ikea-side-mash').click()
  for (let i = 0; i < 3; i++) {
    const sausageNo = page.getByTestId(sausage ? 'ikea-sausage-yes' : 'ikea-sausage-no')
    const familyNo = page.getByTestId('ikea-family-no')
    const loading = page.getByTestId('ikea-loading')
    await expect(sausageNo.or(familyNo).or(loading)).toBeVisible()
    // Wait until the clicked step is gone: the kiosk needs a frame to draw the next one.
    if (await loading.isVisible()) { await page.evaluate(() => window.__YHH_TEST_MODE__.advance(100, 1 / 60)); await expect(loading).toHaveCount(0) }
    else if (await sausageNo.isVisible()) { await sausageNo.click(); await expect(sausageNo).toHaveCount(0) }
    else { await familyNo.click(); await expect(familyNo).toHaveCount(0) }
  }
  await expect(page.getByTestId('ikea-cart')).toBeVisible()
}

// Runs against both projects: the test build and the prod build.
test.describe('smoke', () => {
  test('canvas renders and there are no console errors (level 1)', async ({ page }, testInfo) => {
    const errors = trackErrors(page)
    // Test build: offline-safe fonts. Prod keeps hitting the real CDN on purpose.
    if (testInfo.project.name === 'test') await replayCdnFonts(page)
    await page.goto('/')
    await expect(page.locator('.start-screen')).toBeVisible()
    await startGame(page)

    const canvas = page.locator(GAME_CANVAS)
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box.width).toBeGreaterThan(1000)
    expect(box.height).toBeGreaterThan(600)

    // Give the scene a moment to render, then verify it is not blank.
    await page.waitForTimeout(2000)
    expect(await canvasColourCount(page)).toBeGreaterThan(20)

    expectNoErrors(errors)
  })

  test('classroom (level 3) renders without errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 3 })
    await waitTextSynced(page)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1))
    expect(await canvasColourCount(page)).toBeGreaterThan(20)
    const info = await page.evaluate(() => window.__YHH_TEST_MODE__.gl.info.render.calls)
    expect(info, 'classroom should issue many draw calls').toBeGreaterThan(30)
    expectNoErrors(errors)
  })

  test('IKEA (level 4) phase flow intro -> ordering -> lost on the frozen clock', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // 40+ s of advance() at 60 fps is slow on software rendering
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    const advanceSeconds = (s) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n * 20, 1 / 20), s) // coarse dt: the heavy IKEA scene renders slowly on software GL

    await expect(page.locator('.hud-item').first()).toContainText('Rasmus')
    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible() // intro
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)

    await advanceSeconds(7)
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)
    await advanceSeconds(1.5) // past 8 s: ordering
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    await expect(page.getByTestId('ikea-rasmus-meter')).toBeVisible()
    await expect(page.getByTestId('ikea-rasmus-bar')).toHaveAttribute('style', /width: 0%/)
    await expect(page.locator('.game-over-screen')).toHaveCount(0)

    await page.getByTestId('ikea-look-back').click() // looking back pauses the order, not the countdown
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)
    await page.getByTestId('ikea-look-back').click()
    await expect(page.getByTestId('ikea-start')).toBeVisible()

    await advanceSeconds(39) // 40 s timer not yet out
    await expect(page.locator('.game-over-screen')).toHaveCount(0)
    await advanceSeconds(2) // lost
    await expect(page.locator('.game-over-screen')).toBeVisible()
    expectNoErrors(errors)
  })

  test('IKEA (level 4) win path: order -> level complete -> Selma (level 5)', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // 40+ s of advance() at 60 fps is slow on software rendering
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    const advanceSeconds = (s) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n * 60, 1 / 60), s)

    await advanceSeconds(8.5) // ordering
    await orderMeatballs(page)
    await page.getByTestId('ikea-pay').click()
    await expect(page.getByTestId('ikea-done')).toBeVisible()
    await expect(page.locator('.victory-screen')).toHaveCount(0) // 'won', level complete follows after ~4 s
    await advanceSeconds(4.5)
    await expect(page.locator('.victory-screen')).toBeVisible()
    await page.locator('.victory-screen .restart-btn').click()
    await expect(page.locator('.hud-item').first()).toContainText('5: Selma')
    expectNoErrors(errors)
  })

  test('IKEA kiosk: quantity must be exactly 16, wrong choices give a back button, the sausage blocks payment', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // the IKEA scene renders slowly on software GL
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 20, 1 / 20))

    await page.getByTestId('ikea-start').click()
    await page.getByTestId('ikea-category-drinks').click() // wrong
    await expect(page.getByTestId('ikea-error')).toBeVisible()
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-category-main').click()
    await page.getByTestId('ikea-dish-salmon').click() // wrong
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-dish-meatballs').click()

    await expect(page.getByTestId('ikea-qty-value')).toHaveText('4')
    await expect(page.getByTestId('ikea-qty-next')).toBeDisabled()
    for (let i = 0; i < 12; i++) await page.getByTestId('ikea-qty-plus').click()
    await expect(page.getByTestId('ikea-qty-value')).toHaveText('16')
    await page.getByTestId('ikea-qty-plus').click()
    await expect(page.getByTestId('ikea-qty-next')).toBeDisabled()
    await page.getByTestId('ikea-qty-minus').click()
    await page.getByTestId('ikea-qty-next').click()

    await page.getByTestId('ikea-side-fries').click() // wrong
    await page.getByTestId('ikea-back').click()
    await page.getByTestId('ikea-side-mash').click()
    // the sausage is added when answering Yes and must be removed again
    for (let i = 0; i < 3; i++) {
      const yes = page.getByTestId('ikea-sausage-yes')
      const familyNo = page.getByTestId('ikea-family-no')
      const loading = page.getByTestId('ikea-loading')
      await expect(yes.or(familyNo).or(loading)).toBeVisible()
      if (await loading.isVisible()) { await page.evaluate(() => window.__YHH_TEST_MODE__.advance(100, 1 / 60)); await expect(loading).toHaveCount(0) }
      else if (await yes.isVisible()) { await yes.click(); await expect(yes).toHaveCount(0) }
      else { await familyNo.click(); await expect(familyNo).toHaveCount(0) }
    }
    await expect(page.getByTestId('ikea-pay')).toBeDisabled()
    await page.getByTestId('ikea-cart-remove-sausage').click()
    await expect(page.getByTestId('ikea-pay')).toBeEnabled()
    expectNoErrors(errors)
  })

  test('IKEA kiosk: Space looks back while held and the kiosk is hidden', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // the IKEA scene renders slowly on software GL
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 20, 1 / 20))
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(3, 1 / 60)) // let React commit the phase change, then render the overlay
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    await page.keyboard.down('Space')
    await expect(page.getByTestId('ikea-start')).toHaveCount(0)
    await page.keyboard.up('Space')
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    expectNoErrors(errors)
  })
})

test.describe('smoke (touch)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 740 } })

  test('IKEA kiosk is usable with touch in a mobile viewport', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // the IKEA scene renders slowly on software GL
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 20, 1 / 20))
    await page.getByTestId('ikea-start').tap()
    await page.getByTestId('ikea-category-main').tap()
    await expect(page.getByTestId('ikea-dish-meatballs')).toBeInViewport()
    expectNoErrors(errors)
  })
})

test.describe('Rasmus', () => {
  test('IKEA (level 4) Rasmus walks closer to the kiosk while ordering (frozen clock)', async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    // Distance from Rasmus' group (named "rasmus") to the kiosk at the origin.
    const distance = () =>
      page.evaluate(() => {
        const p = window.__YHH_TEST_MODE__.scene.getObjectByName('rasmus').position
        return Math.hypot(p.x, p.z)
      })

    const atStart = await distance() // intro: at the knife shelf
    expect(atStart).toBeGreaterThan(20)
    // Coarse dt (like the phase flow test) keeps the software-GL run short.
    const advanceCoarse = (s) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n * 20, 1 / 20), s)
    // React commits state between evaluate() calls: after each step wait until the HUD countdown has moved
    // on, then advance once more so the visual position eases to the committed target before measuring.
    const hudSeconds = async () => {
      const [text] = await page.locator('.hud-item').filter({ hasText: /\d+s/ }).allTextContents() // never waits for the element
      return text ? Number(/(\d+)s/.exec(text)[1]) : Infinity
    }
    let lastSeconds = 41
    const stepAndMeasure = async (seconds) => {
      await advanceCoarse(seconds)
      await expect.poll(hudSeconds, { timeout: 20_000 }).toBeLessThan(lastSeconds)
      await advanceCoarse(1)
      lastSeconds = await hudSeconds()
      return distance()
    }

    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible() // intro: its effect and timer are registered
    await advanceCoarse(9) // intro (8 s) -> ordering
    // The countdown starts once React has committed the phase: let the poll step the clock until it shows.
    await expect
      .poll(async () => {
        await advanceCoarse(0.25)
        return hudSeconds()
      }, { timeout: 20_000 })
      .toBeLessThan(41)
    const ordering = await stepAndMeasure(5)
    const later = await stepAndMeasure(9)
    expect(later).toBeLessThan(ordering - 2)
    expect(await stepAndMeasure(9)).toBeLessThan(later - 2)
    expectNoErrors(errors)
  })
})

// Stacking contract of the kiosk's DOM overlay (OrderKiosk.jsx, index.css): mobile controls <
// kiosk < .ui-overlay, so the kiosk buttons can be tapped and the victory / game-over screens are
// never covered by the kiosk. With the kiosk on top, its "order done" panel intercepted the click on
// the victory screen's continue button in the IKEA win flow (BENG-91).
test.describe('IKEA kiosk overlay', () => {
  test('sits above the mobile controls and below the UI overlay', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'phase=ordering exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'ordering' })
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    const z = await page.evaluate(() => {
      const zIndex = (el) => Number(getComputedStyle(el).zIndex)
      // The kiosk is portalled into <body>; its top-level wrapper carries the z-index.
      const start = document.querySelector('[data-testid="ikea-start"]')
      let wrapper = start
      while (wrapper.parentElement !== document.body) wrapper = wrapper.parentElement
      return { kiosk: zIndex(wrapper), mobile: zIndex(document.querySelector('.mobile-controls')), ui: zIndex(document.querySelector('.ui-overlay')) }
    })
    expect(z.kiosk, `kiosk z-index ${z.kiosk} vs mobile controls ${z.mobile}`).toBeGreaterThan(z.mobile)
    expect(z.kiosk, `kiosk z-index ${z.kiosk} vs .ui-overlay ${z.ui}`).toBeLessThan(z.ui)
    expectNoErrors(errors)
  })
})
