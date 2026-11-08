# Release runbook — Google Play (Android)

Follow top to bottom. Commands run from `native/`. EAS CLI = `npx eas-cli@latest` (written `eas` below).
Placeholders to fill before starting: `taemedev@gmail.com`, `https://github.com/Mortyrise/tune-pulse/blob/main/native/docs/store/privacy-policy.md` (in `listing.md`, `privacy-policy.md`, `data-safety.md`).

Requirements checked Nov 2026: Play needs an **AAB** (no APK) and **targetSdk 36** for new apps/updates (RN 0.88 default = 36 ✔). New **personal** accounts (created after 13 Nov 2023) need a closed test with **≥12 testers opted in for 14 continuous days** before production access.

## 0. Which account do you have? (decides step 11)
Play Console → Settings (gear) → Developer account → Account details → *Account type*.
- **Personal** → you'll do internal testing → **closed testing (12 testers × 14 days)** → apply for production.
- **Organisation** → internal testing → production directly (closed test optional).

## 1. Prerequisites (once)
- `eas login` (account `joanmarcdomenech`; project already linked in `app.json`).
- Play Console account active, developer identity verified.
- `https://github.com/Mortyrise/tune-pulse/blob/main/native/docs/store/privacy-policy.md` live (step 7) before you fill App content.

## 2. Regenerate and check assets/config
```bash
node scripts/generate-assets.mjs          # only if favicon.svg / palette changed
npx expo config --type introspect | grep -A1 uses-permission
npx expo-doctor
```
Permissions must be exactly: INTERNET, VIBRATE, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, POST_NOTIFICATIONS (+ three `tools:node="remove"` entries for SYSTEM_ALERT_WINDOW and READ/WRITE_EXTERNAL_STORAGE).

## 3. Create the app in Play Console
Home → **Create app**: name `TunePulse`, default language English (United States), **App**, **Free**, tick the declarations → Create.
(Free cannot be changed to paid later.)

## 4. Build the production AAB
```bash
eas build --platform android --profile production
```
- First run: let EAS **generate a new Android keystore** (this is the *upload key*; EAS stores it — back it up: `eas credentials -p android` → Download).
- `versionCode` is auto-incremented remotely (`appVersionSource: remote`); `version` comes from `app.json` (`1.0.0`).
- Download the `.aab` from the build page when it finishes.

## 5. First upload — manually, to Internal testing
Expo can create the first release via `eas submit`, but do the first one by hand: it is the most reliable path (Google's API historically rejected apps with no prior upload) and it walks you through Play App Signing.
1. Test and release → Testing → **Internal testing** → *Testers* tab → **Create email list** (e.g. "core"), add your Gmail(s) → Save. Copy the **opt-in link**.
2. *Releases* tab → **Create new release**.
3. **Play App Signing**: accept *Use Google-generated key* (default). Google keeps the app signing key; EAS keeps the upload key.
4. Upload the `.aab`. Release name auto-fills (`1 (1.0.0)`). Release notes: `<en-US>First internal build.</en-US>`.
5. Next → Save → **Start rollout to Internal testing**. Fix any errors it lists (usually missing App content — do steps 6–8 first if blocked).
6. Testers open the opt-in link on their phone → *Become a tester* → install from Play. Internal releases are available within minutes, no review.

## 6. Store listing
Grow users → Store presence → **Main store listing**: copy from `listing.md` (name, short, full description), upload `assets/store/icon-512.png`, `assets/store/feature-graphic.png`, ≥2 phone screenshots. Then *Manage translations* → add **Spanish (Spain)** with the ES texts.
Store settings: category **Music & Audio**, contact email `taemedev@gmail.com`.

## 7. Privacy policy hosting
Recommended: a **static page** (no login, not a PDF, not an editable doc). Options: publish `privacy-policy.md` as a page from this Claude session (ask), GitHub Pages, or a `/privacy` page on the PWA's domain. Paste the URL into App content → Privacy policy and into the placeholders.

## 8. App content (Monitor and improve → App content)
Fill each item with `data-safety.md`: privacy policy, ads (no), app access (no login), content rating questionnaire, target audience (13+), data safety ("no data collected"), news/government/financial/health (no).

**Foreground service permissions** (required, targetSdk ≥ 34): declare `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
- Use case: **Media playback** (from the list).
- Description: "TunePulse's metronome plays click audio that musicians start explicitly with the Play button. A mediaPlayback foreground service with a visible playback notification keeps the click playing with the screen locked or while another app (e.g. sheet music) is in front. Playback stops when the user taps Stop in the app, pauses/stops from the notification, or removes the app from recents."
- User impact if deferred/interrupted: "The click stops or drifts mid-practice/performance, which defeats the purpose of a metronome."
- Video link: an unlisted YouTube video (≈30 s, screen recording): open Metronome → tap Play → press the power button / go home → click keeps playing → show the notification → tap Stop.

**Microphone**: RECORD_AUDIO is not a Play "restricted permission"; no separate form. It is covered by the privacy policy and the data safety answer (processed on-device, not collected). The in-app rationale is the system prompt shown when opening the tuner.

## 9. Service account for `eas submit` (once, after step 5)
Google Cloud Console (any project, e.g. "tunepulse-release"):
1. **APIs & Services → Library** → enable **Google Play Android Developer API**.
2. **IAM & Admin → Service Accounts → Create service account** (name `eas-submit`) → Create and close. Copy its email.
3. ⋮ → **Manage keys → Add key → Create new key → JSON**. Save it as `native/secrets/play-service-account.json` (`secrets/` is git-ignored — never commit it).
Play Console → **Users and permissions → Invite new users**: paste the email; *App permissions* → add TunePulse with: View app information (read-only); Edit and delete draft apps; Release to production, exclude devices, and use Play App Signing; Release apps to testing tracks; Manage testing tracks and edit tester lists; Manage store presence → Invite user.
Optional: upload the key to EAS instead of keeping the file (`eas credentials -p android` → production → Google Service Account), then `serviceAccountKeyPath` can stay as a fallback.

## 10. Every later release
```bash
eas build --platform android --profile production --auto-submit
# or, for an existing build:
eas submit --platform android --profile production
```
`submit.production` uploads to **internal** as a **draft** (`releaseStatus: "draft"`). In Play Console → Internal testing → edit the draft release → add notes → *Start rollout*. To skip the draft step, remove `releaseStatus` from `eas.json`.

## 11. Towards production
**Personal account:**
1. Testing → **Closed testing** → create track (e.g. "beta") → Countries: all/your choice → Testers: an email list or Google Group with **≥12 people** (not counting you) → promote the internal release (*Promote release → Closed testing*) → *Send for review* (first closed release is reviewed, typically hours–days).
2. Share the opt-in link; each tester must opt in **and stay opted in 14 consecutive days** (installing isn't strictly required but they should use it; Google asks about their feedback).
3. Dashboard → **Apply for production** (enabled after 14 days) → answer the questionnaire (how you recruited testers, feedback, changes made).
4. After approval: promote to **Production**, staged rollout (e.g. 20 % → 100 %).

**Organisation account:**
1. Optional closed test for wider feedback.
2. Production → **Create new release** → *Add from library* (the tested build) → staged rollout → *Send for review*.

To ship by `eas submit` straight to a track, change `track` in `eas.json` (`internal` | `alpha` (closed) | `beta` (open) | `production`).

## Troubleshooting
- *"You need to use a different version code"* → a build was uploaded with that code already; rebuild (remote auto-increment handles it) or `eas build:version:set`.
- *"APK/AAB signed with the wrong key"* → the upload key must be the EAS keystore registered at step 5; never regenerate it (if lost: Play Console → App integrity → *Request upload key reset*).
- `eas submit` 403 / "The caller does not have permission" → service account permissions (step 9) not propagated yet (can take up to 24 h) or the API isn't enabled.
