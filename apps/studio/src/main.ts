import './styles.css'
import { redo, undo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import type { Diagnostic, OutlineItem } from '@markupme/core'
import { markupmeCss } from '@markupme/themes'
import { type Command, createRegistry, formatShortcut } from './commands.js'
import { byId, h, isApple } from './dom.js'
import { Editor } from './editor.js'
import { copyText, download, exportableHtml, fileName, standaloneHtml } from './export.js'
import {
  codeBlock,
  cycleHeading,
  insertBlock,
  insertLink,
  MERMAID_TEMPLATE,
  TABLE_TEMPLATE,
  TOC_MARKER,
  toggleTaskList,
  toggleWrap,
} from './format.js'
import { createOutline } from './outline.js'
import { createPalette } from './palette.js'
import { type EffectiveTheme, Preview, type RenderOutcome } from './preview.js'
import { SAMPLE } from './sample.js'
import { createSettingsPanel } from './settings.js'
import {
  KEYS,
  nextTheme,
  parseSettings,
  parseTheme,
  type Settings,
  safeStorage,
  type ThemeChoice,
} from './storage.js'
import { previewOffsetForLine } from './sync.js'

type Mode = 'source' | 'split' | 'preview' | 'readonly'
const MODES: Mode[] = ['source', 'split', 'preview', 'readonly']
const MODE_LABELS: Record<Mode, string> = {
  source: 'Source',
  split: 'Split',
  preview: 'Preview',
  readonly: 'Read-only',
}

declare global {
  interface Window {
    markupmeStudio?: {
      setMarkdown(text: string): Promise<void>
      getMarkdown(): string
      /** Resolves when the preview (including Mermaid) has caught up. */
      whenRendered(): Promise<void>
    }
  }
}

// Theme styles for rendered Markdown, shared with exported pages.
document.head.append(h('style', { id: 'st-markupme-css' }, markupmeCss))

const storage = safeStorage()
let settings: Settings = parseSettings(storage.get(KEYS.settings))
let themeChoice: ThemeChoice = parseTheme(storage.get(KEYS.theme))
let docName: string | undefined = storage.get(KEYS.name) ?? undefined
let mode: Mode = 'split'
let lastEditMode: Mode = 'split'
let focusMode = false

const studio = byId('studio')
const systemDark = matchMedia('(prefers-color-scheme: dark)')
const narrow = matchMedia('(max-width: 859.98px)')

const effectiveTheme = (): EffectiveTheme =>
  themeChoice === 'auto' ? (systemDark.matches ? 'dark' : 'light') : themeChoice

const announcer = byId('announcer')
const announce = (msg: string) => {
  announcer.textContent = ''
  // A fresh text node makes screen readers announce repeated messages too.
  setTimeout(() => {
    announcer.textContent = msg
  }, 30)
}

// ----- Save state and autosave -----

const saveState = byId('save-state')
const setSaveState = (text: string, state: 'saved' | 'dirty' | 'warn') => {
  saveState.textContent = text
  saveState.dataset.state = state
}
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
const persistDoc = (text: string) => {
  if (!storage.available) {
    setSaveState('Not saved: browser storage is off', 'warn')
    return
  }
  if (storage.set(KEYS.doc, text)) setSaveState('Saved in this browser', 'saved')
  else setSaveState('Not saved: storage is full', 'warn')
}
const scheduleAutosave = (text: string) => {
  setSaveState('Saving…', 'dirty')
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => persistDoc(text), 400)
}

// ----- Preview -----

const previewScroller = byId('preview')
const article = byId('preview-article')
const preview = new Preview(previewScroller, article, settings, effectiveTheme())
let renderTimer: ReturnType<typeof setTimeout> | undefined
let rendering: Promise<void> = Promise.resolve()

const renderNow = (): Promise<void> => {
  clearTimeout(renderTimer)
  const text = editor.getText()
  rendering = preview.update(text).then(
    (outcome) => {
      if (!outcome) return
      article.setAttribute('aria-busy', 'false')
      showOutcome(outcome)
      syncPreview()
    },
    (error: unknown) => {
      article.setAttribute('aria-busy', 'false')
      showDiagnostics([
        {
          code: 'MM000',
          rule: 'render',
          severity: 'error',
          message: `Preview failed: ${(error as Error).message ?? String(error)}`,
        },
      ])
    },
  )
  return rendering
}
const scheduleRender = () => {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => void renderNow(), 150)
}

// ----- Editor -----

const cursorPos = byId('cursor-pos')
const editorHost = byId('editor')
const dropHint = byId('drop-hint')
const editor = new Editor({
  parent: editorHost,
  doc: storage.get(KEYS.doc) ?? SAMPLE,
  lineNumbers: settings.editorLineNumbers,
  onChange(text) {
    scheduleAutosave(text)
    scheduleRender()
  },
  onCursor(line, col) {
    cursorPos.textContent = `Ln ${line}, Col ${col}`
  },
  onScroll: () => requestSync(),
  onDropFile: (file) => {
    dropHint.hidden = true
    void openFile(file)
  },
})

const editorPane = byId('editor-pane')
editorPane.addEventListener('dragenter', (e) => {
  if (e.dataTransfer?.types.includes('Files') && editable()) dropHint.hidden = false
})
editorPane.addEventListener('dragleave', (e) => {
  if (!editorPane.contains(e.relatedTarget as Node | null)) dropHint.hidden = true
})
editorPane.addEventListener('drop', () => {
  dropHint.hidden = true
})

// ----- Scroll sync (editor → preview) -----

let syncFrame = 0
let suppressSyncUntil = 0
const previewVisible = () =>
  mode === 'preview' ||
  mode === 'readonly' ||
  (mode === 'split' && (!narrow.matches || studio.dataset.pane === 'preview'))
const editorVisible = () =>
  mode === 'source' || (mode === 'split' && (!narrow.matches || studio.dataset.pane === 'editor'))

function syncPreview(): void {
  const line = editor.topLine()
  outlineView.setCurrentLine(Math.floor(line))
  if (performance.now() < suppressSyncUntil) return
  if (mode !== 'split' || !previewVisible()) return
  const max = previewScroller.scrollHeight - previewScroller.clientHeight
  previewScroller.scrollTop = previewOffsetForLine(line, preview.anchors(), editor.lineCount, max)
}
function requestSync(): void {
  if (syncFrame) return
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0
    syncPreview()
  })
}

// ----- Outline -----

const outlineView = createOutline(
  byId<HTMLUListElement>('outline-tree'),
  byId('outline-empty'),
  (item: OutlineItem) => {
    suppressSyncUntil = performance.now() + 400
    if (item.line !== undefined && mode !== 'preview' && mode !== 'readonly')
      editor.goToLine(item.line, false)
    if (narrow.matches && mode === 'split' && studio.dataset.pane !== 'preview') {
      // Stacked layout: the editor is the visible pane, so the jump already happened there.
    } else preview.scrollToId(item.id)
    outlineView.setCurrentLine(item.line ?? 1)
  },
)

// ----- Diagnostics -----

const diagList = byId<HTMLUListElement>('diagnostics-list')
const diagCount = byId('diagnostics-count')
function showDiagnostics(list: Diagnostic[]): void {
  diagCount.textContent = String(list.length)
  diagCount.dataset.severity = list.some((d) => d.severity === 'error')
    ? 'error'
    : list.some((d) => d.severity === 'warning')
      ? 'warning'
      : list.length
        ? 'info'
        : 'none'
  diagList.replaceChildren()
  if (list.length === 0) {
    diagList.append(h('li', { class: 'empty' }, 'No problems found.'))
    return
  }
  for (const d of list) {
    const li = h('li')
    const btn = h('button', { type: 'button', class: `diag diag-${d.severity}` })
    const where = d.line !== undefined ? `Ln ${d.line}${d.column ? `:${d.column}` : ''}` : '—'
    btn.append(h('span', { class: 'diag-sev' }, d.severity))
    btn.append(h('span', { class: 'diag-msg' }, d.message))
    btn.append(h('span', { class: 'diag-rule' }, `${d.rule} ${d.code}`))
    btn.append(h('span', { class: 'diag-line' }, where))
    if (d.line === undefined) btn.disabled = true
    btn.addEventListener('click', () => {
      if (d.line === undefined) return
      if (!editorVisible()) {
        if (mode === 'split') setPane('editor')
        else setMode(mode === 'readonly' ? 'split' : lastEditMode)
      }
      editor.goToLine(d.line)
    })
    li.append(btn)
    diagList.append(li)
  }
}

const problemsToggle = byId('problems-toggle')
problemsToggle.addEventListener('click', () => {
  const open = problemsToggle.getAttribute('aria-expanded') !== 'true'
  problemsToggle.setAttribute('aria-expanded', String(open))
  diagList.hidden = !open
})

// ----- Status -----

const wordCount = byId('word-count')
const readingTime = byId('reading-time')
let currentTitle: string | undefined
function showOutcome(o: RenderOutcome): void {
  outlineView.update(o.outline)
  showDiagnostics(o.diagnostics)
  wordCount.textContent = `${o.stats.words.toLocaleString()} ${o.stats.words === 1 ? 'word' : 'words'}`
  readingTime.textContent = `${o.stats.readingMinutes} min read`
  currentTitle = o.title ?? o.outline[0]?.text
  document.title = currentTitle ? `${currentTitle} · MarkupMe Studio` : 'MarkupMe Studio'
}

// ----- Modes, panes, focus, theme -----

const modeButtons = Array.from(
  byId('view-modes').querySelectorAll<HTMLButtonElement>('button[data-mode]'),
)
const editable = () => mode === 'source' || mode === 'split'
const formatButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(
    '[data-command^="format."], [data-command^="insert."]',
  ),
)

function setMode(next: Mode): void {
  mode = next
  if (next === 'source' || next === 'split') lastEditMode = next
  studio.dataset.mode = next
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === next))
  editor.setReadOnly(next === 'readonly')
  for (const b of formatButtons) b.disabled = !editable()
  // The editor re-measures when it becomes visible again.
  requestAnimationFrame(() => {
    editor.view.requestMeasure()
    syncPreview()
  })
}
for (const b of modeButtons) b.addEventListener('click', () => setMode(b.dataset.mode as Mode))

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.pane-tabs [role="tab"]'))
function setPane(pane: 'editor' | 'preview'): void {
  studio.dataset.pane = pane
  for (const t of tabs) {
    const on = t.dataset.pane === pane
    t.setAttribute('aria-selected', String(on))
    t.tabIndex = on ? 0 : -1
  }
  requestAnimationFrame(() => {
    editor.view.requestMeasure()
    if (pane === 'preview') {
      const max = previewScroller.scrollHeight - previewScroller.clientHeight
      previewScroller.scrollTop = previewOffsetForLine(
        editor.topLine(),
        preview.anchors(),
        editor.lineCount,
        max,
      )
    }
  })
}
for (const t of tabs) {
  t.addEventListener('click', () => setPane(t.dataset.pane as 'editor' | 'preview'))
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = studio.dataset.pane === 'editor' ? 'preview' : 'editor'
    setPane(next)
    tabs.find((x) => x.dataset.pane === next)?.focus()
  })
}

const outlineToggle = byId('outline-toggle')
function setOutlineVisible(on: boolean): void {
  studio.dataset.outline = on ? 'shown' : 'hidden'
  outlineToggle.setAttribute('aria-pressed', String(on))
}
setOutlineVisible(!narrow.matches)
narrow.addEventListener('change', () => {
  setOutlineVisible(!narrow.matches)
  setPane('editor')
})

const focusButton = document.querySelector<HTMLButtonElement>('[data-testid="focus-mode"]')
const focusExit = byId<HTMLButtonElement>('focus-exit')
function setFocusMode(on: boolean): void {
  focusMode = on
  studio.dataset.focus = String(on)
  focusExit.hidden = !on
  focusButton?.setAttribute('aria-pressed', String(on))
  closePopups()
  requestAnimationFrame(() => editor.view.requestMeasure())
  if (on) {
    if (editorVisible()) editor.focus()
    else previewScroller.focus()
    announce('Focus mode on. Press Escape to exit.')
  } else focusButton?.focus()
}
focusExit.addEventListener('click', () => setFocusMode(false))

const themeButton = byId('theme-toggle')
const themeLabel = byId('theme-label')
const THEME_NAMES: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }
function applyTheme(): void {
  const root = document.documentElement
  if (themeChoice === 'auto') delete root.dataset.theme
  else root.dataset.theme = themeChoice
  const next = nextTheme(themeChoice, systemDark.matches)
  themeLabel.textContent = THEME_NAMES[themeChoice]
  themeButton.setAttribute(
    'aria-label',
    `Theme: ${THEME_NAMES[themeChoice]}. Switch to ${THEME_NAMES[next]}`,
  )
  themeButton.title = `Theme: ${THEME_NAMES[themeChoice]} (switch to ${THEME_NAMES[next]})`
  themeButton.dataset.effective = effectiveTheme()
}
let renderedTheme = effectiveTheme()
function onThemeChanged(): void {
  applyTheme()
  const eff = effectiveTheme()
  if (eff !== renderedTheme) {
    renderedTheme = eff
    preview.configure(settings, eff)
    void renderNow()
  }
}
systemDark.addEventListener('change', onThemeChanged)
function cycleTheme(): void {
  themeChoice = nextTheme(themeChoice, systemDark.matches)
  storage.set(KEYS.theme, themeChoice)
  onThemeChanged()
  announce(`Theme: ${THEME_NAMES[themeChoice]}`)
}

// ----- Settings -----

const settingsButton = byId('settings-button')
const settingsPanel = byId('settings-panel')
const settingsView = createSettingsPanel(
  byId('settings-list'),
  () => settings,
  (next) => {
    settings = next
    storage.set(KEYS.settings, JSON.stringify(settings))
    settingsView.sync()
    editor.setLineNumbers(settings.editorLineNumbers)
    preview.configure(settings, effectiveTheme())
    void renderNow()
  },
)
function setSettingsOpen(open: boolean, restoreFocus = true): void {
  settingsPanel.hidden = !open
  settingsButton.setAttribute('aria-expanded', String(open))
  if (open) settingsPanel.querySelector<HTMLElement>('button, select')?.focus()
  else if (restoreFocus) settingsButton.focus()
}
settingsButton.addEventListener('click', () => {
  closeExportMenu(false)
  setSettingsOpen(Boolean(settingsPanel.hidden))
})

// ----- Export menu -----

const exportButton = byId('export-button')
const exportMenu = byId('export-menu')
const menuItems = Array.from(exportMenu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
function openExportMenu(): void {
  setSettingsOpen(false, false)
  exportMenu.hidden = false
  exportButton.setAttribute('aria-expanded', 'true')
  menuItems[0]?.focus()
}
function closeExportMenu(restoreFocus = true): void {
  if (exportMenu.hidden) return
  exportMenu.hidden = true
  exportButton.setAttribute('aria-expanded', 'false')
  if (restoreFocus) exportButton.focus()
}
exportButton.addEventListener('click', () => {
  if (exportMenu.hidden) openExportMenu()
  else closeExportMenu()
})
exportButton.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    openExportMenu()
  }
})
exportMenu.addEventListener('keydown', (e) => {
  const i = menuItems.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    menuItems[(i + step + menuItems.length) % menuItems.length]?.focus()
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault()
    menuItems[e.key === 'Home' ? 0 : menuItems.length - 1]?.focus()
  } else if (e.key === 'Tab') closeExportMenu(false)
})

function closePopups(): boolean {
  const had = !exportMenu.hidden || !settingsPanel.hidden
  closeExportMenu(false)
  if (!settingsPanel.hidden) setSettingsOpen(false, false)
  return had
}
document.addEventListener('pointerdown', (e) => {
  const target = e.target as Node
  if (!exportMenu.hidden && !exportMenu.parentElement?.contains(target)) closeExportMenu(false)
  if (!settingsPanel.hidden && !settingsPanel.parentElement?.contains(target))
    setSettingsOpen(false, false)
})

// ----- Files -----

const MAX_FILE = 5 * 1024 * 1024
const fileInput = byId<HTMLInputElement>('file-input')
async function openFile(file: File): Promise<void> {
  if (!/\.(md|markdown|txt)$/i.test(file.name) && !file.type.startsWith('text/')) {
    announce(`${file.name} is not a Markdown or text file.`)
    setSaveState(`Can't open ${file.name}: not a Markdown file`, 'warn')
    return
  }
  if (file.size > MAX_FILE) {
    setSaveState(`Can't open ${file.name}: larger than 5 MB`, 'warn')
    return
  }
  const text = await file.text()
  docName = file.name
  storage.set(KEYS.name, file.name)
  if (!editable()) setMode(lastEditMode)
  editor.setText(text, { resetHistory: true })
  persistDoc(text)
  await renderNow()
  editor.focus()
  announce(`Opened ${file.name}`)
}
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) void openFile(file)
  fileInput.value = ''
})

const confirmDialog = byId<HTMLDialogElement>('confirm-dialog')
byId('confirm-cancel').addEventListener('click', () => confirmDialog.close('cancel'))
byId('confirm-ok').addEventListener('click', () => confirmDialog.close('ok'))
function newDocument(): void {
  confirmDialog.returnValue = ''
  confirmDialog.showModal()
  byId('confirm-cancel').focus()
  confirmDialog.addEventListener(
    'close',
    () => {
      if (confirmDialog.returnValue !== 'ok') return
      docName = undefined
      storage.remove(KEYS.name)
      if (!editable()) setMode(lastEditMode)
      editor.setText('', { resetHistory: true })
      persistDoc('')
      void renderNow()
      editor.focus()
      announce('New document')
    },
    { once: true },
  )
}

const title = () => currentTitle ?? 'Document'
function saveMarkdown(): void {
  const name = fileName(docName, currentTitle, 'md')
  download(name, editor.getText(), 'text/markdown;charset=utf-8')
  persistDoc(editor.getText())
  announce(`Downloaded ${name}`)
}
async function exportHtml(): Promise<void> {
  await renderNow()
  await preview.whenIdle()
  const name = fileName(docName, currentTitle, 'html')
  download(name, standaloneHtml(article, title(), effectiveTheme()), 'text/html;charset=utf-8')
  announce(`Downloaded ${name}`)
}
async function copyHtml(): Promise<void> {
  await renderNow()
  await preview.whenIdle()
  const ok = await copyText(exportableHtml(article).html)
  announce(ok ? 'HTML copied to the clipboard' : 'The browser blocked clipboard access')
  setSaveState(ok ? 'HTML copied' : 'Copy failed: clipboard blocked', ok ? 'saved' : 'warn')
}

// ----- Preview interactions -----

previewScroller.addEventListener('click', async (e) => {
  const target = e.target instanceof Element ? e.target : null
  const copy = target?.closest<HTMLButtonElement>('.mm-copy')
  if (copy) {
    const code = copy.parentElement?.querySelector('pre code, pre')
    const ok = code ? await copyText((code as HTMLElement).innerText) : false
    copy.textContent = ok ? 'Copied' : 'Press Ctrl+C'
    copy.setAttribute('data-copied', '')
    setTimeout(() => {
      copy.textContent = 'Copy'
      copy.removeAttribute('data-copied')
    }, 1500)
    return
  }
  const link = target?.closest<HTMLAnchorElement>('a[href]')
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  if (href.startsWith('#')) {
    e.preventDefault()
    let id = href.slice(1)
    try {
      id = decodeURIComponent(id)
    } catch {}
    suppressSyncUntil = performance.now() + 400
    preview.scrollToId(id)
  } else if (/^https?:/i.test(href)) {
    e.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
  }
})

// ----- Commands -----

const edit = (fn: Parameters<Editor['apply']>[0]) => () => editor.apply(fn)
const block = (text: string, cursor?: number) =>
  edit((doc, sel) => insertBlock(doc, sel, text, cursor))

const registry = createRegistry()
const add = (c: Command) => registry.add(c)
const formatCommands: Command[] = [
  {
    id: 'format.bold',
    title: 'Bold',
    shortcut: 'Mod-B',
    keywords: ['strong'],
    run: edit((d, s) => toggleWrap(d, s, '**', 'bold text')),
  },
  {
    id: 'format.italic',
    title: 'Italic',
    shortcut: 'Mod-I',
    keywords: ['emphasis'],
    run: edit((d, s) => toggleWrap(d, s, '_', 'italic text')),
  },
  {
    id: 'format.heading',
    title: 'Heading (cycle level)',
    keywords: ['title'],
    run: edit(cycleHeading),
  },
  { id: 'format.link', title: 'Link', keywords: ['url', 'href'], run: edit(insertLink) },
  { id: 'insert.codeBlock', title: 'Code block', keywords: ['fence'], run: edit(codeBlock) },
  { id: 'insert.table', title: 'Insert table', keywords: ['grid'], run: block(TABLE_TEMPLATE, 2) },
  {
    id: 'format.taskList',
    title: 'Task list',
    keywords: ['checkbox', 'todo'],
    run: edit(toggleTaskList),
  },
  {
    id: 'insert.toc',
    title: 'Insert table of contents',
    keywords: ['toc'],
    run: block(TOC_MARKER),
  },
  {
    id: 'insert.mermaid',
    title: 'Insert Mermaid diagram',
    keywords: ['flowchart', 'chart'],
    run: block(MERMAID_TEMPLATE, 11),
  },
].map((c) => ({ ...c, group: 'Format', enabled: editable }))
for (const c of formatCommands) add(c)

const editCommands: Command[] = [
  {
    id: 'edit.undo',
    title: 'Undo',
    shortcut: 'Mod-Z',
    run: () => {
      undo(editor.view)
      editor.focus()
    },
  },
  {
    id: 'edit.redo',
    title: 'Redo',
    shortcut: 'Mod-Shift-Z',
    run: () => {
      redo(editor.view)
      editor.focus()
    },
  },
  {
    id: 'edit.find',
    title: 'Find and replace',
    shortcut: 'Mod-F',
    keywords: ['search'],
    run: () => {
      editor.focus()
      openSearchPanel(editor.view)
    },
  },
].map((c) => ({ ...c, group: 'Edit', enabled: editable }))
for (const c of editCommands) add(c)

add({ id: 'file.new', group: 'File', title: 'New document', keywords: ['clear'], run: newDocument })
add({
  id: 'file.open',
  group: 'File',
  title: 'Open Markdown file…',
  keywords: ['import', 'load'],
  run: () => fileInput.click(),
})
add({
  id: 'file.save',
  group: 'File',
  title: 'Save (download Markdown)',
  shortcut: 'Mod-S',
  run: saveMarkdown,
})
add({ id: 'export.markdown', group: 'Export', title: 'Download Markdown (.md)', run: saveMarkdown })
add({ id: 'export.html', group: 'Export', title: 'Download standalone HTML', run: exportHtml })
add({ id: 'export.copyHtml', group: 'Export', title: 'Copy HTML to clipboard', run: copyHtml })
for (const [i, m] of MODES.entries()) {
  add({
    id: `view.${m}`,
    group: 'View',
    title: `${MODE_LABELS[m]} mode`,
    shortcut: `Mod-Alt-${i + 1}`,
    run: () => setMode(m),
  })
}
const togglePreview = () => setMode(mode === 'preview' ? lastEditMode : 'preview')
add({
  id: 'view.togglePreview',
  group: 'View',
  title: 'Toggle preview',
  shortcut: 'Mod-Shift-P',
  run: togglePreview,
})
add({
  id: 'view.focus',
  group: 'View',
  title: 'Toggle focus mode',
  keywords: ['zen', 'distraction'],
  run: () => setFocusMode(!focusMode),
})
add({
  id: 'view.outline',
  group: 'View',
  title: 'Toggle outline panel',
  run: () => setOutlineVisible(studio.dataset.outline !== 'shown'),
})
add({
  id: 'view.problems',
  group: 'View',
  title: 'Toggle problems panel',
  keywords: ['diagnostics', 'lint'],
  run: () => problemsToggle.click(),
})
add({ id: 'view.theme', group: 'View', title: 'Switch theme (auto, light, dark)', run: cycleTheme })
add({
  id: 'app.settings',
  group: 'App',
  title: 'Settings',
  keywords: ['preferences', 'options'],
  run: () => {
    if (focusMode) setFocusMode(false)
    setSettingsOpen(true)
  },
})

const palette = createPalette(
  byId<HTMLDialogElement>('command-palette'),
  byId<HTMLInputElement>('command-input'),
  byId('command-list'),
  byId('command-empty'),
  () => registry.all(),
)
add({
  id: 'app.palette',
  group: 'App',
  title: 'Command palette',
  shortcut: 'Mod-K',
  run: () => palette.open(),
})

// Toolbar and menu buttons run commands by id.
document.addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-command]') : null
  if (!btn || btn.closest('dialog')) return
  const id = btn.dataset.command
  if (!id) return
  if (btn.getAttribute('role') === 'menuitem') closeExportMenu(false)
  void registry.run(id)
})

// Shortcut hints follow the platform.
byId('palette-kbd').textContent = formatShortcut('Mod-K', isApple)
for (const c of registry.all()) {
  if (!c.shortcut) continue
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>(`.toolbar [data-command="${c.id}"][title]`),
  ))
    el.title = `${el.getAttribute('aria-label') ?? c.title} (${formatShortcut(c.shortcut, isApple)})`
}

// ----- Keyboard -----

const anyDialogOpen = () =>
  palette.isOpen || confirmDialog.open || !settingsPanel.hidden || !exportMenu.hidden

window.addEventListener(
  'keydown',
  (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    const key = e.code
    const target = e.target as HTMLElement | null
    const inField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    let id: string | undefined
    if (key === 'KeyK' && !e.shiftKey && !e.altKey) {
      if (palette.isOpen) {
        e.preventDefault()
        palette.close()
        return
      }
      if (!confirmDialog.open) id = 'app.palette'
    } else if (confirmDialog.open || palette.isOpen) return
    else if (key === 'KeyS' && !e.shiftKey && !e.altKey) id = 'file.save'
    else if (key === 'KeyP' && e.shiftKey && !e.altKey) id = 'view.togglePreview'
    else if (key === 'KeyB' && !e.shiftKey && !e.altKey && !inField) id = 'format.bold'
    else if (key === 'KeyI' && !e.shiftKey && !e.altKey && !inField) id = 'format.italic'
    else if (e.altKey && !e.shiftKey && /^Digit[1-4]$/.test(key))
      id = `view.${MODES[Number(key.slice(5)) - 1]}`
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    closePopups()
    void registry.run(id)
  },
  { capture: true },
)
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  if (palette.isOpen || confirmDialog.open) return
  if (!exportMenu.hidden) {
    closeExportMenu()
    return
  }
  if (!settingsPanel.hidden) {
    setSettingsOpen(false)
    return
  }
  if (focusMode && !anyDialogOpen()) setFocusMode(false)
})

// ----- Start -----

applyTheme()
setMode('split')
setPane('editor')
if (!storage.available) setSaveState('Not saved: browser storage is off', 'warn')
else setSaveState('Saved in this browser', 'saved')
void renderNow()

window.markupmeStudio = {
  async setMarkdown(text: string) {
    editor.setText(text)
    await renderNow()
  },
  getMarkdown: () => editor.getText(),
  async whenRendered() {
    await rendering
    await preview.whenIdle()
  },
}
