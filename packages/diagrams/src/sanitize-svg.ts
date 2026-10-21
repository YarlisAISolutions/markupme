import type { Element, Root } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import { toHtml } from 'hast-util-to-html'
import { SKIP, visit } from 'unist-util-visit'

const BLOCKED = new Set([
  'script',
  'foreignobject',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'image',
  'animate',
  'set',
  'animateMotion',
  'animateTransform',
  'handler',
  'listener',
])
const URL_PROPS = ['href', 'xLinkHref', 'src', 'action', 'formAction']
const SAFE_URL = /^(?:#|https?:|mailto:)/i

/**
 * Makes diagram SVG safe to inline. Diagram labels and Graphviz `URL=` attributes are user input,
 * and Kroki responses come from a server, so every SVG is parsed and cleaned: no scripts,
 * no foreignObject, no event handlers, no `javascript:`/`data:` links, no external CSS.
 */
export function sanitizeSvg(svg: string): string {
  const tree: Root = fromHtml(svg, { fragment: true, space: 'svg' })
  visit(tree, (node, index, parent) => {
    if (node.type === 'comment' || node.type === 'doctype') {
      if (parent && index !== undefined) {
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
      return undefined
    }
    if (node.type !== 'element') return undefined
    const el = node as Element
    if (BLOCKED.has(el.tagName) && parent && index !== undefined) {
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
    for (const key of Object.keys(el.properties)) {
      const value = el.properties[key]
      if (/^on/i.test(key)) delete el.properties[key]
      else if (URL_PROPS.includes(key) && typeof value === 'string' && !SAFE_URL.test(value.trim()))
        delete el.properties[key]
      else if (
        key === 'style' &&
        typeof value === 'string' &&
        /url\(|expression|@import/i.test(value)
      )
        delete el.properties[key]
    }
    if (el.tagName === 'style') {
      const css = el.children.map((c) => (c.type === 'text' ? c.value : '')).join('')
      if (/@import|url\(\s*['"]?(?!#)/i.test(css)) el.children = []
    }
    return undefined
  })
  return toHtml(tree, { space: 'svg' })
}
