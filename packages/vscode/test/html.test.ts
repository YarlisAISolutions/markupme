import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce, previewPage } from '../src/html.js'

describe('webview CSP', () => {
  it('builds a strict policy', () => {
    expect(buildCsp('vscode-webview://x', 'abc123')).toBe(
      "default-src 'none'; img-src vscode-webview://x https: data:; style-src vscode-webview://x 'unsafe-inline'; script-src 'nonce-abc123'; font-src vscode-webview://x",
    )
  })

  it('rejects a nonce that could break out of the policy', () => {
    expect(() => buildCsp('x', "a'; script-src *")).toThrow()
  })

  it('makes unique alphanumeric nonces', () => {
    const a = createNonce()
    expect(a).toMatch(/^[A-Za-z0-9]{16,}$/)
    expect(createNonce()).not.toBe(a)
  })

  it('puts the nonce on every script and no inline handlers', () => {
    const html = previewPage({
      cspSource: 'vscode-webview://x',
      nonce: 'n0nce',
      css: '.markupme{}',
      scriptUri: 'vscode-webview://x/preview.js',
      mermaidUri: 'vscode-webview://x/mermaid.min.js',
      body: '<p>Hi</p>',
      theme: 'auto',
    })
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"')
    expect(html).toContain('script-src &#39;nonce-n0nce&#39;')
    const scripts = html.match(/<script[^>]*>/g) ?? []
    expect(scripts.length).toBe(1)
    for (const s of scripts) expect(s).toContain('nonce="n0nce"')
    expect(html).toContain('data-mermaid-url="vscode-webview://x/mermaid.min.js"')
    expect(html).toContain('<article class="markupme" id="mm-root">\n<p>Hi</p>')
    expect(html).not.toContain('data-theme="auto"')
  })
})
