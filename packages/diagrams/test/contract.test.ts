// The stable exports of @markupme/diagrams that no behaviour test exercises on its own (MKP-3).
// docs/api-stability.md links here.
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  blueprintProvider,
  DiagramError,
  type DiagramOptions,
  type DiagramOutput,
  type DiagramRequest,
  type DiagramTheme,
  defaultProviders,
  graphvizProvider,
  KROKI_TYPES,
  type KrokiOptions,
  MERMAID_LANGS,
  mermaidProvider,
} from '../src/index.js'

describe('stable diagrams exports', () => {
  it('the built-in providers have fixed ids, languages and modes', () => {
    expect(defaultProviders().map((p) => [p.id, p.mode])).toEqual([
      ['blueprint', 'server'],
      ['graphviz', 'server'],
      ['mermaid', 'client'],
    ])
    expect(blueprintProvider().langs).toContain('ybp')
    expect(graphvizProvider().langs).toContain('dot')
    expect(mermaidProvider().langs).toEqual(MERMAID_LANGS)
    expect(defaultProviders({ kroki: 'http://localhost:8000' }).at(-1)?.id).toBe('kroki')
  })

  it('mermaid renders a client placeholder with escaped source', async () => {
    const out = await mermaidProvider().render({ lang: 'mermaid', source: 'a<b', theme: 'light' })
    expect(out.kind).toBe('client')
    const html = out.kind === 'client' ? out.html : ''
    expect(html).toMatch(/^<pre class="mermaid">/)
    expect(html).not.toContain('a<b')
  })

  it('KROKI_TYPES maps fence languages to Kroki types', () => {
    expect(KROKI_TYPES.puml).toBe('plantuml')
    expect(KROKI_TYPES.d2).toBe('d2')
  })

  it('DiagramError carries the source line', () => {
    const e = new DiagramError('bad', 4)
    expect(e).toBeInstanceOf(Error)
    expect(e.line).toBe(4)
  })

  it('exports the stable types', () => {
    expectTypeOf<DiagramTheme>().toEqualTypeOf<'light' | 'dark'>()
    expectTypeOf<DiagramRequest>().toHaveProperty('source')
    expectTypeOf<DiagramOutput>().not.toBeAny()
    expectTypeOf<DiagramOptions>().toBeObject()
    expectTypeOf<KrokiOptions>().toHaveProperty('server')
  })
})
