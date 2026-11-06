import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { openFrozen, expectNoErrors, trackErrors, setView, startGame, waitReady, replayCdnFonts, waitTextSynced, waitSceneContent, waitFrames, stableCanvasShot, hideHud } from './helpers.js'
import { VIEWS } from './views.js'

// ?seed=1&freeze=1 must not depend on the wall clock or the frame rate:
//  - canvas hashes are identical across page loads and across wall-clock time
//    (the classroom intro used to shoot after 7 s, Astrid woke after 4 s),
//  - game timers fire from advance() on the frozen clock only,
//  - the key turns exactly KEY_SPIN_SPEED * dt, at any frame rate.
// The hash test catches wall-clock dependence only, NOT frame-count dependence (an
// animation that adds a fixed step per frame, e.g. `rotation.y += 0.02`, still gives
// the same hash for the same number of advance() frames): the key/timer tests below
// cover that.
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
  const advance = (page, seconds) => page.evaluate((s) => window.__YHH_TEST_MODE__.advance(Math.max(1, Math.round(s * 60)), s === 0 ? 0 : 1 / 60), seconds)

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
  test('candy spawns 3 s after the shot: none at 9.9 s, present at 10.1 s', async ({ page }) => {
    await openFrozen(page, { level: 3 })
    // Candy.jsx: round candy = SphereGeometry r 0.14, lollipop head = r 0.16
    const candy = () => page.evaluate(() => { let n = 0; window.__YHH_TEST_MODE__.scene.traverse((o) => { const g = o.geometry; if (g?.type === 'SphereGeometry' && [0.14, 0.16].includes(g.parameters.radius)) n++ }); return n })
    // The 3 s candy timer starts when React has committed the 'shots' phase, so step to just
    // after the shot (7 s), let React commit, then measure from there (~7.02 s + 3 s).
    await advance(page, 7.02)
    await waitFrames(page)
    await advance(page, 2.88) // 9.9 s
    // Longer than the 3 s candy delay in wall-clock time: a real setTimeout would have fired by now.
    await sleep(3500)
    await waitFrames(page)
    await advance(page, 0)
    expect(await candy()).toBe(0)
    await advance(page, 0.2) // 10.1 s
    await waitFrames(page)
    await advance(page, 0)
    expect(await candy()).toBeGreaterThan(0)
  })

  test('timers survive a Canvas remount (clock back to 0): Astrid wakes 4 s after the new start', async ({ page }) => {
    // 24 s of advance() at 60 fps = ~1700 house-interior frames of software rendering. Since
    // advance() syncs with the GPU (testMode.js), their full cost is paid inside the calls instead
    // of as a stall later (that stall is what used to blow the 150 s budget), ~100 ms per frame
    // on the CI runner: same budget as the other heavy frozen-clock tests and the shard's --timeout.
    test.setTimeout(240_000)
    const errors = trackErrors(page)
    await openFrozen(page, { level: 2, inside: true })
    await advance(page, 4.2) // first wake-up
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(1)
    await advance(page, 20) // the hide timer runs out: game over, the Canvas unmounts
    await waitFrames(page)
    await page.locator('.restart-btn').click()
    await page.locator('.start-btn').click() // new Canvas, new R3F clock at 0
    await waitReady(page)
    await waitSceneContent(page) // the scene (and Astrid's timer effect) mounts after `ready`
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(0)
    await advance(page, 3.9)
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(0)
    await advance(page, 0.2)
    await waitFrames(page)
    await expect(page.locator(jumpscare)).toHaveCount(1)
    expectNoErrors(errors)
  })

  // Test-API contract across a Canvas remount (testMode.js, "Software GL and the frozen clock" and
  // "Canvas remount"): `ready` must drop with the old Canvas (it used to stay true, so waitReady()
  // after a restart passed on the disposed Canvas), advance() must not drive it (false), and the
  // test build must not force-lose the old context (WEBGL_lose_context.loseContext, which R3F calls
  // 500 ms after the unmount: on software GL it blocks the main thread until the GPU backlog has
  // drained). The spy makes the last point deterministic; a wall-clock bound could not tell the fix
  // from no fix (BENG-91 review).
  test('Canvas remount after game over: ready drops with the old Canvas, no forced context loss, the API follows the new one', async ({ page }) => {
    test.setTimeout(150_000)
    const errors = trackErrors(page)
    await replayCdnFonts(page)
    await page.addInitScript(() => {
      window.__loseContextCalls = 0
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        const getExtension = proto.getExtension
        proto.getExtension = function (name) {
          const ext = getExtension.call(this, name)
          if (name === 'WEBGL_lose_context' && ext && !ext.__spied) {
            ext.__spied = true
            const loseContext = ext.loseContext
            ext.loseContext = function () { window.__loseContextCalls++; return loseContext.call(this) }
          }
          return ext
        }
      }
    })
    await openFrozen(page, { level: 1 })
    const ready = () => page.evaluate(() => window.__YHH_TEST_MODE__.ready)
    const loseContextCalls = () => page.evaluate(() => window.__loseContextCalls)
    // Molltas (Character.jsx) hits for 25 within 2 units, at most every 0.5 s of frozen time:
    // stand next to her start position (-8, 1, -18) and let four hits land.
    await page.evaluate(() => window.__YHH_TEST_MODE__.camera.position.set(-8, 1.6, -17))
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(45, 1 / 20)) // 2.25 s: hits at 0.5, 1, 1.5, 2 s
    await expect(page.locator('.game-over-screen')).toBeVisible()
    await expect.poll(ready).toBe(false) // the probe's cleanup retires the unmounted Canvas
    expect(await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 0))).toBe(false) // no Canvas to drive
    expect(await ready()).toBe(false)
    // R3F's forced loss is a 500 ms setTimeout after the unmount: wait past it (wall clock).
    await page.waitForTimeout(1500)
    expect(await loseContextCalls(), 'WEBGL_lose_context.loseContext calls after the old Canvas unmounted').toBe(0)

    const t0 = Date.now()
    await page.locator('.restart-btn').click()
    await page.locator('.start-btn').click()
    await waitReady(page) // now genuinely waits for the new Canvas
    await waitSceneContent(page)
    await waitFrames(page)
    // Sanity bound only (the mechanism is covered by the spy above): a remount takes well under a
    // second here and a few seconds on the CI runner.
    expect(Date.now() - t0, 'time from restart to the first frames of the new Canvas').toBeLessThan(60_000)
    expect(await ready()).toBe(true)
    expect(await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 0))).toBe(true)
    expect(await page.evaluate(() => window.__YHH_TEST_MODE__.gl.info.render.calls)).toBeGreaterThan(20)
    await expect(page.locator('.hud-item').first()).toContainText('1: Molltas')
    await page.waitForTimeout(1500) // past the forced-loss window of this Canvas' unmount, if any
    expect(await loseContextCalls()).toBe(0)
    expectNoErrors(errors) // includes Chrome's "Too many active WebGL contexts" warning (helpers.js)
  })
})

test.describe('key rotation does not depend on the frame rate', () => {
  const KEY_SPIN = 1.2 // rad/s, Key.jsx KEY_SPIN_SPEED
  const keyAngle = (page) => page.evaluate(() => {
    let a = null
    window.__YHH_TEST_MODE__.scene.traverse((o) => { if (a === null && o.isGroup && o.children.some((c) => c.geometry?.type === 'TorusGeometry' && c.geometry.parameters.radius === 0.4)) a = o.rotation.y })
    return a
  })

  test('one second of frozen time turns the key 1.2 rad at 60 and at 144 Hz', async ({ page }) => {
    await openFrozen(page, { level: 1 })
    const a0 = await keyAngle(page)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(60, 1 / 60))
    const a1 = await keyAngle(page)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(144, 1 / 144))
    const a2 = await keyAngle(page)
    await page.evaluate(() => window.__YHH_TEST_MODE__.advance(30, 0)) // delta 0: no turn
    const a3 = await keyAngle(page)
    expect(a1 - a0).toBeCloseTo(KEY_SPIN, 6)
    expect(a2 - a1).toBeCloseTo(KEY_SPIN, 6)
    expect(a3).toBe(a2)
  })

  // Opt-in smoke test of the real render loop (not a CI gate: the frame-rate ratio depends on the
  // runner). E2E_KEY_THROTTLE=1 lowers the frame rate with CDP CPU throttling and measures rad/s.
  test('real loop: rad/s is the same at different frame rates (opt-in E2E_KEY_THROTTLE=1)', async ({ page }, testInfo) => {
    test.skip(process.env.E2E_KEY_THROTTLE !== '1', 'set E2E_KEY_THROTTLE=1 to run')
    async function spinRate(cpuRate) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
      const m = await page.evaluate(async () => {
        let key = null
        window.__YHH_TEST_MODE__.scene.traverse((o) => { if (!key && o.isGroup && o.children.some((c) => c.geometry?.type === 'TorusGeometry' && c.geometry.parameters.radius === 0.4)) key = o })
        let frames = 0, unwrapped = 0, last = key.rotation.y
        const t0 = performance.now()
        await new Promise((resolve) => {
          const step = () => {
            frames++
            let d = key.rotation.y - last
            d = Math.atan2(Math.sin(d), Math.cos(d))
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
    await page.goto('/?seed=1&level=1') // no freeze: the real render loop
    await startGame(page)
    await waitReady(page)
    const fast = await spinRate(1)
    const slow = await spinRate(25)
    testInfo.annotations.push({ type: 'key spin', description: `${fast.fps.toFixed(0)} fps: ${fast.rate.toFixed(3)} rad/s, ${slow.fps.toFixed(0)} fps: ${slow.rate.toFixed(3)} rad/s` })
    expect(Math.abs(fast.rate - KEY_SPIN) / KEY_SPIN).toBeLessThan(0.15)
    expect(Math.abs(slow.rate - KEY_SPIN) / KEY_SPIN).toBeLessThan(0.15)
  })
})
