import type { OutlineItem } from '@markupme/core'
import { h } from './dom.js'

export interface OutlineView {
  update(items: OutlineItem[]): void
  /** Marks the heading that contains this source line as current. */
  setCurrentLine(line: number): void
}

/** The heading tree. Clicking an entry calls `onSelect` with the heading's line and id. */
export function createOutline(
  tree: HTMLUListElement,
  empty: HTMLElement,
  onSelect: (item: OutlineItem) => void,
): OutlineView {
  let flat: { item: OutlineItem; button: HTMLButtonElement }[] = []
  let signature = ''

  const build = (items: OutlineItem[], parent: HTMLUListElement) => {
    for (const item of items) {
      const li = h('li')
      const button = h('button', { type: 'button', class: `outline-item depth-${item.depth}` })
      button.textContent = item.text || '(untitled)'
      button.addEventListener('click', () => onSelect(item))
      li.append(button)
      flat.push({ item, button })
      if (item.children.length > 0) {
        const ul = h('ul')
        build(item.children, ul)
        li.append(ul)
      }
      parent.append(li)
    }
  }

  return {
    update(items) {
      const next = JSON.stringify(items, ['depth', 'text', 'id', 'line', 'children'])
      if (next === signature) return
      signature = next
      flat = []
      tree.replaceChildren()
      build(items, tree)
      empty.hidden = items.length > 0
    },
    setCurrentLine(line) {
      let current: HTMLButtonElement | undefined
      for (const { item, button } of flat) if ((item.line ?? 0) <= line) current = button
      for (const { button } of flat) {
        if (button === current) button.setAttribute('aria-current', 'location')
        else button.removeAttribute('aria-current')
      }
    },
  }
}
