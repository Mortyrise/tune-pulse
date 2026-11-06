#!/usr/bin/env node
// Generates every native brand asset from the PWA source icon.
//
//   node scripts/generate-assets.mjs        (run from native/)
//
// Source of truth: the waveform <path d> in ../public/favicon.svg. Its colours
// are not used: the native app uses the pulse·groove palette (terracotta
// waveform on cream). Re-run whenever favicon.svg or the palette changes.
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const NATIVE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_SVG = resolve(NATIVE, '../public/favicon.svg')
const ASSETS = join(NATIVE, 'assets')

const CREAM = '#EEE7D6' // light theme bg (src/theme/tokens.ts)
const ACCENT = '#C4502F' // light theme accent
const WHITE = '#FFFFFF' // Android monochrome / notification icons are alpha-only silhouettes

// Waveform geometry in the favicon's 64x64 grid: x 10..54, y 18..46, centre (32, 32).
const PATH_WIDTH = 44
const PATH_CENTRE = 32

async function readWaveformPath() {
  const svg = await readFile(SOURCE_SVG, 'utf8')
  const match = svg.match(/<path[^>]*\sd="([^"]+)"/)
  if (!match) throw new Error(`No <path d="..."> found in ${SOURCE_SVG}`)
  return match[1]
}

/**
 * SVG of the waveform centred on a w x h canvas.
 * widthFrac: waveform width as a fraction of the canvas width.
 * stroke: stroke width in favicon units (source uses 3.5).
 */
function waveformSvg(d, { w, h, widthFrac, color, background, stroke = 3.5 }) {
  const k = (w * widthFrac) / PATH_WIDTH
  const bg = background ? `<rect width="${w}" height="${h}" fill="${background}"/>` : ''
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      bg +
      `<g transform="translate(${w / 2} ${h / 2}) scale(${k}) translate(${-PATH_CENTRE} ${-PATH_CENTRE})">` +
      `<path d="${d}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g></svg>`,
  )
}

async function render(file, svg, { flatten, alpha } = {}) {
  const out = join(ASSETS, file)
  await mkdir(dirname(out), { recursive: true })
  let img = sharp(svg, { density: 72 })
  if (flatten) img = img.flatten({ background: flatten })
  if (alpha) img = img.ensureAlpha() // Play hi-res icon spec: 32-bit PNG
  await img.png({ compressionLevel: 9 }).toFile(out)
  console.log(`  ${file}`)
}

// Adaptive icon canvas is 108dp; the launcher mask always shows the centred 66dp
// circle (61%). The waveform's bounding box diagonal is ~1.19x its width, so a
// 48% width keeps every corner inside that circle with stroke margin.
const ADAPTIVE_WIDTH_FRAC = 0.48

// Notification small icon: 24dp with ~2dp padding, thicker stroke so it reads at 24px.
const NOTIFICATION_SIZES = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 }

async function main() {
  const d = await readWaveformPath()
  console.log(`Generating assets from ${SOURCE_SVG}`)

  // Store/iOS/fallback icon: square, full-bleed, no transparency.
  const icon = (size) =>
    waveformSvg(d, { w: size, h: size, widthFrac: 0.62, color: ACCENT, background: CREAM })
  await render('icon.png', icon(1024), { flatten: CREAM })
  await render('store/icon-512.png', icon(512), { flatten: CREAM, alpha: true })

  // Android adaptive icon layers (background is android.adaptiveIcon.backgroundColor).
  await render(
    'android-icon-foreground.png',
    waveformSvg(d, { w: 1024, h: 1024, widthFrac: ADAPTIVE_WIDTH_FRAC, color: ACCENT }),
  )
  await render(
    'android-icon-monochrome.png',
    waveformSvg(d, { w: 1024, h: 1024, widthFrac: ADAPTIVE_WIDTH_FRAC, color: WHITE }),
  )

  // Splash: transparent, readable on cream (light) and #0F0E0C (dark).
  await render(
    'splash-icon.png',
    waveformSvg(d, { w: 1024, h: 1024, widthFrac: 0.9, color: ACCENT, stroke: 3 }),
  )

  // Web favicon.
  await render(
    'favicon.png',
    waveformSvg(d, { w: 48, h: 48, widthFrac: 0.8, color: ACCENT, background: CREAM, stroke: 5 }),
    { flatten: CREAM },
  )

  // Play feature graphic (1024x500, no transparency).
  await render(
    'store/feature-graphic.png',
    waveformSvg(d, { w: 1024, h: 500, widthFrac: 0.5, color: ACCENT, background: CREAM }),
    { flatten: CREAM },
  )

  // Notification small icon, copied into res/drawable-*dpi by plugins/withNotificationIcon.js.
  for (const [dpi, size] of Object.entries(NOTIFICATION_SIZES)) {
    await render(
      `notification-icon/ic_notification_${dpi}.png`,
      waveformSvg(d, { w: size, h: size, widthFrac: 0.84, color: WHITE, stroke: 5 }),
    )
  }

  // Superseded by android.adaptiveIcon.backgroundColor.
  await rm(join(ASSETS, 'android-icon-background.png'), { force: true })
  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
