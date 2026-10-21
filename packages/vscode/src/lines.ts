import type { MarkupMePlugin } from '@markupme/core'
import type { Nodes, PhrasingContent, Root } from 'mdast'

/** Class prefix that carries a block's 1-based source line into the preview HTML. */
export const LINE_CLASS_PREFIX = 'mm-line-'

type WithData = { data?: { hProperties?: Record<string, unknown> } }

function addClass(node: Nodes, line: number): void {
  const n = node as WithData
  const props = { ...(n.data?.hProperties ?? {}) }
  const existing = props.className
  const list = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === 'string'
      ? existing.split(/\s+/).filter(Boolean)
      : []
  props.className = [...list, `${LINE_CLASS_PREFIX}${line}`]
  n.data = { ...(n.data ?? {}), hProperties: props }
}

/**
 * An empty `<span class="mm-line-N">`. GitHub's sanitize schema only allows fixed classes on some
 * elements (`h2`, `li`, `ul`, `ol`), so headings and list items carry their line in a marker child.
 */
function marker(line: number): PhrasingContent {
  return {
    type: 'mmLine',
    data: { hName: 'span', hProperties: { className: [`${LINE_CLASS_PREFIX}${line}`] } },
  } as unknown as PhrasingContent
}

/** Whether a block can carry a line class on its own element. */
function taggable(node: Nodes): boolean {
  switch (node.type as string) {
    case 'paragraph':
    case 'blockquote':
    case 'table':
    case 'thematicBreak':
    case 'containerDirective':
    case 'leafDirective':
      return true
    default:
      return false
  }
}

/** Tags blocks with their source line so the preview can follow the editor. */
export function tagSourceLines(tree: Root): void {
  const walk = (node: Nodes) => {
    const line = node.position?.start.line
    if (line !== undefined) {
      if (node.type === 'heading') node.children.unshift(marker(line))
      else if (node.type === 'listItem') {
        const first = node.children[0]
        if (first?.type === 'paragraph') first.children.unshift(marker(line))
      } else if (taggable(node)) addClass(node, line)
    }
    if ('children' in node) for (const child of node.children) walk(child as Nodes)
  }
  for (const child of tree.children) walk(child as Nodes)
}

/** A render-only plugin: it changes the copy of the tree that becomes HTML, never the source. */
export const sourceLinePlugin: MarkupMePlugin = {
  name: 'markupme-vscode-source-lines',
  render: (tree) => tagSourceLines(tree),
}

/** Reads the source line from a class list (`mm-line-12` → 12). */
export function lineFromClassName(className: string): number | undefined {
  const m = new RegExp(`(?:^|\\s)${LINE_CLASS_PREFIX}(\\d+)(?:\\s|$)`).exec(className)
  return m?.[1] ? Number(m[1]) : undefined
}

export interface BlockPosition {
  line: number
  top: number
}

/**
 * Where to scroll for a 1-based editor line, given blocks sorted by line with their offsets.
 * Interpolates between the nearest block at or above the line and the next one.
 */
export function scrollTopForLine(blocks: BlockPosition[], line: number): number | undefined {
  if (blocks.length === 0) return undefined
  let lo = 0
  let hi = blocks.length - 1
  let at = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((blocks[mid] as BlockPosition).line <= line) {
      at = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (at < 0) return 0
  const cur = blocks[at] as BlockPosition
  const next = blocks[at + 1]
  if (!next || next.line === cur.line) return cur.top
  const ratio = Math.min(1, Math.max(0, (line - cur.line) / (next.line - cur.line)))
  return cur.top + (next.top - cur.top) * ratio
}

/** The nearest block at or above a line (its index), or -1 when the line is above every block. */
export function nearestBlock(lines: number[], line: number): number {
  let at = -1
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] as number) <= line) at = i
    else break
  }
  return at
}
