import GithubSlugger from 'github-slugger'
import type { Heading, Root, Text } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Diagnostic } from '../types.js'

const CUSTOM_ID = /\s*\{#([A-Za-z][\w:.-]*)\}\s*$/

export function headingId(node: Heading): string | undefined {
  const id = (node.data?.hProperties as { id?: unknown } | undefined)?.id
  return typeof id === 'string' ? id : undefined
}

/**
 * Gives every heading a GitHub-compatible id in `data.hProperties.id`.
 * A trailing `{#custom-id}` sets the id explicitly; the marker is kept in `data.customId` so
 * serialization can write it back.
 */
export function addHeadingIds(tree: Root, report: (d: Diagnostic) => void): void {
  const slugger = new GithubSlugger()
  const seen = new Map<string, number>()
  visit(tree, 'heading', (node: Heading) => {
    let id: string | undefined
    const last = node.children[node.children.length - 1]
    if (last && last.type === 'text') {
      const m = CUSTOM_ID.exec(last.value)
      if (m?.[1]) {
        id = m[1]
        ;(last as Text).value = last.value.slice(0, m.index)
        if ((last as Text).value === '') node.children.pop()
        node.data = { ...node.data, customId: id } as Heading['data']
        slugger.slug(id)
      }
    }
    id ??= slugger.slug(mdToString(node))
    if (seen.has(id)) {
      report({
        code: 'MM003',
        rule: 'duplicate-heading-id',
        severity: 'warning',
        message: `Heading id "${id}" is already used on line ${seen.get(id)}`,
        line: node.position?.start.line,
        column: node.position?.start.column,
      })
    } else seen.set(id, node.position?.start.line ?? 0)
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } }
  })
}

export interface OutlineItem {
  depth: number
  text: string
  id: string
  line?: number
  children: OutlineItem[]
}

/** The heading tree of a document. */
export function outline(tree: Root): OutlineItem[] {
  const roots: OutlineItem[] = []
  const stack: OutlineItem[] = []
  visit(tree, 'heading', (node: Heading) => {
    const item: OutlineItem = {
      depth: node.depth,
      text: mdToString(node),
      id: headingId(node) ?? '',
      line: node.position?.start.line,
      children: [],
    }
    while (stack.length > 0 && (stack[stack.length - 1] as OutlineItem).depth >= item.depth)
      stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(item)
    else roots.push(item)
    stack.push(item)
  })
  return roots
}
