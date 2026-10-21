import { describe, expect, it } from 'vitest'
import {
  codeBlock,
  cycleHeading,
  type Edit,
  insertBlock,
  insertLink,
  toggleTaskList,
  toggleWrap,
} from '../src/format.js'

const apply = (doc: string, e: Edit) => doc.slice(0, e.from) + e.insert + doc.slice(e.to)

describe('toggleWrap', () => {
  it('wraps the selection and keeps it selected', () => {
    const doc = 'make this bold'
    const e = toggleWrap(doc, { from: 10, to: 14 }, '**', 'bold text')
    const out = apply(doc, e)
    expect(out).toBe('make this **bold**')
    expect(out.slice(e.selection.from, e.selection.to)).toBe('bold')
  })

  it('inserts a placeholder for an empty selection', () => {
    const e = toggleWrap('', { from: 0, to: 0 }, '_', 'italic text')
    expect(apply('', e)).toBe('_italic text_')
    expect(e.selection).toEqual({ from: 1, to: 12 })
  })

  it('unwraps when the markers surround the selection', () => {
    const doc = 'a **b** c'
    const e = toggleWrap(doc, { from: 4, to: 5 }, '**', 'x')
    expect(apply(doc, e)).toBe('a b c')
    expect(e.selection).toEqual({ from: 2, to: 3 })
  })

  it('unwraps when the selection includes the markers', () => {
    const doc = '**bold**'
    expect(apply(doc, toggleWrap(doc, { from: 0, to: 8 }, '**', 'x'))).toBe('bold')
  })
})

describe('cycleHeading', () => {
  it('cycles text → h2 … h6 → text', () => {
    let doc = 'Title'
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      doc = apply(doc, cycleHeading(doc, { from: 0, to: 0 }))
      seen.push(doc)
    }
    expect(seen).toEqual([
      '## Title',
      '### Title',
      '#### Title',
      '##### Title',
      '###### Title',
      'Title',
    ])
  })

  it('turns an h1 into an h2 and only touches the cursor line', () => {
    const doc = 'one\n# two\nthree'
    expect(apply(doc, cycleHeading(doc, { from: 5, to: 5 }))).toBe('one\n## two\nthree')
  })
})

describe('insertLink', () => {
  it('uses the selection as text and selects the URL', () => {
    const doc = 'see docs'
    const e = insertLink(doc, { from: 4, to: 8 })
    const out = apply(doc, e)
    expect(out).toBe('see [docs](https://)')
    expect(out.slice(e.selection.from, e.selection.to)).toBe('https://')
  })
})

describe('toggleTaskList', () => {
  it('adds task markers to plain lines and bullets', () => {
    const doc = 'one\n- two'
    expect(apply(doc, toggleTaskList(doc, { from: 0, to: doc.length }))).toBe(
      '- [ ] one\n- [ ] two',
    )
  })

  it('removes markers when every line has one', () => {
    const doc = '- [ ] one\n- [x] two'
    expect(apply(doc, toggleTaskList(doc, { from: 0, to: doc.length }))).toBe('one\ntwo')
  })
})

describe('insertBlock', () => {
  it('puts the block on its own paragraph', () => {
    const doc = 'before\nafter'
    const e = insertBlock(doc, { from: 6, to: 6 }, '[[toc]]')
    expect(apply(doc, e)).toBe('before\n\n[[toc]]\n\nafter')
  })

  it('adds no leading blank lines at the start of a document', () => {
    const e = insertBlock('', { from: 0, to: 0 }, 'X')
    expect(apply('', e)).toBe('X\n')
    expect(e.selection.from).toBe(1)
  })

  it('places the caret at the requested offset', () => {
    const e = insertBlock('', { from: 0, to: 0 }, 'abc', 1)
    expect(e.selection.from).toBe(1)
  })
})

describe('codeBlock', () => {
  it('fences the selection with the caret after the opening fence', () => {
    const doc = 'x = 1'
    const e = codeBlock(doc, { from: 0, to: 5 })
    expect(apply(doc, e)).toBe('```\nx = 1\n```\n')
    expect(e.selection.from).toBe(3)
  })
})
