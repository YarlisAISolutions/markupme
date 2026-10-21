import { h } from './dom.js'
import type { Settings, TocPosition } from './storage.js'

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

const SWITCHES: { key: BoolKey; label: string; hint: string }[] = [
  { key: 'gfm', label: 'GitHub Flavored Markdown', hint: 'Tables, task lists, footnotes' },
  { key: 'math', label: 'Math', hint: '$inline$ and $$block$$ with KaTeX' },
  { key: 'emoji', label: 'Emoji shortcodes', hint: ':rocket: becomes 🚀' },
  { key: 'diagrams', label: 'Diagrams', hint: 'Mermaid, Graphviz and Blueprint' },
  { key: 'anchors', label: 'Heading anchors', hint: '# links next to headings' },
  { key: 'editorLineNumbers', label: 'Editor line numbers', hint: 'Gutter in the source editor' },
  { key: 'codeLineNumbers', label: 'Code block line numbers', hint: 'In the preview' },
]

const TOC: { value: TocPosition; label: string }[] = [
  { value: 'marker-only', label: 'Only at [[toc]]' },
  { value: 'top', label: 'Top of document' },
  { value: 'after-title', label: 'After the title' },
]

/** Builds the settings controls. `onChange` receives the full new settings. */
export function createSettingsPanel(
  list: HTMLElement,
  get: () => Settings,
  onChange: (next: Settings) => void,
): { sync(): void } {
  const switches = new Map<BoolKey, HTMLButtonElement>()
  for (const s of SWITCHES) {
    const row = h('div', { class: 'setting-row' })
    const id = `st-setting-${s.key}`
    const text = h('span', { class: 'setting-text' })
    text.append(h('span', { class: 'setting-label', id: `${id}-label` }, s.label))
    text.append(h('span', { class: 'setting-hint', id: `${id}-hint` }, s.hint))
    const btn = h('button', {
      type: 'button',
      role: 'switch',
      class: 'switch',
      id,
      'aria-labelledby': `${id}-label`,
      'aria-describedby': `${id}-hint`,
      'aria-checked': 'false',
      'data-testid': `setting-${s.key}`,
    })
    btn.append(h('span', { class: 'switch-thumb', 'aria-hidden': 'true' }))
    btn.addEventListener('click', () => onChange({ ...get(), [s.key]: !get()[s.key] }))
    text.addEventListener('click', () => btn.click())
    row.append(text, btn)
    list.append(row)
    switches.set(s.key, btn)
  }
  const row = h('div', { class: 'setting-row' })
  const label = h('label', { class: 'setting-text', for: 'st-setting-toc' })
  label.append(h('span', { class: 'setting-label' }, 'Table of contents'))
  label.append(h('span', { class: 'setting-hint' }, 'Where the generated TOC goes'))
  const select = h('select', {
    id: 'st-setting-toc',
    class: 'select',
    'data-testid': 'setting-toc',
  })
  for (const o of TOC) select.append(h('option', { value: o.value }, o.label))
  select.addEventListener('change', () =>
    onChange({ ...get(), tocPosition: select.value as TocPosition }),
  )
  row.append(label, select)
  list.append(row)

  const sync = () => {
    const s = get()
    for (const [key, btn] of switches) btn.setAttribute('aria-checked', String(s[key]))
    select.value = s.tocPosition
  }
  sync()
  return { sync }
}
