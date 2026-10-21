import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import { applyEdit, computeTocEdit } from '../src/toc.js'

const processor = createProcessor({ toc: false })
const run = (src: string) => computeTocEdit(src, processor, { minDepth: 2, maxDepth: 3 })

describe('computeTocEdit', () => {
  it('inserts the TOC after the first h1 without touching the rest', () => {
    const src = '# Title\n\nIntro  with   *odd*  spacing\n\n## One\n\ntext\n\n### Two\n'
    const r = run(src)
    expect(r.kind).toBe('insert')
    if (r.kind !== 'insert') return
    const out = applyEdit(src, r.edit)
    expect(out).toBe(
      '# Title\n\n<!-- toc -->\n\n- [One](#one)\n  - [Two](#two)\n\n<!-- tocstop -->\n\nIntro  with   *odd*  spacing\n\n## One\n\ntext\n\n### Two\n',
    )
  })

  it('replaces an existing region and is idempotent', () => {
    const src =
      '# T\n\n<!-- toc -->\n\n- [Old](#old)\n\n<!-- tocstop -->\n\n## New\n\n* keep this bullet\n'
    const r = run(src)
    expect(r.kind).toBe('replace')
    if (r.kind !== 'replace') return
    const out = applyEdit(src, r.edit)
    expect(out).toBe(
      '# T\n\n<!-- toc -->\n\n- [New](#new)\n\n<!-- tocstop -->\n\n## New\n\n* keep this bullet\n',
    )
    expect(run(out).kind).toBe('unchanged')
  })

  it('accepts <!-- /toc --> as the closing marker and ignores markers in code', () => {
    const src = '```md\n<!-- toc -->\n```\n\n<!-- toc -->\nstale\n<!-- /toc -->\n\n## A\n'
    const r = run(src)
    expect(r.kind).toBe('replace')
    if (r.kind !== 'replace') return
    expect(src.slice(r.edit.start, r.edit.end)).toBe('<!-- toc -->\nstale\n<!-- /toc -->')
  })

  it('inserts after frontmatter when there is no h1, and keeps CRLF line endings', () => {
    const src = '---\ntitle: x\n---\n\n## A\r\n'.replace(/\n/g, '\r\n').replace(/\r\r/g, '\r')
    const r = run(src)
    expect(r.kind).toBe('insert')
    if (r.kind !== 'insert') return
    const out = applyEdit(src, r.edit)
    expect(out.startsWith('---\r\ntitle: x\r\n---\r\n\r\n<!-- toc -->\r\n')).toBe(true)
    expect(out).not.toMatch(/[^\r]\n/)
  })

  it('handles a setext title and a title at the end of the file', () => {
    const setext = run('Title\n=====\n## A\n')
    expect(setext.kind).toBe('insert')
    if (setext.kind === 'insert')
      expect(applyEdit('Title\n=====\n## A\n', setext.edit)).toBe(
        'Title\n=====\n\n<!-- toc -->\n\n- [A](#a)\n\n<!-- tocstop -->\n\n## A\n',
      )
  })

  it('reports an empty TOC', () => {
    expect(run('# Only a title\n\ntext\n').kind).toBe('empty')
  })
})
