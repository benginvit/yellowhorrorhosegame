import { defineConfig } from '@playwright/test'

// Targets. Defaults are local `vite preview` servers over the builds made by
// tests/e2e/build.mjs. Override to run against docker containers or live prod:
//   E2E_TEST_URL=http://127.0.0.1:3003  E2E_PROD_URL=https://<prod-host>
const TEST_PORT = 4173
const PROD_PORT = 4174
const TEST_URL = process.env.E2E_TEST_URL || `http://127.0.0.1:${TEST_PORT}`
const PROD_URL = process.env.E2E_PROD_URL || `http://127.0.0.1:${PROD_PORT}`

const preview = (dir, port) => ({
  command: `node node_modules/vite/bin/vite.js preview --outDir dist-e2e/${dir} --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: new URL('../..', import.meta.url).pathname,
  url: `http://127.0.0.1:${port}`,
  // Never reuse a listening server: a stale `vite preview` left behind by another
  // worktree would silently serve the wrong build. With a busy port Playwright
  // aborts with "http://127.0.0.1:<port> is already used ...".
  reuseExistingServer: false,
  timeout: 30_000,
})

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  outputDir: '../../test-results',
  // Baselines are generated in the environment that runs the tests (SwiftShader
  // output differs per machine/driver), so they are not committed. The first
  // run writes them and passes; later runs compare against them. With CI set
  // ('none') a missing baseline fails instead, so a fresh environment cannot
  // pass vacuously.
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  snapshotPathTemplate: '{testDir}/__baselines__/{projectName}/{testFilePath}/{arg}{ext}',
  workers: 1, // software rendering is CPU bound; parallel runs distort frame times
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2 },
  },
  use: {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
      ],
    },
  },
  projects: [
    { name: 'test', use: { baseURL: TEST_URL }, testMatch: ['smoke.spec.js', 'visual.spec.js', 'perf.spec.js'] },
    { name: 'prod', use: { baseURL: PROD_URL }, testMatch: ['smoke.spec.js', 'prod-check.spec.js'] },
  ],
  webServer: [
    ...(process.env.E2E_TEST_URL ? [] : [preview('test', TEST_PORT)]),
    ...(process.env.E2E_PROD_URL ? [] : [preview('prod', PROD_PORT)]),
  ],
})
