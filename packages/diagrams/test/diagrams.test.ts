import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import { diagramHandler, extractDiagrams, krokiProvider, sanitizeSvg } from '../src/index.js'

const p = createProcessor()
const render = async (md: string, handler = diagramHandler()) =>
  p.render(md, { codeBlocks: [handler] })

describe('providers', () => {
  it('renders Blueprint to deterministic SVG', async () => {
    const md = '```ybp\nflowchart "Flow"\napi: API [service]\ndb: DB [database]\napi -> db\n```'
    const a = await render(md)
    const b = await render(md, diagramHandler())
    expect(a.output).toContain('<figure class="mm-diagram mm-diagram-blueprint"')
    expect(a.output).toContain('<svg')
    expect(a.output).toBe(b.output)
  })

  it('renders Graphviz DOT through WebAssembly', async () => {
    const r = await render('```dot\ndigraph G { a -> b }\n```')
    expect(r.output).toContain('mm-diagram-graphviz')
    expect(r.output).toMatch(/<svg[\s\S]*<title>a<\/title>/)
  })

  it('emits Mermaid for the browser runtime', async () => {
    const r = await render('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(r.output).toContain('<pre class="mermaid">flowchart LR\n  A --&#62; B</pre>')
  })

  it('reports a bad diagram as a diagnostic and an inline error', async () => {
    const r = await render('# t\n\n```dot\ndigraph { a -> \n```')
    expect(r.output).toContain('class="mm-diagram-error" role="alert"')
    expect(r.diagnostics.find((d) => d.code === 'MM040')).toMatchObject({ severity: 'error' })
  })

  it('uses Kroki only when configured, and sanitizes its SVG', async () => {
    const fakeFetch = (async (url: string) => {
      expect(url).toBe('http://kroki.local/plantuml/svg')
      return new Response('<svg onload="alert(1)"><script>alert(1)</script><text>ok</text></svg>', {
        status: 200,
      })
    }) as unknown as typeof fetch
    const handler = diagramHandler({
      providers: [krokiProvider({ server: 'http://kroki.local/', fetch: fakeFetch })],
    })
    const r = await render('```plantuml\n@startuml\nA -> B\n@enduml\n```', handler)
    expect(r.output).toContain('<text>ok</text>')
    expect(r.output).not.toMatch(/onload|<script/)
    const none = await render('```plantuml\nA -> B\n```')
    expect(none.output).toContain('<code class="language-plantuml">')
  })
})

describe('sanitizeSvg', () => {
  it('removes scripts, handlers, foreignObject and unsafe links', () => {
    const out = sanitizeSvg(
      '<svg><a href="javascript:alert(1)"><text>x</text></a><a xlink:href="https://ok.dev"><g onclick="x"/></a><foreignObject><div>h</div></foreignObject><style>@import url(https://evil)</style></svg>',
    )
    expect(out).not.toMatch(/javascript:|onclick|foreignObject|@import/i)
    expect(out).toContain('https://ok.dev')
  })
})

it('extracts diagram blocks', async () => {
  const list = await extractDiagrams('```dot\na\n```\n\n```ts\nx\n```\n\n```mermaid\nb\n```')
  expect(list.map((d) => `${d.provider}:${d.lang}`)).toEqual(['graphviz:dot', 'mermaid:mermaid'])
})
