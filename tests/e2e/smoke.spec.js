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
