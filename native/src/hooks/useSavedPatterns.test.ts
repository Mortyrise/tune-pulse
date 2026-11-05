import { describe, expect, it, vi } from 'vitest'

vi.mock('../settings', () => ({ usePersistentState: vi.fn() }))

const { sanitizePatterns } = await import('./useSavedPatterns')

describe('sanitizePatterns', () => {
  it('drops malformed entries and sanitizes configs', () => {
    const out = sanitizePatterns([
      { id: 'a', name: 'Mine', createdAt: 5, config: { bpm: 999, numerator: 3 } },
      { id: 1, name: 'bad id' },
      null,
      'x',
    ])
    expect(out).toHaveLength(1)
    expect(out[0].config.bpm).toBe(300)
    expect(out[0].config.beats.subdivisions).toEqual([1, 1, 1])
    expect(sanitizePatterns({})).toEqual([])
  })
})
