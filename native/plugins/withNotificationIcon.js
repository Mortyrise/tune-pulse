// Copies the generated notification small icon (assets/notification-icon/,
// from scripts/generate-assets.mjs) into the Android project as
// res/drawable-<dpi>/ic_notification.png at prebuild.
//
// react-native-audio-api's PlaybackNotificationManager resolves
// `androidSmallIcon: 'ic_notification'` by drawable name; without this resource
// it falls back to android.R.drawable.ic_media_play.
const fs = require('node:fs')
const path = require('node:path')
const { withDangerousMod } = require('expo/config-plugins')

const RESOURCE_NAME = 'ic_notification'
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
const SOURCE_DIR = 'assets/notification-icon'

module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest
      const resDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res')
      for (const dpi of DENSITIES) {
        const src = path.join(projectRoot, SOURCE_DIR, `${RESOURCE_NAME}_${dpi}.png`)
        if (!fs.existsSync(src)) {
          throw new Error(
            `[withNotificationIcon] Missing ${src}. Run: node scripts/generate-assets.mjs`,
          )
        }
        const destDir = path.join(resDir, `drawable-${dpi}`)
        fs.mkdirSync(destDir, { recursive: true })
        fs.copyFileSync(src, path.join(destDir, `${RESOURCE_NAME}.png`))
      }
      return cfg
    },
  ])
}
