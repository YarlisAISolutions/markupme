import { wrapDocument } from '@markupme/themes'
import { isLineClass, LINE_CLASS } from './sync.js'

/** A file name for a download: the opened file's name, else a slug of the title. */
export function fileName(
  opened: string | undefined,
  title: string | undefined,
  ext: string,
): string {
  const base = opened?.replace(/\.(md|markdown|txt)$/i, '').trim()
  const slug = (base || title || 'document')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  return `${slug || 'document'}.${ext}`
}

/** Triggers a browser download of text content. */
export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * The preview's HTML, cleaned for use outside the Studio: scroll-sync classes removed, Mermaid
 * blocks replaced by the SVG they rendered (so the export needs no Mermaid script), and KaTeX's
 * visual layer dropped in favour of its MathML (which browsers render without KaTeX CSS).
 */
export function exportableHtml(article: HTMLElement): { html: string; hasMermaid: boolean } {
  const clone = article.cloneNode(true) as HTMLElement
  for (const el of Array.from(clone.querySelectorAll<HTMLElement>(`[class*="${LINE_CLASS}"]`))) {
    for (const c of Array.from(el.classList)) if (isLineClass(c)) el.classList.remove(c)
    if (el.classList.length === 0) el.removeAttribute('class')
  }
  let hasMermaid = false
  for (const pre of Array.from(clone.querySelectorAll<HTMLElement>('pre.mermaid'))) {
    const div = document.createElement('div')
    div.className = 'mm-mermaid'
    if (pre.hasAttribute('data-processed')) {
      div.innerHTML = pre.innerHTML
      hasMermaid = true
    } else {
      // Not rendered (a syntax error): keep the source readable instead.
      const code = document.createElement('pre')
      code.textContent = pre.textContent ?? ''
      div.append(code)
    }
    pre.replaceWith(div)
  }
  for (const el of Array.from(clone.querySelectorAll('.katex-html'))) el.remove()
  return { html: clone.innerHTML.trim(), hasMermaid }
}

/** A complete standalone HTML page for the current preview. */
export function standaloneHtml(
  article: HTMLElement,
  title: string,
  theme: 'light' | 'dark',
): string {
  const { html, hasMermaid } = exportableHtml(article)
  return wrapDocument({
    body: html,
    title,
    // Mermaid SVG carries the colours it was rendered with, so pin the page to that theme.
    theme: hasMermaid ? theme : 'auto',
    extraCss: '.markupme .mm-mermaid svg { max-width: 100%; height: auto; }',
  })
}

/** Copies text to the clipboard. Resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}
