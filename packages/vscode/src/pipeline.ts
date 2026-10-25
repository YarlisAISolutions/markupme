import {
  type CodeBlockHandler,
  createProcessor,
  type MarkupMeDocument,
  type MarkupMePlugin,
  type Processor,
  type RenderResult,
} from '@markupme/core'
import {
  codeBlockHandlers,
  type DiagramProvider,
  type DiagramTheme,
  providersFromIds,
} from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'
import { sourceLinePlugin } from './lines.js'
import {
  formatOptions,
  type MarkupMeSettings,
  processorOptions,
  renderOptions,
} from './settings.js'

/**
 * Providers for the settings. An id that gives no provider (unknown, or `kroki`, which VS Code
 * configures through `markupme.diagrams.server`) is reported to `onWarning` and skipped.
 */
export function providersFor(
  s: MarkupMeSettings,
  onWarning: (message: string) => void = console.warn,
): DiagramProvider[] {
  const { providers, problems } = providersFromIds(s.providers, s.server)
  for (const p of problems)
    onWarning(
      p.reason === 'needs-server'
        ? 'MarkupMe: the kroki diagram provider needs markupme.diagrams.server; skipped'
        : `MarkupMe: unknown diagram provider "${p.id}" in markupme.diagrams.providers; skipped`,
    )
  return providers
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
  onWarning: (message: string) => void = console.warn,
): Pipeline {
  const opts = processorOptions(s)
  const processor = createProcessor({ ...opts, plugins: extraPlugins })
  const previewProcessor = createProcessor({
    ...opts,
    plugins: [...extraPlugins, sourceLinePlugin],
  })
  const formatProcessor = createProcessor({ ...formatOptions(s), plugins: extraPlugins })
  const handlers = codeBlockHandlers({
    providers: providersFor(s, onWarning),
    theme,
    next: (skip) => highlightHandler({ lineNumbers: s.lineNumbers, skip }),
  })
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
