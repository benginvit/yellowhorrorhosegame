import { test, expect } from '@playwright/test'
import { openFrozen, setView, waitSceneContent, replayCdnFonts, waitTextSynced, trackErrors, expectNoErrors } from './helpers.js'

// Suite-wide particle checks (ADR on BENG-26): budget, freeze, off switch, event bursts
// (src/components/particles/Bursts.jsx) and a direct look at every system, since the
// screenshot gate is too coarse for faint particles (ash changes 1-3 % of the pixels).
const PARTICLE_BUDGET = 1500
const DRAW_CALL_BUDGET = 1 // per system
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
      // Fire all bursts: the visible draw calls of the Points are bounded by one per system.
      const calls = await page.evaluate(() => {
        const api = window.__YHH_TEST_MODE__
        const pointsCalls = () => {
          api.advance(1, 1 / 60)
          let visible = 0
          api.scene.traverse((o) => { if (o.isPoints && o.visible) visible++ })
          return visible
        }
        const idle = pointsCalls()
        api.emit('hit'); api.emit('jumpscare'); api.emit('astrid')
        return { idle, active: pointsCalls() }
      })
      expect(calls.active, 'visible Points = draw calls').toBeLessThanOrEqual(systems.length * DRAW_CALL_BUDGET)
      expect(calls.active).toBe(calls.idle + 3)
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

  test('ash and ground fog render with a visible alpha', async ({ page }) => {
    await open(page, SCENES[0], '')
    const res = await page.evaluate(() => {
      const out = {}
      window.__YHH_TEST_MODE__.scene.traverse((o) => {
        if (o.isPoints && (o.name === 'ash' || o.name === 'groundFog')) out[o.name] = { opacity: o.material.uniforms.uOpacity.value, visible: o.visible, transparent: o.material.transparent }
      })
      return out
    })
    for (const name of ['ash', 'groundFog']) {
      expect(res[name], name).toBeTruthy()
      expect(res[name].visible).toBe(true)
      expect(res[name].opacity, `${name} alpha`).toBeGreaterThan(0.1)
    }
  })

  test('ash does not race when the game clock is late (a few cm per frame at t = 600 s)', async ({ page }) => {
    await open(page, SCENES[0])
    await page.evaluate(() => window.__YHH_TEST_MODE__.setTime(600))
    const maxStep = await page.evaluate(() => {
      const api = window.__YHH_TEST_MODE__
      let ash
      api.scene.traverse((o) => { if (o.name === 'ash') ash = o })
      api.advance(2, 1 / 60)
      const a = Float32Array.from(ash.geometry.attributes.position.array)
      api.advance(1, 1 / 60)
      const b = ash.geometry.attributes.position.array
      let m = 0
      for (let i = 0; i < a.length; i += 3) {
        const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2])
        // A wrap jumps a whole box width; that is a hidden sprite (edge fade), not speed.
        if (d < 5) m = Math.max(m, d)
      }
      return m
    })
    expect(maxStep, 'ash moves more than a few cm per frame').toBeLessThan(0.03)
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

  for (const [type, name, duration] of [['hit', 'burstHit', 0.9], ['jumpscare', 'burstJumpscare', 0.6], ['astrid', 'burstAstrid', 1]]) {
    test(`${type}: shows, then disappears after ${duration} s`, async ({ page }) => {
      const errors = trackErrors(page)
      await open(page, SCENES[0])
      const idle = (await points(page)).find((s) => s.name === name)
      expect(idle.visible, 'nothing before the event').toBe(false)
      const during = (await burstPositions(page, type, 12)).find((s) => s.name === name)
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
    const hit = (await burstPositions(page, 'jumpscare', 6)).find((s) => s.name === 'burstJumpscare')
    let maxR = 0
    for (let i = 0; i < hit.positions.length; i += 3) {
      maxR = Math.max(maxR, Math.hypot(hit.positions[i], hit.positions[i + 1] - 1.4, hit.positions[i + 2] - 13.6))
    }
    expect(maxR, 'burst stays within ~3 m of the spot in front of the player').toBeLessThan(3)
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
