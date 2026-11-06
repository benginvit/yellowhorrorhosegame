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
    if (await loading.isVisible()) await page.evaluate(() => window.__YHH_TEST_MODE__.advance(100, 1 / 60))
    else if (await sausageNo.isVisible()) await sausageNo.click()
    else await familyNo.click()
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
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 60, 1 / 60))

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
      if (await loading.isVisible()) await page.evaluate(() => window.__YHH_TEST_MODE__.advance(100, 1 / 60))
      else if (await yes.isVisible()) await yes.click()
      else await familyNo.click()
    }
    await expect(page.getByTestId('ikea-pay')).toBeDisabled()
    await page.getByTestId('ikea-cart-remove-sausage').click()
    await expect(page.getByTestId('ikea-pay')).toBeEnabled()
    expectNoErrors(errors)
  })

  test('IKEA kiosk: Space looks back while held and the kiosk is hidden', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 60, 1 / 60))
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
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(8.5 * 60, 1 / 60))
    await page.getByTestId('ikea-start').tap()
    await page.getByTestId('ikea-category-main').tap()
    await expect(page.getByTestId('ikea-dish-meatballs')).toBeInViewport()
    expectNoErrors(errors)
  })
})
