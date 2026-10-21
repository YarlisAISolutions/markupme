import { describe, expect, it } from 'vitest'
import { type Emphasis, toggleEmphasis } from '../src/emphasis.js'

/** Applies a toggle and returns the new text with the selection marked as [ ]. */
function run(input: string, kind: Emphasis): string {
  const start = input.indexOf('[')
  const end = input.indexOf(']') - 1
  const text = input.replace('[', '').replace(']', '')
  const r = toggleEmphasis(text, start, end, kind)
  const out = text.slice(0, r.start) + r.text + text.slice(r.end)
  return `${out.slice(0, r.selectionStart)}[${out.slice(r.selectionStart, r.selectionEnd)}]${out.slice(r.selectionEnd)}`
}

describe('toggleEmphasis', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(run('make [this] bold', 'bold')).toBe('make **[this]** bold')
    expect(run('make [this] lean', 'italic')).toBe('make *[this]* lean')
    expect(run('[gone]', 'strikethrough')).toBe('~~[gone]~~')
    expect(run('run [npm test]', 'code')).toBe('run `[npm test]`')
  })

  it('unwraps when the selection sits just inside the markers', () => {
    expect(run('make **[this]** bold', 'bold')).toBe('make [this] bold')
    expect(run('~~[gone]~~', 'strikethrough')).toBe('[gone]')
  })

  it('unwraps when the selection includes the markers', () => {
    expect(run('make [**this**] bold', 'bold')).toBe('make [this] bold')
    expect(run('[`x`]', 'code')).toBe('[x]')
  })

  it('works on the word under the cursor', () => {
    expect(run('a wo[]rd here', 'bold')).toBe('a **[word]** here')
    expect(run('a **wo[]rd** here', 'bold')).toBe('a [word] here')
  })

  it('inserts an empty pair outside a word', () => {
    expect(run('end. []', 'bold')).toBe('end. **[]**')
  })

  it('tells italic from bold', () => {
    // Italic inside bold adds a marker instead of eating half of the bold one.
    expect(run('**[word]**', 'italic')).toBe('***[word]***')
    expect(run('***[word]***', 'italic')).toBe('**[word]**')
    expect(run('[**word**]', 'italic')).toBe('*[**word**]*')
  })

  it('handles a reversed selection', () => {
    const r = toggleEmphasis('abc', 3, 0, 'bold')
    expect(r.text).toBe('**abc**')
  })
})
