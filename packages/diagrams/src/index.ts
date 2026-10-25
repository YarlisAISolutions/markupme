import { type CodeBlockHandler, type Diagnostic, escapeHtml } from '@markupme/core'
import { sanitizeSvg } from './sanitize-svg.js'

export { sanitizeSvg }

export type DiagramTheme = 'light' | 'dark'

export interface DiagramRequest {
  /** The fence language that selected this provider. */
  lang: string
  source: string
  theme: DiagramTheme
}

/**
 * Server output is an SVG string. Client output is HTML that a browser runtime turns into a
 * diagram (Mermaid needs a DOM to lay out text).
 */
export type DiagramOutput = { kind: 'svg'; svg: string } | { kind: 'client'; html: string }

/** A diagram backend. Implement it to plug in another renderer without touching the engine. */
export interface DiagramProvider {
  id: string
  /** Fence languages this provider renders. */
  langs: string[]
  /** Where rendering happens. `client` providers need the MarkupMe runtime in the page. */
  mode: 'server' | 'client'
  /** Network access needed (Kroki). Off unless configured. */
  remote?: boolean
  render(req: DiagramRequest): Promise<DiagramOutput>
}

export class DiagramError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message)
    this.name = 'DiagramError'
  }
}

/** Yarlis Blueprint (`ybp`, `blueprint`, `blueprint-yaml`), deterministic SVG via @bpview/core. */
export function blueprintProvider(): DiagramProvider {
  return {
    id: 'blueprint',
    langs: ['ybp', 'blueprint', 'blueprint-yaml'],
    mode: 'server',
    async render({ lang, source }) {
      const bp = await import('@bpview/core')
      try {
        const { svg } = bp.renderSourceToSvg(source, {
          format: lang === 'blueprint-yaml' ? 'yaml' : 'ybp',
        })
        return { kind: 'svg', svg }
      } catch (error) {
        const diags = (error as { diagnostics?: { message: string; line?: number }[] }).diagnostics
        const first = diags?.[0]
        throw new DiagramError(first?.message ?? (error as Error).message, first?.line)
      }
    },
  }
}

type GraphvizInstance = { dot(src: string, format?: 'svg'): string }
let graphviz: Promise<GraphvizInstance> | undefined

/** Graphviz DOT (`dot`, `graphviz`) through the WebAssembly build: no system binary needed. */
export function graphvizProvider(): DiagramProvider {
  return {
    id: 'graphviz',
    langs: ['dot', 'graphviz'],
    mode: 'server',
    async render({ source }) {
      graphviz ??= import('@hpcc-js/wasm-graphviz').then((m) => m.Graphviz.load())
      const gv = await graphviz
      try {
        const svg = gv.dot(source, 'svg')
        return { kind: 'svg', svg: svg.replace(/^[\s\S]*?(<svg)/, '$1') }
      } catch (error) {
        const msg = String((error as Error).message ?? error)
        const line = /line (\d+)/.exec(msg)?.[1]
        throw new DiagramError(msg.trim(), line ? Number(line) : undefined)
      }
    },
  }
}

export const MERMAID_LANGS = ['mermaid']

/**
 * Mermaid (flowchart, sequence, state, class, ER, gantt, C4, mindmap, …). Mermaid lays out text
 * with a DOM, so it renders in the browser: output is `<pre class="mermaid">` that the MarkupMe
 * runtime (or any Mermaid setup) turns into SVG. The CLI can export SVG with a headless browser.
 */
export function mermaidProvider(): DiagramProvider {
  return {
    id: 'mermaid',
    langs: MERMAID_LANGS,
    mode: 'client',
    async render({ source }) {
      return { kind: 'client', html: `<pre class="mermaid">${escapeHtml(source)}</pre>` }
    },
  }
}

/** Fence languages Kroki can render, mapped to Kroki diagram types. */
export const KROKI_TYPES: Record<string, string> = {
  plantuml: 'plantuml',
  puml: 'plantuml',
  c4plantuml: 'c4plantuml',
  c4: 'c4plantuml',
  structurizr: 'structurizr',
  d2: 'd2',
  ditaa: 'ditaa',
  erd: 'erd',
  nomnoml: 'nomnoml',
  bpmn: 'bpmn',
  bytefield: 'bytefield',
  excalidraw: 'excalidraw',
  pikchr: 'pikchr',
  svgbob: 'svgbob',
  vega: 'vega',
  vegalite: 'vegalite',
  wavedrom: 'wavedrom',
}

export interface KrokiOptions {
  /** Kroki base URL, e.g. a self-hosted `http://localhost:8000` or `https://kroki.io`. */
  server: string
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number
  fetch?: typeof fetch
}

/**
 * PlantUML, C4-PlantUML, Structurizr DSL, D2 and more through a Kroki server. Opt-in only: it sends
 * diagram source over the network, so nothing uses it unless a server is configured. Responses are
 * sanitized like any other SVG.
 */
export function krokiProvider(options: KrokiOptions): DiagramProvider {
  const base = options.server.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  return {
    id: 'kroki',
    langs: Object.keys(KROKI_TYPES),
    mode: 'server',
    remote: true,
    async render({ lang, source }) {
      const type = KROKI_TYPES[lang] ?? lang
      const res = await doFetch(`${base}/${type}/svg`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Accept: 'image/svg+xml' },
        body: source,
        signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
      })
      const text = await res.text()
      if (!res.ok)
        throw new DiagramError(`Kroki ${type} returned ${res.status}: ${text.slice(0, 200).trim()}`)
      return { kind: 'svg', svg: text }
    },
  }
}

export interface DiagramOptions {
  /** Providers to use. Default: blueprint, graphviz and mermaid (no network). */
  providers?: DiagramProvider[]
  theme?: DiagramTheme
  /** Max cached renders. Default 200. */
  cacheSize?: number
}

export interface DiagramHandler extends CodeBlockHandler {
  readonly providers: DiagramProvider[]
  /** Fence languages handled. */
  readonly langs: string[]
  clearCache(): void
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function defaultProviders(opts: { kroki?: string } = {}): DiagramProvider[] {
  const list = [blueprintProvider(), graphvizProvider(), mermaidProvider()]
  if (opts.kroki) list.push(krokiProvider({ server: opts.kroki }))
  return list
}

/**
 * A MarkupMe code block handler for diagrams. Output is sanitized SVG in a `<figure>`, or a
 * Mermaid placeholder for the browser. A bad diagram becomes an inline error box plus a
 * diagnostic, never a crash. Results are cached by provider, theme and source hash.
 */
export function diagramHandler(options: DiagramOptions = {}): DiagramHandler {
  const providers = options.providers ?? defaultProviders()
  const theme = options.theme ?? 'light'
  const byLang = new Map<string, DiagramProvider>()
  for (const p of providers) for (const l of p.langs) if (!byLang.has(l)) byLang.set(l, p)
  const cache = new Map<string, string>()
  const limit = options.cacheSize ?? 200

  const handler = (async (block) => {
    if (!block.lang) return undefined
    const provider = byLang.get(block.lang)
    if (!provider) return undefined
    const key = await sha256(`${provider.id}\0${theme}\0${block.lang}\0${block.code}`)
    const cached = cache.get(key)
    if (cached) return { html: cached }
    try {
      const out = await provider.render({ lang: block.lang, source: block.code, theme })
      const body = out.kind === 'svg' ? sanitizeSvg(out.svg) : out.html
      const html = `<figure class="mm-diagram mm-diagram-${provider.id}" data-lang="${escapeHtml(block.lang)}" role="group" aria-label="${escapeHtml(provider.id)} diagram">${body}</figure>`
      if (cache.size >= limit) cache.delete(cache.keys().next().value as string)
      cache.set(key, html)
      return { html }
    } catch (error) {
      const message = (error as Error).message
      const line =
        error instanceof DiagramError && error.line !== undefined && block.line !== undefined
          ? block.line + error.line
          : block.line
      const diagnostic: Diagnostic = {
        code: 'MM040',
        rule: 'diagram',
        severity: 'error',
        message: `${provider.id} diagram: ${message}`,
        ...(line !== undefined ? { line } : {}),
      }
      return {
        html: `<div class="mm-diagram-error" role="alert"><strong>Diagram error (${escapeHtml(provider.id)})</strong><pre>${escapeHtml(message)}</pre><pre class="mm-diagram-source">${escapeHtml(block.code)}</pre></div>`,
        diagnostics: [diagnostic],
      }
    }
  }) as DiagramHandler
  Object.defineProperties(handler, {
    providers: { value: providers },
    langs: { value: [...byLang.keys()] },
    clearCache: { value: () => cache.clear() },
  })
  return handler
}

/** Why a provider id from configuration produced no provider. */
export interface ProviderProblem {
  id: string
  /** `unknown`: no provider has this id. `needs-server`: `kroki` listed without a server URL. */
  reason: 'unknown' | 'needs-server'
}

export interface ProvidersFromIds {
  providers: DiagramProvider[]
  /** In the order the ids were given. */
  problems: ProviderProblem[]
}

/**
 * Turns configured provider ids (`blueprint`, `graphviz`, `mermaid`, `kroki`, `none`) into
 * providers, in the order given. A Kroki provider is added last whenever `server` is set; listing
 * `kroki` without a server is reported, as is any id no provider has. Problems are returned, not
 * thrown, so each caller decides whether one is an error or a warning.
 */
export function providersFromIds(ids: readonly string[], server?: string): ProvidersFromIds {
  const providers: DiagramProvider[] = []
  const problems: ProviderProblem[] = []
  for (const id of ids) {
    if (id === 'blueprint') providers.push(blueprintProvider())
    else if (id === 'graphviz') providers.push(graphvizProvider())
    else if (id === 'mermaid') providers.push(mermaidProvider())
    else if (id === 'kroki') {
      if (!server) problems.push({ id, reason: 'needs-server' })
    } else if (id !== 'none') problems.push({ id, reason: 'unknown' })
  }
  if (server) providers.push(krokiProvider({ server }))
  return { providers, problems }
}

export interface CodeBlockHandlerOptions {
  providers: DiagramProvider[]
  theme?: DiagramTheme
  /**
   * Builds the handler that runs after diagrams (such as `highlightHandler`), given the fence
   * languages the diagram handler takes so it can skip them. Omit it for diagrams only.
   */
  next?: (skip: string[]) => CodeBlockHandler
}

/**
 * The code block handlers in the order MarkupMe runs them: diagrams first (only when there are
 * providers), then the `next` handler with the diagram languages to skip.
 */
export function codeBlockHandlers(options: CodeBlockHandlerOptions): CodeBlockHandler[] {
  const { providers, theme, next } = options
  const handlers: CodeBlockHandler[] = []
  const diagrams =
    providers.length > 0 ? diagramHandler({ providers, ...(theme ? { theme } : {}) }) : undefined
  if (diagrams) handlers.push(diagrams)
  if (next) handlers.push(next(diagrams?.langs ?? []))
  return handlers
}

export interface ExtractedDiagram {
  index: number
  lang: string
  provider: string
  source: string
  line?: number
}

/** Lists the diagram blocks in Markdown that the given providers can render. */
export async function extractDiagrams(
  markdown: string,
  providers: DiagramProvider[] = defaultProviders(),
): Promise<ExtractedDiagram[]> {
  const { parse, query } = await import('@markupme/core')
  const byLang = new Map<string, DiagramProvider>()
  for (const p of providers) for (const l of p.langs) if (!byLang.has(l)) byLang.set(l, p)
  const out: ExtractedDiagram[] = []
  for (const node of query(parse(markdown).tree, 'code')) {
    const p = node.lang ? byLang.get(node.lang) : undefined
    if (p && node.lang)
      out.push({
        index: out.length,
        lang: node.lang,
        provider: p.id,
        source: node.value,
        line: node.position?.start.line,
      })
  }
  return out
}
