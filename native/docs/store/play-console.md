# TunePulse on Google Play — status

Last updated: 9 Nov 2026. To resume, read this, `listing.md` (texts), `data-safety.md` (form answers) and `release-runbook.md`.

## Account and app

- Developer account **jotaemedev** (personal), Google login `joanmarc.domenech@gmail.com`. Public contact email: `taemedev@gmail.com`.
- App **TunePulse**, package `com.bandpulse.tunepulse`, free app, default language en-US.
- Links:
  - Dashboard: https://play.google.com/console/u/0/developers/8105890828863184168/app/4974952077606520829/app-dashboard
  - Closed testing (Alpha): https://play.google.com/console/u/0/developers/8105890828863184168/app/4974952077606520829/tracks/4701158697981901277
- Personal account → **a closed test with at least 12 testers for 14 consecutive days is required before production** (same as Farsant / TranstalJobs).
- Privacy policy URL: https://github.com/Mortyrise/tune-pulse/blob/main/native/docs/store/privacy-policy.md (the Vercel deployments of this repo are behind Vercel login and `tune-pulse.vercel.app` belongs to someone else, so the PWA domain is not usable yet).

## Done (9 Nov 2026)

- App created; Developer Program Policies and US export law declarations accepted.
- App content, all complete: privacy policy; ads: none; sign-in: no restricted access; advertising ID: not used; government / financial / health: no; target audience 13–15, 16–17, 18+; data safety: no data collected or shared; content rating IARC (All other app types, all "No", contact `taemedev@gmail.com`).
- Store settings: category **Music & Audio**, contact email `taemedev@gmail.com`.
- Default store listing (en-US), **saved as draft**: name, short and full description, icon (`assets/store/icon-512.png`), feature graphic (`assets/store/feature-graphic.png`).
- Closed testing **Alpha**: 178 countries; testers = Google Group `farsant-testers@googlegroups.com` (shared with Farsant; anyone can join); feedback `taemedev@gmail.com`.

## Pending, in order

1. **Upload the AAB by hand** (79 MB, too big for the browser tool; the first upload of a new app must be manual anyway): Alpha → Create release → drag `C:\Users\joanm\Downloads\tunepulse-1.0.0.aab` (versionCode 1, 1.0.0) → accept Play App Signing if asked → release notes → Save.
2. **Foreground service declaration** (appears in App content after the AAB is uploaded): `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, text in `release-runbook.md` §8, plus an **unlisted YouTube video** (~30 s, recorded on the phone with sound: Metronome → Play → home → notification shade → lock/unlock → Stop).
3. **Phone screenshots** (min 2, ideally 4–8; list in `listing.md`): take them on the phone over USB (`adb exec-out screencap -p > shot.png`), save in `assets/store/screenshots/`, add to the listing and save it.
4. **es-ES translation** of the listing (texts in `listing.md`).
5. **Send the Alpha release for review**: Publishing overview → send changes for review.
6. **Recruit 12+ testers** (join the group → opt-in link from the Testers tab → install from Play → keep it 14 days). The account also has an email list "usuario prueba transtaljobs" (17 users) that could be used instead of / besides the group.
7. After 14 days: Dashboard → **Apply for production access** → production release → review.

## Account-wide reminders

- Declare **trader status** before 1 Feb 2027 (Manage account → Account details); for free apps without ads/IAP "non-trader" is the coherent choice — the account holder does it.
