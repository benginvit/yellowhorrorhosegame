// Builds the three variants the e2e suite runs against (the local equivalent of
// `docker build .`, `docker build --build-arg VITE_TEST_MODE=1 .` and the staging
// image `docker build --build-arg VITE_LEVEL_SELECT=1 .`):
//   dist-e2e/prod     normal build (no marker may be present)
//   dist-e2e/test     VITE_TEST_MODE=1 build (window.__YHH_TEST_MODE__ available)
//   dist-e2e/staging  VITE_LEVEL_SELECT=1 build (level picker + ?level=N, no test API)
// Each build is skipped when its E2E_*_URL points at an already running server.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

if (process.env.E2E_TEST_URL && process.env.E2E_PROD_URL && process.env.E2E_STAGING_URL) {
  console.log('[e2e build] E2E_TEST_URL, E2E_PROD_URL and E2E_STAGING_URL set - skipping local builds')
  process.exit(0)
}

const FLAGS = ['VITE_TEST_MODE', 'VITE_LEVEL_SELECT']

function build(name, flags = {}) {
  const env = { ...process.env }
  for (const f of FLAGS) delete env[f] // never inherit a flag into another variant
  Object.assign(env, flags)
  const shown = FLAGS.map((f) => `${f}=${env[f] ?? 'unset'}`).join(' ')
  console.log(`[e2e build] ${name} (${shown})`)
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', `dist-e2e/${name}`, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: root, env, stdio: 'inherit' },
  )
}

const check = (args) => execFileSync('bash', ['scripts/check-prod-bundle.sh', ...args], { cwd: root, stdio: 'inherit' })

if (!process.env.E2E_PROD_URL) {
  build('prod')
  check(['dist-e2e/prod']) // same guard as CI: no marker may leak into the prod bundle
}
if (!process.env.E2E_TEST_URL) {
  build('test', { VITE_TEST_MODE: '1' })
  check(['--test', 'dist-e2e/test'])
}
if (!process.env.E2E_STAGING_URL) {
  build('staging', { VITE_LEVEL_SELECT: '1' })
  check(['--level-select', 'dist-e2e/staging'])
}
