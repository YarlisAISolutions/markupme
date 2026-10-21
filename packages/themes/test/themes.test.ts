import { describe, expect, it } from 'vitest'
import { markupmeCss, runtimeScript, wrapDocument } from '../src/index.js'

describe('wrapDocument', () => {
  it('builds an accessible standalone page', () => {
    const html = wrapDocument({ body: '<h1>Hi</h1>', title: 'A <b> title', theme: 'dark' })
    expect(html).toMatch(/^<!doctype html>\n<html lang="en" data-theme="dark">/)
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">')
    expect(html).toContain('<title>A &#60;b&#62; title</title>')
    expect(html).toContain('<main id="content"><article class="markupme">')
    expect(html).toContain('aria-label="Toggle dark mode"')
    expect(html).toContain(runtimeScript)
  })

  it('renders site navigation and escapes the Mermaid URL', () => {
    const html = wrapDocument({
      body: '',
      nav: [{ title: 'Home', href: 'index.html', current: true }],
      mermaidUrl: 'mermaid.min.js</script>',
    })
    expect(html).toContain(
      '<nav class="mm-sidebar" aria-label="Pages"><ul><li><a href="index.html" aria-current="page">Home</a>',
    )
    expect(html).toContain('window.MARKUPME_MERMAID_URL="mermaid.min.js\\u003c/script>"')
  })
})

it('ships light, dark and print styles', () => {
  expect(markupmeCss).toContain('@media (prefers-color-scheme: dark)')
  expect(markupmeCss).toContain(":root[data-theme='dark']")
  expect(markupmeCss).toContain('@media print')
})
