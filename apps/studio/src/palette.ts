import { type Command, filterCommands, formatShortcut } from './commands.js'
import { h, isApple } from './dom.js'

export interface Palette {
  open(): void
  close(): void
  readonly isOpen: boolean
}

/**
 * The command palette: a modal `<dialog>` with a combobox input and a listbox. Arrow keys move,
 * Enter runs, Escape closes and focus goes back to where it was.
 */
export function createPalette(
  dialog: HTMLDialogElement,
  input: HTMLInputElement,
  list: HTMLElement,
  empty: HTMLElement,
  commands: () => Command[],
): Palette {
  let shown: Command[] = []
  let active = 0
  let returnFocus: HTMLElement | null = null

  const optionId = (i: number) => `st-command-option-${i}`

  const paint = () => {
    list.replaceChildren()
    shown.forEach((c, i) => {
      const enabled = c.enabled?.() !== false
      const li = h('div', {
        id: optionId(i),
        role: 'option',
        class: 'palette-option',
        'aria-selected': String(i === active),
      })
      if (!enabled) li.setAttribute('aria-disabled', 'true')
      li.append(h('span', { class: 'palette-group' }, c.group))
      li.append(h('span', { class: 'palette-title' }, c.title))
      if (c.shortcut) li.append(h('kbd', { class: 'kbd' }, formatShortcut(c.shortcut, isApple)))
      li.addEventListener('mousedown', (e) => e.preventDefault())
      li.addEventListener('click', () => void choose(i))
      list.append(li)
    })
    empty.hidden = shown.length > 0
    if (shown.length > 0) {
      input.setAttribute('aria-activedescendant', optionId(active))
      document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
  }

  const refresh = () => {
    shown = filterCommands(commands(), input.value)
    active = 0
    paint()
  }

  const close = () => {
    if (dialog.open) dialog.close()
  }

  const choose = async (i: number) => {
    const c = shown[i]
    if (!c || c.enabled?.() === false) return
    close()
    await c.run()
  }

  input.addEventListener('input', refresh)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (shown.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      active = (active + step + shown.length) % shown.length
      paint()
    } else if (e.key === 'Home' && e.ctrlKey) {
      active = 0
      paint()
    } else if (e.key === 'End' && e.ctrlKey) {
      active = Math.max(shown.length - 1, 0)
      paint()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void choose(active)
    }
  })
  dialog.addEventListener('click', (e) => {
    // A click on the backdrop lands on the dialog element itself.
    if (e.target === dialog) close()
  })
  dialog.addEventListener('close', () => {
    const target = returnFocus
    returnFocus = null
    // Commands that move focus (into the editor) run after close; only restore if nothing did.
    queueMicrotask(() => {
      if (target && (document.activeElement === document.body || document.activeElement === null))
        target.focus()
    })
  })

  return {
    open() {
      if (dialog.open) return
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      input.value = ''
      refresh()
      dialog.showModal()
      input.focus()
    },
    close,
    get isOpen() {
      return dialog.open
    },
  }
}
