import { test, expect } from '@playwright/test'
import { openFrozen, setView, waitSceneContent, replayCdnFonts, waitTextSynced, trackErrors, expectNoErrors } from './helpers.js'

// Outdoor ash + ground fog (src/components/particles/Ash.jsx), test build, frozen.
// Budget and freeze rules: ADR on BENG-26. BENG-29 adds the suite-wide particles.spec.js;
// these checks can move there.
const PARTICLE_BUDGET = 1500 // particles/common.js; a fine pointer (headless desktop) is the desktop tier
const ASH_COUNT = 600 // ASH.count in Ash.jsx; mobile (pointer: coarse) gets half
const ASH_BOX = { hx: 18, hz: 18, floor: 0.1, height: 9 } // ASH.box / 2, ASH.floor, ASH.box[1]

const pointSystems = (page) => page.evaluate(() => {
  const out = []
  window.__YHH_TEST_MODE__.scene.traverse((o) => {
    if (!o.isPoints || o.name.startsWith('burst')) return // event bursts: particles.spec.js
    const m = o.material
    // ash = SoftPointsMaterial (uGroundFade); the indoor dust (Dust.jsx) has none.
    out.push({ name: o.name, ash: !!m.uniforms?.uGroundFade, count: o.geometry.attributes.position.count, depthWrite: m.depthWrite, transparent: m.transparent, castShadow: o.castShadow, positions: Array.from(o.geometry.attributes.position.array) })
  })
  return out
})

async function openOutdoor(page, view = { x: 0, z: 15, yaw: 0 }) {
  await replayCdnFonts(page)
  await openFrozen(page, { level: 1 })
  await setView(page, view)
  await waitTextSynced(page)
  await waitSceneContent(page)
}

test('outdoor: two Points systems at the desktop count, within budget, no depth write, no shadows', async ({ page }) => {
  const errors = trackErrors(page)
  await openOutdoor(page)
  const systems = await pointSystems(page)
  expect(systems.length, 'ash + ground fog').toBe(2)
  expect(systems.every((s) => s.ash), 'no indoor dust outdoors').toBe(true)
  const total = systems.reduce((n, s) => n + s.count, 0)
  console.log(`[ash] particles per system: ${systems.map((s) => s.count).join(' + ')} = ${total}`)
  expect(systems.find((s) => s.name === 'ash')?.count, 'ash at the desktop count (CI perf measures the desktop budget)').toBe(ASH_COUNT)
  expect(systems.find((s) => s.name === 'groundFog')?.count, 'ground fog').toBe(24)
  expect(total).toBeLessThanOrEqual(PARTICLE_BUDGET)
  for (const s of systems) {
    expect(s.depthWrite).toBe(false)
    expect(s.transparent).toBe(true)
    expect(s.castShadow).toBe(false)
  }
  expectNoErrors(errors)
})

test.describe('mobile tier', () => {
  test.use({ hasTouch: true }) // Chromium: touch emulation makes (pointer: coarse) match

  test('a coarse pointer halves the particle count', async ({ page }) => {
    await openOutdoor(page)
    const systems = await pointSystems(page)
    expect(Object.fromEntries(systems.map((s) => [s.name, s.count]))).toEqual({ ash: ASH_COUNT / 2, groundFog: 12 })
  })
})

test('frozen: particle positions do not change between frames, with or without dt', async ({ page }) => {
  await openOutdoor(page)
  const a = await pointSystems(page)
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(3, 0))
  const b = await pointSystems(page)
  await page.evaluate(() => window.__YHH_TEST_MODE__.advance(5, 1 / 60))
  const c = await pointSystems(page)
  expect(b.map((s) => s.positions)).toEqual(a.map((s) => s.positions))
  expect(c.map((s) => s.positions)).toEqual(a.map((s) => s.positions))
})

test('the ash volume follows the camera', async ({ page }) => {
  await openOutdoor(page, { x: -22, z: -2, yaw: -0.8 })
  const ash = (await pointSystems(page)).find((s) => s.name === 'ash')
  let outside = 0
  for (let i = 0; i < ash.count; i++) {
    const dx = ash.positions[i * 3] - -22
    const y = ash.positions[i * 3 + 1]
    const dz = ash.positions[i * 3 + 2] - -2
    if (Math.abs(dx) > ASH_BOX.hx + 1e-6 || Math.abs(dz) > ASH_BOX.hz + 1e-6) outside++
    if (y < ASH_BOX.floor || y >= ASH_BOX.floor + ASH_BOX.height) outside++
  }
  expect(outside, 'ash particles outside the box around the camera / outside [floor, floor + height)').toBe(0)
})

test('indoors (classroom, house interior): dust only, no ash or ground fog', async ({ page }) => {
  await replayCdnFonts(page)
  await openFrozen(page, { level: 3 })
  await waitTextSynced(page)
  await waitSceneContent(page)
  let systems = await pointSystems(page)
  expect(systems.filter((s) => s.ash).length).toBe(0)
  expect(systems.length, 'classroom dust (BENG-27) still mounted').toBe(1)
  await openFrozen(page, { level: 2, inside: true })
  await waitSceneContent(page)
  systems = await pointSystems(page)
  expect(systems.filter((s) => s.ash).length).toBe(0)
  expect(systems.length, 'house interior dust (BENG-27) still mounted').toBe(1)
})
