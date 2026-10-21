import type { Blockquote, Paragraph, Root } from 'mdast'
import { visit } from 'unist-util-visit'

export const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type AlertType = (typeof ALERT_TYPES)[number]

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i

export const ALERT_TITLES: Record<AlertType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

/** Parse time: records `data.alert` on `> [!NOTE]` blockquotes. The tree text is untouched. */
export function annotateAlerts(tree: Root): void {
  visit(tree, 'blockquote', (node: Blockquote) => {
    const first = node.children[0]
    if (first?.type !== 'paragraph') return
    const text = first.children[0]
    if (text?.type !== 'text') return
    const m = MARKER.exec(text.value)
    if (!m?.[1]) return
    node.data = { ...node.data, alert: m[1].toLowerCase() as AlertType } as Blockquote['data']
  })
}

/** Render time (on a copy): turns annotated blockquotes into GitHub-style alert boxes. */
export function presentAlerts(tree: Root): void {
  visit(tree, 'blockquote', (node: Blockquote) => {
    const type = (node.data as { alert?: AlertType } | undefined)?.alert
    if (!type) return
    const first = node.children[0] as Paragraph
    const text = first.children[0]
    if (text?.type === 'text') text.value = text.value.replace(MARKER, '')
    if (first.children.length === 1 && text?.type === 'text' && text.value === '')
      node.children.shift()
    const title: Paragraph = {
      type: 'paragraph',
      children: [{ type: 'text', value: ALERT_TITLES[type] }],
      data: { hProperties: { className: ['markdown-alert-title'] } },
    }
    node.children.unshift(title)
    node.data = {
      ...node.data,
      hName: 'div',
      hProperties: { className: ['markdown-alert', `markdown-alert-${type}`], role: 'note' },
    }
  })
}
