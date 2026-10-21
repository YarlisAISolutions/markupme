import { describe, expect, it } from 'vitest'
import { fileName } from '../src/export.js'

describe('fileName', () => {
  it('keeps the opened file name with the new extension', () => {
    expect(fileName('Notes.md', 'Ignored', 'html')).toBe('notes.html')
    expect(fileName('my draft.markdown', undefined, 'md')).toBe('my-draft.md')
  })

  it('falls back to a slug of the title, then "document"', () => {
    expect(fileName(undefined, 'Welcome to MarkupMe Studio!', 'md')).toBe(
      'welcome-to-markupme-studio.md',
    )
    expect(fileName(undefined, undefined, 'md')).toBe('document.md')
    expect(fileName(undefined, '???', 'md')).toBe('document.md')
  })
})
