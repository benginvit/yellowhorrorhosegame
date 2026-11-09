import { test, expect } from '@playwright/test'
import { trackErrors, openFrozen, replayCdnFonts, expectNoErrors, setCamera } from './helpers.js'

// Hiding under Astrid's bed (level 2, ?inside=1) on the frozen clock. Only the "test" project matches this file.
// The bed's foot end is at (5, -19.5) (levels/astridLayout.js, from houseLayout.js); the button shows within 1.2 of it.

test.setTimeout(240_000)

const NEAR = [5, -19] // inside the house, 0.5 in front of the foot end
const FAR = [0, -12]
const ADVANCE = (page, seconds, dt = 1 / 20) =>
  page.evaluate(([s, step]) => window.__YHH_TEST_MODE__.advance(Math.round(s / step), step), [seconds, dt])
const cameraY = (page) => page.evaluate(() => window.__YHH_TEST_MODE__.camera.position.y)
/**
 * Steps the clock until the camera height satisfies `ok`. The Canvas content (Player's pose) is updated by react-three-fiber's
 * own reconciler a moment after the UI, so one advance() right after a click can run before the pose arrived.
 */
async function settleHeight(page, ok) {
  await expect
    .poll(async () => {
      await ADVANCE(page, 0.6)
      return ok(await cameraY(page))
    }, { timeout: 30_000 })
    .toBe(true)
}
const under = (y) => y < 0.5
const standing = (y) => y > 1.5
const prompt = (page) => page.getByTestId('hide-prompt')
const underBed = (page) => page.getByTestId('hide-vignette')

/**
 * Walks the camera to a spot and lets the game see it: BedInteraction reports from a frame, React commits in real time,
 * so alternate advance() and a short real wait until the prompt is (not) there.
 */
async function stand(page, [x, z], visible) {
  for (let i = 0; i < 10 && (await prompt(page).isVisible()) !== visible; i++) {
    await setCamera(page, x, z)
    await ADVANCE(page, 0.1)
    await page.waitForTimeout(100)
  }
  await expect(prompt(page)).toBeVisible({ visible })
}

test.describe('hiding under the bed (level 2)', () => {
  test.beforeEach(async ({ page }) => {
    await replayCdnFonts(page)
  })

  test('no text reveals the hiding place, and the button only shows near the bed', async ({ page }) => {
    const errors = trackErrors(page)
    await openFrozen(page, { level: 2, inside: true })
    await ADVANCE(page, 4.5) // Astrid wakes: the generic "hide" text appears
    await expect(page.locator('body')).not.toContainText(/s[aä]ng|bed/i)
    await stand(page, FAR, false)
    await expect(prompt(page)).toBeHidden()
    await stand(page, NEAR, true)
    await expect(prompt(page)).toHaveText('Krypa in (F)')
    expectNoErrors(errors)
  })

  test('standing next to the bed is not hiding; F crawls in and out', async ({ page }) => {
    const errors = trackErrors(page)
    await openFrozen(page, { level: 2, inside: true })
    await stand(page, NEAR, true)
    await ADVANCE(page, 1)
    await expect(underBed(page)).toBeHidden()
    expect(await cameraY(page)).toBeGreaterThan(1.5)

    await page.keyboard.press('KeyF')
    await expect(underBed(page)).toBeVisible()
    await settleHeight(page, under)
    await expect(prompt(page)).toHaveText('Krypa ut (F)')

    await page.keyboard.press('KeyF')
    await expect(underBed(page)).toBeHidden()
    await settleHeight(page, standing)
    expectNoErrors(errors)
  })

})

test.describe('hiding under the bed on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 740 } })

  test('the on-screen button crawls in and out', async ({ page }) => {
    const errors = trackErrors(page)
    await openFrozen(page, { level: 2, inside: true })
    await stand(page, NEAR, true)
    await expect(page.getByTestId('hide-use')).toHaveText('Krypa in')
    await page.getByTestId('hide-use').tap()
    await expect(underBed(page)).toBeVisible()
    await settleHeight(page, under)
    await expect(page.getByTestId('hide-use')).toHaveText('Krypa ut')
    await page.getByTestId('hide-use').tap()
    await expect(underBed(page)).toBeHidden()
    await settleHeight(page, standing)
    expectNoErrors(errors)
  })
})
