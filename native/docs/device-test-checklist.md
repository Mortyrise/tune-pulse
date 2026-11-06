# Device test checklist

Covers the whole native app (tuner, metronome, settings). Fill one copy per device and build. Tick each box and add notes; numbers are more useful than adjectives.

- Device / OS version:
- Build (profile + build id or date):
- Tester / date:
- Reference tuner/tone generator used:
- Reference metronome used:

## 1. Install and permissions

- [ ] The build installs and opens. Dev client: the app loads from `npx expo start --dev-client --tunnel`. Preview/production: it opens standalone.
- [ ] Splash uses the theme background (light `#EEE7D6`, dark `#0F0E0C`) and there is no white flash before the first screen
- [ ] Tuner tab, tap to listen: the microphone prompt shows the TunePulse text; after allowing, the tuner starts listening
- [ ] Deny the mic (reinstall or reset permissions): the denied state shows, and its button opens the system Settings
- [ ] Android 13+: the first metronome start asks for notifications; after allowing, a "playing" notification shows while it runs and goes away on stop

## 2. Tuner accuracy

Play each tone from the reference (tone generator on another phone or laptop, about 30 cm away). Write down the reading.

| Tone | Expected | Reading (note, cents) | Pass (within ±3 cents, stable) |
|---|---|---|---|
| A4 | 440.00 Hz, A4 0 c | | [ ] |
| E2 | 82.41 Hz, E2 0 c | | [ ] |
| E6 | 1318.5 Hz, E6 0 c | | [ ] |
| A4 +10 c | 442.55 Hz | | [ ] |

- [ ] Real instrument: readings match the reference tuner on every string
- [ ] Latency feels immediate (the ring reacts within about 100 ms of plucking)
- [ ] A sustained note does not jump between octaves
- [ ] Silence: the display goes idle, no random notes from room noise

## 3. Tuner UI

- [ ] States: idle ("Tap to listen") → listening → stop button returns to idle
- [ ] Cents ring and note follow the pitch smoothly; the note sticks briefly after the sound stops
- [ ] Holding a note in tune shows the "In tune" badge plus one haptic tick (not repeated while held)
- [ ] History strip adds notes over time (12 max) without flooding on one sustained note
- [ ] Reference pitch chip opens its sheet; changing A4 (for example to 442) moves the readings
- [ ] Instrument target sheet: choosing guitar, bass, ukulele or violin shows the strings, the closest string is highlighted, and the top-bar label shows the instrument
- [ ] Notation (C-D-E / Do-Re-Mi) and ♯/♭ from Settings show up on the tuner
- [ ] The screen stays awake while the tuner tab is open
- [ ] Long-press the top-bar label: the debug panel (presets and live stats) toggles

## 4. Metronome UI

- [ ] Dial: dragging changes BPM smoothly; the tempo name (Andante, etc.) updates
- [ ] Tap tempo: from the 2nd tap the BPM follows (average of the last 4 taps); a pause over 2 s starts over
- [ ] Time signature sheet: beats per bar and note value apply; the beat column updates
- [ ] Bar pattern: tapping a beat toggles its accent; tapping its subdivision cluster cycles the subdivisions; both sound right
- [ ] Count-in chip (off / 1 / 2 bars): the selected bars play before the pattern; the session strip shows "count-in", then live
- [ ] Haptic / Audio chip: haptic mode vibrates on the beat instead of clicking
- [ ] Session strip: bar counter and elapsed time advance while running and reset on a new start
- [ ] Brand mark pulses at the tempo while running
- [ ] Grooves sheet: applying a library groove sets BPM, signature and pattern
- [ ] My grooves: "Save current" with a name, apply it, delete it

## 5. Metronome timing

- [ ] 120 BPM, 4/4: start together with the reference metronome; after **5 minutes** they are still in sync (write down any offset you hear): ______
- [ ] 60 and 240 BPM sound steady
- [ ] Change BPM (+1, +10, −10) while running: no glitch, gap or double click; the new tempo starts on the next beat
- [ ] Change the time signature, accents or subdivisions while running: no glitch, and the bar count continues
- [ ] Apply a groove while running: switches cleanly

## 6. Background, lock screen and tabs

- [ ] Metronome running, lock the screen for **2 minutes**: clicks continue at a steady tempo (Android: the notification shows on the lock screen)
- [ ] Home screen for 3 minutes, then another app (browser, not playing audio) for 3 minutes: clicks continue
- [ ] Back in the app: the UI state (running, BPM, beat position) is correct and stop works
- [ ] Android: swiping the app away from recents stops playback and removes the notification
- [ ] Metronome running, switch to the Tuner tab and to Settings: clicks continue without a glitch
- [ ] Tuner listening while the metronome runs: the tuner still works (note whether the clicks confuse it)
- [ ] Leave the Tuner tab: the mic indicator (Android green dot / iOS orange dot) goes off
- [ ] Android, notifications denied: the metronome plays in the foreground; after locking for 2 minutes, write down whether it keeps playing: ______

## 7. Interruptions and Bluetooth

- [ ] A notification sound plays while the metronome runs: clicks continue (or resume right after)
- [ ] Incoming call / alarm / assistant: write down what happens afterwards (resumes / stays stopped / needs a restart): ______
- [ ] Another app starts playing music: write down the behaviour: ______
- [ ] BT headphones connected before starting: clicks come through in good quality (not phone-call quality)
- [ ] BT connected or disconnected while running: playback continues on the new route
- [ ] Extra delay on BT (expected), write it down: ______
- [ ] Tuner with BT connected: still detects from the phone mic

## 8. Settings and persistence

- [ ] Settings opens from the gear on both tabs; the back button returns to the tab
- [ ] Theme: light, dark, mono and system each apply everywhere (tabs, sheets, status bar icons readable); system follows the OS dark mode
- [ ] Tuner settings (notation, accidentals, reference pitch ± with long-press repeat, tolerance, instrument) update the preview and the tuner
- [ ] About shows the app version (and versionCode on Android builds)
- [ ] Kill the app and reopen: theme, tuner settings, metronome config (BPM, signature, pattern, count-in, haptic) and saved grooves are all restored

## 9. Audio robustness

Expected behaviour and implementation: `docs/phase3/14-audio-robustness.md`.

- [ ] 1. **Call:** with the metronome running, have someone call you. Clicks stop at the ring, the notification goes, and the screen says "Paused by a call…". After hanging up there is still no sound; tap play to resume the same groove.
- [ ] 2. **Alarm or timer:** set a 1-minute timer while the metronome runs. Same result as test 1.
- [ ] 3. **Other media:** with the metronome running, start Spotify or YouTube. The metronome stops with the interrupted message. Then do it the other way round: start Spotify first and press play on the metronome. Spotify pauses (expected v1 behaviour).
- [ ] 4. **Duck:** receive a message notification while the metronome runs. The metronome keeps playing and stays in time.
- [ ] 5. **Bluetooth off:** play through Bluetooth headphones, then turn the headphones off. The metronome stops ("headphones disconnected") and does **not** continue on the speaker. Repeat with wired headphones if you have any.
- [ ] 6. **Bluetooth on:** start on the speaker, then connect Bluetooth headphones. The clicks move to the headphones and keep the tempo; the BAR counter keeps counting.
- [ ] 7. **Tuner and route:** with the tuner running, connect and then disconnect Bluetooth headphones. The tuner restarts within about 1 s and still detects notes; there is no restart loop and no error.
- [ ] 8. **Tuner and call (iOS):** a call or Siri while tuning shows "Tuner paused" with Start again.
- [ ] 9. **Long background:** start the metronome, lock the phone for at least 10 minutes, then unlock. Either the clicks are still playing and the UI shows running, or it shows "Audio stopped in the background" with play available. Never "running" while silent.
- [ ] 10. **Swipe away:** close the app from recents while it plays. Sound and notification stop.
- [ ] 11. **Notification denied:** deny notification permission (Android 13+), start the metronome and lock the screen for 3 minutes. The clicks continue.
- [ ] 12. **Notification controls:** on Android 13+, Pause in the media controls (shade or lock screen) stops the metronome; a headset play/pause key does the same. Android ≤ 12: the button does nothing (known lib limitation).
- [ ] 13. **Notification swipe (Android 14+):** dismiss the notification while playing. Playback continues.
- [ ] 14. **Battery saver on**, screen off for 5 minutes: playback continues. On Xiaomi, Huawei or Samsung, note whether the system kills it; if it does, exempt the app from battery optimisation and retest.
- [ ] 15. **Notification icon:** the TunePulse icon (from 13's `ic_notification`) is shown in the status bar instead of the generic play icon. This needs a new build with 13's plugin.

## Summary

- Tuner: PASS / FAIL. Notes:
- Metronome foreground: PASS / FAIL. Notes:
- Metronome background / locked: PASS / FAIL. Notes:
- Settings / persistence: PASS / FAIL. Notes:
