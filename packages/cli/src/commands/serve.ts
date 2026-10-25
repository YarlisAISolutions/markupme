import { createReadStream, existsSync, watch as fsWatch, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { isIP } from 'node:net'
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { stats, VERSION } from '@markupme/core'
import { escapeHtml, wrapDocument } from '@markupme/themes'
import type { MarkupMeConfig } from '../config.js'
import { DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { MARKDOWN_EXT, walkMarkdown } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import type { Io } from '../io.js'
import {
  createPipeline,
  mergeConfig,
  mermaidScriptPath,
  type Pipeline,
  renderPage,
} from '../pipeline.js'
import { CAPABILITIES } from './info.js'

const require = createRequire(import.meta.url)
const MAX_BODY = 1024 * 1024
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
}

const PLAYGROUND_SAMPLE = `## Try MarkupMe

Type Markdown here. **Bold**, _italic_, \`code\`, ~~strike~~ and a footnote.[^1]

> [!TIP]
> GitHub alerts, :::callouts and :kbd[Ctrl] directives work too.

| Feature | Status |
| ------- | ------ |
| Tables  | ✓      |

- [x] Task lists
- [ ] Diagrams below

\`\`\`mermaid
flowchart LR
  Write --> Preview --> Publish
\`\`\`

[^1]: Footnotes link both ways.
`

const LIVE_RELOAD = `<script>(() => { try { const es = new EventSource('/__markupme/events'); es.onmessage = (e) => { if (e.data === 'reload') location.reload(); }; } catch {} })();</script>`

function playgroundPage(): string {
  const body = `<h1>MarkupMe playground</h1>
<p>Write Markdown on the left; the preview renders through the <code>/api/render</code> endpoint.</p>
<div class="mm-playground">
<div class="mm-pg-editor">
<label for="mm-input">Markdown</label>
<textarea id="mm-input" data-testid="markdown-input" spellcheck="false" rows="22">${escapeHtml(PLAYGROUND_SAMPLE)}</textarea>
<fieldset><legend>Options</legend>
<label><input type="checkbox" id="mm-opt-toc"> Table of contents</label>
<label><input type="checkbox" id="mm-opt-math"> Math</label>
<label><input type="checkbox" id="mm-opt-emoji"> Emoji</label>
<label><input type="checkbox" id="mm-opt-lines"> Line numbers</label>
</fieldset>
<button type="button" id="mm-render" data-testid="render-button">Render</button>
<p id="mm-status" role="status" data-testid="status"></p>
</div>
<section class="mm-pg-preview" aria-label="Preview">
<div id="mm-preview" class="markupme" data-testid="preview"></div>
<h2 class="mm-pg-diag-title">Diagnostics</h2>
<ul id="mm-diagnostics" data-testid="diagnostics"></ul>
</section>
</div>
<script>(() => {
  const $ = (id) => document.getElementById(id);
  const input = $('mm-input'), preview = $('mm-preview'), status = $('mm-status'), diags = $('mm-diagnostics');
  let timer, seq = 0;
  async function render() {
    const mine = ++seq;
    status.textContent = 'Rendering…';
    const body = { markdown: input.value, format: 'html', lint: true, toc: $('mm-opt-toc').checked, math: $('mm-opt-math').checked, emoji: $('mm-opt-emoji').checked, lineNumbers: $('mm-opt-lines').checked };
    try {
      const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (mine !== seq) return;
      if (!res.ok) { status.textContent = 'Error: ' + (data.error && data.error.message); return; }
      preview.innerHTML = data.output;
      diags.innerHTML = '';
      for (const d of data.diagnostics) { const li = document.createElement('li'); li.textContent = 'Line ' + (d.line || '?') + ': ' + d.severity + ' ' + d.code + ' ' + d.message; diags.appendChild(li); }
      if (data.diagnostics.length === 0) { const li = document.createElement('li'); li.textContent = 'No problems found'; diags.appendChild(li); }
      status.textContent = 'Rendered ' + data.stats.words + ' words';
      if (window.markupme) window.markupme.renderMermaid(true);
    } catch (err) { status.textContent = 'Error: ' + err.message; }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 250); });
  for (const id of ['mm-opt-toc', 'mm-opt-math', 'mm-opt-emoji', 'mm-opt-lines']) $(id).addEventListener('change', render);
  $('mm-render').addEventListener('click', render);
  render();
})();</script>`
  return wrapDocument({
    body,
    title: 'MarkupMe playground',
    siteName: 'MarkupMe',
    homeHref: '/',
    mermaidUrl: '/__markupme/mermaid.min.js',
    head: '<link rel="stylesheet" href="/__markupme/katex/katex.min.css">',
    extraCss:
      '.mm-layout{max-width:1400px}.markupme{max-width:none}.mm-playground{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.mm-pg-editor textarea{width:100%;box-sizing:border-box;font:14px/1.5 var(--mm-mono);padding:12px;color:var(--mm-fg);background:var(--mm-subtle);border:1px solid var(--mm-border);border-radius:6px}.mm-pg-editor label{display:block;font-weight:600;margin:8px 0 4px}.mm-pg-editor fieldset{border:1px solid var(--mm-border);border-radius:6px;margin:12px 0}.mm-pg-editor fieldset label{display:inline-block;font-weight:400;margin-right:12px}.mm-pg-editor button{font:inherit;padding:6px 16px;border-radius:6px;border:1px solid var(--mm-border);background:var(--mm-link);color:#fff;cursor:pointer}.mm-pg-preview{border:1px solid var(--mm-border);border-radius:6px;padding:16px;min-height:300px}@media(max-width:860px){.mm-playground{grid-template-columns:minmax(0,1fr)}}',
  })
}

export interface ServeOptions {
  root: string
  config: MarkupMeConfig
  port?: number
  host?: string
  /** Allow API callers to turn sanitizing off. Never for a shared server. */
  unsafe?: boolean
  /** Add `Access-Control-Allow-Origin` for this origin (or `*`). */
  cors?: string
  liveReload?: boolean
  log?: (line: string) => void
}

export interface RunningServer {
  server: Server
  url: string
  close(): Promise<void>
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type = 'text/plain; charset=utf-8',
  extra: Record<string, string> = {},
) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extra,
  })
  res.end(body)
}

function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown,
  extra: Record<string, string> = {},
) {
  send(res, status, `${JSON.stringify(data)}\n`, 'application/json; charset=utf-8', extra)
}

function apiError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  extra: Record<string, string> = {},
) {
  sendJson(res, status, { error: { code, message } }, extra)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY)
      throw Object.assign(new Error('Request body is larger than 1 MB'), {
        status: 413,
        code: 'TOO_LARGE',
      })
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text || '{}')
  } catch {
    throw Object.assign(new Error('Body must be JSON'), { status: 400, code: 'BAD_JSON' })
  }
}

interface ApiBody {
  markdown?: unknown
  format?: unknown
  toc?: unknown
  math?: unknown
  emoji?: unknown
  anchors?: unknown
  highlight?: unknown
  diagrams?: unknown
  lineNumbers?: unknown
  sanitize?: unknown
  standalone?: unknown
  lint?: unknown
}

/** Host names a browser may use for the server: loopback names, IP literals and the bound host. */
export function isAllowedHost(header: string | undefined, bound?: string): boolean {
  if (!header) return false
  let name = header.trim().toLowerCase()
  if (name.startsWith('[')) {
    const end = name.indexOf(']')
    if (end < 0) return false
    name = name.slice(1, end)
  } else {
    const colon = name.lastIndexOf(':')
    if (colon >= 0) name = name.slice(0, colon)
  }
  if (name.endsWith('.')) name = name.slice(0, -1)
  if (!name) return false
  // A DNS rebinding attack needs a host name the attacker controls, never an IP literal.
  if (isIP(name) !== 0) return true
  if (name === 'localhost' || name.endsWith('.localhost')) return true
  return !!bound && name === bound.toLowerCase()
}

/** True when any segment of a path relative to the root is a dotfile or dot folder (.env, .git …). */
function hasDotSegment(rel: string): boolean {
  return rel.split(/[\\/]/).some((part) => part.startsWith('.') && part !== '.')
}

/** Starts the preview server: rendered pages with live reload, a playground and a JSON API. */
export async function startServer(o: ServeOptions): Promise<RunningServer> {
  const root = resolve(o.root)
  const isFile = statSync(root).isFile()
  const baseDir = isFile ? dirname(root) : root
  const log = o.log ?? (() => {})
  const clients = new Set<ServerResponse>()
  const cors: Record<string, string> = o.cors
    ? {
        'Access-Control-Allow-Origin': o.cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    : {}
  const pagePipeline = createPipeline(o.config)
  const apiPipelines = new Map<string, Pipeline>()
  const apiPipeline = (b: ApiBody): Pipeline => {
    const layer: MarkupMeConfig = {
      ...(typeof b.toc === 'boolean'
        ? {
            toc: b.toc
              ? { position: 'after-title' as const }
              : { position: 'marker-only' as const },
          }
        : {}),
      ...(typeof b.math === 'boolean' ? { math: b.math } : {}),
      ...(typeof b.emoji === 'boolean' ? { emoji: b.emoji } : {}),
      render: {
        ...(typeof b.anchors === 'boolean' ? { anchors: b.anchors } : {}),
        ...(typeof b.highlight === 'boolean' ? { highlight: b.highlight } : {}),
        ...(typeof b.lineNumbers === 'boolean' ? { lineNumbers: b.lineNumbers } : {}),
        sanitize: !(o.unsafe && b.sanitize === false),
      },
      ...(b.diagrams === false ? { diagrams: { providers: [] } } : {}),
    }
    const key = JSON.stringify(layer)
    let p = apiPipelines.get(key)
    if (!p) {
      p = createPipeline(mergeConfig(o.config, layer))
      if (apiPipelines.size > 32) apiPipelines.clear()
      apiPipelines.set(key, p)
    }
    return p
  }

  const resolveSafe = (urlPath: string): string | undefined => {
    const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/')
    const full = normalize(join(baseDir, decoded))
    if (full !== baseDir && !full.startsWith(baseDir + sep)) return undefined
    return full
  }

  const serveStatic = (file: string, res: ServerResponse) => {
    const stream = createReadStream(file)
    res.once('close', () => stream.destroy())
    stream.once('error', (error) => {
      log(`error ${relative(baseDir, file)}: ${error.message}`)
      if (!res.headersSent) send(res, 500, 'Internal error')
      else res.destroy()
    })
    stream.once('open', () => {
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        ...SECURITY_HEADERS,
      })
      stream.pipe(res)
    })
  }

  const renderMarkdownFile = async (file: string, res: ServerResponse) => {
    const rel = relative(baseDir, file).split(sep).join('/')
    const pages = isFile ? [root] : walkMarkdown(baseDir)
    const nav =
      pages.length > 1
        ? pages.map((p) => ({
            title: relative(baseDir, p).split(sep).join('/'),
            href: `/${relative(baseDir, p).split(sep).join('/')}`,
            current: p === file,
          }))
        : undefined
    const page = await renderPage(pagePipeline, readFileSync(file, 'utf8'), {
      format: 'html',
      standalone: true,
      file: rel,
      assetsHref: '/__markupme/',
      ...(nav ? { nav } : {}),
      siteName: isFile ? basename(file) : basename(baseDir),
      homeHref: '/',
      footer: o.liveReload === false ? '' : LIVE_RELOAD,
    })
    const diag = page.diagnostics.filter((d) => d.severity !== 'info')
    const banner = diag.length
      ? `<aside class="mm-callout mm-callout-warning" role="status" data-testid="render-diagnostics"><p class="mm-callout-title">${diag.length} problem${diag.length === 1 ? '' : 's'}</p><ul>${diag.map((d) => `<li>Line ${d.line ?? '?'}: ${escapeHtml(d.message)} (${d.code})</li>`).join('')}</ul></aside>`
      : ''
    send(
      res,
      200,
      page.output.replace('<article class="markupme">', `<article class="markupme">${banner}`),
      TYPES['.html'],
    )
  }

  const listing = (res: ServerResponse) => {
    const files = walkMarkdown(baseDir).map((f) => relative(baseDir, f).split(sep).join('/'))
    const body = `<h1>${escapeHtml(basename(baseDir))}</h1>\n<ul>${files.map((f) => `<li><a href="/${encodeURI(f)}">${escapeHtml(f)}</a></li>`).join('')}</ul>\n<p><a href="/__markupme/playground">Open the playground</a></p>`
    send(
      res,
      200,
      wrapDocument({ body, title: basename(baseDir), siteName: 'MarkupMe', homeHref: '/' }),
      TYPES['.html'],
    )
  }

  const handleApi = async (req: IncomingMessage, res: ServerResponse, path: string) => {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', cors)
    if (path === '/api/health') {
      if (req.method !== 'GET')
        return apiError(res, 405, 'METHOD', 'Use GET', { Allow: 'GET', ...cors })
      return sendJson(res, 200, { status: 'ok', name: 'markupme', version: VERSION }, cors)
    }
    if (path === '/api/capabilities')
      return sendJson(res, 200, { version: VERSION, capabilities: CAPABILITIES }, cors)
    if (!['/api/render', '/api/validate', '/api/stats'].includes(path))
      return apiError(res, 404, 'NOT_FOUND', `No API route ${path}`, cors)
    if (req.method !== 'POST')
      return apiError(res, 405, 'METHOD', 'Use POST with a JSON body', { Allow: 'POST', ...cors })
    let body: ApiBody
    try {
      body = (await readBody(req)) as ApiBody
    } catch (error) {
      const e = error as Error & { status?: number; code?: string }
      return apiError(res, e.status ?? 400, e.code ?? 'BAD_REQUEST', e.message, cors)
    }
    if (typeof body !== 'object' || body === null || typeof body.markdown !== 'string')
      return apiError(res, 400, 'MARKDOWN_REQUIRED', 'Body must be {"markdown": "<text>"}', cors)
    const markdown = body.markdown
    const p = apiPipeline(body)
    if (path === '/api/validate') {
      const diagnostics = p.processor.validate(
        markdown,
        o.config.rules ? { rules: o.config.rules } : {},
      )
      return sendJson(
        res,
        200,
        {
          ok: !diagnostics.some((d) => d.severity === 'error'),
          errors: diagnostics.filter((d) => d.severity === 'error').length,
          warnings: diagnostics.filter((d) => d.severity === 'warning').length,
          diagnostics,
        },
        cors,
      )
    }
    if (path === '/api/stats')
      return sendJson(res, 200, stats(p.processor.parse(markdown).tree), cors)
    const format = typeof body.format === 'string' ? body.format : 'html'
    const formats: Record<string, 'html' | 'markdown' | 'ast' | 'text'> = {
      html: 'html',
      markdown: 'markdown',
      md: 'markdown',
      ast: 'ast',
      text: 'text',
    }
    if (['pdf', 'docx', 'mdx'].includes(format))
      return apiError(res, 501, 'UNSUPPORTED', `Format "${format}" is planned, not built`, cors)
    const f = formats[format]
    if (!f) return apiError(res, 400, 'FORMAT', `Unknown format "${format}"`, cors)
    const page = await renderPage(p, markdown, {
      format: f,
      standalone: body.standalone === true,
      assetsHref: '/__markupme/',
    })
    // `lint: true` adds the validation rules (broken links, heading levels …) to the result.
    const diagnostics = [...page.diagnostics]
    if (body.lint === true) {
      const seen = new Set(diagnostics.map((d) => `${d.code}:${d.line}:${d.column}`))
      for (const d of p.processor.validate(
        markdown,
        o.config.rules ? { rules: o.config.rules } : {},
      ))
        if (!seen.has(`${d.code}:${d.line}:${d.column}`)) diagnostics.push(d)
      diagnostics.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
    }
    return sendJson(
      res,
      200,
      {
        format: f,
        title: page.title ?? null,
        output: page.output,
        diagnostics,
        stats: stats(p.processor.parse(markdown).tree),
      },
      cors,
    )
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    try {
      // DNS rebinding: a page on evil.example that resolves to 127.0.0.1 still sends its own Host.
      if (!isAllowedHost(req.headers.host, o.host))
        return send(res, 403, 'Forbidden: host not allowed')
      if (path.startsWith('/api/')) return await handleApi(req, res, path)
      if (path === '/__markupme/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        })
        res.write('retry: 1000\n\n')
        clients.add(res)
        req.on('close', () => clients.delete(res))
        return
      }
      if (path === '/__markupme/playground') return send(res, 200, playgroundPage(), TYPES['.html'])
      if (path === '/__markupme/mermaid.min.js')
        return send(res, 200, readFileSync(mermaidScriptPath()), TYPES['.js'], {
          'Cache-Control': 'max-age=3600',
        })
      if (path.startsWith('/__markupme/katex/')) {
        const katex = join(dirname(require.resolve('katex/package.json')), 'dist')
        const file = normalize(join(katex, path.slice('/__markupme/katex/'.length)))
        if (!file.startsWith(katex + sep) || !existsSync(file)) return send(res, 404, 'Not found')
        return send(
          res,
          200,
          readFileSync(file),
          TYPES[extname(file)] ?? 'application/octet-stream',
        )
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return send(res, 405, 'Method not allowed', 'text/plain', { Allow: 'GET' })
      if (path === '/') {
        if (isFile) return await renderMarkdownFile(root, res)
        const index = ['index.md', 'README.md', 'readme.md']
          .map((n) => join(baseDir, n))
          .find((f) => existsSync(f))
        return index ? await renderMarkdownFile(index, res) : listing(res)
      }
      const file = resolveSafe(path)
      if (!file) return send(res, 403, 'Forbidden')
      // Dotfiles and dot folders (.env, .git, .npmrc) are never served, like the file listing.
      if (hasDotSegment(relative(baseDir, file))) return send(res, 404, 'Not found')
      if (!existsSync(file)) return send(res, 404, 'Not found')
      if (statSync(file).isDirectory()) {
        const index = ['index.md', 'README.md'].map((n) => join(file, n)).find((f) => existsSync(f))
        return index ? await renderMarkdownFile(index, res) : send(res, 404, 'Not found')
      }
      if (MARKDOWN_EXT.test(file)) return await renderMarkdownFile(file, res)
      return serveStatic(file, res)
    } catch (error) {
      log(`error ${path}: ${(error as Error).message}`)
      if (!res.headersSent)
        path.startsWith('/api/')
          ? apiError(res, 500, 'INTERNAL', (error as Error).message)
          : send(res, 500, 'Internal error')
    }
  })

  const watcher =
    o.liveReload === false
      ? undefined
      : fsWatch(baseDir, { recursive: true }, (_e, name) => {
          if (name && (String(name).includes('node_modules') || String(name).startsWith('.')))
            return
          for (const c of clients) c.write('data: reload\n\n')
        })

  await new Promise<void>((done, fail) => {
    server.once('error', fail)
    server.listen(o.port ?? 4321, o.host ?? '127.0.0.1', () => done())
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : (o.port ?? 4321)
  const host = o.host && o.host !== '0.0.0.0' ? o.host : '127.0.0.1'
  return {
    server,
    url: `http://${host.includes(':') ? `[${host}]` : host}:${port}`,
    close: async () => {
      watcher?.close()
      for (const c of clients) c.end()
      await new Promise<void>((done) => server.close(() => done()))
    },
  }
}

export interface ServeFlags extends FeatureFlagValues {
  port?: string
  host?: string
  unsafe?: boolean
  cors?: string
  liveReload?: boolean
}

export async function runServe(
  io: Io,
  target: string | undefined,
  flags: ServeFlags,
  cmd?: import('commander').Command,
): Promise<number> {
  const root = resolve(io.cwd, target ?? '.')
  if (!existsSync(root)) throw new CliError(`No such file or directory: ${target}`, EXIT.USAGE)
  const port = flags.port ? Number(flags.port) : Number(io.env.PORT ?? 4321)
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new CliError('--port must be 0-65535', EXIT.USAGE)
  const config = mergeConfig(
    DEFAULT_CONFIG,
    loadConfig(io.cwd, flags.config),
    flagsToConfig(flags, cmd),
  )
  const running = await startServer({
    root,
    config,
    port,
    ...(flags.host ? { host: flags.host } : {}),
    unsafe: flags.unsafe === true,
    ...(flags.cors ? { cors: flags.cors } : {}),
    liveReload: flags.liveReload !== false,
    log: (l) => io.err(l),
  })
  io.err(`markupme ${VERSION} serving ${relative(io.cwd, root) || '.'} at ${running.url}`)
  io.err(`  playground  ${running.url}/__markupme/playground`)
  io.err(`  api         ${running.url}/api/health · POST /api/render · POST /api/validate`)
  await new Promise<void>((done) => {
    process.once('SIGINT', done)
    process.once('SIGTERM', done)
  })
  await running.close()
  return EXIT.OK
}
