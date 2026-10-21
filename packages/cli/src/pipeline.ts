import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import {
  type CodeBlockHandler,
  createProcessor,
  type Diagnostic,
  type MarkupMePlugin,
  type Processor,
  query,
  type RenderFormat,
} from '@markupme/core'
import {
  blueprintProvider,
  type DiagramProvider,
  diagramHandler,
  graphvizProvider,
  krokiProvider,
  mermaidProvider,
} from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'
import { type NavItem, type ThemeMode, wrapDocument } from '@markupme/themes'
import { DEFAULT_CONFIG, type MarkupMeConfig, processorOptions } from './config.js'
import { CliError, EXIT } from './exit.js'

const require = createRequire(import.meta.url)

/** Merges defaults, the config file and flags (later wins), one level deep. */
export function mergeConfig(...layers: MarkupMeConfig[]): MarkupMeConfig {
  const out: MarkupMeConfig = {}
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue
      const prev = (out as Record<string, unknown>)[k]
      ;(out as Record<string, unknown>)[k] =
        v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object'
          ? { ...prev, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) }
          : v
    }
  }
  return out
}

/** Rewrites relative `.md` links to `.html`, for multi-page output. */
export const mdLinksToHtml: MarkupMePlugin = {
  name: 'md-links-to-html',
  render(tree) {
    for (const link of query(tree, 'link')) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(link.url)) continue
      link.url = link.url
        .replace(/(^|\/)README\.md(?=$|#|\?)/i, '$1index.md')
        .replace(/\.md(?=$|#|\?)/i, '.html')
    }
  },
}

export function providersFor(config: MarkupMeConfig): DiagramProvider[] {
  const ids = config.diagrams?.providers ?? DEFAULT_CONFIG.diagrams?.providers ?? []
  const list: DiagramProvider[] = []
  for (const id of ids) {
    if (id === 'blueprint') list.push(blueprintProvider())
    else if (id === 'graphviz') list.push(graphvizProvider())
    else if (id === 'mermaid') list.push(mermaidProvider())
    else if (id === 'kroki') {
      if (!config.diagrams?.server)
        throw new CliError('The kroki provider needs --diagram-server <url>', EXIT.USAGE)
    } else if (id !== 'none') throw new CliError(`Unknown diagram provider "${id}"`, EXIT.USAGE)
  }
  if (config.diagrams?.server) list.push(krokiProvider({ server: config.diagrams.server }))
  return list
}

export interface Pipeline {
  config: MarkupMeConfig
  processor: Processor
  handlers: CodeBlockHandler[]
}

export function createPipeline(
  config: MarkupMeConfig,
  extraPlugins: MarkupMePlugin[] = [],
): Pipeline {
  const opts = processorOptions(config)
  const processor = createProcessor({
    ...opts,
    plugins: [...(opts.plugins ?? []), ...extraPlugins],
  })
  const handlers: CodeBlockHandler[] = []
  const providers = providersFor(config)
  const diagrams = providers.length > 0 ? diagramHandler({ providers }) : undefined
  if (diagrams) handlers.push(diagrams)
  if (config.render?.highlight !== false)
    handlers.push(
      highlightHandler({
        lineNumbers: config.render?.lineNumbers === true,
        skip: diagrams?.langs ?? [],
      }),
    )
  return { config, processor, handlers }
}

export interface PageOptions {
  format: RenderFormat
  standalone?: boolean
  file?: string
  /** URL (relative to the page) of the assets folder holding mermaid.min.js and katex/. */
  assetsHref?: string
  /** Inline Mermaid into the page instead of linking it (single offline file). */
  inlineMermaid?: boolean
  mermaidUrl?: string
  nav?: NavItem[]
  siteName?: string
  homeHref?: string
  head?: string
  footer?: string
}

export interface PageResult {
  output: string
  title?: string
  diagnostics: Diagnostic[]
  hasMermaid: boolean
  hasMath: boolean
}

export function mermaidScriptPath(): string {
  return join(dirname(require.resolve('mermaid/package.json')), 'dist', 'mermaid.min.js')
}

function katexDir(): string {
  return join(dirname(require.resolve('katex/package.json')), 'dist')
}

/** Copies the browser assets a page needs (Mermaid, KaTeX CSS and fonts) into `dir`. */
export function writeAssets(dir: string, need: { mermaid: boolean; math: boolean }): void {
  mkdirSync(dir, { recursive: true })
  if (need.mermaid) copyFileSync(mermaidScriptPath(), join(dir, 'mermaid.min.js'))
  if (need.math) {
    const src = katexDir()
    mkdirSync(join(dir, 'katex', 'fonts'), { recursive: true })
    copyFileSync(join(src, 'katex.min.css'), join(dir, 'katex', 'katex.min.css'))
    for (const f of readdirSync(join(src, 'fonts')))
      copyFileSync(join(src, 'fonts', f), join(dir, 'katex', 'fonts', f))
  }
}

export async function renderPage(p: Pipeline, source: string, o: PageOptions): Promise<PageResult> {
  const doc = p.processor.parse(source, o.file ? { file: o.file } : {})
  const r = p.config.render ?? {}
  const result = await p.processor.render(doc, {
    format: o.format,
    sanitize: r.sanitize !== false,
    allowHtml: r.allowHtml !== false,
    anchors: r.anchors !== false,
    codeBlocks: p.handlers,
    ...(r.baseUrl ? { baseUrl: r.baseUrl } : {}),
    externalLinksNewTab: r.externalLinksNewTab === true,
  })
  const hasMermaid = o.format === 'html' && result.output.includes('<pre class="mermaid">')
  const hasMath = o.format === 'html' && result.output.includes('class="katex')
  let output = result.output
  if (o.format === 'html' && o.standalone) {
    const description = doc.frontmatter?.description
    const head = [
      hasMath && o.assetsHref !== undefined
        ? `<link rel="stylesheet" href="${o.assetsHref}katex/katex.min.css">`
        : '',
      o.head ?? '',
    ].join('')
    const mermaidUrl =
      o.mermaidUrl ?? (o.assetsHref !== undefined ? `${o.assetsHref}mermaid.min.js` : undefined)
    output = wrapDocument({
      body: result.output,
      ...(result.title ? { title: result.title } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      theme: (r.theme ?? 'auto') as ThemeMode,
      ...(hasMath && o.assetsHref === undefined
        ? {
            extraCss: readFileSync(join(katexDir(), 'katex.min.css'), 'utf8').replace(
              /@font-face\{[^}]*\}/g,
              '',
            ),
          }
        : {}),
      ...(hasMermaid && o.inlineMermaid
        ? { mermaidInline: readFileSync(mermaidScriptPath(), 'utf8') }
        : {}),
      ...(hasMermaid && !o.inlineMermaid && mermaidUrl ? { mermaidUrl } : {}),
      ...(o.nav ? { nav: o.nav } : {}),
      ...(o.siteName ? { siteName: o.siteName } : {}),
      ...(o.homeHref ? { homeHref: o.homeHref } : {}),
      ...(head ? { head } : {}),
      ...(o.footer ? { footer: o.footer } : {}),
    })
  }
  return {
    output,
    ...(result.title ? { title: result.title } : {}),
    diagnostics: result.diagnostics,
    hasMermaid,
    hasMath,
  }
}

export function fileExistsFrom(baseDir: string): (path: string) => boolean {
  return (path) => existsSync(path.startsWith('/') ? path : join(baseDir, path))
}
