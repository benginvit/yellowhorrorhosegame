import { test, expect } from '@playwright/test'
import { openFrozen, setView, replayCdnFonts, waitTextSynced, trackErrors, expectNoErrors, lumaStats, projectToScreen, stableCanvasShot, waitSceneContent, countDifferingPixels } from './helpers.js'
import { LIGHT_LIMITS, LIGHT_VIEWS } from './views.js'

// Lighting checks (test build, ?seed=1&freeze=1). The screenshot diff does not
// catch subtle light/colour changes (tolerance 1 %, no baseline in git), so these
// tests measure the frame itself. Limits live in views.js (LIGHT_LIMITS) and
// are documented in the README ("Lighting checks").

async function open(page, view) {
  await replayCdnFonts(page)
  await openFrozen(page, { level: view.level, inside: view.inside })
  await setView(page, view)
  await waitTextSynced(page)
  await waitSceneContent(page)
  // A few frames so the scene settles (the house interior still changes
  // for ~2 frames after the first render); time and lights stay fixed.
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(4, 1 / 60))
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(3, 0)) // delta-driven animations (snoring bubbles) catch up
  // Only the 3D scene is measured: hide every HTML overlay on top of the canvas.
  await page.addStyleTag({ content: '.ui-overlay, .mobile-controls { visibility: hidden !important; }' })
}

const fmt = (s) => `mean ${s.mean.toFixed(1)}, p5 ${s.p5}, p50 ${s.p50}, p95 ${s.p95}, black ${(s.blackShare * 100).toFixed(1)} %, white ${(s.whiteShare * 100).toFixed(2)} %`

test.describe('lighting: brightness per camera pose', () => {
  for (const view of LIGHT_VIEWS) {
    test(view.name, async ({ page }, testInfo) => {
      const errors = trackErrors(page)
      await open(page, view)
      const s = await lumaStats(page)
      testInfo.annotations.push({ type: 'luma', description: fmt(s) })
      console.log(`[lighting] ${view.name}: ${fmt(s)}`)
      const L = LIGHT_LIMITS.brightness
      expect(s.mean, `${view.name}: too dark to play (${fmt(s)})`).toBeGreaterThanOrEqual(L.meanMin)
      expect(s.mean, `${view.name}: too bright (${fmt(s)})`).toBeLessThanOrEqual(L.meanMax)
      expect(s.p50, `${view.name}: median too dark (${fmt(s)})`).toBeGreaterThanOrEqual(L.p50Min)
      expect(s.p95, `${view.name}: highlights too dim, flat image (${fmt(s)})`).toBeGreaterThanOrEqual(L.p95Min)
      expect(s.p95, `${view.name}: highlights blown out (${fmt(s)})`).toBeLessThanOrEqual(L.p95Max)
      expect(s.blackShare, `${view.name}: too much crushed black (${fmt(s)})`).toBeLessThanOrEqual(L.blackShareMax)
      expect(s.whiteShare, `${view.name}: too much clipped white (${fmt(s)})`).toBeLessThanOrEqual(L.whiteShareMax)
      expectNoErrors(errors)
    })
  }
})

test.describe('lighting: readability of key and door', () => {
  // Level 1, camera between house and key. World positions: Key.jsx default
  // [8, 1, -10]; House.jsx door = house group (0, 0, -25) + (0, 2, 7.6).
  const view = { level: 1, x: 2, z: 0, yaw: -0.45 }
  const TARGETS = [
    { name: 'key', world: [8, 1, -10], half: 70 },
    { name: 'door', world: [0, 2, -17.4], half: 100 },
  ]
  for (const t of TARGETS) {
    test(`${t.name} region has contrast and is not black`, async ({ page }, testInfo) => {
      await open(page, view)
      const p = await projectToScreen(page, t.world)
      expect(p, `${t.name} is behind the camera`).not.toBeNull()
      const s = await lumaStats(page, { x: p.x - t.half, y: p.y - t.half, w: 2 * t.half, h: 2 * t.half })
      const contrast = s.p95 - s.p5
      testInfo.annotations.push({ type: 'luma', description: `${fmt(s)}, contrast(p95-p5) ${contrast}` })
      console.log(`[lighting] ${t.name} region @${p.x.toFixed(0)},${p.y.toFixed(0)}: ${fmt(s)}, contrast ${contrast}`)
      const L = LIGHT_LIMITS.readability[t.name]
      expect(contrast, `${t.name}: contrast p95-p5 ${contrast} < ${L.contrastMin}`).toBeGreaterThanOrEqual(L.contrastMin)
      expect(s.p95, `${t.name}: brightest 5 % of the region only ${s.p95}`).toBeGreaterThanOrEqual(L.p95Min)
    })
  }
})

test.describe('lighting: shadow casters', () => {
  for (const view of LIGHT_VIEWS.filter((v) => v.shadowScene)) {
    test(`${view.shadowScene}: at most ${LIGHT_LIMITS.maxShadowCasters} lights with castShadow`, async ({ page }) => {
      await open(page, view)
      const casters = await page.evaluate(() => {
        const out = []
        window.__YHH_TEST_MODE__.scene.traverse((o) => {
          if (o.isLight && o.castShadow) out.push(`${o.type}${o.parent?.isCamera ? ' (flashlight)' : ''}`)
        })
        return out
      })
      console.log(`[lighting] ${view.shadowScene}: shadow casters = ${casters.join(', ') || 'none'}`)
      expect(casters.length, `${view.shadowScene}: ${casters.length} shadow casting lights (${casters.join(', ')})`).toBeLessThanOrEqual(LIGHT_LIMITS.maxShadowCasters)
    })
  }
})

test.describe('lighting: no flicker when frozen', () => {
  // The frame is compared pixel for pixel, so poses must not contain anything
  // animated per frame: the key spins +0.02 rad per frame (Key.jsx), so it must
  // be out of view. outdoor-door looks at the house, away from the key.
  for (const view of LIGHT_VIEWS.filter((v) => v.flicker)) {
    test(`light state and frame are identical across frames: ${view.name}`, async ({ page }) => {
      await open(page, view)
      const lightState = () => page.evaluate(() => {
        const out = []
        window.__YHH_TEST_MODE__.scene.traverse((o) => {
          if (o.isLight) out.push([o.type, o.intensity, o.color.getHexString(), o.distance ?? 0, ...o.getWorldPosition(o.position.clone()).toArray()])
        })
        return out
      })
            const lightsA = await lightState()
      const a = await stableCanvasShot(page)
      for (let i = 0; i < 3; i++) await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 0)) // new frames, time unchanged
      const lightsB = await lightState()
      const b = await stableCanvasShot(page)
      expect(lightsB, `${view.name}: a light changed (intensity/colour/position) between frozen frames`).toEqual(lightsA)
      // The interior has wall-clock timers (snoring Z bubbles, Character.jsx) that add
      // and remove meshes while frozen, so only its light state is compared.
      if (view.lightsOnly || a.equals(b)) return
      const differing = await countDifferingPixels(page, a, b)
      expect(differing, `${view.name}: ${differing} px changed between frames of a frozen scene (flicker)`).toBe(0)
    })
  }
})
