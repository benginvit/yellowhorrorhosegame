import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { startGame, waitReady, waitTextSynced, waitFrames, replayCdnFonts } from './helpers.js'

// Test build only. Frame time = requestAnimationFrame interval over a fixed
// window (not frozen: ?seed=1 only). renderer.info is read from
// window.__YHH_TEST_MODE__.gl.
//
// Budget policy:
//  * p95 < 16.7 ms is the target and is REPORTED on every run.
//  * The baseline (tests/e2e/perf-baseline.json) is per environment and not committed.
//    No baseline -> locally this run records one and cannot fail (a warning is printed and an
//    annotation added). With CI set a missing baseline FAILS (fail-closed); E2E_SET_BASELINE=1
//    may still write one.
//  * With a baseline -> the test fails on regressions: p95 > max(baseline * P95_TOLERANCE,
//    baseline + P95_MIN_SLACK_MS) or calls/triangles > baseline * COUNT_TOLERANCE. p95 is the
//    best of WINDOWS measurement windows. The absolute 16.7 ms budget is
//    only enforced with E2E_ENFORCE_BUDGET=1 (needs a real GPU; SwiftShader is far
//    slower than 60 fps by design).
//  * E2E_SET_BASELINE=1 re-records the baseline.
const BUDGET_MS = 16.7
const P95_TOLERANCE = 1.5
const P95_MIN_SLACK_MS = 40 // frame times are quantised to vsync steps (16.7/33/50 ms...)
const COUNT_TOLERANCE = 1.1
const WARMUP_MS = 500
const MEASURE_MS = 2500
const WINDOWS = 2

const here = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_FILE = path.join(here, 'perf-baseline.json')
const readBaseline = () => (fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {})

const SCENARIOS = [
  { name: 'outdoor-level1', level: 1 },
  { name: 'classroom-level3', level: 3 },
]

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]

for (const scenario of SCENARIOS) {
  test(`frame time + renderer.info: ${scenario.name}`, async ({ page }, testInfo) => {
    await replayCdnFonts(page)
    await page.goto(`/?seed=1&level=${scenario.level}`)
    await startGame(page)
    await waitReady(page)
    await waitTextSynced(page)

    // renderer.info of the last rendered frame, read before the measurement so the
    // classroom is still in its (deterministic) 'seated' intro phase. The 2 rAFs make
    // sure that frame was drawn after the text was synced (not a frame from before).
    await waitFrames(page, 2)
    await page.waitForFunction(() => window.__YHH_TEST_MODE__.gl.info.render.calls > 0)
    const info = await page.evaluate(() => {
      const r = window.__YHH_TEST_MODE__.gl.info.render
      return { calls: r.calls, triangles: r.triangles }
    })

    const measureWindow = () => page.evaluate(([warmup, measure]) => new Promise((resolve) => {
      const dts = []
      let last = performance.now()
      const t0 = last
      const tick = (now) => {
        if (now - t0 > warmup) dts.push(now - last)
        last = now
        if (now - t0 > warmup + measure) resolve(dts)
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }), [WARMUP_MS, MEASURE_MS])

    // Best (lowest p95) of WINDOWS windows: software rendering has occasional
    // multi-frame stalls, a regression has to show up in every window.
    let best = null
    for (let w = 0; w < WINDOWS; w++) {
      const frames = await measureWindow()
      expect(frames.length, 'too few frames measured').toBeGreaterThan(10)
      const s = [...frames].sort((a, b) => a - b)
      const stats = { frames: frames.length, p50Ms: +percentile(s, 0.5).toFixed(1), p95Ms: +percentile(s, 0.95).toFixed(1), maxMs: +s.at(-1).toFixed(1) }
      if (!best || stats.p95Ms < best.p95Ms) best = stats
    }

    const result = { ...best, calls: info.calls, triangles: info.triangles }
    const underBudget = result.p95Ms < BUDGET_MS
    const line = `[perf] ${scenario.name}: ${JSON.stringify(result)} budget p95<${BUDGET_MS}ms: ${underBudget ? 'WITHIN' : 'OVER'}`
    console.log(line)
    testInfo.annotations.push({ type: 'perf', description: line })

    expect(Number.isFinite(result.triangles), 'renderer.info triangles is not finite (unsynced geometry?)').toBe(true)

    const baselines = readBaseline()
    const baseline = baselines[scenario.name]
    const setBaseline = process.env.E2E_SET_BASELINE === '1'
    if (!baseline && process.env.CI && !setBaseline) {
      throw new Error(
        `[perf] ${scenario.name}: no baseline in ${path.relative(process.cwd(), BASELINE_FILE)} and CI is set - refusing to pass without a regression check. ` +
        'Record one in this environment first (E2E_SET_BASELINE=1) or restore it from a CI artifact.',
      )
    }
    if (!baseline || setBaseline) {
      baselines[scenario.name] = { ...result, recordedAt: new Date().toISOString() }
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2) + '\n')
      const warning = `perf baseline for "${scenario.name}" ${baseline ? 're-recorded (E2E_SET_BASELINE=1)' : 'was missing and has been recorded'}; no regression check was done this run. Review ${path.relative(process.cwd(), BASELINE_FILE)} before relying on it.`
      console.warn(`[perf] WARNING: ${warning}`)
      testInfo.annotations.push({ type: 'baseline-written', description: warning })
      return
    }

    const p95Limit = Math.max(baseline.p95Ms * P95_TOLERANCE, baseline.p95Ms + P95_MIN_SLACK_MS)
    expect.soft(result.p95Ms, `p95 regressed vs baseline ${baseline.p95Ms} ms (limit ${p95Limit.toFixed(1)})`).toBeLessThanOrEqual(p95Limit)
    expect.soft(result.calls, 'draw calls increased vs baseline').toBeLessThanOrEqual(baseline.calls * COUNT_TOLERANCE)
    expect.soft(result.triangles, 'triangles increased vs baseline').toBeLessThanOrEqual(baseline.triangles * COUNT_TOLERANCE)
    if (process.env.E2E_ENFORCE_BUDGET === '1') {
      expect.soft(result.p95Ms, `p95 over the ${BUDGET_MS} ms budget`).toBeLessThan(BUDGET_MS)
    }
  })
}
