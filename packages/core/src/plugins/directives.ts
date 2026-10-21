import type { Properties } from 'hast'
import type { Paragraph, Root, RootContent } from 'mdast'
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive'
import { toString as mdToString } from 'mdast-util-to-string'
import { SKIP, visit } from 'unist-util-visit'
import type { Diagnostic } from '../types.js'

/** `:::name` containers rendered as callout boxes. */
export const CALLOUTS = [
  'note',
  'tip',
  'info',
  'important',
  'warning',
  'caution',
  'danger',
  'success',
]
export const CONTAINERS = [...CALLOUTS, 'details', 'figure', 'columns', 'column']
/** `:name[label]` inline directives. */
export const TEXT_DIRECTIVES = ['kbd', 'abbr', 'mark', 'sub', 'sup', 'badge']
/** `::name` leaf directives. `toc` is handled by the TOC plugin. */
export const LEAF_DIRECTIVES = ['toc', 'br']

type AnyDirective = ContainerDirective | LeafDirective | TextDirective

function isLabel(node: RootContent | undefined): node is Paragraph {
  return (
    node?.type === 'paragraph' &&
    (node.data as { directiveLabel?: boolean })?.directiveLabel === true
  )
}

/**
 * Parse time: a text directive with no label and no attributes (`10:30`, `note:this`) is almost
 * always prose, so it goes back to plain text. Unknown directives are reported, never dropped.
 */
export function normalizeDirectives(tree: Root, report: (d: Diagnostic) => void): void {
  visit(tree, (node, index, parent) => {
    if (
      node.type !== 'textDirective' &&
      node.type !== 'leafDirective' &&
      node.type !== 'containerDirective'
    )
      return
    const d = node as AnyDirective
    const hasAttrs = d.attributes && Object.keys(d.attributes).length > 0
    if (
      d.type === 'textDirective' &&
      d.children.length === 0 &&
      !hasAttrs &&
      parent &&
      index !== undefined
    ) {
      parent.children.splice(index, 1, { type: 'text', value: `:${d.name}` } as never)
      return [SKIP, index]
    }
    const known =
      d.type === 'textDirective'
        ? TEXT_DIRECTIVES
        : d.type === 'leafDirective'
          ? LEAF_DIRECTIVES
          : CONTAINERS
    if (!known.includes(d.name)) {
      report({
        code: 'MM009',
        rule: 'unknown-directive',
        severity: 'warning',
        message: `Unknown directive "${d.name}" (${d.type.replace('Directive', '')}); its content is rendered as-is`,
        line: d.position?.start.line,
        column: d.position?.start.column,
      })
    }
    return undefined
  })
}

function setH(node: AnyDirective, hName: string, hProperties: Properties = {}) {
  node.data = { ...node.data, hName, hProperties: { ...hProperties } }
}

/** Render time (on a copy): maps directives to HTML elements. */
export function presentDirectives(tree: Root): void {
  visit(tree, (node) => {
    if (
      node.type !== 'textDirective' &&
      node.type !== 'leafDirective' &&
      node.type !== 'containerDirective'
    )
      return
    const d = node as AnyDirective
    const attrs = d.attributes ?? {}
    if (d.type === 'containerDirective') {
      const label = isLabel(d.children[0]) ? (d.children.shift() as Paragraph) : undefined
      const title = attrs.title ?? (label ? mdToString(label) : undefined)
      if (CALLOUTS.includes(d.name)) {
        setH(d, 'div', { className: ['mm-callout', `mm-callout-${d.name}`], role: 'note' })
        const heading = title ?? d.name.charAt(0).toUpperCase() + d.name.slice(1)
        d.children.unshift({
          type: 'paragraph',
          children: label && !attrs.title ? label.children : [{ type: 'text', value: heading }],
          data: { hProperties: { className: ['mm-callout-title'] } },
        })
      } else if (d.name === 'details') {
        setH(d, 'details', attrs.open !== undefined ? { open: true } : {})
        d.children.unshift({
          type: 'paragraph',
          children: label ? label.children : [{ type: 'text', value: title ?? 'Details' }],
          data: { hName: 'summary' },
        })
      } else if (d.name === 'figure') {
        setH(d, 'figure', { className: ['mm-figure'] })
        if (label)
          d.children.push({
            type: 'paragraph',
            children: label.children,
            data: { hName: 'figcaption' },
          })
      } else if (d.name === 'columns') setH(d, 'div', { className: ['mm-columns'] })
      else if (d.name === 'column') setH(d, 'div', { className: ['mm-column'] })
      else setH(d, 'div', { className: ['mm-directive', `mm-directive-${d.name}`] })
    } else if (d.type === 'textDirective') {
      if (d.name === 'kbd' || d.name === 'mark' || d.name === 'sub' || d.name === 'sup')
        setH(d, d.name)
      else if (d.name === 'abbr') setH(d, 'abbr', attrs.title ? { title: attrs.title } : {})
      else if (d.name === 'badge')
        setH(d, 'span', { className: ['mm-badge', `mm-badge-${attrs.type ?? 'default'}`] })
      else setH(d, 'span', { className: ['mm-directive', `mm-directive-${d.name}`] })
    } else {
      if (d.name === 'br') setH(d, 'br')
      else setH(d, 'div', { className: ['mm-directive', `mm-directive-${d.name}`] })
    }
  })
}
