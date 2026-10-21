import { markupmeCss } from './css.js'
import { runtimeScript } from './runtime.js'

export { markupmeCss, runtimeScript }

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface NavItem {
  title: string
  href: string
  current?: boolean
  children?: NavItem[]
}

export interface DocumentOptions {
  /** Rendered MarkupMe HTML (the article body). */
  body: string
  title?: string
  description?: string
  lang?: string
  /** 'auto' follows the system; the toggle overrides it per viewer. Default 'auto'. */
  theme?: ThemeMode
  /** Inline the stylesheet (default) or link to this URL. */
  cssHref?: string
  /** Extra CSS appended after the theme (KaTeX, overrides). */
  extraCss?: string
  /** Extra `<head>` HTML (trusted). */
  head?: string
  /** Mermaid script URL, set when the page has Mermaid diagrams. */
  mermaidUrl?: string
  /** Inline Mermaid source code instead of a URL (fully offline single file). */
  mermaidInline?: string
  /** Include the runtime (copy, theme toggle, Mermaid). Default true. */
  runtime?: boolean
  /** Site navigation for multi-page output. */
  nav?: NavItem[]
  /** Site name shown in the top bar. */
  siteName?: string
  /** Link for the site name. Default './'. */
  homeHref?: string
  /** Extra HTML after the article (trusted), such as a search script. */
  footer?: string
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function navHtml(items: NavItem[]): string {
  return `<ul>${items
    .map(
      (i) =>
        `<li><a href="${escapeHtml(i.href)}"${i.current ? ' aria-current="page"' : ''}>${escapeHtml(i.title)}</a>${i.children?.length ? navHtml(i.children) : ''}</li>`,
    )
    .join('')}</ul>`
}

/** Wraps rendered HTML in a complete, accessible HTML5 page. */
export function wrapDocument(o: DocumentOptions): string {
  const theme = o.theme ?? 'auto'
  const title = o.title ?? 'Document'
  const themeAttr = theme === 'auto' ? '' : ` data-theme="${theme}"`
  const css = o.cssHref
    ? `<link rel="stylesheet" href="${escapeHtml(o.cssHref)}">`
    : `<style>${markupmeCss}</style>`
  const sidebar = o.nav?.length
    ? `<nav class="mm-sidebar" aria-label="Pages">${navHtml(o.nav)}</nav>`
    : ''
  const mermaid = o.mermaidInline
    ? `<script>${o.mermaidInline.replace(/<\/script/gi, '<\\/script')}</script>`
    : o.mermaidUrl
      ? `<script>window.MARKUPME_MERMAID_URL=${JSON.stringify(o.mermaidUrl).replace(/</g, '\\u003c')}</script>`
      : ''
  return `<!doctype html>
<html lang="${escapeHtml(o.lang ?? 'en')}"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MarkupMe">
<meta name="color-scheme" content="${theme === 'auto' ? 'light dark' : theme}">
<title>${escapeHtml(title)}</title>
${o.description ? `<meta name="description" content="${escapeHtml(o.description)}">\n` : ''}${css}
${o.extraCss ? `<style>${o.extraCss}</style>\n` : ''}${o.head ?? ''}
</head>
<body class="mm-page">
<header class="mm-topbar"><a href="${escapeHtml(o.homeHref ?? './')}">${escapeHtml(o.siteName ?? title)}</a><button class="mm-theme-toggle" type="button" aria-label="Toggle dark mode" aria-pressed="false">Theme</button></header>
<div class="mm-layout${sidebar ? ' mm-has-sidebar' : ''}">
${sidebar}<main id="content"><article class="markupme">
${o.body}
</article></main>
</div>
${o.footer ?? ''}${mermaid}${o.runtime === false ? '' : `<script>${runtimeScript}</script>`}
</body>
</html>
`
}
