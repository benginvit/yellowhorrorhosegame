import { test, expect } from '@playwright/test'
import { GAME_CANVAS, trackErrors, startGame, openFrozen, waitTextSynced, replayCdnFonts, canvasColourCount, expectNoErrors } from './helpers.js'

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
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    const advanceSeconds = (s) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n * 60, 1 / 60), s)

    await expect(page.locator('.hud-item').first()).toContainText('Rasmus')
    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible() // intro
    await expect(page.getByTestId('ikea-pay')).toHaveCount(0)

    await advanceSeconds(7)
    await expect(page.getByTestId('ikea-pay')).toHaveCount(0)
    await advanceSeconds(1.5) // past 8 s: ordering
    await expect(page.getByTestId('ikea-pay')).toBeVisible()
    await expect(page.locator('.game-over-screen')).toHaveCount(0)

    await page.getByTestId('ikea-look-back').click() // looking back pauses the order, not the countdown
    await expect(page.getByTestId('ikea-pay')).toHaveCount(0)
    await page.getByTestId('ikea-look-back').click()
    await expect(page.getByTestId('ikea-pay')).toBeVisible()

    await advanceSeconds(39) // 40 s timer not yet out
    await expect(page.locator('.game-over-screen')).toHaveCount(0)
    await advanceSeconds(2) // lost
    await expect(page.locator('.game-over-screen')).toBeVisible()
    expectNoErrors(errors)
  })

  test('IKEA (level 4) win path: order -> level complete -> Selma (level 5)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    const advanceSeconds = (s) => page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n * 60, 1 / 60), s)

    await advanceSeconds(8.5) // ordering
    await page.getByTestId('ikea-pay').click()
    await expect(page.locator('.victory-screen')).toHaveCount(0) // 'won', level complete follows after ~4 s
    await advanceSeconds(4.5)
    await expect(page.locator('.victory-screen')).toBeVisible()
    await page.locator('.victory-screen .restart-btn').click()
    await expect(page.locator('.hud-item').first()).toContainText('5: Selma')
    expectNoErrors(errors)
  })
})
