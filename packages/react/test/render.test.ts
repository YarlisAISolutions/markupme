import { createProcessor } from '@markupme/core'
import { diagramHandler } from '@markupme/diagrams'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { htmlToReact, Markdown, renderToReact, renderToTree } from '../src/index.js'

const A = (props: { href?: string; children?: ReactNode }) =>
  createElement('a', { href: props.href, 'data-custom': 'yes' }, props.children)

const html = async (md: string, o?: Parameters<typeof renderToReact>[1]) =>
  renderToStaticMarkup(await renderToReact(md, o))

describe('renderToReact', () => {
  it('renders GFM', async () => {
    const out = await html(
      '# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~ and https://example.com\n\n- [x] done\n',
    )
    expect(out).toContain('<h1 id="title">Title</h1>')
    expect(out).toContain('<table><thead><tr><th>a</th><th>b</th></tr></thead>')
    expect(out).toContain('<del>gone</del>')
    expect(out).toContain('<a href="https://example.com">https://example.com</a>')
    expect(out).toMatch(
      /<input type="checkbox" disabled="" aria-label="Completed task: done" checked=""\/>/,
    )
  })

  it('lets components override elements', async () => {
    const out = await html('[docs](https://example.com/docs)', { components: { a: A } })
    expect(out).toBe('<p><a href="https://example.com/docs" data-custom="yes">docs</a></p>')
  })

  it('sanitizes scripts, event handlers and javascript: URLs', async () => {
    const out = await html(
      '<script>alert(1)</script>\n\n<img src="x.png" onerror="alert(1)">\n\n[x](javascript:alert(1))\n',
    )
    expect(out).not.toContain('<script')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('<img src="x.png"')
  })

  it('keeps raw HTML only when sanitizing is off', async () => {
    const out = await html('<span style="color: red">red</span>', { render: { sanitize: false } })
    expect(out).toContain('<span style="color:red">red</span>')
  })

  it('renders Graphviz diagrams as SVG through a code block handler', async () => {
    const out = await html('```dot\ndigraph { a -> b }\n```', {
      render: { codeBlocks: [diagramHandler()] },
    })
    expect(out).toContain('<figure class="mm-diagram mm-diagram-graphviz"')
    expect(out).toContain('<svg')
    expect(out).toContain('viewBox=')
    expect(out).toMatch(/<text[^>]*>a<\/text>/)
  })

  it('applies processor options and reuses a processor', async () => {
    expect(await html(':tada:', { options: { emoji: true } })).toContain('🎉')
    const processor = createProcessor({ emoji: true })
    expect(await html(':tada:', { processor })).toContain('🎉')
  })

  it('returns the tree with diagnostics and title', async () => {
    const r = await renderToTree('# Hello\n\n```dot\nnot dot {\n```', {
      render: { codeBlocks: [diagramHandler()] },
    })
    expect(r.title).toBe('Hello')
    expect(r.tree.type).toBe('root')
    expect(r.diagnostics.some((d) => d.code === 'MM040')).toBe(true)
  })

  it('converts trusted HTML strings', () => {
    expect(renderToStaticMarkup(htmlToReact('<p class="x">Hi</p>'))).toBe('<p class="x">Hi</p>')
  })
})

describe('<Markdown> on the server', () => {
  it('renders the fallback, because rendering happens in an effect', () => {
    const out = renderToStaticMarkup(
      createElement(Markdown, { source: '# Hi', fallback: 'Loading…', className: 'markupme' }),
    )
    expect(out).toBe('<div class="markupme">Loading…</div>')
  })
})
