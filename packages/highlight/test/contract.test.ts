// The stable exports of @markupme/highlight that no behaviour test exercises on its own (MKP-3).
// docs/api-stability.md links here.
import { describe, expect, expectTypeOf, it } from 'vitest'
import { type CodeMeta, escapeHtml, type HighlightOptions } from '../src/index.js'

describe('stable highlight exports', () => {
  it('escapeHtml escapes markup', () => {
    expect(escapeHtml('<a href="x">&</a>')).not.toMatch(/[<>"]/)
  })

  it('exports the stable types', () => {
    expectTypeOf<CodeMeta>().toBeObject()
    expectTypeOf<HighlightOptions>().toBeObject()
  })
})
