import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { openFrozen, replayCdnFonts, waitTextSynced, waitSceneContent, stableCanvasShot } from './helpers.js'

// The frozen classroom (?level=3&seed=1&freeze=1) must be byte-identical to a
// build without the flicker code (e.g. feat/lighting). Runs only when such a
// baseline test build is served:
//   E2E_BASELINE_URL=http://127.0.0.1:4181 npx playwright test -c tests/e2e/playwright.config.js lighting-baseline.spec.js --project=test
const BASELINE = process.env.E2E_BASELINE_URL
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex')

async function classroomMd5(browser, baseURL) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  await replayCdnFonts(page)
  await openFrozen(page, { level: 3 })
  await waitTextSynced(page)
  await waitSceneContent(page)
  await page.addStyleTag({ content: '.ui-overlay, .mobile-controls { visibility: hidden !important; }' })
  const hash = md5(await stableCanvasShot(page))
  await ctx.close()
  return hash
}

test.describe('lighting: frozen classroom equals baseline build', () => {
  test.skip(!BASELINE, 'set E2E_BASELINE_URL to a served test build without flicker')

  test('level 3, seed 1, freeze: md5 matches the baseline, twice', async ({ browser, baseURL }) => {
    const base1 = await classroomMd5(browser, BASELINE)
    const cur1 = await classroomMd5(browser, baseURL)
    const base2 = await classroomMd5(browser, BASELINE)
    const cur2 = await classroomMd5(browser, baseURL)
    console.log(`[lighting] md5 baseline ${base1} ${base2}, current ${cur1} ${cur2}`)
    expect(base2).toBe(base1)
    expect(cur2).toBe(cur1)
    expect(cur1).toBe(base1)
  })
})
