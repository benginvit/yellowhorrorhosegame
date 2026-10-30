import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

/** The react-three-fiber canvas (other <canvas> elements exist for overlays). */
export const GAME_CANVAS = 'canvas[data-engine]'

/** Collects console errors / uncaught exceptions / failed requests of a page. */
export function trackErrors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  return errors
}

/** Pick language ("sv" = first button) and press Start. Works in test and prod builds. */
export async function startGame(page) {
  await page.locator('.start-screen button').first().click()
  await page.locator('.start-btn').click()
  await page.locator(GAME_CANVAS).waitFor({ state: 'attached' })
}

/** Test build only: wait until the scene is mounted and a frame has been rendered. */
export async function waitReady(page) {
  await page.waitForFunction(() => window.__YHH_TEST_MODE__?.ready === true, null, { timeout: 30_000 })
}

/**
 * Decodes a screenshot of the canvas in the page and returns how many distinct
 * (quantised) colours it has. A blank/black/uniform canvas gives 1-2.
 */
export async function canvasColourCount(page) {
  const png = await page.locator(GAME_CANVAS).screenshot()
  const b64 = png.toString('base64')
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob()
    const bmp = await createImageBitmap(blob)
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const ctx = c.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data
    const seen = new Set()
    for (let i = 0; i < px.length; i += 4 * 7) {
      seen.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
    }
    return seen.size
  }, b64)
}

export function expectNoErrors(errors) {
  expect(errors, `unexpected console/page errors:\n${errors.join('\n')}`).toEqual([])
}

/** Opens the test build frozen/seeded, starts the game at `level` and waits for the first frame. */
export async function openFrozen(page, { level = 1, inside = false } = {}) {
  const q = new URLSearchParams({ seed: '1', freeze: '1', level: String(level) })
  if (inside) q.set('inside', '1')
  await page.goto(`/?${q}`)
  await startGame(page)
  await waitReady(page)
}

const YAW_RATE = 2 // Player.jsx rotateSpeed (rad/s)
const FRAME_DT = 1 / 60

/**
 * Puts the (frozen) camera at a fixed pose and renders one frame.
 * Position is set directly; yaw/pitch (radians, +yaw = turn left, +pitch = up)
 * go through Player's own keyboard handling (ArrowLeft/Right/Up/Down), stepped
 * with advance() so the result is deterministic. Resolution: 2/60 rad (~1.9 deg).
 */
export async function setView(page, { x, z, yaw = 0, pitch = 0 }) {
  await page.evaluate(([px, pz]) => {
    window.__YHH_TEST_MODE__.camera.position.set(px, 1.6, pz)
  }, [x, z])
  const turn = async (angle, plus, minus) => {
    const frames = Math.round(Math.abs(angle) / (YAW_RATE * FRAME_DT))
    if (!frames) return
    const key = angle > 0 ? plus : minus
    await page.keyboard.down(key)
    await page.evaluate((n) => window.__YHH_TEST_MODE__.advance(n, 1 / 60), frames)
    await page.keyboard.up(key)
  }
  await turn(yaw, 'ArrowLeft', 'ArrowRight')
  await turn(pitch, 'ArrowUp', 'ArrowDown')
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(1, 1 / 60)) // render with no keys held
}

const here = path.dirname(fileURLToPath(import.meta.url))
const FONT_HAR = path.join(here, 'fixtures', 'jsdelivr-fonts.har.zip')

/**
 * drei <Text> (troika) downloads its glyph data from cdn.jsdelivr.net at runtime.
 * The responses are committed as tests/e2e/fixtures/jsdelivr-fonts.har.zip and
 * replayed, so renders neither depend on the CDN nor race against it.
 * Re-record (needs network) with:
 *   E2E_RECORD_FONTS=1 npx playwright test -c tests/e2e/playwright.config.js -g "classroom \(level 3\)" --project=test
 */
export async function replayCdnFonts(page) {
  const record = process.env.E2E_RECORD_FONTS === '1'
  if (!record && !fs.existsSync(FONT_HAR)) return // no fixture: fall back to the real CDN
  await page.routeFromHAR(FONT_HAR, {
    url: /cdn\.jsdelivr\.net/,
    update: record,
    updateContent: 'embed',
    notFound: 'abort',
  })
}

/**
 * Waits until every troika <Text> has synced its glyph geometry. Until the first
 * sync, troika's GlyphsGeometry has no position attribute (set on sync, not in the
 * constructor) and an instanceCount of Infinity (inherited from
 * InstancedBufferGeometry). The Infinity instanceCount makes
 * renderer.info.render.triangles Infinity for any frame drawn before the sync.
 * Both conditions are checked; without this, screenshots and renderer.info depend
 * on font load timing.
 */
export async function waitTextSynced(page) {
  await page.waitForFunction(() => {
    let pending = 0
    window.__YHH_TEST_MODE__.scene.traverse((o) => {
      const g = o.geometry
      if (!g) return
      if (!g.attributes.position) pending++
      else if (g.isInstancedBufferGeometry && !Number.isFinite(g.instanceCount)) pending++
    })
    return pending === 0
  }, null, { timeout: 30_000 })
}

/**
 * Waits for two requestAnimationFrame callbacks, so at least one full frame has
 * been rendered after the current JS task. Use before reading renderer.info, which
 * only reflects the last rendered frame.
 */
export async function waitFrames(page, n = 2) {
  await page.evaluate((count) => new Promise((resolve) => {
    let left = count
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step))
    requestAnimationFrame(step)
  }), n)
}

/** Hide the HTML HUD so screenshots only contain the 3D scene. */
export async function hideHud(page) {
  await page.addStyleTag({ content: '.ui-overlay { visibility: hidden !important; }' })
}

/**
 * Number of pixels that differ (any RGBA channel) between two PNG buffers of the
 * same size. Decoded in the browser (createImageBitmap) so no PNG library is needed.
 */
export async function countDifferingPixels(page, pngA, pngB) {
  return page.evaluate(async ([a, b]) => {
    const decode = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0)
      return ctx.getImageData(0, 0, bmp.width, bmp.height)
    }
    const [ia, ib] = await Promise.all([decode(a), decode(b)])
    if (ia.width !== ib.width || ia.height !== ib.height) return -1
    let n = 0
    for (let i = 0; i < ia.data.length; i += 4) {
      if (ia.data[i] !== ib.data[i] || ia.data[i + 1] !== ib.data[i + 1] || ia.data[i + 2] !== ib.data[i + 2] || ia.data[i + 3] !== ib.data[i + 3]) n++
    }
    return n
  }, [pngA.toString('base64'), pngB.toString('base64')])
}
