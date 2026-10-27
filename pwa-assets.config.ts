import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Regenerate with `npm run generate-pwa-assets` whenever public/favicon.svg changes.
// Maskable and Apple icons are full-bleed, so pad them with the icon's own fill colour.
const ICON_BACKGROUND = '#10b981'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: ICON_BACKGROUND },
    },
  },
  images: ['public/favicon.svg'],
})
