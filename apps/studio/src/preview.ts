import {
  type CodeBlockHandler,
  createProcessor,
  type Diagnostic,
  type DocumentStats,
  type MarkupMePlugin,
  type OutlineItem,
  outline,
  type Processor,
  query,
  stats,
} from '@markupme/core'
import { diagramHandler } from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'
import type { Settings } from './storage.js'
import { type Anchor, LINE_CLASS, lineFromClasses, normalizeAnchors } from './sync.js'

export type EffectiveTheme = 'light' | 'dark'

export interface RenderOutcome {
  diagnostics: Diagnostic[]
  outline: OutlineItem[]
  stats: DocumentStats
  title?: string
}

const SKIP_LINE_TYPES = new Set([
  'definition',
  'footnoteDefinition',
  'yaml',
  'toml',
  'html',
  'code',
])

/**
 * Tags every top-level block with `mm-srcline-<n>` (its source line) so the preview can follow the
 * editor. The sanitizer keeps `mm-*` classes; `data-*` attributes would be stripped.
 */
const lineClassPlugin: MarkupMePlugin = {
  name: 'studio-line-classes',
  render(tree) {
    for (const node of tree.children) {
      const line = node.position?.start.line
      if (line === undefined || SKIP_LINE_TYPES.has(node.type)) continue
      const data = (node.data ?? {}) as { hProperties?: Record<string, unknown> }
      const props = { ...data.hProperties }
      const cls = props.className
      const list = Array.isArray(cls)
        ? cls.map(String)
        : typeof cls === 'string'
          ? cls.split(/\s+/)
          : []
      props.className = [...list, `${LINE_CLASS}${line}`]
      node.data = { ...data, hProperties: props } as typeof node.data
    }
  },
}

type MermaidApi = typeof import('mermaid').default
let mermaidLoader: Promise<MermaidApi> | undefined

/** Mermaid is large, so it loads only when a document has a Mermaid block. */
function loadMermaid(): Promise<MermaidApi> {
  mermaidLoader ??= import('mermaid').then((m) => m.default)
  return mermaidLoader
}

let katexCss: Promise<unknown> | undefined

/** KaTeX styles load with the math switch. */
function loadKatexCss(): Promise<unknown> {
  katexCss ??= import('katex/dist/katex.min.css')
  return katexCss
}

export class Preview {
  private processor: Processor
  private handlers: CodeBlockHandler[] = []
  private settings: Settings
  private theme: EffectiveTheme
  private seq = 0
  private mermaidCache = new Map<string, string>()
  private idle: Promise<void> = Promise.resolve()

  constructor(
    readonly scroller: HTMLElement,
    readonly article: HTMLElement,
    settings: Settings,
    theme: EffectiveTheme,
  ) {
    this.settings = settings
    this.theme = theme
    this.processor = this.build()
  }

  /** Re-creates the processor and code block handlers for new settings or theme. */
  configure(settings: Settings, theme: EffectiveTheme): void {
    this.settings = settings
    this.theme = theme
    this.processor = this.build()
  }

  get currentProcessor(): Processor {
    return this.processor
  }

  /** Resolves once the latest update (including Mermaid) has finished. */
  whenIdle(): Promise<void> {
    return this.idle
  }

  private build(): Processor {
    const s = this.settings
    if (s.diagrams) {
      const diagrams = diagramHandler({ theme: this.theme })
      this.handlers = [
        diagrams,
        highlightHandler({ skip: diagrams.langs, lineNumbers: s.codeLineNumbers }),
      ]
    } else {
      this.handlers = [highlightHandler({ lineNumbers: s.codeLineNumbers })]
    }
    if (s.math) void loadKatexCss()
    return createProcessor({
      gfm: s.gfm,
      math: s.math,
      emoji: s.emoji,
      toc: { position: s.tocPosition },
      plugins: [lineClassPlugin],
    })
  }

  /** Renders Markdown into the preview. Returns undefined when a newer update superseded it. */
  update(markdown: string): Promise<RenderOutcome | undefined> {
    const run = this.render(markdown)
    this.idle = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async render(markdown: string): Promise<RenderOutcome | undefined> {
    const seq = ++this.seq
    const p = this.processor
    const doc = p.parse(markdown)
    const validation = p.validate(doc)
    const result = await p.render(doc, {
      format: 'html',
      anchors: this.settings.anchors,
      codeBlocks: this.handlers,
    })
    if (seq !== this.seq) return undefined
    const keepScroll = this.scroller.scrollTop
    this.article.innerHTML = result.output
    this.scroller.scrollTop = keepScroll
    const mermaidLines = this.settings.diagrams
      ? query(doc.tree, 'code')
          .filter((c) => c.lang === 'mermaid')
          .map((c) => c.position?.start.line)
      : []
    const mermaidDiagnostics = await this.renderMermaid(seq, mermaidLines)
    if (seq !== this.seq) return undefined
    const diagnostics = dedupe([...validation, ...result.diagnostics, ...mermaidDiagnostics])
    const out: RenderOutcome = { diagnostics, outline: outline(doc.tree), stats: stats(doc.tree) }
    if (result.title) out.title = result.title
    return out
  }

  private async renderMermaid(seq: number, lines: (number | undefined)[]): Promise<Diagnostic[]> {
    const blocks = Array.from(this.article.querySelectorAll<HTMLElement>('pre.mermaid'))
    if (blocks.length === 0) return []
    const pending: { el: HTMLElement; key: string; line: number | undefined }[] = []
    blocks.forEach((el, i) => {
      const source = el.textContent ?? ''
      const key = `${this.theme}\0${source}`
      const cached = this.mermaidCache.get(key)
      if (cached !== undefined) {
        el.innerHTML = cached
        el.setAttribute('data-processed', 'true')
      } else pending.push({ el, key, line: lines[i] })
    })
    if (pending.length === 0) return []
    const mermaid = await loadMermaid()
    if (seq !== this.seq) return []
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: this.theme === 'dark' ? 'dark' : 'default',
    })
    const diagnostics: Diagnostic[] = []
    for (const { el, key, line } of pending) {
      if (seq !== this.seq) return []
      try {
        await mermaid.parse(el.textContent ?? '')
        await mermaid.run({ nodes: [el] })
        if (this.mermaidCache.size > 100) this.mermaidCache.clear()
        this.mermaidCache.set(key, el.innerHTML)
      } catch (error) {
        const message =
          String((error as Error).message ?? error).split('\n')[0] ?? 'Invalid diagram'
        el.classList.add('mm-mermaid-error')
        el.setAttribute('title', message)
        diagnostics.push({
          code: 'MM040',
          rule: 'diagram',
          severity: 'error',
          message: `mermaid diagram: ${message}`,
          ...(line !== undefined ? { line } : {}),
        })
      }
    }
    return diagnostics
  }

  /** Measures the rendered top-level blocks for scroll sync. */
  anchors(): Anchor[] {
    const base = this.scroller.getBoundingClientRect().top - this.scroller.scrollTop
    const out: Anchor[] = []
    for (const el of Array.from(this.article.children)) {
      const line = lineFromClasses(el.classList)
      if (line === undefined) continue
      out.push({ line, top: (el as HTMLElement).getBoundingClientRect().top - base })
    }
    return normalizeAnchors(out)
  }

  /** Scrolls the preview so the element with this id is at the top. */
  scrollToId(id: string): boolean {
    if (!id) return false
    const el = this.article.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!el) return false
    const base = this.scroller.getBoundingClientRect().top - this.scroller.scrollTop
    this.scroller.scrollTo({ top: el.getBoundingClientRect().top - base - 8 })
    return true
  }
}

function dedupe(list: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>()
  const out: Diagnostic[] = []
  for (const d of list) {
    const key = `${d.code}\0${d.line ?? ''}\0${d.column ?? ''}\0${d.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
}
