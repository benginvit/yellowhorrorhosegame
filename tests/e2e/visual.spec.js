import { test, expect } from '@playwright/test'
import { openFrozen, setView, replayCdnFonts, waitTextSynced, hideHud, trackErrors, expectNoErrors, countDifferingPixels } from './helpers.js'
import { VIEWS } from './views.js'

// Test build only (project "test"). Baselines are generated in the environment
// that runs the tests: the first run writes tests/e2e/__baselines__/ and passes,
// later runs compare against it (see README).
async function capture(page, view) {
  await replayCdnFonts(page)
  await openFrozen(page, { level: view.level, phase: view.phase })
  // The frozen clock only moves with advance(): `advance` (seconds) walks the game timers, then ~0.5 s lets visuals ease onto them.
  if (view.advance) {
    await page.evaluate((s) => window.__YHH_TEST_MODE__.advance(Math.round(s * 20), 1 / 20), view.advance)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(30, 1 / 60))
  }
  await setView(page, view)
  await waitTextSynced(page)
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 1 / 60)) // render with text
  if (!view.keepHud) await hideHud(page) // keepHud: the HTML side panel is part of the view
}

test.describe('screenshot diff (?seed=1&freeze=1)', () => {
  for (const view of VIEWS) {
    test(view.name, async ({ page }, testInfo) => {
      const errors = trackErrors(page)
      await capture(page, view)
      const info = await page.evaluate(() => {
        const r = window.__YHH_TEST_MODE__.gl.info.render
        return { calls: r.calls, triangles: r.triangles }
      })
      testInfo.annotations.push({ type: 'renderer.info', description: JSON.stringify(info) })
      await expect(page).toHaveScreenshot(`${view.name}.png`)
      expectNoErrors(errors)
    })
  }

  // One outdoor and one classroom view: the classroom has its own timers, text and lights.
  // SwiftShader output is not always bit-identical between page loads (a few dozen
  // pixels in the classroom), so the limit is a tiny pixel ratio, far below the
  // screenshot-diff tolerance (1 %). Identical bytes pass immediately.
  const MAX_DIFF_PIXEL_RATIO = 0.001
  // Determinism tests: a pass-on-retry is non-determinism and must be red, so this
  // nested block overrides the CLI --retries (the visual shard runs with --retries=1).
  // The screenshot-diff tests above keep their retry (screenshot-timeout flake, BENG-7).
  test.describe('frozen render is deterministic', () => {
    test.describe.configure({ retries: 0 })
    for (const view of [VIEWS[0], VIEWS[3]]) {
      test(`frozen render is deterministic across two page loads: ${view.name}`, async ({ browser, baseURL }, testInfo) => {
        const shots = []
        for (let i = 0; i < 2; i++) {
          const context = await browser.newContext({ baseURL })
          const page = await context.newPage()
          await capture(page, view)
          shots.push(await page.screenshot())
          await context.close()
        }
        if (shots[0].equals(shots[1])) return
        const context = await browser.newContext()
        const page = await context.newPage()
        const differing = await countDifferingPixels(page, shots[0], shots[1])
        await context.close()
        const total = 1280 * 720
        testInfo.annotations.push({ type: 'determinism', description: `${view.name}: ${differing} of ${total} px differ between loads` })
        expect(differing, `${view.name}: screenshot size differs between loads`).toBeGreaterThanOrEqual(0)
        expect(differing / total, `${view.name}: ${differing} px differ between two frozen loads`).toBeLessThanOrEqual(MAX_DIFF_PIXEL_RATIO)
      })
    }
  })
})
