import { type CodeBlock, type CodeBlockHandler, escapeHtml } from '@markupme/core'
import {
  type BundledLanguage,
  type BundledTheme,
  bundledLanguages,
  createHighlighter,
  type HighlighterGeneric,
} from 'shiki'

export interface HighlightOptions {
  /** Theme for light mode. Default 'github-light-high-contrast' (meets WCAG AA contrast). */
  light?: BundledTheme
  /** Theme for dark mode. Default 'github-dark'. */
  dark?: BundledTheme
  /** Show line numbers on every block (blocks can opt in with `showLineNumbers`). Default false. */
  lineNumbers?: boolean
  /** Add a copy button. Default true. */
  copyButton?: boolean
  /** Languages this handler leaves alone (diagram languages, for example). */
  skip?: string[]
}

export interface CodeMeta {
  title?: string
  lineNumbers: boolean
  /** 1-based line numbers to highlight. */
  highlight: Set<number>
  startLine: number
}

/** Parses fence meta such as `title="app.ts" {1,3-5} showLineNumbers startLine=10`. */
export function parseMeta(meta: string | undefined): CodeMeta {
  const out: CodeMeta = { lineNumbers: false, highlight: new Set(), startLine: 1 }
  if (!meta) return out
  const title = /(?:title|filename)=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta)
  if (title) out.title = title[1] ?? title[2] ?? title[3]
  if (/\b(?:showLineNumbers|lineNumbers|linenums)\b/.test(meta)) out.lineNumbers = true
  const start = /\bstartLine=(\d+)/.exec(meta)
  if (start?.[1]) {
    out.startLine = Number(start[1])
    out.lineNumbers = true
  }
  const ranges = /\{([\d,\s-]+)\}/.exec(meta)
  if (ranges?.[1]) {
    for (const part of ranges[1].split(',')) {
      const [a, b] = part.trim().split('-').map(Number)
      if (a === undefined || Number.isNaN(a)) continue
      for (let n = a; n <= (b !== undefined && !Number.isNaN(b) ? b : a); n++) out.highlight.add(n)
    }
  }
  return out
}

export { escapeHtml }

const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  js: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  ps1: 'powershell',
  dockerfile: 'docker',
  kt: 'kotlin',
  rs: 'rust',
}

function resolveLang(lang: string | undefined): BundledLanguage | undefined {
  if (!lang) return undefined
  const l = ALIASES[lang] ?? lang
  return l in bundledLanguages ? (l as BundledLanguage) : undefined
}

function frame(block: CodeBlock, meta: CodeMeta, inner: string, copy: boolean): string {
  const lang = block.lang ?? 'text'
  const parts = [`<figure class="mm-code" data-lang="${escapeHtml(lang)}">`]
  if (meta.title)
    parts.push(`<figcaption class="mm-code-title">${escapeHtml(meta.title)}</figcaption>`)
  if (copy) parts.push('<button class="mm-copy" type="button" aria-label="Copy code">Copy</button>')
  parts.push(inner, '</figure>')
  return parts.join('')
}

/**
 * A code block handler that highlights with Shiki. Output uses dual themes through CSS
 * variables (`--shiki-light` / `--shiki-dark`), so the page theme switches colours without
 * re-rendering. Unknown languages are escaped as plain text, never dropped.
 */
export function highlightHandler(options: HighlightOptions = {}): CodeBlockHandler {
  const light = options.light ?? 'github-light-high-contrast'
  const dark = options.dark ?? 'github-dark'
  const skip = new Set(options.skip ?? [])
  let highlighter: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | undefined

  return async (block) => {
    if (block.lang && skip.has(block.lang)) return undefined
    const meta = parseMeta(block.meta)
    const showNumbers = meta.lineNumbers || options.lineNumbers === true
    const copy = options.copyButton !== false
    const lang = resolveLang(block.lang)
    const lineAttrs = (n: number) => `${meta.highlight.has(n) ? ' mm-line-highlight' : ''}`
    if (!lang) {
      const lines = block.code
        .split('\n')
        .map((l, i) => `<span class="line${lineAttrs(i + 1)}">${escapeHtml(l)}</span>`)
        .join('\n')
      const cls = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : ''
      const pre = `<pre class="mm-pre${showNumbers ? ' mm-line-numbers' : ''}" style="--mm-start:${meta.startLine}"><code${cls}>${lines}</code></pre>`
      return { html: frame(block, meta, pre, copy) }
    }
    highlighter ??= createHighlighter({ themes: [light, dark], langs: [] })
    const h = await highlighter
    if (!h.getLoadedLanguages().includes(lang)) await h.loadLanguage(lang)
    const html = h.codeToHtml(block.code, {
      lang,
      themes: { light, dark },
      defaultColor: false,
      transformers: [
        {
          pre(node) {
            this.addClassToHast(node, 'mm-pre')
            if (showNumbers) this.addClassToHast(node, 'mm-line-numbers')
            const style =
              typeof node.properties.style === 'string' ? `${node.properties.style};` : ''
            node.properties.style = `${style}--mm-start:${meta.startLine}`
            node.properties.tabindex = '0'
          },
          line(node, line) {
            if (meta.highlight.has(line)) this.addClassToHast(node, 'mm-line-highlight')
          },
        },
      ],
    })
    return { html: frame(block, meta, html, copy) }
  }
}
