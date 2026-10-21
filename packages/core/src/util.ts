import type { Nodes, Root, RootContent } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'

export { visit }

/** All nodes of a type (or matching a predicate), in document order. */
export function query<T extends Nodes['type']>(tree: Root, type: T): Extract<Nodes, { type: T }>[]
export function query(tree: Root, test: (node: Nodes) => boolean): Nodes[]
export function query(tree: Root, test: string | ((node: Nodes) => boolean)): Nodes[] {
  const out: Nodes[] = []
  visit(tree, (node) => {
    if (typeof test === 'string' ? node.type === test : test(node as Nodes)) out.push(node as Nodes)
  })
  return out
}

/** Removes `position` (and optionally `data`) so trees can be compared structurally. */
export function stripPositions<T>(node: T, dropData = false): T {
  return JSON.parse(
    JSON.stringify(node, (key, value) =>
      key === 'position' || (dropData && key === 'data') ? undefined : value,
    ),
  )
}

export interface DocumentStats {
  words: number
  characters: number
  readingMinutes: number
  headings: number
  paragraphs: number
  links: number
  images: number
  tables: number
  codeBlocks: number
  footnotes: number
  tasks: { total: number; done: number }
  languages: Record<string, number>
}

/** Counts that help writers and dashboards. Reading time assumes 230 words a minute. */
export function stats(tree: Root): DocumentStats {
  const s: DocumentStats = {
    words: 0,
    characters: 0,
    readingMinutes: 0,
    headings: 0,
    paragraphs: 0,
    links: 0,
    images: 0,
    tables: 0,
    codeBlocks: 0,
    footnotes: 0,
    tasks: { total: 0, done: 0 },
    languages: {},
  }
  visit(tree, (node) => {
    switch (node.type) {
      case 'text':
      case 'inlineCode': {
        const v = (node as { value: string }).value
        s.characters += v.length
        s.words += v.split(/\s+/).filter(Boolean).length
        break
      }
      case 'heading':
        s.headings++
        break
      case 'paragraph':
        s.paragraphs++
        break
      case 'link':
        s.links++
        break
      case 'image':
        s.images++
        break
      case 'table':
        s.tables++
        break
      case 'footnoteDefinition':
        s.footnotes++
        break
      case 'code': {
        s.codeBlocks++
        const lang = node.lang ?? 'text'
        s.languages[lang] = (s.languages[lang] ?? 0) + 1
        break
      }
      case 'listItem':
        if (typeof node.checked === 'boolean') {
          s.tasks.total++
          if (node.checked) s.tasks.done++
        }
        break
    }
  })
  s.readingMinutes = Math.max(1, Math.round(s.words / 230))
  return s
}

export interface BlockChange {
  kind: 'added' | 'removed' | 'changed'
  /** Block index in the old document (removed/changed) or the new one (added). */
  index: number
  type: string
  before?: string
  after?: string
  line?: number
}

function key(node: RootContent): string {
  return JSON.stringify(stripPositions(node, true))
}

function preview(node: RootContent): string {
  const text = mdToString(node as Nodes)
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 80 ? `${text.slice(0, 77)}...` : text || `[${node.type}]`
}

/**
 * Block-level structural diff (longest common subsequence over top-level blocks).
 * A removal followed by an addition of the same block type is reported as one change.
 */
export function diff(a: Root, b: Root): BlockChange[] {
  const A = a.children
  const B = b.children
  const ka = A.map(key)
  const kb = B.map(key)
  const n = A.length
  const m = B.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      (lcs[i] as number[])[j] =
        ka[i] === kb[j]
          ? ((lcs[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((lcs[i + 1] as number[])[j] as number, (lcs[i] as number[])[j + 1] as number)
  const raw: BlockChange[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && ka[i] === kb[j]) {
      i++
      j++
    } else if (
      i < n &&
      (j >= m || ((lcs[i + 1] as number[])[j] as number) >= ((lcs[i] as number[])[j + 1] as number))
    ) {
      const node = A[i] as RootContent
      raw.push({
        kind: 'removed',
        index: i,
        type: node.type,
        before: preview(node),
        line: node.position?.start.line,
      })
      i++
    } else {
      const node = B[j] as RootContent
      raw.push({
        kind: 'added',
        index: j,
        type: node.type,
        after: preview(node),
        line: node.position?.start.line,
      })
      j++
    }
  }
  const out: BlockChange[] = []
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k] as BlockChange
    const next = raw[k + 1]
    if (cur.kind === 'removed' && next?.kind === 'added' && next.type === cur.type) {
      out.push({
        kind: 'changed',
        index: cur.index,
        type: cur.type,
        before: cur.before,
        after: next.after,
        line: next.line,
      })
      k++
    } else out.push(cur)
  }
  return out
}
