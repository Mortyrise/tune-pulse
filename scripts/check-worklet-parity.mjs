#!/usr/bin/env node
// Web/native tuner parity check (phase3/16).
//
// Loads the BUILT web worklet (dist/assets/mpm-processor-*.js) in a node:vm
// context with stub AudioWorklet globals, feeds it 128-sample render quanta,
// and compares every posted sample with native MpmDetector
// (native/src/core/mpm.ts) fed identically. Also reports the pre-phase-3
// worklet (from git, if available) as a baseline.
//
// Exits non-zero if the build output is missing/broken, the worklet does not
// match native bit for bit, or the E2-in-noise / C8 acceptance fails.
//
// Usage (repo root): npm run build && npm run check:worklet
// Requires Node ≥ 22.18 (built-in TypeScript type stripping, module.registerHooks).

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreDir = join(root, 'native/src/core')
const BASELINE_REV = '13ecc7b' // last commit with the hand-written JS worklet
const QUANTUM = 128
const HOP = 512
const WINDOW = 4096

function fail(msg) {
  console.error(`\n✗ check:worklet FAILED: ${msg}`)
  process.exit(1)
}

if (typeof registerHooks !== 'function') fail(`Node ${process.version} lacks module.registerHooks (need ≥ 22.15)`)

// native/src/core uses extensionless relative imports ('./biquad'); resolve them to .ts.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
      return next(`${specifier}.ts`, context)
    }
    return next(specifier, context)
  },
})

let MpmDetector, pluck, harmonicTone
try {
  ;({ MpmDetector } = await import(pathToFileURL(join(coreDir, 'mpm.ts')).href))
  ;({ pluck, harmonicTone } = await import(pathToFileURL(join(coreDir, 'testSignals.ts')).href))
} catch (err) {
  fail(`cannot import native core with Node type stripping (${process.version}): ${err.message}`)
}

// --- built worklet ----------------------------------------------------------
const assetsDir = join(root, 'dist/assets')
const built = existsSync(assetsDir) ? readdirSync(assetsDir).filter((f) => /^mpm-processor-.*\.js$/.test(f)) : []
if (built.length !== 1) {
  fail(`expected exactly one dist/assets/mpm-processor-*.js, found ${built.length}. Run \`npm run build\` first.`)
}
const builtSource = readFileSync(join(assetsDir, built[0]), 'utf8')
const forbidden = builtSource.match(/\b(window|document|self|import\.meta|require)\b/)
if (forbidden) fail(`built worklet references \`${forbidden[0]}\`, which does not exist in AudioWorkletGlobalScope`)

let baselineSource = null
try {
  baselineSource = execFileSync('git', ['show', `${BASELINE_REV}:src/audio/worklets/mpm-processor.js`], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch {
  console.warn(`(baseline worklet at ${BASELINE_REV} not available; skipping before/after column)`)
}

/** Instantiate a worklet script in a fresh context with AudioWorklet stubs. */
function loadWorklet(source, label, sr) {
  const posted = []
  let Ctor = null
  class AudioWorkletProcessor {
    constructor() {
      this.port = { postMessage: (m) => posted.push(m) }
    }
  }
  const context = vm.createContext({
    sampleRate: sr,
    AudioWorkletProcessor,
    registerProcessor: (name, ctor) => {
      if (name === 'mpm-processor') Ctor = ctor
    },
  })
  try {
    vm.runInContext(source, context, { filename: label })
  } catch (err) {
    fail(`${label} threw while loading: ${err.message}`)
  }
  if (!Ctor) fail(`${label} did not registerProcessor('mpm-processor', …)`)
  return { proc: new Ctor(), posted }
}

function runWorklet(source, label, x, sr) {
  const { proc, posted } = loadWorklet(source, label, sr)
  for (let i = 0; i + QUANTUM <= x.length; i += QUANTUM) proc.process([[x.subarray(i, i + QUANTUM)]], [[]], {})
  return posted
}

function runNative(x, sr) {
  const det = new MpmDetector(sr)
  const out = []
  for (let i = 0; i + QUANTUM <= x.length; i += QUANTUM) {
    const s = det.push(x.subarray(i, i + QUANTUM))
    if (s) out.push(s)
  }
  return out
}

const cents = (a, b) => 1200 * Math.log2(a / b)

/** Frames (k-th analysis ends at (k+1)·HOP) with a full window and t in [0.2, 2.0] s. */
function score(frames, f0, sr) {
  const sel = frames.filter((_, k) => {
    const end = (k + 1) * HOP
    const t = end / sr
    return end >= WINDOW && t >= 0.2 && t <= 2.0
  })
  const hits = sel.filter((q) => q.frequency > 0 && Math.abs(cents(q.frequency, f0)) < 50)
  const voiced = sel.filter((q) => q.frequency > 0)
  const maxCents = voiced.length ? Math.max(...voiced.map((q) => Math.abs(cents(q.frequency, f0)))) : NaN
  return { n: sel.length, rate: sel.length ? hits.length / sel.length : 0, maxCents }
}

const fmt = (s) => `${(100 * s.rate).toFixed(1).padStart(5)} % hit, max |¢| ${s.maxCents.toFixed(2).padStart(7)} (${s.n} frames)`

const cases = [
  { name: 'E2 pluck + white noise σ0.008 @48k', sr: 48000, f0: 82.41, x: pluck({ noise: 0.008 }), minRate: 0.95, maxCents: 50 },
  { name: 'E2 pluck + white noise σ0.008 @44.1k', sr: 44100, f0: 82.41, x: pluck({ noise: 0.008, sampleRate: 44100 }), minRate: 0.95, maxCents: 50 },
  { name: 'C8 4-harmonic tone @48k', sr: 48000, f0: 4186.01, x: harmonicTone(4186.01, 48000, 48000, 4), minRate: 1, maxCents: 1 },
  { name: 'C8 4-harmonic tone @44.1k', sr: 44100, f0: 4186.01, x: harmonicTone(4186.01, 44100, 44100, 4), minRate: 1, maxCents: 1 },
]

console.log(`worklet: dist/assets/${built[0]} (${builtSource.length} B)\n`)
const errors = []
for (const c of cases) {
  const native = runNative(c.x, c.sr)
  const web = runWorklet(builtSource, built[0], c.x, c.sr)
  let maxDiff = 0
  if (web.length !== native.length) errors.push(`${c.name}: ${web.length} worklet frames vs ${native.length} native`)
  for (let k = 0; k < Math.min(web.length, native.length); k++) {
    for (const key of ['frequency', 'clarity', 'rms']) {
      maxDiff = Math.max(maxDiff, Math.abs(web[k][key] - native[k][key]))
    }
  }
  if (maxDiff !== 0) errors.push(`${c.name}: worklet differs from native (max abs diff ${maxDiff})`)
  const ws = score(web, c.f0, c.sr)
  const ns = score(native, c.f0, c.sr)
  if (ws.rate < c.minRate || !(ws.maxCents <= c.maxCents)) {
    errors.push(`${c.name}: worklet ${fmt(ws)}; need ≥ ${100 * c.minRate} % and ≤ ${c.maxCents} ¢`)
  }
  console.log(c.name)
  if (baselineSource) console.log(`  old worklet  ${fmt(score(runWorklet(baselineSource, 'baseline', c.x, c.sr), c.f0, c.sr))}`)
  console.log(`  new worklet  ${fmt(ws)}`)
  console.log(`  native core  ${fmt(ns)}`)
  console.log(`  worklet vs native: ${web.length}/${native.length} frames, max abs diff ${maxDiff}\n`)
}

// Cost on the audio thread at the web cadence (48 kHz / 512 hop = 93.75 analyses/s).
{
  const x = cases[0].x
  const reps = 3
  const analyses = reps * Math.floor(x.length / HOP)
  const bench = (source, label) => {
    const { proc } = loadWorklet(source, label, 48000)
    const t0 = performance.now()
    for (let r = 0; r < reps; r++) for (let i = 0; i + QUANTUM <= x.length; i += QUANTUM) proc.process([[x.subarray(i, i + QUANTUM)]], [[]], {})
    const ms = (performance.now() - t0) / analyses
    console.log(`  ${label.padEnd(12)} ${ms.toFixed(3)} ms/analysis ≈ ${((ms * 93.75) / 10).toFixed(1)} % of one core (V8, this machine)`)
  }
  console.log('cost @48k')
  if (baselineSource) bench(baselineSource, 'old worklet')
  bench(builtSource, 'new worklet')
}

if (errors.length) fail(`\n  - ${errors.join('\n  - ')}`)
console.log('\n✓ check:worklet passed: built worklet is bit-identical to native/src/core and meets E2/C8 acceptance')
