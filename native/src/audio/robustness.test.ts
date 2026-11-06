import { describe, expect, it } from 'vitest'
import {
  AUTO_RESUME_AFTER_TRANSIENT,
  DEFAULT_RESUME_POLICY,
  FocusRefCount,
  PAUSED_MESSAGES,
  isContextStalled,
  isPrivateOutput,
  lostPrivateOutput,
  metronomeReaction,
  privateOutputIds,
  tunerReaction,
  type AudioEvt,
  type MetronomeRunState,
} from './robustness'

const running: MetronomeRunState = { running: true, pausedReason: null, pausedAt: null }
const idle: MetronomeRunState = { running: false, pausedReason: null, pausedAt: null }
const interrupted: MetronomeRunState = { running: false, pausedReason: 'interrupted', pausedAt: 1000 }
const autoPolicy = { ...DEFAULT_RESUME_POLICY, autoResumeAfterTransient: true }

describe('metronomeReaction', () => {
  it('stops with a reason on interruption began', () => {
    expect(metronomeReaction(running, { kind: 'interruptionBegan' }, 0)).toEqual({
      action: 'stop',
      reason: 'interrupted',
      message: PAUSED_MESSAGES.interrupted,
    })
  })

  it('ignores events while idle', () => {
    const evts: AudioEvt[] = [
      { kind: 'interruptionBegan' },
      { kind: 'routeLost', lostPrivate: true },
      { kind: 'contextError' },
      { kind: 'stalled' },
      { kind: 'remoteStop' },
    ]
    for (const e of evts) expect(metronomeReaction(idle, e, 0)).toEqual({ action: 'none' })
  })

  it('v1 policy never auto-resumes', () => {
    expect(AUTO_RESUME_AFTER_TRANSIENT).toBe(false)
    expect(metronomeReaction(interrupted, { kind: 'interruptionEnded', shouldResume: true }, 2000)).toEqual({
      action: 'none',
    })
  })

  it('auto-resume policy resumes only after a short transient interruption', () => {
    const ended = { kind: 'interruptionEnded', shouldResume: true } as const
    expect(metronomeReaction(interrupted, ended, 2000, autoPolicy)).toEqual({ action: 'resume' })
    expect(metronomeReaction(interrupted, ended, 1000 + 30_001, autoPolicy)).toEqual({ action: 'none' })
    expect(
      metronomeReaction(interrupted, { kind: 'interruptionEnded', shouldResume: false }, 2000, autoPolicy),
    ).toEqual({ action: 'none' })
    // Paused for another reason, or the user stopped (reason cleared): no resume.
    expect(metronomeReaction({ ...interrupted, pausedReason: 'route' }, ended, 2000, autoPolicy)).toEqual({
      action: 'none',
    })
    expect(metronomeReaction(idle, ended, 2000, autoPolicy)).toEqual({ action: 'none' })
    expect(metronomeReaction(running, ended, 2000, autoPolicy)).toEqual({ action: 'none' })
  })

  it('keeps playing on duck and on a new device', () => {
    expect(metronomeReaction(running, { kind: 'duck' }, 0)).toEqual({ action: 'none' })
    expect(metronomeReaction(running, { kind: 'routeAdded' }, 0)).toEqual({ action: 'none' })
  })

  it('stops on route loss only when a private output went away', () => {
    expect(metronomeReaction(running, { kind: 'routeLost', lostPrivate: true }, 0)).toMatchObject({
      action: 'stop',
      reason: 'route',
    })
    expect(metronomeReaction(running, { kind: 'routeLost', lostPrivate: false }, 0)).toEqual({ action: 'none' })
  })

  it('stops on context error and stall with messages', () => {
    expect(metronomeReaction(running, { kind: 'contextError' }, 0)).toMatchObject({ action: 'stop', reason: 'error' })
    expect(metronomeReaction(running, { kind: 'stalled' }, 0)).toMatchObject({ action: 'stop', reason: 'stalled' })
  })

  it('remote stop is a plain stop without a message', () => {
    expect(metronomeReaction(running, { kind: 'remoteStop' }, 0)).toEqual({
      action: 'stop',
      reason: null,
      message: null,
    })
  })
})

describe('tunerReaction', () => {
  it('stops on interruption and context error, restarts on route changes', () => {
    expect(tunerReaction(true, { kind: 'interruptionBegan' })).toBe('stop')
    expect(tunerReaction(true, { kind: 'contextError' })).toBe('stop')
    expect(tunerReaction(true, { kind: 'routeLost', lostPrivate: false })).toBe('restart')
    expect(tunerReaction(true, { kind: 'routeAdded' })).toBe('restart')
    expect(tunerReaction(true, { kind: 'duck' })).toBe('none')
    expect(tunerReaction(true, { kind: 'interruptionEnded', shouldResume: true })).toBe('none')
  })

  it('does nothing while idle', () => {
    expect(tunerReaction(false, { kind: 'interruptionBegan' })).toBe('none')
    expect(tunerReaction(false, { kind: 'routeAdded' })).toBe('none')
  })
})

describe('outputs', () => {
  it('classifies Android and iOS categories', () => {
    for (const c of [
      'Wired Headset',
      'Wired Headphones',
      'Bluetooth A2DP',
      'Bluetooth SCO',
      'Bluetooth LE Headset',
      'USB Headset',
      'USB Device',
      'Headphones',
      'BluetoothA2DPOutput',
      'BluetoothHFP',
      'BluetoothLE',
      'USBAudio',
    ]) {
      expect(isPrivateOutput(c), c).toBe(true)
    }
    for (const c of ['Built-in Speaker', 'Built-in Earpiece', 'Bluetooth LE Speaker', 'Speaker', 'Receiver', 'HDMI']) {
      expect(isPrivateOutput(c), c).toBe(false)
    }
  })

  const speaker = { id: '1', category: 'Built-in Speaker' }
  const a2dp = { id: '7', category: 'Bluetooth A2DP' }
  const wired = { id: '3', category: 'Wired Headphones' }

  it('reads availableOutputs on Android and currentOutputs on iOS', () => {
    const info = { availableOutputs: [speaker, a2dp, wired], currentOutputs: [a2dp] }
    expect(privateOutputIds(info, 'android')).toEqual(['7', '3'])
    expect(privateOutputIds(info, 'ios')).toEqual(['7'])
  })

  it('detects a lost headset but not a speaker-only change or a new device', () => {
    expect(lostPrivateOutput(['7', '8'], [])).toBe(true) // BT headset off
    expect(lostPrivateOutput(['3'], [])).toBe(true) // wired unplugged
    expect(lostPrivateOutput([], [])).toBe(false) // speaker-only change
    expect(lostPrivateOutput(['7'], ['7', '8'])).toBe(false) // SCO appeared
    expect(lostPrivateOutput(['7', '8'], ['7'])).toBe(true) // SCO dropped (conservative: pause)
  })
})

describe('isContextStalled', () => {
  it('is fine when the clock advances with wall time', () => {
    expect(isContextStalled(10, 10.3, 300, 'running')).toBe(false)
    expect(isContextStalled(10, 10.16, 300, 'running')).toBe(false)
  })

  it('flags a frozen clock or a non-running state', () => {
    expect(isContextStalled(10, 10, 300, 'running')).toBe(true)
    expect(isContextStalled(10, 10.1, 300, 'running')).toBe(true)
    expect(isContextStalled(10, 10.3, 300, 'suspended')).toBe(true)
    expect(isContextStalled(10, 10.3, 300, 'closed')).toBe(true)
  })
})

describe('FocusRefCount', () => {
  it('requests on first owner and abandons on last', () => {
    const f = new FocusRefCount()
    expect(f.acquire('metronome')).toBe('request')
    expect(f.acquire('metronome')).toBe(null)
    expect(f.acquire('other')).toBe(null)
    expect(f.release('metronome')).toBe(null)
    expect(f.held).toBe(true)
    expect(f.release('other')).toBe('abandon')
    expect(f.held).toBe(false)
    expect(f.release('other')).toBe(null)
  })
})
