import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { RASMUS_TABLE_POS } from '../../src/levels/ikeaLayout.js'

/** The react-three-fiber canvas (other <canvas> elements exist for overlays). */
export const GAME_CANVAS = 'canvas[data-engine]'

/** Collects console errors / uncaught exceptions / failed requests of a page. */
export function trackErrors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
    // Chrome loses the oldest WebGL context once ~16 are alive. The test build leaves
    // unmounted Canvases to garbage collection (testMode.js), so count this as an error.
    if (msg.type() === 'warning' && /Too many active WebGL contexts/.test(msg.text())) errors.push(`console.warning: ${msg.text()}`)
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
export async function openFrozen(page, { level = 1, inside = false, phase } = {}) {
  const q = new URLSearchParams({ seed: '1', freeze: '1', level: String(level) })
  if (inside) q.set('inside', '1')
  if (phase) q.set('phase', phase)
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

/**
 * Luminance statistics of the game canvas (Rec. 709 luma, 0-255) from a
 * screenshot of the real frame. `region` is an optional pixel box
 * {x, y, w, h} in canvas coordinates. Returns mean, p5/p50/p95 and the share of
 * pixels that are (nearly) black (luma < 8) and (nearly) white (luma > 247).
 */
export async function lumaStats(page, region = null) {
  const png = await stableCanvasShot(page)
  return page.evaluate(async ([b64, box]) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const ctx = c.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    const r = box ?? { x: 0, y: 0, w: bmp.width, h: bmp.height }
    const x0 = Math.max(0, Math.round(r.x)), y0 = Math.max(0, Math.round(r.y))
    const w = Math.min(bmp.width - x0, Math.round(r.w)), h = Math.min(bmp.height - y0, Math.round(r.h))
    const px = ctx.getImageData(x0, y0, w, h).data
    const hist = new Uint32Array(256)
    let sum = 0
    for (let i = 0; i < px.length; i += 4) {
      const l = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2])
      hist[l]++
      sum += l
    }
    const n = px.length / 4
    const pct = (p) => {
      let acc = 0
      for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc >= p * n) return l }
      return 255
    }
    let dark = 0, bright = 0
    for (let l = 0; l < 8; l++) dark += hist[l]
    for (let l = 248; l < 256; l++) bright += hist[l]
    return { mean: sum / n, p5: pct(0.05), p50: pct(0.5), p95: pct(0.95), blackShare: dark / n, whiteShare: bright / n, pixels: n }
  }, [png.toString('base64'), region])
}

/** Screen position (canvas pixels) of a world point, or null if behind the camera. */
export async function projectToScreen(page, [x, y, z]) {
  return page.evaluate(([px, py, pz]) => {
    const api = window.__YHH_TEST_MODE__
    const cam = api.camera
    cam.updateMatrixWorld()
    const v = cam.position.clone().set(px, py, pz).project(cam)
    if (v.z > 1) return null
    const { width, height } = api.gl.domElement
    return { x: (v.x * 0.5 + 0.5) * width, y: (1 - (v.y * 0.5 + 0.5)) * height }
  }, [x, y, z])
}

/**
 * Screenshot of the game canvas. A frozen scene must give the same bytes every
 * time, but in the house interior an occasional capture shows a different
 * (uniform grey) frame; capture until two consecutive shots are identical.
 */
export async function stableCanvasShot(page, attempts = 5) {
  const canvas = page.locator(GAME_CANVAS)
  let prev = await canvas.screenshot()
  for (let i = 0; i < attempts; i++) {
    const next = await canvas.screenshot()
    if (next.equals(prev)) return next
    prev = next
  }
  throw new Error(`canvas screenshots of a frozen scene never stabilised in ${attempts} attempts`)
}

/**
 * Test build: renders frames (time unchanged) until the frame has at least
 * `minCalls` draw calls. The scene content sits in <Suspense>, so right after
 * `ready` a frame can contain only the lights, sky colour and fog (1 draw call);
 * measuring such a frame says nothing about the lighting.
 */
export async function waitSceneContent(page, minCalls = 20) {
  await page.waitForFunction((min) => {
    const api = window.__YHH_TEST_MODE__
    api.advance(1, 0)
    return api.gl.info.render.calls >= min
  }, minCalls, { timeout: 20_000, polling: 100 })
}

/** Test build only: puts the (frozen) camera at (x, 1.6, z); the player moves by velocity only, so the pose stays. */
export function setCamera(page, x, z) {
  return page.evaluate(([px, pz]) => window.__YHH_TEST_MODE__.camera.position.set(px, 1.6, pz), [x, z])
}

// Throws when there is no live Canvas: advance() then renders nothing and the game's frame logic does not run.
const advance = async (page, seconds, dt = 1 / 20) => {
  const live = await page.evaluate(([s, step]) => window.__YHH_TEST_MODE__.advance(Math.round(s / step), step), [seconds, dt])
  if (!live) throw new Error('advance(): no live Canvas, the frames did not run')
}

// Spots inside IKEA_BOUNDS within 1.5 of the interactables (ikeaLayout.js): the tray at (0, 0.9), Rasmus' table at
// (4.25, 1.2), the drink station at (-3, 6).
export const AT_TRAY = [0, 2.2]
export const AT_TABLE = [4.25, 2.4]
export const AT_STATION = [-3, 5.2]

/** Walks to a spot, lets the game see it (state commits between steps) and presses F once the hint is up. */
export async function useAt(page, [x, z], { tap = false } = {}) {
  // The pose is set again on every retry: the game may still be moving the camera (Rasmus' scene, phase changes).
  await setCamera(page, x, z)
  await advance(page, 0.1)
  // A few more frames if React has not committed the target yet (bounded; the failure is the expect below).
  for (let i = 0; i < 5 && !(await page.getByTestId('ikea-use-hint').isVisible()); i++) {
    await setCamera(page, x, z)
    await advance(page, 0.1)
  }
  await expect(page.getByTestId('ikea-use-hint')).toBeVisible()
  if (tap) await page.getByTestId('ikea-use').tap() // the on-screen "Use" button
  else await page.keyboard.press('KeyF')
}

/**
 * World position of a named scene object (a group the IKEA scene mounts conditionally), or null when it is not in the
 * scene. `visible` is false when the object or any ancestor is hidden.
 */
export function sceneObject(page, name) {
  return page.evaluate((n) => {
    const o = window.__YHH_TEST_MODE__.scene.getObjectByName(n)
    if (!o) return null
    o.updateWorldMatrix(true, false)
    const p = o.getWorldPosition(o.position.clone())
    let visible = true
    for (let a = o; a; a = a.parent) visible = visible && a.visible
    return { x: p.x, y: p.y, z: p.z, visible }
  }, name)
}

/**
 * Steps the frozen clock in small bounded steps (10 x 0.1 s of clock time) until the named object is in the scene
 * (`present`) or gone from it. React state (the UI, e.g. data-objective) commits before the R3F scene mounts or
 * unmounts the matching group, so a UI check does not sync the scene. Fails with the last state if it never settles.
 */
export async function waitSceneObject(page, name, present = true) {
  for (let i = 0; i < 10 && Boolean(await sceneObject(page, name)) !== present; i++) await advance(page, 0.1)
  expect(Boolean(await sceneObject(page, name)), `"${name}" is ${present ? 'in' : 'gone from'} the scene`).toBe(present)
}

/** Horizontal distance from a scene object to a [x, , z] point. */
export async function distanceTo(page, name, [x, , z]) {
  const o = await sceneObject(page, name)
  expect(o, `"${name}" is in the scene`).not.toBeNull()
  return Math.hypot(o.x - x, o.z - z)
}

/** The tray/glass in hand: the scene group "carried-item" sits in front of the camera, or is absent when nothing is carried. */
export async function expectCarrying(page, carrying, { inView = true } = {}) {
  await waitSceneObject(page, 'carried-item', Boolean(carrying))
  if (!carrying) return
  // The group is placed in front of the camera by a frame, not on mount.
  // Mounting (a React commit after the use) and placing (the next frame) can land in different steps: a few extra frames, bounded.
  const measure = () => page.evaluate(() => {
    const api = window.__YHH_TEST_MODE__
    const o = api.scene.getObjectByName('carried-item')
    if (!o) return null
    const cam = api.camera
    cam.updateMatrixWorld()
    const p = o.getWorldPosition(cam.position.clone())
    let visible = true
    for (let a = o; a; a = a.parent) visible = visible && a.visible
    const v = p.clone().project(cam)
    return { visible, dist: cam.position.distanceTo(p), onScreen: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 }
  })
  let m = await measure()
  for (let i = 0; i < 5 && !(m && m.dist < 1.5); i++) { await advance(page, 0.1); m = await measure() }
  expect(m, `"carried-item" (${carrying}) is in the scene`).not.toBeNull()
  expect(m.visible).toBe(true)
  expect(m.dist, 'the carried item is held close to the camera').toBeLessThan(1.5)
  if (inView) expect(m.onScreen, 'the carried item is in view').toBe(true)
}

/** From 'serve' (Rasmus walking to his seat) through tray, table, lingonberry drink to level complete. */
export async function serveAndDrink(page, { tap = false } = {}) {
  await waitSceneObject(page, 'tray-pickup', true) // the tray waits on the counter
  await expectCarrying(page, null)
  await useAt(page, AT_TRAY, { tap })
  await expectCarrying(page, 'tray')
  await waitSceneObject(page, 'tray-pickup', false) // the picked-up tray is gone from the counter
  await advance(page, 4.5) // he is seated (walk or fallback timer)
  await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjServeTable')
  await useAt(page, AT_TABLE, { tap })
  await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDrink')
  await expectCarrying(page, null)
  await waitSceneObject(page, 'tray-on-table', true)
  expect(await distanceTo(page, 'tray-on-table', RASMUS_TABLE_POS), 'the tray stands on Rasmus\' table').toBeLessThan(0.3)
  expect(await sceneObject(page, 'glass-on-table'), 'no glass yet').toBeNull()
  await advance(page, 4) // the station opens once Rasmus has said "Lingondryck" (ikeaDrinkAsked)
  await useAt(page, AT_STATION, { tap })
  if (tap) await page.getByTestId('ikea-drink-lingon').tap()
  else await page.getByTestId('ikea-drink-lingon').click()
  await expect(page.getByTestId('ikea-objective')).toHaveAttribute('data-objective', 'ikeaObjDeliverDrink')
  // Portrait phone (390x740): the glass' offset puts it just outside the view (BENG-96 comment), so only its distance is checked there.
  await expectCarrying(page, 'drink', { inView: !tap })
  expect(await sceneObject(page, 'glass-on-table'), 'the glass is still in hand, not on the table').toBeNull()
  await useAt(page, AT_TABLE, { tap })
  await expectCarrying(page, null)
  await waitSceneObject(page, 'glass-on-table', true)
  expect(await distanceTo(page, 'glass-on-table', RASMUS_TABLE_POS), 'the glass stands on Rasmus\' table').toBeLessThan(0.6)
  expect(await sceneObject(page, 'tray-on-table'), 'the tray is still on the table').not.toBeNull()
  await advance(page, 4.5)
  await expect(page.locator('.victory-screen')).toBeVisible()
}
