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

  test('IKEA (level 4) renders without errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1))
    expect(await canvasColourCount(page)).toBeGreaterThan(20)
    expectNoErrors(errors)
  })

  test('IKEA (level 4) phases: intro -> ordering -> lost, and won -> Selma', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'level selection exists only in the test build')
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4 })
    const step = async (sec) => {
      await page.evaluate((s) => window.__YHH_TEST_MODE__.advance(Math.round(s * 10), 0.1), sec)
      await page.waitForTimeout(50) // let React flush
    }
    const pay = page.getByTestId('ikea-pay')
    await expect(pay).toHaveCount(0)
    await step(7.5)
    await expect(pay).toHaveCount(0)
    await step(0.6)
    await expect(pay).toHaveCount(1)
    await step(39)
    await expect(page.locator('.game-over-screen')).toHaveCount(0)
    await step(1.5)
    await expect(page.locator('.game-over-screen')).toBeVisible()

    // Won path
    await openFrozen(page, { level: 4 })
    await step(8.5)
    await pay.click()
    await expect(page.locator('.victory-screen')).toHaveCount(0)
    await step(6.5)
    await expect(page.locator('.victory-screen')).toBeVisible()
    await page.locator('.victory-screen .restart-btn').click()
    await expect(page.locator('.victory-screen')).toHaveCount(0)
  })
})
