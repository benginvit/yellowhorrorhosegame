import { test, expect } from '@playwright/test'
import { setView, waitSceneContent, replayCdnFonts, waitTextSynced, trackErrors, expectNoErrors, hideHud, stableCanvasShot, countDifferingPixels } from './helpers.js'

// Suite-wide particle checks (ADR on BENG-26): budget, freeze, off switch, event bursts
// (src/components/particles/Bursts.jsx) and a direct look at every system, since the
// screenshot gate is too coarse for faint particles (ash changes 1-3 % of the pixels).
const PARTICLE_BUDGET = 1500
// Ash + ground fog are faint (alpha 0.6 / 0.28, small sprites): together they change a few percent of the pixels.
const MIN_ASH_PIXELS = 500
const MIN_FOG_PIXELS = 5000
const DRAW_CALL_BUDGET = 1 // per burst system
const SCENES = [
  { name: 'outdoor', level: 1, inside: false },
  { name: 'house interior', level: 2, inside: true },
  { name: 'classroom', level: 3, inside: false },
]

const points = (page) => page.evaluate(() => {
  const out = []
  window.__YHH_TEST_MODE__.scene.traverse((o) => {
    if (!o.isPoints) return
    const u = o.material.uniforms
    out.push({ name: o.name, count: o.geometry.attributes.position.count, visible: o.visible, castShadow: o.castShadow, depthWrite: o.material.depthWrite, opacity: u?.uOpacity?.value, positions: Array.from(o.geometry.attributes.position.array) })
  })
  return out
})

async function open(page, scene, query = '') {
  await replayCdnFonts(page)
  const q = new URLSearchParams({ seed: '1', freeze: '1', level: String(scene.level) })
  if (scene.inside) q.set('inside', '1')
  await page.goto(`/?${q}${query}`)
  await page.locator('.start-screen button').first().click()
  await page.locator('.start-btn').click()
  await page.waitForFunction(() => window.__YHH_TEST_MODE__?.ready === true, null, { timeout: 30_000 })
  await waitTextSynced(page)
  await waitSceneContent(page)
}

test.describe('budget', () => {
  for (const scene of SCENES) {
    test(`${scene.name}: particles and draw calls within budget, no shadows, no depth write`, async ({ page }) => {
      const errors = trackErrors(page)
      await open(page, scene)
      const systems = await points(page)
      const total = systems.reduce((n, s) => n + s.count, 0)
      console.log(`[particles] ${scene.name}: ${systems.map((s) => `${s.name}=${s.count}`).join(' ')} total ${total}`)
      expect(systems.length).toBeGreaterThan(0)
      expect(total, 'particles per scene (desktop)').toBeLessThanOrEqual(PARTICLE_BUDGET)
      // Real draw calls (gl.info.render.calls) before and after firing all bursts: one per Points.
      // autoReset is off in test builds and reset once per frame (testMode.js), so the number is
      // the whole frame, as it would be behind an EffectComposer with several passes.
      const calls = await page.evaluate(() => {
        const api = window.__YHH_TEST_MODE__
        const frameCalls = () => { api.advance(1, 1 / 60); return api.gl.info.render.calls }
        const idle = frameCalls()
        api.emit('hit'); api.emit('jumpscare'); api.emit('astrid')
        let active = 0
        for (let i = 0; i < 70; i++) active = Math.max(active, frameCalls()) // jumpscare starts after its delay
        return { autoReset: api.gl.info.autoReset, idle, active }
      })
      expect(calls.autoReset, 'calls are counted per frame, not per gl.render()').toBe(false)
      expect(calls.active - calls.idle, 'burst draw calls (one per Points)').toBe(3)
      expect(calls.active - calls.idle).toBeLessThanOrEqual(3 * DRAW_CALL_BUDGET)
      for (const s of systems) {
        expect(s.castShadow).toBe(false)
        expect(s.depthWrite).toBe(false)
      }
      expectNoErrors(errors)
    })
  }
})

test.describe('mobile tier', () => {
  test.use({ hasTouch: true }) // Chromium: touch emulation makes (pointer: coarse) match

  for (const scene of SCENES) {
    test(`${scene.name}: a coarse pointer keeps the scene within half the budget`, async ({ page }) => {
      await open(page, scene)
      const systems = await points(page)
      const total = systems.reduce((n, s) => n + s.count, 0)
      console.log(`[particles] ${scene.name} (touch): total ${total}`)
      expect(total, 'particles per scene (mobile)').toBeLessThanOrEqual(PARTICLE_BUDGET / 2)
    })
  }

  test('a coarse pointer halves the burst pools', async ({ page }) => {
    await open(page, SCENES[0])
    const counts = Object.fromEntries((await points(page)).map((s) => [s.name, s.count]))
    expect(counts).toMatchObject({ burstHit: 16, burstJumpscare: 20, burstAstrid: 12 })
  })
})

test.describe('systems are present and visible', () => {
  test('outdoor: ash, ground fog and the burst pools exist with the expected counts', async ({ page }) => {
    await open(page, SCENES[0])
    const counts = Object.fromEntries((await points(page)).map((s) => [s.name, s.count]))
    expect(counts).toMatchObject({ ash: 600, groundFog: 24, burstHit: 32, burstJumpscare: 40, burstAstrid: 24 })
  })

  // Same frozen view, one system hidden at a time: what the system really adds to the frame.
  for (const [name, minPixels] of [['ash', MIN_ASH_PIXELS], ['groundFog', MIN_FOG_PIXELS]]) {
    test(`${name} changes the rendered frame (pixels with and without it)`, async ({ page }) => {
      await open(page, SCENES[0])
      await hideHud(page)
      await setView(page, { x: 0, z: 15, yaw: 0 })
      const render = async (visible) => {
        await page.evaluate(([n, v]) => {
          const api = window.__YHH_TEST_MODE__
          api.scene.traverse((o) => { if (o.name === n) o.visible = v })
          api.advance(2, 0)
        }, [name, visible])
        return stableCanvasShot(page)
      }
      const withSystem = await render(true)
      const without = await render(false)
      const changed = await countDifferingPixels(page, withSystem, without)
      console.log(`[particles] ${name} changes ${changed} pixels`)
      expect(changed, 'pixels that differ with the system on').toBeGreaterThan(minPixels)
    })
  }

  test('ash does not race when the game clock is late (a few cm per frame at t = 600 s)', async ({ page }) => {
    await open(page, SCENES[0], '&animate=1') // the ash moves with the test clock
    const maxStep = await page.evaluate(() => {
      const api = window.__YHH_TEST_MODE__
      api.setTime(600)
      let ash
      api.scene.traverse((o) => { if (o.name === 'ash') ash = o })
      api.advance(2, 1 / 60)
      const a = Float32Array.from(ash.geometry.attributes.position.array)
      api.advance(1, 1 / 60)
      const b = ash.geometry.attributes.position.array
      let m = 0
      let moved = 0
      for (let i = 0; i < a.length; i += 3) {
        const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2])
        if (d > 0) moved++
        // A wrap jumps a whole box width; that is a hidden sprite (edge fade), not speed.
        if (d < 5) m = Math.max(m, d)
      }
      return { m, moved }
    })
    expect(maxStep.moved, 'the ash really moves between the two frames (the guard measures something)').toBeGreaterThan(300)
    expect(maxStep.m, 'ash moves more than a few cm per frame').toBeLessThan(0.03)
  })
})

test.describe('event bursts', () => {
  const burstPositions = async (page, type, frames) => {
    await page.evaluate(([t, n]) => {
      const api = window.__YHH_TEST_MODE__
      api.emit(t)
      api.advance(n, 1 / 60)
    }, [type, frames])
    return (await points(page)).filter((s) => s.name.startsWith('burst'))
  }

  // delay: seconds from the event until the burst starts (Jumpscare overlay, see Bursts.jsx).
  for (const [type, name, delay, duration] of [['hit', 'burstHit', 0, 0.9], ['jumpscare', 'burstJumpscare', 0.8, 0.6], ['astrid', 'burstAstrid', 0, 1]]) {
    test(`${type}: starts after ${delay} s, shows, then disappears after ${duration} s`, async ({ page }) => {
      const errors = trackErrors(page)
      await open(page, SCENES[0])
      const idle = (await points(page)).find((s) => s.name === name)
      expect(idle.visible, 'nothing before the event').toBe(false)
      if (delay > 0) {
        const early = (await burstPositions(page, type, Math.floor(delay * 60) - 6)).find((s) => s.name === name)
        expect(early.visible, 'hidden while the full-screen overlay is up').toBe(false)
      }
      const during = (await burstPositions(page, delay > 0 ? 'none' : type, 12 + (delay > 0 ? 12 : 0))).find((s) => s.name === name)
      expect(during.visible).toBe(true)
      expect(during.opacity, 'visible alpha').toBeGreaterThan(0.02)
      expect(during.opacity, 'faint (photosensitivity: no flashes)').toBeLessThan(0.6)
      const after = (await burstPositions(page, 'none', Math.ceil(duration * 60) + 5)).find((s) => s.name === name)
      expect(after.visible, 'pool hidden after the burst').toBe(false)
      expectNoErrors(errors)
    })
  }

  test('a burst is a small cloud in front of the camera', async ({ page }) => {
    await open(page, SCENES[0])
    await setView(page, { x: 0, z: 15, yaw: 0 })
    const cloud = (await burstPositions(page, 'astrid', 6)).find((s) => s.name === 'burstAstrid')
    let maxR = 0
    for (let i = 0; i < cloud.positions.length; i += 3) {
      maxR = Math.max(maxR, Math.hypot(cloud.positions[i], cloud.positions[i + 1] - 1.4, cloud.positions[i + 2] - 13))
    }
    expect(maxR, 'burst stays within ~1.5 m of the spot in front of the player').toBeLessThan(1.5)
  })

  test('frozen: the same event gives identical positions on two loads', async ({ page }) => {
    await open(page, SCENES[0])
    const a = await burstPositions(page, 'hit', 20)
    await open(page, SCENES[0])
    const b = await burstPositions(page, 'hit', 20)
    expect(b.map((s) => s.positions)).toEqual(a.map((s) => s.positions))
  })

  test('frozen: without events nothing changes between frames', async ({ page }) => {
    await open(page, SCENES[0])
    const a = await points(page)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(5, 1 / 60))
    expect((await points(page)).map((s) => s.positions)).toEqual(a.map((s) => s.positions))
  })
})

test.describe('off switch', () => {
  for (const scene of SCENES) {
    test(`${scene.name}: PARTICLES_ENABLED = false leaves no Points in the scene`, async ({ page }) => {
      await open(page, scene, '&particles=0')
      expect(await points(page)).toEqual([])
    })
  }
})
