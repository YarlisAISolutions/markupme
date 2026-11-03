// The stable exports of @markupme/themes that no behaviour test exercises on its own (MKP-3).
// docs/api-stability.md links here.
import { describe, expect, expectTypeOf, it } from 'vitest'
import { type DocumentOptions, escapeHtml, type NavItem, type ThemeMode } from '../src/index.js'

describe('stable themes exports', () => {
  it('escapeHtml escapes markup', () => {
    expect(escapeHtml('<a href="x">&</a>')).not.toMatch(/[<>"]/)
  })

  it('exports the stable types', () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark' | 'auto'>()
    expectTypeOf<DocumentOptions>().toHaveProperty('body')
    expectTypeOf<NavItem>().toBeObject()
  })
})
