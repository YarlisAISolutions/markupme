import type { CodeBlockHandler } from '@markupme/core'
import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import {
  codeBlockHandlers,
  type DiagramHandler,
  type DiagramProvider,
  diagramHandler,
  extractDiagrams,
  krokiProvider,
  providersFromIds,
  sanitizeSvg,
} from '../src/index.js'

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

describe('providersFromIds', () => {
  it('builds providers in the order given and skips none', () => {
    const r = providersFromIds(['mermaid', 'none', 'graphviz', 'blueprint'])
    expect(r.providers.map((x) => x.id)).toEqual(['mermaid', 'graphviz', 'blueprint'])
    expect(r.problems).toEqual([])
  })

  it('reports unknown ids and kroki without a server, in order', () => {
    expect(providersFromIds(['foo', 'kroki']).problems).toEqual([
      { id: 'foo', reason: 'unknown' },
      { id: 'kroki', reason: 'needs-server' },
    ])
    expect(providersFromIds(['kroki', 'foo']).problems).toEqual([
      { id: 'kroki', reason: 'needs-server' },
      { id: 'foo', reason: 'unknown' },
    ])
  })

  it('adds Kroki last whenever a server is set', () => {
    const listed = providersFromIds(['kroki', 'graphviz'], 'http://kroki.local/')
    expect(listed.providers.map((x) => x.id)).toEqual(['graphviz', 'kroki'])
    expect(listed.problems).toEqual([])
    expect(providersFromIds([], 'http://kroki.local/').providers.map((x) => x.id)).toEqual([
      'kroki',
    ])
  })
})

describe('codeBlockHandlers', () => {
  const marker: CodeBlockHandler = async () => undefined

  it('puts diagrams first and hands their languages to the next handler', () => {
    let skip: string[] = []
    const { providers } = providersFromIds(['graphviz', 'mermaid'])
    const handlers = codeBlockHandlers({
      providers,
      next: (s) => {
        skip = s
        return marker
      },
    })
    expect(handlers).toHaveLength(2)
    expect((handlers[0] as DiagramHandler).langs).toEqual(skip)
    expect(skip).toContain('dot')
    expect(skip).toContain('mermaid')
    expect(handlers[1]).toBe(marker)
  })

  it('has no diagram handler without providers', () => {
    let skip: string[] | undefined
    const handlers = codeBlockHandlers({
      providers: [],
      next: (s) => {
        skip = s
        return marker
      },
    })
    expect(handlers).toEqual([marker])
    expect(skip).toEqual([])
  })

  it('returns diagrams only when next is omitted', () => {
    expect(codeBlockHandlers({ providers: providersFromIds(['mermaid']).providers })).toHaveLength(
      1,
    )
    expect(codeBlockHandlers({ providers: [] })).toEqual([])
  })

  it('passes the theme to the diagram handler', async () => {
    const echo: DiagramProvider = {
      id: 'echo',
      langs: ['echo'],
      mode: 'client',
      render: async ({ theme }) => ({ kind: 'client', html: `<p>${theme}</p>` }),
    }
    const md = '```echo\nx\n```'
    const out = async (theme?: 'dark') => {
      const handlers = codeBlockHandlers({ providers: [echo], ...(theme ? { theme } : {}) })
      return (await p.render(md, { codeBlocks: handlers })).output
    }
    expect(await out('dark')).toContain('<p>dark</p>')
    expect(await out()).toContain('<p>light</p>')
  })
})
