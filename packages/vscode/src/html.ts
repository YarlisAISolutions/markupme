/** Webview HTML and its Content Security Policy. No `vscode` import, so it can be tested. */

/** A random nonce for one webview page load. */
export function createNonce(random: (n: number) => Uint8Array = defaultRandom): string {
  return Buffer.from(random(18))
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '')
}

function defaultRandom(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/**
 * The preview's CSP: nothing by default; images from the extension, the workspace, https and data
 * URIs; styles from the extension plus inline (Shiki colours and Mermaid use inline styles); scripts
 * only with this page's nonce; fonts (KaTeX) only from the extension.
 */
export function buildCsp(cspSource: string, nonce: string): string {
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) throw new Error('Invalid nonce')
  return [
    "default-src 'none'",
    `img-src ${cspSource} https: data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${cspSource}`,
  ].join('; ')
}

export function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export interface PreviewPageOptions {
  cspSource: string
  nonce: string
  /** The MarkupMe stylesheet (inlined). */
  css: string
  /** Webview URI of the preview script. */
  scriptUri: string
  /** Webview URI of mermaid.min.js; loaded only when the document has Mermaid blocks. */
  mermaidUri?: string
  /** Webview URI of katex.min.css, linked when math is on. */
  katexCssUri?: string
  /** Rendered body HTML for the first paint. */
  body: string
  theme: 'auto' | 'light' | 'dark'
  title?: string
}

/** The whole webview page. Later updates replace the article through `postMessage`. */
export function previewPage(o: PreviewPageOptions): string {
  const csp = buildCsp(o.cspSource, o.nonce)
  const themeAttr = o.theme === 'auto' ? '' : ` data-theme="${o.theme}"`
  const katex = o.katexCssUri ? `<link rel="stylesheet" href="${escapeAttr(o.katexCssUri)}">\n` : ''
  return `<!doctype html>
<html lang="en"${themeAttr}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttr(o.title ?? 'MarkupMe Preview')}</title>
${katex}<style nonce="${o.nonce}">${o.css}
body.mm-vscode { margin: 0; padding: 0 26px 40px; background: var(--mm-bg); color: var(--mm-fg); }
body.mm-vscode .markupme { max-width: 980px; margin: 0 auto; padding-top: 16px; }
</style>
</head>
<body class="mm-vscode" data-theme-setting="${o.theme}" data-mermaid-url="${escapeAttr(o.mermaidUri ?? '')}">
<article class="markupme" id="mm-root">
${o.body}
</article>
<script nonce="${o.nonce}" src="${escapeAttr(o.scriptUri)}"></script>
</body>
</html>
`
}
