import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import { highlightHandler, parseMeta } from '../src/index.js'

describe('parseMeta', () => {
  it('reads titles, ranges and line numbers', () => {
    const m = parseMeta('title="app.ts" {1,3-4} showLineNumbers')
    expect(m.title).toBe('app.ts')
    expect([...m.highlight]).toEqual([1, 3, 4])
    expect(m.lineNumbers).toBe(true)
    expect(parseMeta('startLine=10').startLine).toBe(10)
  })
})

describe('highlightHandler', () => {
  const p = createProcessor()
  it('highlights with dual themes, title, copy button and highlighted lines', async () => {
    const out = (
      await p.render('```ts title="hello.ts" {2}\nconst a = 1\nconst b = 2\n```', {
        codeBlocks: [highlightHandler()],
      })
    ).output
    expect(out).toContain('<figure class="mm-code" data-lang="ts">')
    expect(out).toContain('<figcaption class="mm-code-title">hello.ts</figcaption>')
    expect(out).toContain('class="mm-copy"')
    expect(out).toContain('--shiki-dark')
    expect(out).toMatch(/class="line mm-line-highlight"><span[^>]*>const<\/span><span[^>]*> b/)
  })

  it('escapes unknown languages instead of dropping them', async () => {
    const out = (
      await p.render('```nolang\n<script>x</script>\n```', { codeBlocks: [highlightHandler()] })
    ).output
    expect(out).toContain('&#60;script&#62;x&#60;/script&#62;')
    expect(out).not.toContain('<script>')
  })

  it('skips configured languages', async () => {
    const out = (
      await p.render('```mermaid\ngraph TD\n```', {
        codeBlocks: [highlightHandler({ skip: ['mermaid'] })],
      })
    ).output
    expect(out).toContain('<pre><code class="language-mermaid">')
  })
})
