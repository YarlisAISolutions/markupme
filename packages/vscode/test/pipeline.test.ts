import { describe, expect, it, vi } from 'vitest'
import { exportPage } from '../src/export.js'
import { createPipeline, formatMarkdown, renderBody } from '../src/pipeline.js'
import { DEFAULT_SETTINGS } from '../src/settings.js'

const md = [
  '# Doc',
  '',
  '```dot',
  'digraph { a -> b }',
  '```',
  '',
  '```ybp',
  'flowchart "Flow"',
  'api: API [service]',
  'api -> api',
  '```',
  '',
  '```mermaid',
  'graph TD; A-->B',
  '```',
  '',
  '```ts',
  'const x = 1',
  '```',
  '',
  '<script>alert(1)</script>',
  '',
].join('\n')

describe('pipeline', () => {
  it('renders diagrams, highlighting and sanitizes', async () => {
    const r = await renderBody(createPipeline(DEFAULT_SETTINGS), md, { preview: true })
    expect(r.output).toContain('mm-diagram-graphviz')
    expect(r.output).toContain('mm-diagram-blueprint')
    expect(r.output).toContain('<pre class="mermaid">')
    expect(r.output).toContain('class="shiki')
    expect(r.output).toContain('class="mm-line-1"')
    expect(r.output).not.toContain('<script')
    expect(r.hasMermaid).toBe(true)
  })

  it('skips providers that are turned off', async () => {
    const p = createPipeline({ ...DEFAULT_SETTINGS, providers: ['graphviz'] })
    const r = await renderBody(p, md)
    expect(r.output).not.toContain('<pre class="mermaid">')
    expect(r.output).not.toContain('mm-line-')
  })

  it('formats Markdown', () => {
    const p = createPipeline(DEFAULT_SETTINGS)
    expect(formatMarkdown(p, '* a\n* b\n\nSome *em*\n')).toBe('- a\n- b\n\nSome _em_\n')
  })

  it('exports a standalone page that links Mermaid from assets/', async () => {
    const page = await exportPage(createPipeline(DEFAULT_SETTINGS), md, { fallbackTitle: 'x' })
    expect(page.html).toMatch(/^<!doctype html>/)
    expect(page.html).toContain('<title>Doc</title>')
    expect(page.html).toContain('"assets/mermaid.min.js"')
    expect(page.needs).toEqual({ mermaid: true, math: false })
  })

  it('exports math with KaTeX linked from assets/', async () => {
    const p = createPipeline({ ...DEFAULT_SETTINGS, math: true })
    const page = await exportPage(p, '# M\n\n$$\nx^2\n$$\n')
    expect(page.needs).toEqual({ mermaid: false, math: true })
    expect(page.html).toContain('<link rel="stylesheet" href="assets/katex/katex.min.css">')
    expect(page.html).toContain('class="katex')
  })

  it('warns about unknown diagram providers instead of ignoring them silently', async () => {
    const warn = vi.fn()
    const p = createPipeline(
      { ...DEFAULT_SETTINGS, providers: ['nope', 'graphviz'] },
      'light',
      [],
      warn,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('"nope"')
    const r = await renderBody(p, md)
    expect(r.output).toContain('mm-diagram-graphviz')
  })

  it('does not warn for the default settings', () => {
    const warn = vi.fn()
    createPipeline(DEFAULT_SETTINGS, 'light', [], warn)
    expect(warn).not.toHaveBeenCalled()
  })
})
