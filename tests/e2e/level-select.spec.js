import { test, expect } from '@playwright/test'
import { trackErrors, expectNoErrors, GAME_CANVAS } from './helpers.js'

// Staging project only (VITE_LEVEL_SELECT=1 build): ?level=N and the start-screen
// level buttons jump straight to a level. Everything else behaves like prod: no
// test API, no seed, no frozen clock.

const HUD = '.game-hud .hud-item'

/** Pick Swedish and wait for the start screen (does not press Start). */
async function toStartScreen(page) {
  await page.locator('.start-screen button').first().click()
  await expect(page.locator('.start-btn')).toBeVisible()
}

async function pressStart(page) {
  await page.locator('.start-btn').click()
  await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
}

test.describe('level select (staging build)', () => {
  test('?level=4 starts on the IKEA level with the real clock and no test API', async ({ page }) => {
    const errors = trackErrors(page)
    // seed/freeze are test-only and must stay inert here.
    await page.goto('/?seed=1&freeze=1&level=4')
    expect(await page.evaluate(() => window.__YHH_LEVEL_SELECT__)).toBe(true)
    expect(await page.evaluate(() => typeof window.__YHH_TEST_MODE__)).toBe('undefined')
    expect(await page.evaluate(() => typeof window.__YHH_TEST__)).toBe('undefined')

    await toStartScreen(page)
    await pressStart(page)
    await expect(page.locator(HUD).first()).toContainText('Level 4: Rasmus')
    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible() // ikeaPhase 'intro'

    // Not frozen: the render loop keeps running, so the scene changes over time.
    const a = await page.locator(GAME_CANVAS).screenshot()
    await page.waitForTimeout(1500)
    const b = await page.locator(GAME_CANVAS).screenshot()
    expect(a.equals(b), 'canvas did not change in 1.5 s: freeze seems to be active').toBe(false)
    expectNoErrors(errors)
  })

  test('?level=3 starts the classroom in its seated intro', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/?level=3')
    await toStartScreen(page)
    await pressStart(page)
    await expect(page.locator(HUD).first()).toContainText('Level 3: Kerstin')
    // classroomIntroPhase 'seated': the classroom HUD shows the key/health lines (not Astrid's or IKEA's).
    await expect(page.locator(HUD).nth(1)).toContainText('Key:')
    expectNoErrors(errors)
  })

  test('?level=2&inside=1 starts inside Astrid\'s house', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/?level=2&inside=1')
    await toStartScreen(page)
    await pressStart(page)
    await expect(page.locator(HUD).first()).toContainText('Level 2: Astrid')
    await expect(page.locator(HUD).nth(1)).toContainText('Astrid sover') // inside: sleeping HUD line
    expectNoErrors(errors)
  })

  // parseInt semantics as in the test build: '2.5' -> 2 is accepted, these are not.
  for (const bad of ['0', '8', '99', 'abc', '-1']) {
    test(`?level=${bad} is ignored and starts on level 1`, async ({ page }) => {
      await page.goto(`/?level=${bad}`)
      await toStartScreen(page)
      await pressStart(page)
      await expect(page.locator(HUD).first()).toContainText('Level 1: Molltas')
    })
  }

  test('start screen shows one clearly marked button per level', async ({ page }) => {
    await page.goto('/')
    // Not on the language screen, only on the start screen.
    await expect(page.locator('.level-select')).toHaveCount(0)
    await toStartScreen(page)

    const picker = page.locator('.level-select')
    await expect(picker).toBeVisible()
    await expect(picker).toContainText('STAGING')
    await expect(picker).toContainText('hoppa till nivå')
    const buttons = picker.locator('.level-select-btn')
    await expect(buttons).toHaveText([
      '1. Molltas', '2. Astrid', '3. Kerstin', '4. Rasmus', '5. Selma', '6. Maria', '7. Pappa',
    ])
  })

  test('clicking a level button starts the game on that level', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await toStartScreen(page)
    await page.locator('.level-select-btn', { hasText: '4. Rasmus' }).click()
    await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
    await expect(page.locator('.start-screen')).toHaveCount(0)
    await expect(page.locator(HUD).first()).toContainText('Level 4: Rasmus')
    await expect(page.getByText('BESTÄLL! SNABBT!')).toBeVisible()
    expectNoErrors(errors)
  })

  test('a level button wins over ?level=N in the URL', async ({ page }) => {
    await page.goto('/?level=4')
    await toStartScreen(page)
    await page.locator('.level-select-btn', { hasText: '3. Kerstin' }).click()
    await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
    await expect(page.locator(HUD).first()).toContainText('Level 3: Kerstin')
  })

  test('level buttons work on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await toStartScreen(page)
    const buttons = page.locator('.level-select-btn')
    await expect(buttons).toHaveCount(7)
    for (let i = 0; i < 7; i++) {
      await expect(buttons.nth(i)).toBeInViewport()
      const box = await buttons.nth(i).boundingBox()
      expect(box.height, `button ${i + 1} touch target`).toBeGreaterThanOrEqual(40)
    }
    await buttons.nth(4).click() // 5. Selma
    await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
    await expect(page.locator(HUD).first()).toContainText('Level 5: Selma')
  })
})
