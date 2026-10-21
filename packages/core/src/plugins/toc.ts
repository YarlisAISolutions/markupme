import type { Html, List, ListItem, Paragraph, Parent, Root, RootContent } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import type { TocOptions } from '../types.js'
import { type OutlineItem, outline } from './headings.js'

/** mdast node holding a generated table of contents. Serialized between `<!-- toc -->` markers. */
export interface TocNode extends Parent {
  type: 'toc'
  children: List[]
}

declare module 'mdast' {
  interface RootContentMap {
    toc: TocNode
  }
}

const OPEN = /^<!--\s*toc\s*-->$/i
const CLOSE = /^<!--\s*(?:tocstop|\/toc)\s*-->$/i
const INLINE_MARKER = /^\[\[?toc\]\]?$/i

function isMarker(node: RootContent): boolean {
  if (node.type === 'paragraph') return INLINE_MARKER.test(mdToString(node).trim())
  if (node.type === 'leafDirective') return node.name === 'toc'
  return false
}

function flatten(items: OutlineItem[], min: number, max: number): OutlineItem[] {
  const out: OutlineItem[] = []
  for (const item of items) {
    if (item.depth >= min && item.depth <= max) {
      out.push({ ...item, children: flatten(item.children, min, max) })
    } else out.push(...flatten(item.children, min, max))
  }
  return out
}

function toList(items: OutlineItem[]): List {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: items.map(
      (item): ListItem => ({
        type: 'listItem',
        spread: false,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: `#${item.id}`,
                children: [{ type: 'text', value: item.text }],
              },
            ],
          } satisfies Paragraph,
          ...(item.children.length > 0 ? [toList(item.children)] : []),
        ],
      }),
    ),
  }
}

export function buildToc(tree: Root, opts: TocOptions = {}): TocNode {
  const min = opts.minDepth ?? 2
  const max = opts.maxDepth ?? 3
  return {
    type: 'toc',
    children: [toList(flatten(outline(tree), min, max))],
    data: {
      hName: 'nav',
      hProperties: { className: ['mm-toc'], ariaLabel: opts.title ?? 'Table of contents' },
    },
  }
}

/**
 * Replaces `[[toc]]`, `::toc` and `<!-- toc --> … <!-- tocstop -->` with a generated TOC.
 * Returns true when a TOC was placed.
 */
export function insertToc(tree: Root, opts: TocOptions = {}): boolean {
  const kids = tree.children
  let placed = false
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i] as RootContent
    if (node.type === 'html' && OPEN.test((node as Html).value.trim())) {
      let end = i + 1
      while (end < kids.length) {
        const n = kids[end] as RootContent
        if (n.type === 'html' && CLOSE.test((n as Html).value.trim())) break
        end++
      }
      const removeTo = end < kids.length ? end + 1 : i + 1
      kids.splice(i, removeTo - i, buildToc(tree, opts))
      placed = true
    } else if (isMarker(node)) {
      kids.splice(i, 1, buildToc(tree, opts))
      placed = true
    }
  }
  const empty = (buildToc(tree, opts).children[0]?.children.length ?? 0) === 0
  if (!placed && !empty && opts.position && opts.position !== 'marker-only') {
    let at = 0
    if (opts.position === 'after-title') {
      const h1 = kids.findIndex((n) => n.type === 'heading' && n.depth === 1)
      at = h1 >= 0 ? h1 + 1 : kids.findIndex((n) => n.type !== 'yaml' && n.type !== 'toml')
      if (at < 0) at = kids.length
    } else {
      const fm = kids.findIndex((n) => n.type !== 'yaml' && n.type !== 'toml')
      at = fm < 0 ? kids.length : fm
    }
    kids.splice(at, 0, buildToc(tree, opts))
    placed = true
  }
  return placed
}
