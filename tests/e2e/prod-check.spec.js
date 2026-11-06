import { test, expect } from '@playwright/test'
import { trackErrors, expectNoErrors, GAME_CANVAS } from './helpers.js'

// Prod project only: neither test mode nor the staging level picker may exist in
// the prod build, even when their query params are supplied.
test('prod ignores ?seed=1&freeze=1 and exposes no test API', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/?seed=1&freeze=1&level=3')
  await expect(page.locator('.start-screen')).toBeVisible()

  expect(await page.evaluate(() => typeof window.__YHH_TEST_MODE__)).toBe('undefined')
  expect(await page.evaluate(() => typeof window.__YHH_TEST__)).toBe('undefined')
  // The staging level picker (VITE_LEVEL_SELECT=1) must not exist in prod either.
  expect(await page.evaluate(() => typeof window.__YHH_LEVEL_SELECT__)).toBe('undefined')
  await page.locator('.start-screen button').first().click() // language -> start screen
  await expect(page.locator('.start-btn')).toBeVisible()
  await expect(page.locator('.level-select')).toHaveCount(0)
  await expect(page.locator('.start-screen')).not.toContainText('hoppa till')

  await page.locator('.start-btn').click()
  await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
  await expect(page.locator(GAME_CANVAS)).toBeVisible()
  // ?level=3 must not skip ahead either: prod starts on level 1.
  await expect(page.locator('.ui-overlay')).toContainText('Level 1')
  expect(await page.evaluate(() => typeof window.__YHH_TEST_MODE__)).toBe('undefined')

  // freeze must be inert: the render loop keeps running, so the scene changes over time.
  const a = await page.locator(GAME_CANVAS).screenshot()
  await page.waitForTimeout(1500)
  const b = await page.locator(GAME_CANVAS).screenshot()
  expect(a.equals(b), 'canvas did not change in 1.5 s: freeze seems to be active in prod').toBe(false)
  expectNoErrors(errors)
})
