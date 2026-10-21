import { describe, expect, it } from 'vitest'
import { greeting } from '../src/onboarding.js'

describe('greeting', () => {
  it('welcomes a first run', () => {
    expect(greeting(undefined, '0.2.0')).toBe('welcome')
    expect(greeting(undefined, '0.2.0', false)).toBe('welcome')
  })

  it('announces minor and major updates only', () => {
    expect(greeting('0.1.0', '0.2.0')).toBe('whatsNew')
    expect(greeting('0.9.3', '1.0.0')).toBe('whatsNew')
    expect(greeting('0.2.0', '0.2.1')).toBe('none')
    expect(greeting('0.2.0', '0.2.0')).toBe('none')
  })

  it('stays quiet on a downgrade, a bad version or when turned off', () => {
    expect(greeting('0.3.0', '0.2.0')).toBe('none')
    expect(greeting('dev', '0.2.0')).toBe('none')
    expect(greeting('0.1.0', '0.2.0', false)).toBe('none')
  })
})
