// The stable types of @markupme/react (MKP-3). docs/api-stability.md links here; the components
// and functions are covered by render.test.ts and hook.test.ts.
import { describe, expectTypeOf, it } from 'vitest'
import type { MarkdownComponents, MarkdownOptions, MarkdownProps } from '../src/index.js'

describe('stable react exports', () => {
  it('exports the stable types', () => {
    expectTypeOf<MarkdownComponents>().toBeObject()
    expectTypeOf<MarkdownOptions>().toHaveProperty('components')
    expectTypeOf<MarkdownProps>().toHaveProperty('source')
  })
})
