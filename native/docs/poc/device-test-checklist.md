# Device test checklist

Fill one copy per device. Mark each box and add notes (numbers beat adjectives).

- Device / OS version:
- Build (profile + build id or date):
- Tester / date:
- Reference tuner/tone generator used:
- Reference metronome used:

## 1. Install and permissions

- [ ] Dev client installs and opens, the app loads from `npx expo start --dev-client`
- [ ] Tuner tab: microphone prompt appears with the TunePulse text; after allowing, the tuner starts listening
- [ ] Deny the mic once (reinstall or reset permissions): the app shows a message and the "open Settings" button works
- [ ] Android 13+: first metronome start asks for notifications; after allowing, a "playing" notification appears while it runs and disappears on stop

## 2. Tuner accuracy and feel

Play each tone from the reference (tone generator on another phone or a laptop, ~30 cm away). Write the reading.

| Tone | Expected | Reading (note, cents) | Pass (within ±3 cents, stable) |
|---|---|---|---|
| A4 | 440.00 Hz, A4 0 c | | [ ] |
| E2 | 82.41 Hz, E2 0 c | | [ ] |
| E6 | 1318.5 Hz, E6 0 c | | [ ] |
| A4 +10 c | 442.55 Hz | | [ ] |

- [ ] Real instrument: readings match the reference tuner on every string
- [ ] Latency feels immediate (needle reacts within ~100 ms of plucking)
- [ ] Reading doesn't jump between octaves on a sustained note
- [ ] Silence: display goes idle, no random notes from room noise

## 3. Metronome timing

- [ ] 120 BPM, 4/4: start together with the reference metronome; after **5 minutes** they're still in sync (note the offset you hear, if any): ______
- [ ] 60 and 240 BPM sound steady
- [ ] Accent on beat 1 and subdivisions (2, 3, 4) sound correct
- [ ] Change BPM (+1, +10, -10) while running: no glitch, gap or double click; new tempo from the next beat
- [ ] Change the time signature while running: no glitch

## 4. Screen locked

- [ ] Metronome running, lock the screen for **2 minutes** (iOS): clicks continue at a steady tempo
- [ ] Same on Android: clicks continue; the notification is visible on the lock screen
- [ ] Unlock: beat dots resume in time with the sound

## 5. App in the background

- [ ] Metronome running, go to the home screen for 3 minutes: clicks continue
- [ ] Switch to another app (browser, not playing audio) for 3 minutes: clicks continue
- [ ] Return to the app: UI state (running, BPM) is correct, stop works
- [ ] Android: swipe the app away from recents: playback stops and the notification goes away

## 6. Interruptions

- [ ] Incoming notification sound while the metronome runs: clicks continue (or resume right after)
- [ ] Incoming call (or Siri / alarm): playback pauses; after it ends, note what happens (resumes / stays stopped / needs restart): ______
- [ ] Another app starts playing music: note the behaviour: ______

## 7. Bluetooth headphones

- [ ] Connect BT headphones before starting: clicks come through the headphones in good quality (not phone-call quality)
- [ ] Connect/disconnect while running: playback continues on the new route
- [ ] Note the extra delay you hear on BT (expected): ______
- [ ] Tuner with BT connected: still detects from the phone mic

## 8. Switching tabs

- [ ] Metronome running, switch to the Tuner tab: clicks continue without a glitch
- [ ] Tuner listening while the metronome runs: tuner still works (note if the clicks confuse it)
- [ ] Back to the Metronome tab: it shows running, stop works
- [ ] Tuner tab left: the mic indicator (iOS orange dot / Android green dot) goes off

## 9. Android notification permission denied

- [ ] Deny notifications, start the metronome: it plays in the foreground
- [ ] Lock the screen 2 minutes: note whether it keeps playing: ______

## Summary

- Tuner: PASS / FAIL — notes:
- Metronome foreground: PASS / FAIL — notes:
- Metronome background / locked: PASS / FAIL — notes:
