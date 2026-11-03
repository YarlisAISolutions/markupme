/**
 * `@markupme/diagrams/experimental`: plumbing the CLI and the VS Code extension share. Built and
 * tested, but the option objects are still growing, so the shape may change in a minor release.
 * Pin the exact version when you use it. `diagramHandler` and the providers in the package root
 * are the stable way in. See docs/api-stability.md.
 */
import type { CodeBlockHandler } from '@markupme/core'
import {
  blueprintProvider,
  type DiagramProvider,
  type DiagramTheme,
  defaultProviders,
  diagramHandler,
  graphvizProvider,
  krokiProvider,
  mermaidProvider,
} from './index.js'

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
