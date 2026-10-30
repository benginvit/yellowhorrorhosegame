import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { openFrozen, setView, startGame, waitReady, replayCdnFonts, waitTextSynced, waitSceneContent, waitFrames, stableCanvasShot, hideHud } from './helpers.js'
import { VIEWS } from './views.js'

// ?seed=1&freeze=1 must not depend on the wall clock or the frame rate:
//  - canvas hashes are identical across page loads and across wall-clock time
//    (the classroom intro used to shoot after 7 s, Astrid woke after 4 s),
//  - game timers fire from advance() on the frozen clock only,
//  - the key spins at the same speed (rad/s) at any frame rate (no freeze).
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function hashView(page, view) {
  await replayCdnFonts(page)
  await openFrozen(page, { level: view.level })
  await setView(page, view)
  await waitTextSynced(page)
  await waitSceneContent(page)
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 0)) // render with text, time unchanged
  await hideHud(page)
  return md5(await stableCanvasShot(page))
}

test.describe('frozen canvas hash is stable', () => {
  for (const view of [VIEWS[0], VIEWS[3]]) {
    test(`${view.name}: identical across two page loads and after 8 s of wall-clock time`, async ({ browser, baseURL }, testInfo) => {
      const hashes = []
      for (let i = 0; i < 2; i++) {
        const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } })
        const page = await ctx.newPage()
        hashes.push(await hashView(page, view))
        if (i === 1) {
          // Longer than the old 7 s classroom intro timer / 4 s Astrid timer.
          await sleep(8000)
          await waitFrames(page)
          hashes.push(md5(await stableCanvasShot(page)))
        }
        await ctx.close()
      }
      testInfo.annotations.push({ type: 'canvas md5', description: `${view.name}: ${hashes.join(' ')}` })
      console.log(`[determinism] ${view.name} md5 load1=${hashes[0]} load2=${hashes[1]} load2+8s=${hashes[2]}`)
      expect(hashes[1]).toBe(hashes[0])
      expect(hashes[2]).toBe(hashes[0])
    })
  }
})

test.describe('game timers follow the frozen clock', () => {
  const flash = 'div[style*="255, 240, 200"]' // gunshot flash overlay
  const jumpscare = 'div[style*="z-index: 10000"]' // Astrid wake-up overlay
  const advance = (page, seconds) => page.evaluate((s) => window.__YHH_TEST_MODE__.advance(Math.round(s * 60), 1 / 60), seconds)

  test('classroom intro: no gunshot from wall-clock time, shot at 7 s of advance()', async ({ page }) => {
    await openFrozen(page, { level: 3 })
    await sleep(8000)
    await expect(page.locator(flash)).toHaveCount(0)
    await advance(page, 6.9)
    await waitFrames(page)
    await expect(page.locator(flash)).toHaveCount(0)
    await advance(page, 0.2) // 7.1 s: shot at 7.0 s, the flash lasts 300 ms
    await waitFrames(page)
    await expect(page.locator(flash)).toHaveCount(1)
    await advance(page, 0.5)
    await waitFrames(page)
    await expect(page.locator(flash)).toHaveCount(0)
  })

  test('Astrid in the house: wakes after 4 s of advance(), not of wall-clock time', async ({ page }) => {
    await openFrozen(page, { level: 2, inside: true })
    await sleep(5000)
    await expect(page.locator(jumpscare)).toHaveCount(0)
    await advance(page, 3.9)
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(0)
    await advance(page, 0.2)
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(1)
  })

  test('snore bubbles: scene unchanged by wall-clock time, new bubble after 1.5 s of advance()', async ({ page }) => {
    await openFrozen(page, { level: 2, inside: true })
    const objects = () => page.evaluate(() => { let n = 0; window.__YHH_TEST_MODE__.scene.traverse(() => n++); return n })
    await waitFrames(page)
    const before = await objects()
    await sleep(2500) // the old interval created a bubble every 1.5 s of wall-clock time
    await waitFrames(page)
    expect(await objects()).toBe(before)
    await advance(page, 1.6)
    await waitFrames(page)
    await advance(page, 0.1)
    expect(await objects()).toBeGreaterThan(before)
  })
})

test.describe('key rotation does not depend on the frame rate', () => {
  // Real (not frozen) test build. Frame rate is lowered with CPU throttling, so the
  // same code runs at clearly different rates; rad/s must stay the same (1.2).
  const KEY_SPIN = 1.2
  async function spinRate(page, cpuRate) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
    const m = await page.evaluate(async () => {
      const scene = window.__YHH_TEST_MODE__.scene
      let key = null
      scene.traverse((o) => { if (!key && o.isGroup && o.children.some((c) => c.geometry?.type === 'TorusGeometry' && c.geometry.parameters.radius === 0.4)) key = o })
      if (!key) return null
      let frames = 0, unwrapped = 0, last = key.rotation.y
      const t0 = performance.now()
      await new Promise((resolve) => {
        const step = () => {
          frames++
          let d = key.rotation.y - last
          d = Math.atan2(Math.sin(d), Math.cos(d)) // unwrap, per-frame steps are small
          unwrapped += d
          last = key.rotation.y
          performance.now() - t0 < 3000 ? requestAnimationFrame(step) : resolve()
        }
        requestAnimationFrame(step)
      })
      const secs = (performance.now() - t0) / 1000
      return { rate: unwrapped / secs, fps: frames / secs }
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    return m
  }

  test('rad/s is the same at different frame rates', async ({ page }, testInfo) => {
    await page.goto('/?seed=1&level=1') // no freeze: the real render loop
    await startGame(page)
    await waitReady(page)
    // 1.2 rad/s turns 3 s into 3.6 rad: the key must keep its angle through the measurement
    const fast = await spinRate(page, 1)
    const slow = await spinRate(page, 25)
    testInfo.annotations.push({ type: 'key spin', description: `${fast.fps.toFixed(0)} fps: ${fast.rate.toFixed(3)} rad/s, ${slow.fps.toFixed(0)} fps: ${slow.rate.toFixed(3)} rad/s` })
    console.log(`[key spin] ${fast.fps.toFixed(1)} fps -> ${fast.rate.toFixed(3)} rad/s; ${slow.fps.toFixed(1)} fps (25x CPU throttle) -> ${slow.rate.toFixed(3)} rad/s`)
    expect(fast.fps / slow.fps, 'frame rates must differ clearly for the comparison to mean anything').toBeGreaterThan(1.5)
    expect(Math.abs(fast.rate - KEY_SPIN) / KEY_SPIN).toBeLessThan(0.15)
    expect(Math.abs(slow.rate - KEY_SPIN) / KEY_SPIN).toBeLessThan(0.15)
  })

  test('frozen: key stays at a fixed angle however many frames are advanced', async ({ page }) => {
    await openFrozen(page, { level: 1 })
    const angle = () => page.evaluate(() => {
      let a = null
      window.__YHH_TEST_MODE__.scene.traverse((o) => { if (a === null && o.isGroup && o.children.some((c) => c.geometry?.type === 'TorusGeometry' && c.geometry.parameters.radius === 0.4)) a = o.rotation.y })
      return a
    })
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 1 / 60))
    const a1 = await angle()
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(200, 1 / 60))
    expect(await angle()).toBe(a1)
  })
})
