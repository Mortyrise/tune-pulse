import { describe, expect, it } from 'vitest'
import {
  centsToRingAngle,
  centsTone,
  describeArc,
  dialAngleFromPoint,
  dialPoint,
  dialRawValueFromDrag,
  dialValueFromDrag,
  polarToCartesian,
  toleranceBands,
  valueToDialAngle,
  wrapDelta,
} from './svgGeometry'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('polarToCartesian / describeArc', () => {
  it('maps standard SVG angles', () => {
    const top = polarToCartesian(100, 100, 50, -90)
    close(top.x, 100)
    close(top.y, 50)
    const right = polarToCartesian(100, 100, 50, 0)
    close(right.x, 150)
    close(right.y, 100)
  })

  it('draws from end to start and picks the large-arc flag', () => {
    const t = describeArc(100, 100, 50, -90, 90).split(' ')
    expect([t[0], t[3], t[4], t[5], t[6], t[7], t[8]]).toEqual([
      'M',
      'A',
      '50',
      '50',
      '0',
      '0',
      '0',
    ])
    ;[t[1], t[2], t[9], t[10]].map(Number).forEach((v, i) => close(v, [100, 150, 100, 50][i]))
    expect(describeArc(0, 0, 10, 0, 270).split(' ')[7]).toBe('1')
    expect(describeArc(0, 0, 10, 0, 180).split(' ')[7]).toBe('0')
  })
})

describe('dial maths', () => {
  it('measures angles clockwise from 12 o’clock', () => {
    close(dialAngleFromPoint(50, 0, 50, 50), 0)
    close(dialAngleFromPoint(100, 50, 50, 50), 90)
    close(dialAngleFromPoint(0, 50, 50, 50), -90)
    close(Math.abs(dialAngleFromPoint(50, 100, 50, 50)), 180)
  })

  it('wraps deltas across ±180', () => {
    close(wrapDelta(350), -10)
    close(wrapDelta(-350), 10)
    close(wrapDelta(180), 180)
    close(wrapDelta(30), 30)
  })

  it('converts drag degrees to clamped integer values', () => {
    // 270° covers the whole range.
    expect(dialValueFromDrag(40, 270, 40, 240)).toBe(240)
    expect(dialValueFromDrag(120, 1.35, 40, 240)).toBe(121)
    expect(dialValueFromDrag(120, 0.5, 40, 240)).toBe(120)
    expect(dialValueFromDrag(50, -90, 40, 240)).toBe(40)
    expect(dialValueFromDrag(230, 90, 40, 240)).toBe(240)
    close(dialRawValueFromDrag(120, 0.675, 40, 240), 120.5)
  })

  it('maps values to knob angles', () => {
    close(valueToDialAngle(40, 40, 240), -135)
    close(valueToDialAngle(140, 40, 240), 0)
    close(valueToDialAngle(240, 40, 240), 135)
    close(valueToDialAngle(999, 40, 240), 135)
    close(valueToDialAngle(5, 5, 5), -135)
  })

  it('places dial points', () => {
    const p = dialPoint(100, 100, 10, 90)
    close(p.x, 110)
    close(p.y, 100)
  })
})

describe('cents', () => {
  it('uses web thresholds by default', () => {
    expect(centsTone(5)).toBe('good')
    expect(centsTone(-5.1)).toBe('warn')
    expect(centsTone(15)).toBe('warn')
    expect(centsTone(-15.1)).toBe('bad')
  })

  it.each([
    [3, 3, 9],
    [5, 5, 15],
    [10, 10, 30],
  ])('scales thresholds for tolerance %i¢', (tol, good, warn) => {
    expect(centsTone(good, tol)).toBe('good')
    expect(centsTone(good + 0.1, tol)).toBe('warn')
    expect(centsTone(-warn, tol)).toBe('warn')
    expect(centsTone(warn + 0.1, tol)).toBe('bad')
  })

  it('maps cents to the top half of the ring', () => {
    close(centsToRingAngle(0), -90)
    close(centsToRingAngle(50), 0)
    close(centsToRingAngle(-50), -180)
    close(centsToRingAngle(200), 0)
  })

  it('scales the tolerance bands from the 5¢ default', () => {
    expect(toleranceBands()).toEqual({ inTuneDeg: 9.6, nearDeg: 27 })
    const b = toleranceBands(10)
    close(b.inTuneDeg, 19.2)
    close(b.nearDeg, 54)
    expect(toleranceBands(50).nearDeg).toBe(90)
  })
})
