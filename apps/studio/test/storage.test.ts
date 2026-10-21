import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  nextTheme,
  parseSettings,
  parseTheme,
  safeStorage,
} from '../src/storage.js'

class MemoryStorage {
  data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

describe('safeStorage', () => {
  it('reads and writes through a working store', () => {
    const s = safeStorage(() => new MemoryStorage() as Storage)
    expect(s.available).toBe(true)
    expect(s.set('k', 'v')).toBe(true)
    expect(s.get('k')).toBe('v')
    s.remove('k')
    expect(s.get('k')).toBeNull()
  })

  it('degrades without throwing when storage is blocked', () => {
    const s = safeStorage(() => {
      throw new Error('SecurityError')
    })
    expect(s.available).toBe(false)
    expect(s.set('k', 'v')).toBe(false)
    expect(s.get('k')).toBeNull()
    expect(() => s.remove('k')).not.toThrow()
  })

  it('reports a failed write (quota)', () => {
    const store = new MemoryStorage()
    const s = safeStorage(() => store as Storage)
    store.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(s.set('k', 'v')).toBe(false)
  })
})

describe('parseSettings', () => {
  it('returns defaults for missing or broken JSON', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{nope')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid values and drops bad ones', () => {
    const s = parseSettings(
      JSON.stringify({ math: true, gfm: 'yes', tocPosition: 'top', extra: 1, diagrams: false }),
    )
    expect(s).toEqual({ ...DEFAULT_SETTINGS, math: true, tocPosition: 'top', diagrams: false })
    expect(parseSettings(JSON.stringify({ tocPosition: 'bottom' })).tocPosition).toBe('marker-only')
  })
})

describe('theme', () => {
  it('parses stored choices', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('weird')).toBe('auto')
    expect(parseTheme(null)).toBe('auto')
  })

  it('cycles auto → opposite of system → same as system → auto', () => {
    expect(nextTheme('auto', false)).toBe('dark')
    expect(nextTheme('dark', false)).toBe('light')
    expect(nextTheme('light', false)).toBe('auto')
    expect(nextTheme('auto', true)).toBe('light')
    expect(nextTheme('light', true)).toBe('dark')
    expect(nextTheme('dark', true)).toBe('auto')
  })
})
