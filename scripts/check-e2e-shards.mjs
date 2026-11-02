// Shard guard: fails if an e2e test (or a whole tests/e2e/*.spec.js) is not run by
// any shard in .github/workflows/pr-check.yml. Needs only `npm ci` (no browser):
// it uses `playwright test --list`. perf.spec.js is opt-in (label e2e-perf) and is
// exempt. See docs/adr/0001-ci-e2e-baselines.md.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'

const WORKFLOW = '.github/workflows/pr-check.yml'
const CONFIG = 'tests/e2e/playwright.config.js'
const OPT_IN = new Set(['perf.spec.js'])

const list = (extra) => {
  const out = execFileSync(
    'npx',
    ['playwright', 'test', '-c', CONFIG, '--list', '--reporter=json', ...extra],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const ids = new Set()
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests) ids.add(`${t.projectName} | ${spec.file} | ${spec.title}`)
    }
    for (const s of suite.suites ?? []) walk(s)
  }
  for (const s of JSON.parse(out).suites) walk(s)
  return ids
}

// Minimal shell-style split (double quotes only), enough for the matrix `args:` lines.
const split = (s) => [...s.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2])

const shards = [...readFileSync(WORKFLOW, 'utf8').matchAll(/^\s+args:\s*(.+)$/gm)].map((m) => split(m[1].trim()))
if (shards.length === 0) {
  console.error(`No shard args found in ${WORKFLOW}`)
  process.exit(1)
}

const all = list([])
const covered = new Set()
for (const args of shards) for (const id of list(args)) covered.add(id)

const missing = [...all].filter((id) => !covered.has(id) && !OPT_IN.has(id.split(' | ')[1]))
const specFiles = readdirSync('tests/e2e').filter((f) => f.endsWith('.spec.js'))
const listedFiles = new Set([...all].map((id) => id.split(' | ')[1]))
const unmatched = specFiles.filter((f) => !listedFiles.has(f))

for (const f of unmatched) console.error(`::error::tests/e2e/${f} is not matched by any Playwright project (testMatch in ${CONFIG})`)
for (const id of missing) console.error(`::error::Not run by any shard in ${WORKFLOW}: ${id}`)
console.log(`${all.size} tests, ${covered.size} covered by ${shards.length} shards, ${missing.length} uncovered, ${unmatched.length} unmatched spec files`)
process.exit(missing.length || unmatched.length ? 1 : 0)
