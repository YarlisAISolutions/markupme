/// <reference lib="dom" />
import {
  type BlockPosition,
  LINE_CLASS_PREFIX,
  lineFromClassName,
  scrollTopForLine,
} from '../lines.js'

interface VsCodeApi {
  postMessage(message: unknown): void
}
interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  run(opts: { nodes: Element[]; suppressErrors?: boolean }): Promise<void>
}
declare function acquireVsCodeApi(): VsCodeApi
declare global {
  interface Window {
    mermaid?: MermaidApi
  }
}

type Message = { type: 'update'; html: string; line?: number } | { type: 'scroll'; line: number }

const vscode = acquireVsCodeApi()
const root = document.documentElement
const body = document.body
const article = document.getElementById('mm-root') as HTMLElement
const nonce = (document.currentScript as HTMLScriptElement | null)?.nonce ?? ''

function isDark(): boolean {
  const setting = body.dataset.themeSetting
  if (setting === 'dark') return true
  if (setting === 'light') return false
  return (
    body.classList.contains('vscode-dark') ||
    (body.classList.contains('vscode-high-contrast') &&
      !body.classList.contains('vscode-high-contrast-light'))
  )
}

function applyTheme(): boolean {
  const next = isDark() ? 'dark' : 'light'
  if (root.dataset.theme === next) return false
  root.dataset.theme = next
  return true
}

let mermaidReady: Promise<MermaidApi> | undefined
function loadMermaid(): Promise<MermaidApi> {
  if (window.mermaid) return Promise.resolve(window.mermaid)
  mermaidReady ??= new Promise((resolve, reject) => {
    const url = body.dataset.mermaidUrl
    if (!url) return reject(new Error('Mermaid is not available'))
    const s = document.createElement('script')
    // A script added at runtime needs the page nonce to pass the CSP.
    s.nonce = nonce
    s.src = url
    s.onload = () => (window.mermaid ? resolve(window.mermaid) : reject(new Error('No Mermaid')))
    s.onerror = () => reject(new Error('Mermaid failed to load'))
    document.head.appendChild(s)
  })
  return mermaidReady
}

async function renderMermaid(rerender: boolean): Promise<void> {
  const blocks = Array.from(article.querySelectorAll<HTMLElement>('pre.mermaid'))
  if (blocks.length === 0) return
  try {
    const mermaid = await loadMermaid()
    for (const b of blocks) {
      if (b.dataset.source === undefined) b.dataset.source = b.textContent ?? ''
      if (rerender) {
        b.removeAttribute('data-processed')
        b.textContent = b.dataset.source
      }
    }
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark() ? 'dark' : 'default',
    })
    await mermaid.run({ nodes: blocks, suppressErrors: true })
  } catch (error) {
    for (const b of blocks) b.title = String((error as Error).message ?? error)
  }
}

let blocks: BlockPosition[] = []
let blocksDirty = true
function collectBlocks(): BlockPosition[] {
  if (!blocksDirty) return blocks
  const found: BlockPosition[] = []
  for (const el of Array.from(article.querySelectorAll(`[class*="${LINE_CLASS_PREFIX}"]`))) {
    const line = lineFromClassName(el.getAttribute('class') ?? '')
    if (line !== undefined)
      found.push({ line, top: el.getBoundingClientRect().top + window.scrollY })
  }
  found.sort((a, b) => a.line - b.line || a.top - b.top)
  blocks = found
  blocksDirty = false
  return blocks
}

let lastLine: number | undefined
function scrollToLine(line: number): void {
  lastLine = line
  const top = scrollTopForLine(collectBlocks(), line)
  if (top !== undefined) window.scrollTo({ top: Math.max(0, top - 8), behavior: 'auto' })
}

const invalidate = () => {
  blocksDirty = true
}
window.addEventListener('resize', invalidate)
new ResizeObserver(invalidate).observe(article)

window.addEventListener('message', (event: MessageEvent<Message>) => {
  const msg = event.data
  if (msg.type === 'update') {
    article.innerHTML = msg.html
    invalidate()
    void renderMermaid(false).then(() => {
      invalidate()
      if (lastLine !== undefined) scrollToLine(lastLine)
      report()
    })
    const line = msg.line ?? lastLine
    if (line !== undefined) scrollToLine(line)
  } else if (msg.type === 'scroll') scrollToLine(msg.line)
})

document.addEventListener('click', async (e) => {
  const target = e.target instanceof Element ? e.target : null
  const copy = target?.closest('.mm-copy')
  if (copy) {
    const code = copy.parentElement?.querySelector('pre code, pre') as HTMLElement | null
    if (!code) return
    try {
      await navigator.clipboard.writeText(code.innerText)
      copy.textContent = 'Copied'
    } catch {
      copy.textContent = 'Press Ctrl+C'
    }
    setTimeout(() => {
      copy.textContent = 'Copy'
    }, 1500)
    return
  }
  const link = target?.closest('a[href]')
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  e.preventDefault()
  if (href.startsWith('#')) {
    let id = href.slice(1)
    try {
      id = decodeURIComponent(id)
    } catch {
      // keep the raw fragment
    }
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
    return
  }
  vscode.postMessage({ type: 'link', href })
})

new MutationObserver(() => {
  if (applyTheme()) void renderMermaid(true)
}).observe(body, { attributes: true, attributeFilter: ['class'] })

applyTheme()
/** Tells the extension what the page shows (used by the end-to-end tests and for errors). */
function report(): void {
  vscode.postMessage({
    type: 'rendered',
    theme: root.dataset.theme,
    blocks: collectBlocks().map((b) => b.line),
    diagrams: article.querySelectorAll('figure.mm-diagram svg').length,
    mermaid: article.querySelectorAll('pre.mermaid svg').length,
    mermaidPending: article.querySelectorAll('pre.mermaid:not([data-processed])').length,
    scrollY: Math.round(window.scrollY),
  })
}

void renderMermaid(false).then(() => {
  invalidate()
  report()
})
vscode.postMessage({ type: 'ready' })
