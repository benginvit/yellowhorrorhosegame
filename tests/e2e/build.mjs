// Builds the two variants the e2e suite runs against (the local equivalent of
// `docker build .` and `docker build --build-arg VITE_TEST_MODE=1 .`):
//   dist-e2e/prod  normal build (marker must be absent)
//   dist-e2e/test  VITE_TEST_MODE=1 build (window.__YHH_TEST_MODE__ available)
// Skipped when both E2E_TEST_URL and E2E_PROD_URL point at already running servers.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

if (process.env.E2E_TEST_URL && process.env.E2E_PROD_URL) {
  console.log('[e2e build] E2E_TEST_URL and E2E_PROD_URL set - skipping local builds')
  process.exit(0)
}

function build(name, testMode) {
  const env = { ...process.env }
  delete env.VITE_TEST_MODE // never inherit the flag into the prod build
  if (testMode) env.VITE_TEST_MODE = '1'
  console.log(`[e2e build] ${name} (VITE_TEST_MODE=${testMode ? '1' : 'unset'})`)
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', `dist-e2e/${name}`, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: root, env, stdio: 'inherit' },
  )
}

if (!process.env.E2E_PROD_URL) build('prod', false)
if (!process.env.E2E_TEST_URL) build('test', true)

if (!process.env.E2E_PROD_URL) {
  // Same guard as CI: the marker must not leak into the prod bundle.
  execFileSync('bash', ['scripts/check-prod-bundle.sh', 'dist-e2e/prod'], { cwd: root, stdio: 'inherit' })
}
