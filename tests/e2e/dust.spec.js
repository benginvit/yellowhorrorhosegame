import { test, expect } from '@playwright/test'
import { openFrozen, replayCdnFonts, trackErrors, expectNoErrors } from './helpers.js'

// Dust (BENG-27) must drift, not race: the grain speed must not grow with the
// game clock. The frozen clock is deterministic (setTime/advance only).
test.describe('dust: grains float slowly at any game time', () => {
  test.skip(({}, testInfo) => testInfo.project.name !== 'test', 'needs the test build clock')

  test('uTime follows the clock and the grain speed stays at a few cm per frame at t = 600 s', async ({ page }) => {
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await openFrozen(page, { level: 1, inside: true })
    await page.evaluate(() => window.__YHH_TEST_MODE__.setTime(600))
    const res = await page.evaluate(() => {
      const api = window.__YHH_TEST_MODE__
      let mat
      api.scene.traverse((o) => { if (o.isPoints && o.material.uniforms?.uCosInner) mat = o.material })
      if (!mat) return null
      api.advance(1, 1 / 60)
      const t0 = mat.uniforms.uTime.value
      // Mirror of the vertex shader motion (vel * t + sway) for a few seeds.
      const pos = (w, t) => [
        Math.sin(t * 0.17 + w * 40) * 0.15,
        (-0.024 - w * 0.03) * t,
        Math.cos(t * 0.13 + w * 25) * 0.15,
      ]
      let maxStep = 0
      for (let i = 0; i < 100; i++) {
        const w = i / 100
        const a = pos(w, t0)
        const b = pos(w, t0 + 1 / 60)
        maxStep = Math.max(maxStep, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
      }
      return { t0, maxStep }
    })
    expect(res, 'dust Points not found in the house interior').not.toBeNull()
    expect(res.t0).toBeGreaterThan(599)
    expect(res.maxStep, 'dust moves more than a few cm per frame').toBeLessThan(0.03)
    expectNoErrors(errors)
  })
})
