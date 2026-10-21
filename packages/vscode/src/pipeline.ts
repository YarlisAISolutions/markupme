import {
  type CodeBlockHandler,
  createProcessor,
  type MarkupMeDocument,
  type MarkupMePlugin,
  type Processor,
  type RenderResult,
} from '@markupme/core'
import {
  blueprintProvider,
  type DiagramProvider,
  type DiagramTheme,
  diagramHandler,
  graphvizProvider,
  krokiProvider,
  mermaidProvider,
} from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'
import { sourceLinePlugin } from './lines.js'
import {
  formatOptions,
  type MarkupMeSettings,
  processorOptions,
  renderOptions,
} from './settings.js'

export function providersFor(s: MarkupMeSettings): DiagramProvider[] {
  const list: DiagramProvider[] = []
  for (const id of s.providers) {
    if (id === 'blueprint') list.push(blueprintProvider())
    else if (id === 'graphviz') list.push(graphvizProvider())
    else if (id === 'mermaid') list.push(mermaidProvider())
  }
  if (s.server) list.push(krokiProvider({ server: s.server }))
  return list
}

export interface Pipeline {
  settings: MarkupMeSettings
  /** Renders, validates and counts. */
  processor: Processor
  /** Same options plus source-line classes for scroll sync (preview only). */
  previewProcessor: Processor
  /** No TOC regeneration: used by Format Document and Insert TOC. */
  formatProcessor: Processor
  handlers: CodeBlockHandler[]
}

/** Builds processors and code block handlers (diagrams first, then highlighting) from settings. */
export function createPipeline(
  s: MarkupMeSettings,
  theme: DiagramTheme = 'light',
  extraPlugins: MarkupMePlugin[] = [],
): Pipeline {
  const opts = processorOptions(s)
  const processor = createProcessor({ ...opts, plugins: extraPlugins })
  const previewProcessor = createProcessor({
    ...opts,
    plugins: [...extraPlugins, sourceLinePlugin],
  })
  const formatProcessor = createProcessor({ ...formatOptions(s), plugins: extraPlugins })
  const handlers: CodeBlockHandler[] = []
  const providers = providersFor(s)
  const diagrams = providers.length > 0 ? diagramHandler({ providers, theme }) : undefined
  if (diagrams) handlers.push(diagrams)
  handlers.push(highlightHandler({ lineNumbers: s.lineNumbers, skip: diagrams?.langs ?? [] }))
  return { settings: s, processor, previewProcessor, formatProcessor, handlers }
}

export interface RenderedHtml extends RenderResult {
  hasMermaid: boolean
  hasMath: boolean
}

/** Renders a document body to HTML with the pipeline's handlers. */
export async function renderBody(
  p: Pipeline,
  input: string | MarkupMeDocument,
  o: { preview?: boolean; baseUrl?: string } = {},
): Promise<RenderedHtml> {
  const processor = o.preview ? p.previewProcessor : p.processor
  const result = await processor.render(
    input,
    renderOptions(p.settings, {
      codeBlocks: p.handlers,
      ...(o.baseUrl ? { baseUrl: o.baseUrl } : {}),
    }),
  )
  return {
    ...result,
    hasMermaid: result.output.includes('<pre class="mermaid">'),
    hasMath: result.output.includes('class="katex'),
  }
}

/** Core-normalized Markdown for a whole document. */
export function formatMarkdown(p: Pipeline, source: string): string {
  return p.formatProcessor.serialize(p.formatProcessor.parse(source))
}
