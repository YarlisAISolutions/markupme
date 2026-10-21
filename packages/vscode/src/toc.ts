import { buildToc, type Processor, type TocOptions } from '@markupme/core'
import type { Html, RootContent } from 'mdast'

/** Same markers as the core TOC plugin. */
const OPEN = /^<!--\s*toc\s*-->$/i
const CLOSE = /^<!--\s*(?:tocstop|\/toc)\s*-->$/i

export interface TextEdit {
  /** Start offset in the source (UTF-16 code units, like VS Code offsets). */
  start: number
  /** End offset (exclusive). Equal to `start` for an insertion. */
  end: number
  text: string
}

export type TocEditResult =
  | { kind: 'replace' | 'insert'; edit: TextEdit }
  | { kind: 'unchanged' }
  | { kind: 'empty' }

const isHtml = (n: RootContent, re: RegExp) =>
  n.type === 'html' && re.test((n as Html).value.trim())

/**
 * Computes the single edit that inserts or refreshes a table of contents, without touching the
 * rest of the document. An existing `<!-- toc --> … <!-- tocstop -->` region is replaced;
 * otherwise the TOC goes after the first h1 (or after the frontmatter when there is none).
 * `processor` must be created with `toc: false` so the markers stay in the tree.
 */
export function computeTocEdit(
  source: string,
  processor: Processor,
  opts: TocOptions = {},
): TocEditResult {
  const doc = processor.parse(source)
  const toc = buildToc(doc.tree, opts)
  if ((toc.children[0]?.children.length ?? 0) === 0) return { kind: 'empty' }
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const block = processor
    .serialize({ type: 'root', children: [toc] })
    .trimEnd()
    .replace(/\r?\n/g, eol)
  const kids = doc.tree.children

  const open = kids.findIndex((n) => isHtml(n, OPEN))
  if (open >= 0) {
    const start = kids[open]?.position?.start.offset
    let close = -1
    for (let i = open + 1; i < kids.length; i++)
      if (isHtml(kids[i] as RootContent, CLOSE)) {
        close = i
        break
      }
    const end = kids[close >= 0 ? close : open]?.position?.end.offset
    if (start === undefined || end === undefined) return { kind: 'empty' }
    if (source.slice(start, end) === block) return { kind: 'unchanged' }
    return { kind: 'replace', edit: { start, end, text: block } }
  }

  const h1 = kids.find((n) => n.type === 'heading' && n.depth === 1)
  const h1End = h1?.position?.end.offset
  if (h1End !== undefined) {
    const after = source.slice(h1End)
    const blankFollows = after.startsWith(`${eol}${eol}`) || after.trim() === ''
    const suffix = after === '' ? eol : blankFollows ? '' : eol
    return {
      kind: 'insert',
      edit: { start: h1End, end: h1End, text: `${eol}${eol}${block}${suffix}` },
    }
  }

  // A non-empty TOC means there are headings, so a non-frontmatter node exists.
  const first = kids.find((n) => n.type !== 'yaml' && n.type !== 'toml')
  const at = first?.position?.start.offset
  if (at === undefined) return { kind: 'empty' }
  return { kind: 'insert', edit: { start: at, end: at, text: `${block}${eol}${eol}` } }
}

/** Applies a text edit to a string (for tests and previews). */
export function applyEdit(source: string, e: TextEdit): string {
  return source.slice(0, e.start) + e.text + source.slice(e.end)
}
