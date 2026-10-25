import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createProcessor,
  diff,
  escapeHtml,
  type MarkupMePlugin,
  outline,
  parse,
  query,
  type RenderOptions,
  render,
  SCHEMA_VERSION,
  serialize,
  stats,
  transform,
  VERSION,
  validate,
} from '../src/index.js'

const kitchenSink = readFileSync(
  new URL('../../../examples/kitchen-sink.md', import.meta.url),
  'utf8',
)
const html = async (md: string, opts: RenderOptions = {}) => (await render(md, opts)).output

describe('parse', () => {
  it('produces a versioned document with positions', () => {
    const doc = parse('# Hello MarkupMe\n', { file: 'a.md' })
    expect(doc.type).toBe('markupme-document')
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.file).toBe('a.md')
    expect(doc.tree.children[0]?.position?.start.line).toBe(1)
  })

  it('reads YAML and TOML frontmatter', () => {
    expect(parse('---\ntitle: A\nn: 2\n---\n\n# x').frontmatter).toEqual({ title: 'A', n: 2 })
    expect(parse('+++\ntitle = "T"\n+++\n\n# x').frontmatter).toEqual({ title: 'T' })
  })

  it('reports invalid frontmatter without throwing', () => {
    const doc = parse('---\ntitle: [unclosed\n---\n\ntext')
    expect(doc.diagnostics[0]).toMatchObject({ code: 'MM010', severity: 'error', line: 1 })
  })

  it('gives headings GitHub-style ids and honours {#custom}', () => {
    const doc = parse('# Hello World\n\n## Hello World\n\n## Custom {#my-id}\n')
    expect(outline(doc.tree).flatMap((h) => [h.id, ...h.children.map((c) => c.id)])).toEqual([
      'hello-world',
      'hello-world-1',
      'my-id',
    ])
  })

  it('keeps prose colons as text and reports unknown directives', () => {
    const doc = parse('At 10:30 we meet.\n\n:::mystery\nx\n:::\n')
    expect(serialize(doc)).toContain('At 10:30 we meet.')
    expect(doc.diagnostics.map((d) => d.code)).toEqual(['MM009'])
  })

  it('is isolated per processor', async () => {
    const plain = createProcessor({ gfm: false })
    const gfm = createProcessor()
    expect(query(plain.parse('~~x~~').tree, 'delete')).toHaveLength(0)
    expect(query(gfm.parse('~~x~~').tree, 'delete')).toHaveLength(1)
  })
})

describe('render html', () => {
  it('renders CommonMark and GFM', async () => {
    const out = await html(
      '# T\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n\n~~gone~~ https://x.dev\n',
    )
    expect(out).toContain('<h1 id="t">T</h1>')
    expect(out).toContain('<table><thead><tr><th>a</th>')
    expect(out).toContain(
      '<input type="checkbox" checked disabled aria-label="Completed task: done">',
    )
    expect(out).toContain('<del>gone</del>')
    expect(out).toContain('<a href="https://x.dev">https://x.dev</a>')
  })

  it('renders footnotes with working links', async () => {
    const out = await html('Text[^a].\n\n[^a]: Note.')
    expect(out).toContain('href="#fn-a"')
    expect(out).toContain('id="fn-a"')
    expect(out).toContain('aria-describedby="footnote-label"')
  })

  it('renders GitHub alerts and directive callouts', async () => {
    const out = await html('> [!WARNING]\n> Careful.\n\n:::tip[Pro tip]\nBody\n:::\n\n:kbd[Ctrl]')
    expect(out).toContain('<div class="markdown-alert markdown-alert-warning" role="note">')
    expect(out).toContain('<p class="markdown-alert-title">Warning</p>')
    expect(out).toContain(
      '<div class="mm-callout mm-callout-tip" role="note"><p class="mm-callout-title">Pro tip</p>',
    )
    expect(out).toContain('<kbd>Ctrl</kbd>')
  })

  it('inserts a table of contents at [[toc]]', async () => {
    const out = await html('# Doc\n\n[[toc]]\n\n## One\n\n### Sub\n\n## Two\n')
    expect(out).toContain('<nav class="mm-toc" aria-label="Table of contents">')
    expect(out).toMatch(/<a href="#one">One<\/a>\s*<ul>\s*<li><a href="#sub">Sub<\/a>/)
  })

  it('adds anchors, lazy images, base URLs and external link targets when asked', async () => {
    const out = await html('## A\n\n![alt](img.png) [ext](https://e.com) [rel](docs/x.md)', {
      anchors: true,
      baseUrl: 'https://site.dev/base',
      externalLinksNewTab: true,
    })
    expect(out).toContain('<a class="mm-anchor" href="#a" aria-label="Link to section: A">#</a>')
    expect(out).toContain(
      'src="https://site.dev/base/img.png" alt="alt" loading="lazy" decoding="async"',
    )
    expect(out).toContain('target="_blank" rel="noopener noreferrer"')
  })

  it('renders math with KaTeX and emoji when enabled', async () => {
    const p = createProcessor({ math: true, emoji: true })
    const out = (await p.render('Euler $e^{i\\pi}+1=0$ :rocket:')).output
    expect(out).toContain('class="katex"')
    expect(out).toContain('🚀')
  })

  it('is deterministic', async () => {
    const a = await html(kitchenSink, { anchors: true })
    const b = await html(kitchenSink, { anchors: true })
    expect(a).toBe(b)
  })
})

describe('security', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '[x](javascript:alert(1))',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '<svg><script>alert(1)</script></svg>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<form action="https://evil.example"><input name="pw"></form>',
    '<a href="#" id="location">clobber</a>',
  ]
  for (const attack of attacks) {
    it(`neutralises ${attack.slice(0, 40)}`, async () => {
      const out = await html(attack)
      // Escaped text is fine; no live tag may carry a handler, script, style or javascript: URL.
      expect(out).not.toMatch(
        /<script|<\w[^>]*\son[a-z]+=|href="javascript:|<iframe|\sstyle=|<form|<style/i,
      )
      expect(out).not.toContain('id="location"')
    })
  }

  it('keeps trusted code block output after sanitizing', async () => {
    const out = await html('<script>x</script>\n\n```dot\ndigraph{a}\n```', {
      codeBlocks: [
        (b) => (b.lang === 'dot' ? { html: '<svg class="graph"><g/></svg>' } : undefined),
      ],
    })
    expect(out).toContain('<svg class="graph"><g/></svg>')
    expect(out).not.toContain('<script')
  })

  it('allows raw HTML only when sanitize is explicitly off', async () => {
    expect(await html('<b style="color:red">x</b>', { sanitize: false })).toContain(
      'style="color:red"',
    )
    expect(await html('<b>x</b>', { allowHtml: false })).not.toContain('<b>')
  })
})

describe('serialize', () => {
  it('round-trips the kitchen sink without loss', () => {
    const p = createProcessor()
    const doc = p.parse(kitchenSink)
    const { lossless, markdown } = p.roundTrip(doc)
    expect(lossless).toBe(true)
    expect(markdown).toContain('> [!NOTE]')
    expect(markdown).toContain('## Text {#text-basics}')
    expect(markdown).toContain('<!-- toc -->')
  })

  it('keeps a TOC block idempotent', () => {
    const once = serialize(parse('# D\n\n<!-- toc -->\n\n## A\n'))
    expect(serialize(parse(once))).toBe(once)
  })

  it('writes JSON AST with the schema version', () => {
    const json = JSON.parse(serialize(parse('# x'), { format: 'json' }))
    expect(json.schemaVersion).toBe(SCHEMA_VERSION)
    expect(json.tree.type).toBe('root')
  })
})

describe('other formats', () => {
  it('renders plain text, markdown and ast', async () => {
    expect((await render('# Hi\n\n- a\n- [x] b', { format: 'text' })).output).toBe(
      'Hi\n\n- a\n- [x] b\n',
    )
    expect((await render('*a*', { format: 'markdown' })).output).toBe('_a_\n')
    expect(JSON.parse((await render('a', { format: 'ast' })).output).type).toBe('markupme-document')
  })

  it('takes the title from frontmatter, then the first h1', async () => {
    expect((await render('---\ntitle: FM\n---\n# H')).title).toBe('FM')
    expect((await render('# H1 title')).title).toBe('H1 title')
  })
})

describe('validate', () => {
  it('finds structural, link and accessibility problems', () => {
    const codes = validate(
      '# A\n\n# B\n\n#### Skip\n\n![](x.png)\n\n[gone](#nope) [bad](javascript:x)\n\n[unused]: https://x.dev\n\n```\ncode\n```\n',
    ).map((d) => d.code)
    expect(codes).toEqual(
      expect.arrayContaining(['MM001', 'MM002', 'MM004', 'MM005', 'MM008', 'MM013', 'MM015']),
    )
  })

  it('checks local files through an injected checker and honours rule settings', () => {
    const md = '[a](exists.md) [b](missing.md#x)'
    const d = validate(md, { fileExists: (p) => p === 'exists.md' })
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ code: 'MM012', message: 'File not found: missing.md' })
    expect(
      validate(md, { fileExists: () => false, rules: { 'missing-local-file': 'off' } }),
    ).toHaveLength(0)
  })

  it('accepts plugin rules', () => {
    const plugin: MarkupMePlugin = {
      name: 'no-todo',
      rules: [
        {
          code: 'X001',
          name: 'no-todo',
          description: 'No TODO',
          severity: 'warning',
          check: ({ doc, report }) => {
            if (doc.source.includes('TODO')) report({ message: 'TODO found', line: 1 })
          },
        },
      ],
    }
    expect(createProcessor({ plugins: [plugin] }).validate('TODO')[0]).toMatchObject({
      code: 'X001',
      rule: 'no-todo',
    })
  })
})

describe('transform, diff and stats', () => {
  it('adds a TOC after the title on request', async () => {
    const { document } = transform(parse('# Title\n\n## A\n\n## B\n'), { plugins: ['toc'] })
    expect(serialize(document)).toMatch(/# Title\n\n<!-- toc -->\n\n- \[A\]\(#a\)/)
  })

  it('diffs block structure', () => {
    const changes = diff(
      parse('# T\n\nold\n\nkeep').tree,
      parse('# T\n\nnew\n\nkeep\n\n- added').tree,
    )
    expect(changes.map((c) => c.kind)).toEqual(['changed', 'added'])
  })

  it('counts words, tasks and languages', () => {
    const s = stats(parse('# Two words\n\n- [x] a\n- [ ] b\n\n```ts\nx\n```').tree)
    expect(s).toMatchObject({
      headings: 1,
      codeBlocks: 1,
      tasks: { total: 2, done: 1 },
      languages: { ts: 1 },
    })
  })
})

it('VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  expect(VERSION).toBe(pkg.version)
})

it('does not add an empty TOC by position', () => {
  const doc = transform(parse('# Only a title\n\ntext'), { plugins: ['toc'] })
  expect(serialize(doc.document)).not.toContain('<!-- toc -->')
})

it('labels task list checkboxes for screen readers', async () => {
  const out = (await render('- [x] Ship it\n- [ ] Test it')).output
  expect(out).toContain('aria-label="Completed task: Ship it"')
  expect(out).toContain('aria-label="Open task: Test it"')
})

it('runs plugin rehype hooks before sanitizing', async () => {
  const plugin: MarkupMePlugin = {
    name: 'mark-paragraphs',
    rehype(tree) {
      for (const node of tree.children)
        if (node.type === 'element' && node.tagName === 'p')
          node.properties.className = ['mm-note', 'evil-class']
    },
  }
  const out = (await createProcessor({ plugins: [plugin] }).render('Hello')).output
  expect(out).toBe('<p class="mm-note">Hello</p>')
})

describe('escapeHtml', () => {
  it('escapes the five HTML-special characters as numeric references', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&#60;a href=&#34;x&#34; title=&#39;y&#39;&#62;&#38;&#60;/a&#62;',
    )
  })

  it('leaves other text alone', () => {
    expect(escapeHtml('plain text, 1 + 1 = 2 ü')).toBe('plain text, 1 + 1 = 2 ü')
  })
})
