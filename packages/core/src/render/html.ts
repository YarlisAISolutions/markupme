import type { Element, ElementContent, RootContent as HastContent, Root as HastRoot } from 'hast'
import type { Root } from 'mdast'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { presentAlerts } from '../plugins/alerts.js'
import { presentDirectives } from '../plugins/directives.js'
import { presentEmoji } from '../plugins/emoji.js'
import type {
  CodeBlock,
  Diagnostic,
  MarkupMeDocument,
  PluginContext,
  ProcessorOptions,
  RenderOptions,
} from '../types.js'
import { markupmeSchema } from './schema.js'

const CLOBBER = 'user-content-'

function textOf(node: Element): string {
  let out = ''
  visit(node, 'text', (t) => {
    out += t.value
  })
  return out
}

function nonce(): string {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function classList(el: Element): string[] {
  const c: unknown = el.properties.className
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(/\s+/) : []
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function resolveUrl(url: string, base: string | undefined): string {
  if (!base || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) return url
  try {
    return new URL(url, base.endsWith('/') ? base : `${base}/`).href
  } catch {
    return url
  }
}

/**
 * mdast → HTML. Pipeline:
 * 1. presentation transforms on a copy (alerts, directives, emoji, plugins)
 * 2. mdast → hast; record every id MarkupMe generated (before raw HTML is parsed)
 * 3. code blocks → trusted slots (highlighting, diagrams) via handlers
 * 4. raw HTML parsed, then the whole tree sanitized (GitHub schema + MarkupMe classes)
 * 5. generated ids un-clobbered, KaTeX applied, slots filled with trusted HTML
 */
export async function renderHtml(
  doc: MarkupMeDocument,
  opts: ProcessorOptions,
  r: RenderOptions,
  diagnostics: Diagnostic[],
): Promise<string> {
  const report = (d: Diagnostic) => diagnostics.push(doc.file ? { ...d, file: doc.file } : d)
  const ctx: PluginContext = { doc, options: opts, report }
  const tree = structuredClone(doc.tree) as Root
  if (opts.alerts !== false) presentAlerts(tree)
  if (opts.directives !== false) presentDirectives(tree)
  if (opts.emoji === true) presentEmoji(tree)
  for (const p of opts.plugins ?? []) await p.render?.(tree, ctx)

  const sanitize = r.sanitize !== false
  const allowHtml = r.allowHtml !== false
  const hast = (await unified()
    .use(remarkRehype, { allowDangerousHtml: allowHtml, clobberPrefix: '' })
    .run(tree)) as HastRoot

  // Ids generated so far are ours; raw HTML has not been parsed yet.
  const trustedIds = new Set<string>()
  visit(hast, 'element', (el: Element) => {
    if (typeof el.properties.id === 'string') trustedIds.add(el.properties.id)
  })

  // Code blocks → slots.
  const slotPrefix = `mm-slot-${nonce()}-`
  const slots = new Map<string, string>()
  const handlers = [
    ...(opts.plugins ?? []).flatMap((p) => (p.codeBlock ? [p.codeBlock] : [])),
    ...(r.codeBlocks ?? []),
  ]
  const jobs: Promise<void>[] = []
  let index = 0
  visit(hast, 'element', (el: Element, i, parent) => {
    if (el.tagName !== 'pre' || !parent || i === undefined) return
    const code = el.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
    if (!code) return
    const langClass = classList(code).find((c) => c.startsWith('language-'))
    const lang = langClass?.slice('language-'.length).toLowerCase()
    const metaProp = code.data as { meta?: string } | undefined
    const block: CodeBlock = {
      lang,
      meta: metaProp?.meta ?? undefined,
      code: textOf(code).replace(/\n$/, ''),
      index: index++,
      line: el.position?.start.line,
    }
    if (lang === 'math' && opts.math === true) return
    const id = `${slotPrefix}${block.index}`
    const placeholder: Element = {
      type: 'element',
      tagName: 'div',
      properties: { id },
      children: [],
    }
    jobs.push(
      (async () => {
        for (const handle of handlers) {
          try {
            const result = await handle(block)
            if (result) {
              for (const d of result.diagnostics ?? []) report(d)
              slots.set(id, result.html)
              ;(parent.children as HastContent[])[i] = placeholder
              trustedIds.add(id)
              return
            }
          } catch (error) {
            report({
              code: 'MM020',
              rule: 'code-block-handler',
              severity: 'error',
              message: `Code block handler failed for "${lang ?? 'text'}": ${(error as Error).message}`,
              line: block.line,
            })
            return
          }
        }
      })(),
    )
  })
  await Promise.all(jobs)

  // parse5 foster-parents whitespace text out of tables; drop it first.
  visit(hast, 'element', (el: Element) => {
    if (['table', 'thead', 'tbody', 'tfoot', 'tr'].includes(el.tagName))
      el.children = el.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''))
  })

  let pipeline = unified()
  if (allowHtml) pipeline = pipeline.use(rehypeRaw) as never
  if (sanitize) pipeline = pipeline.use(rehypeSanitize, markupmeSchema) as never
  let out = (await pipeline.run(hast as never)) as HastRoot

  // Un-clobber ids MarkupMe generated (headings, footnotes, slots); user ids keep the prefix.
  visit(out, 'element', (el: Element) => {
    for (const key of ['id', 'name', 'ariaDescribedBy', 'ariaLabelledBy'] as const) {
      const v = el.properties[key]
      const value = Array.isArray(v) && v.length === 1 ? String(v[0]) : v
      if (
        typeof value === 'string' &&
        value.startsWith(CLOBBER) &&
        trustedIds.has(value.slice(CLOBBER.length))
      )
        (el.properties as Record<string, unknown>)[key] = value.slice(CLOBBER.length)
    }
    if (el.tagName === 'a' && typeof el.properties.href === 'string') {
      const href = resolveUrl(el.properties.href, r.baseUrl)
      el.properties.href = href
      if (r.externalLinksNewTab && isExternal(href)) {
        el.properties.target = '_blank'
        el.properties.rel = ['noopener', 'noreferrer']
      }
    }
    // Task list checkboxes get an accessible name from their item text (WCAG 4.1.2).
    if (el.tagName === 'li' && classList(el).includes('task-list-item')) {
      const box = el.children.find(
        (c): c is Element =>
          c.type === 'element' && c.tagName === 'input' && c.properties.type === 'checkbox',
      )
      if (box) {
        const label = textOf(el).trim().split('\n')[0]?.trim() ?? ''
        box.properties.ariaLabel = `${box.properties.checked ? 'Completed' : 'Open'} task: ${label}`
      }
    }
    if (el.tagName === 'img') {
      if (typeof el.properties.src === 'string')
        el.properties.src = resolveUrl(el.properties.src, r.baseUrl)
      if (r.lazyImages !== false) {
        el.properties.loading = 'lazy'
        el.properties.decoding = 'async'
      }
    }
    if (
      r.anchors &&
      /^h[1-6]$/.test(el.tagName) &&
      typeof el.properties.id === 'string' &&
      !classList(el).includes('sr-only')
    ) {
      const anchor: ElementContent = {
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['mm-anchor'],
          href: `#${el.properties.id}`,
          ariaLabel: `Link to section: ${textOf(el)}`,
        },
        children: [{ type: 'text', value: '#' }],
      }
      el.children.push(anchor)
    }
  })

  if (opts.math === true)
    out = (await unified()
      .use(rehypeKatex, { throwOnError: false } as never)
      .run(out)) as HastRoot

  // Fill slots with trusted HTML.
  visit(out, 'element', (el: Element, i, parent) => {
    const id = el.properties.id
    if (
      el.tagName !== 'div' ||
      typeof id !== 'string' ||
      !slots.has(id) ||
      !parent ||
      i === undefined
    )
      return
    ;(parent.children as HastContent[])[i] = {
      type: 'raw',
      value: slots.get(id) as string,
    } as never
  })

  return unified()
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(out as never)
}
