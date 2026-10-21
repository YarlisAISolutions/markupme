import type { Nodes, Root, RootContent } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'

function block(node: RootContent, depth: number): string {
  switch (node.type) {
    case 'heading':
    case 'paragraph':
      return mdToString(node)
    case 'code':
      return node.value
    case 'math':
      return node.value
    case 'blockquote':
      return node.children
        .map((c) => block(c, depth))
        .join('\n\n')
        .replace(/^/gm, '> ')
    case 'list':
      return node.children
        .map((item, i) => {
          const marker = node.ordered ? `${(node.start ?? 1) + i}.` : '-'
          const check = item.checked === true ? '[x] ' : item.checked === false ? '[ ] ' : ''
          const body = item.children.map((c) => block(c, depth + 1)).join('\n')
          return `${'  '.repeat(depth)}${marker} ${check}${body.trimStart()}`
        })
        .join('\n')
    case 'table':
      return node.children
        .map((row) => row.children.map((cell) => mdToString(cell)).join('\t'))
        .join('\n')
    case 'thematicBreak':
      return '---'
    case 'yaml':
    case 'toml':
    case 'html':
    case 'definition':
      return ''
    default:
      return 'children' in node
        ? (node.children as RootContent[]).map((c) => block(c, depth)).join('\n\n')
        : mdToString(node as Nodes)
  }
}

/** Plain text: block structure kept as blank lines, lists and tables kept readable. */
export function renderText(tree: Root): string {
  return `${tree.children
    .map((n) => block(n, 0))
    .filter((s) => s.trim() !== '')
    .join('\n\n')}\n`
}
