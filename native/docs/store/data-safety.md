# Play Console — Data safety answers

Play Console → Monitor and improve → App content → **Data safety**. Basis (verified in code, Nov 2026): no `fetch`/network calls in `src/`, no analytics/crash SDKs in `package.json`, AsyncStorage holds settings on-device only, mic PCM goes straight to the in-memory pitch detector (`src/audio/tuner.ts`) and is discarded.

Re-check this file whenever a dependency with network access is added (e.g. expo-updates, Sentry).

## Overview
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| (If asked) Is all user data encrypted in transit? | N/A — nothing is transmitted |
| (If asked) Do you provide a way for users to request deletion? | N/A — nothing is collected (local settings are removed on uninstall) |

Answering "No" skips the data-type sections. That is correct because, per Play's definitions:
- **Audio (Voice or sound recordings / Other audio files)**: not collected. Play's definition of "collect" is transmitting data off the device. Mic audio is processed only on-device, ephemerally, and never leaves it.
- **App activity / App info and performance / Device or other IDs**: none read or sent. No analytics, crash logs or diagnostics.
- **INTERNET permission**: present because React Native, the dev client (and expo-updates if added later) require it; the release app sends nothing. Declaring the permission does not by itself mean data is collected.

## Other App content forms (same section)
| Form | Answer |
|---|---|
| Privacy policy | `{{PRIVACY_POLICY_URL}}` |
| Ads | No, my app does not contain ads |
| App access | All functionality is available without special access (no login) |
| Content rating (IARC) | Category: Utility/Productivity/Communication/Other (a tool app); all content questions **No** (no violence, sexuality, language, drugs, gambling, user interaction, sharing location, purchases) → expected rating: Everyone / PEGI 3 |
| Target audience | 13+ (13–15, 16–17, 18+). Do **not** select under-13 ages (would trigger Families policy requirements); "Appeals to children": No |
| News app | No |
| Government app | No |
| Financial features | None |
| Health | None |
| Foreground service permissions | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` — see `release-runbook.md` §8 for the text and video |
