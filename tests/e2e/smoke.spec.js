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

// Stacking contract of the kiosk's DOM overlay (OrderKiosk.jsx, index.css): while the order is in
// progress the kiosk sits above the mobile controls AND above .ui-overlay (the instructions text must
// not draw over it, nothing in the overlay is clickable then); once the order is done it drops below
// .ui-overlay, so the victory screen always gets the click. With the kiosk on top in 'won', its "order
// done" panel intercepted the click on the continue button in the IKEA win flow (BENG-91).
test.describe('IKEA kiosk overlay', () => {
  const ADVANCE = (page, frames, dt) => page.evaluate(([n, d]) => window.__YHH_TEST_MODE__.advance(n, d), [frames, dt])
  // z-index of the kiosk's top-level wrapper (portalled into <body>), the mobile controls and .ui-overlay.
  const layers = (testId) => (page) => page.evaluate((id) => {
    const zIndex = (el) => Number(getComputedStyle(el).zIndex)
    let wrapper = document.querySelector(`[data-testid="${id}"]`)
    while (wrapper.parentElement !== document.body) wrapper = wrapper.parentElement
    return { kiosk: zIndex(wrapper), mobile: zIndex(document.querySelector('.mobile-controls')), ui: zIndex(document.querySelector('.ui-overlay')) }
  }, testId)
  // Same kiosk flow as ikea.spec.js (BENG-77), kept separate so the two specs stay independent.
  async function orderMeatballs(page) {
    await page.getByTestId('ikea-start').click()
    await page.getByTestId('ikea-category-main').click()
    await page.getByTestId('ikea-dish-meatballs').click()
    for (let i = 0; i < 12; i++) await page.getByTestId('ikea-qty-plus').click()
    await page.getByTestId('ikea-qty-next').click()
    await page.getByTestId('ikea-side-mash').click()
    for (let i = 0; i < 3; i++) {
      const sausageNo = page.getByTestId('ikea-sausage-no')
      const familyNo = page.getByTestId('ikea-family-no')
      const loading = page.getByTestId('ikea-loading')
      await expect(sausageNo.or(familyNo).or(loading)).toBeVisible()
      if (await loading.isVisible()) { await ADVANCE(page, 100, 1 / 60); await expect(loading).toHaveCount(0) }
      else if (await sausageNo.isVisible()) { await sausageNo.click(); await expect(sausageNo).toHaveCount(0) }
      else { await familyNo.click(); await expect(familyNo).toHaveCount(0) }
    }
    await expect(page.getByTestId('ikea-cart')).toBeVisible()
  }

  test('ordering: sits above the mobile controls and above the UI overlay', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'test', 'phase=ordering exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'ordering' })
    await expect(page.getByTestId('ikea-start')).toBeVisible()
    const z = await layers('ikea-start')(page)
    expect(z.kiosk, `kiosk z-index ${z.kiosk} vs mobile controls ${z.mobile}`).toBeGreaterThan(z.mobile)
    expect(z.kiosk, `kiosk z-index ${z.kiosk} vs .ui-overlay ${z.ui}`).toBeGreaterThan(z.ui)
    expectNoErrors(errors)
  })

  test('won: drops below the UI overlay and the victory screen gets the click', async ({ page }, testInfo) => {
    test.setTimeout(240_000) // the IKEA scene renders slowly on software GL
    test.skip(testInfo.project.name !== 'test', 'phase=ordering exists only in the test build')
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 4, phase: 'ordering' })
    await orderMeatballs(page)
    await page.getByTestId('ikea-pay').click()
    await expect(page.getByTestId('ikea-done')).toBeVisible()
    const z = await layers('ikea-done')(page)
    expect(z.kiosk, `kiosk z-index ${z.kiosk} vs .ui-overlay ${z.ui}`).toBeLessThan(z.ui)
    await ADVANCE(page, 90, 1 / 20) // 4.5 s: 'won' -> level complete
    const button = page.locator('.victory-screen .restart-btn')
    await expect(button).toBeVisible()
    // The actual bug: the top-most element at the button's centre must be the button itself.
    const hit = await button.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return top === el || el.contains(top) ? 'button' : `${top?.tagName} ${top?.getAttribute('data-testid') ?? ''}`.trim()
    })
    expect(hit, 'element at the centre of the continue button').toBe('button')
    await button.click()
    await expect(page.locator('.hud-item').first()).toContainText('5: Selma')
    expectNoErrors(errors)
  })
})
