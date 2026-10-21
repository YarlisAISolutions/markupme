import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { EXIT, type Io, run, startServer } from '../src/index.js'

function harness(cwd: string) {
  const out: string[] = []
  const err: string[] = []
  const io: Io = { out: (t) => out.push(t), err: (t) => err.push(t), cwd, env: {} }
  return { io, out, err, exec: (...argv: string[]) => run(argv, io) }
}

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'markupme-cli-'))
  mkdirSync(join(dir, 'docs', 'guide'), { recursive: true })
  writeFileSync(
    join(dir, 'docs', 'README.md'),
    '# Home\n\nSee the [guide](guide/intro.md).\n\n## Diagram\n\n```mermaid\nflowchart LR\n  A --> B\n```\n',
  )
  writeFileSync(
    join(dir, 'docs', 'guide', 'intro.md'),
    '# Intro\n\n## Setup\n\n### Install\n\n## Use\n\n[home](../README.md)\n',
  )
  writeFileSync(join(dir, 'bad.md'), '# A\n\n#### Skip\n\n[x](#nope) [f](missing.md)\n')
  writeFileSync(join(dir, 'messy.md'), '* one\n* two\n\n*em*\n')
})

describe('render', () => {
  it('renders to stdout as html, md, ast and text', async () => {
    for (const [format, expected] of [
      ['html', '<h1 id="intro">Intro'],
      ['md', '# Intro'],
      ['ast', '"schemaVersion": 1'],
      ['text', 'Intro\n\nSetup'],
    ] as const) {
      const h = harness(dir)
      expect(await h.exec('render', 'docs/guide/intro.md', '-f', format)).toBe(EXIT.OK)
      expect(h.out.join('\n')).toContain(expected)
    }
  })

  it('writes a standalone page with Mermaid copied to assets', async () => {
    const h = harness(dir)
    expect(
      await h.exec(
        'render',
        'docs/README.md',
        '--standalone',
        '--toc',
        'after-title',
        '-o',
        'out/home.html',
      ),
    ).toBe(EXIT.OK)
    const html = readFileSync(join(dir, 'out', 'home.html'), 'utf8')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<nav class="mm-toc"')
    expect(html).toContain('<pre class="mermaid">')
    expect(html).toContain('window.MARKUPME_MERMAID_URL="assets/mermaid.min.js"')
    expect(existsSync(join(dir, 'out', 'assets', 'mermaid.min.js'))).toBe(true)
  })

  it('renders a directory into an output directory', async () => {
    const h = harness(dir)
    expect(await h.exec('render', 'docs', '-o', 'out/all', '-q')).toBe(EXIT.OK)
    expect(existsSync(join(dir, 'out', 'all', 'guide', 'intro.html'))).toBe(true)
  })

  it('reports planned formats with exit 64 and unknown ones as usage errors', async () => {
    const h = harness(dir)
    expect(await h.exec('render', 'docs/README.md', '-f', 'pdf')).toBe(EXIT.UNSUPPORTED)
    expect(h.err.join('\n')).toContain('PDF export is planned')
    expect(await harness(dir).exec('render', 'docs/README.md', '-f', 'rtf')).toBe(EXIT.USAGE)
    expect(await harness(dir).exec('render', 'nope.md')).toBe(EXIT.USAGE)
  })
})

describe('validate', () => {
  it('fails on errors and prints file:line diagnostics', async () => {
    const h = harness(dir)
    expect(await h.exec('validate', 'bad.md')).toBe(EXIT.INVALID)
    const text = h.err.join('\n')
    expect(text).toContain('bad.md:3:1 warning MM001')
    expect(text).toContain('bad.md:5:1 error MM004')
    expect(text).toContain('error MM012 File not found: missing.md')
  })

  it('passes clean docs, respects --rule and --strict, and emits JSON', async () => {
    expect(await harness(dir).exec('validate', 'docs', '--strict')).toBe(EXIT.OK)
    expect(
      await harness(dir).exec(
        'validate',
        'bad.md',
        '-r',
        'broken-fragment-link=off',
        '-r',
        'missing-local-file=off',
      ),
    ).toBe(EXIT.OK)
    expect(
      await harness(dir).exec(
        'validate',
        'bad.md',
        '-r',
        'broken-fragment-link=off',
        '-r',
        'MM012=off',
        '--strict',
      ),
    ).toBe(EXIT.INVALID)
    const h = harness(dir)
    await h.exec('validate', 'bad.md', '--json')
    expect(JSON.parse(h.out.join('\n'))).toMatchObject({ ok: false, files: 1, errors: 2 })
  })

  it('emits GitHub annotations in Actions', async () => {
    const h = harness(dir)
    h.io.env.GITHUB_ACTIONS = 'true'
    await h.exec('validate', 'bad.md')
    expect(h.out.join('\n')).toContain('::error file=bad.md,line=5,col=1,title=MM004::')
  })
})

describe('format and toc', () => {
  it('checks and writes formatting', async () => {
    expect(await harness(dir).exec('format', 'messy.md', '--check')).toBe(EXIT.INVALID)
    expect(await harness(dir).exec('format', 'messy.md', '--write')).toBe(EXIT.OK)
    expect(readFileSync(join(dir, 'messy.md'), 'utf8')).toBe('- one\n- two\n\n_em_\n')
    expect(await harness(dir).exec('format', 'messy.md', '--check')).toBe(EXIT.OK)
  })

  it('inserts and refreshes a TOC idempotently', async () => {
    const file = join(dir, 'docs', 'guide', 'intro.md')
    expect(await harness(dir).exec('toc', 'docs/guide/intro.md', '--check')).toBe(EXIT.INVALID)
    expect(await harness(dir).exec('toc', 'docs/guide/intro.md', '--write')).toBe(EXIT.OK)
    const once = readFileSync(file, 'utf8')
    expect(once).toMatch(
      /# Intro\n\n<!-- toc -->\n\n- \[Setup\]\(#setup\)\n {2}- \[Install\]\(#install\)\n- \[Use\]\(#use\)\n\n<!-- tocstop -->/,
    )
    expect(await harness(dir).exec('toc', 'docs/guide/intro.md', '--check')).toBe(EXIT.OK)
  })
})

describe('build', () => {
  it('builds a site with navigation, rewritten links and a search index', async () => {
    const h = harness(dir)
    expect(await h.exec('build', 'docs', '-o', 'site')).toBe(EXIT.OK)
    const index = readFileSync(join(dir, 'site', 'index.html'), 'utf8')
    expect(index).toContain('<nav class="mm-sidebar" aria-label="Pages">')
    expect(index).toContain('href="guide/intro.html"')
    expect(index).toContain('<link rel="stylesheet" href="./markupme.css">')
    const intro = readFileSync(join(dir, 'site', 'guide', 'intro.html'), 'utf8')
    expect(intro).toContain('href="../index.html"')
    const search = JSON.parse(readFileSync(join(dir, 'site', 'search-index.json'), 'utf8'))
    expect(search.map((p: { url: string }) => p.url)).toEqual(['index.html', 'guide/intro.html'])
    expect(existsSync(join(dir, 'site', 'assets', 'mermaid.min.js'))).toBe(true)
  })
})

describe('info commands', () => {
  it('parse --outline, stats, diff and capabilities', async () => {
    let h = harness(dir)
    await h.exec('parse', 'docs/guide/intro.md', '--outline')
    expect(h.out.join('\n')).toContain('- Intro (#intro, line 1)')
    h = harness(dir)
    await h.exec('stats', 'docs/guide/intro.md', '--json')
    expect(JSON.parse(h.out.join('\n'))).toMatchObject({ headings: 4 })
    expect(await harness(dir).exec('diff', 'docs/guide/intro.md', 'docs/guide/intro.md')).toBe(
      EXIT.OK,
    )
    expect(await harness(dir).exec('diff', 'docs/guide/intro.md', 'docs/README.md')).toBe(
      EXIT.INVALID,
    )
    h = harness(dir)
    await h.exec('capabilities', '--json')
    const caps = JSON.parse(h.out.join('\n'))
    expect(caps.capabilities.find((c: { feature: string }) => c.feature === 'PDF').status).toBe(
      'planned',
    )
  })

  it('init writes a config and a sample', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'markupme-init-'))
    expect(await harness(empty).exec('init')).toBe(EXIT.OK)
    expect(existsSync(join(empty, 'markupme.config.json'))).toBe(true)
    expect(existsSync(join(empty, 'docs', 'welcome.md'))).toBe(true)
    expect(await harness(empty).exec('init')).toBe(EXIT.USAGE)
    expect(await harness(empty).exec('validate', 'docs', '--strict')).toBe(EXIT.OK)
  })

  it('exports server-side diagrams as SVG', async () => {
    writeFileSync(
      join(dir, 'dia.md'),
      '```dot\ndigraph { a -> b }\n```\n\n```ybp\nflowchart "F"\na: A\nb: B\na -> b\n```\n',
    )
    const h = harness(dir)
    expect(await h.exec('diagram', 'dia.md', '-o', 'svg')).toBe(EXIT.OK)
    expect(readFileSync(join(dir, 'svg', 'dia-1-dot.svg'), 'utf8')).toContain('<svg')
    expect(readFileSync(join(dir, 'svg', 'dia-2-ybp.svg'), 'utf8')).toContain('<svg')
  })
})

describe('serve API', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  beforeAll(async () => {
    server = await startServer({
      root: join(dir, 'docs'),
      config: DEFAULT_CONFIG,
      port: 0,
      liveReload: false,
    })
  })
  afterAll(() => server.close())
  const post = (path: string, body: unknown) =>
    fetch(`${server.url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('reports health', async () => {
    const res = await fetch(`${server.url}/api/health`)
    expect(await res.json()).toEqual({ status: 'ok', name: 'markupme', version: '0.1.0' })
  })

  it('renders sanitized HTML with diagrams and stats', async () => {
    const res = await post('/api/render', {
      markdown: '# T\n\n<script>x</script>\n\n```dot\ndigraph{a}\n```',
      sanitize: false,
    })
    const data = (await res.json()) as { output: string; stats: { headings: number } }
    expect(res.status).toBe(200)
    expect(data.output).toContain('mm-diagram-graphviz')
    expect(data.output).not.toContain('<script>')
    expect(data.stats.headings).toBe(1)
  })

  it('validates and rejects bad requests', async () => {
    expect(await (await post('/api/validate', { markdown: '[x](#y)' })).json()).toMatchObject({
      ok: false,
      errors: 1,
    })
    expect((await post('/api/render', {})).status).toBe(400)
    expect((await post('/api/render', { markdown: 'x', format: 'pdf' })).status).toBe(501)
    expect((await fetch(`${server.url}/api/render`)).status).toBe(405)
  })

  it('serves rendered pages and refuses path traversal', async () => {
    const page = await fetch(`${server.url}/guide/intro.md`)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(await page.text()).toContain('<h1 id="intro">')
    expect((await fetch(`${server.url}/..%2f..%2fbad.md`)).status).toBe(403)
    expect((await fetch(`${server.url}/__markupme/playground`)).status).toBe(200)
  })
})

describe('serve API lint option', () => {
  it('adds rule diagnostics to a render when lint is true', async () => {
    const server = await startServer({
      root: join(dir, 'docs'),
      config: DEFAULT_CONFIG,
      port: 0,
      liveReload: false,
    })
    try {
      const res = await fetch(`${server.url}/api/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: '[x](#nope)', lint: true }),
      })
      const data = (await res.json()) as { diagnostics: { code: string }[] }
      expect(data.diagnostics.map((d) => d.code)).toEqual(['MM004'])
    } finally {
      await server.close()
    }
  })
})
