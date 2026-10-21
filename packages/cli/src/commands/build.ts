import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { type Diagnostic, outline } from '@markupme/core'
import { markupmeCss, type NavItem } from '@markupme/themes'
import { DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { MARKDOWN_EXT, readInput, walkMarkdown } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import { failing, type Io, plural, printDiagnostics } from '../io.js'
import { createPipeline, mdLinksToHtml, mergeConfig, renderPage, writeAssets } from '../pipeline.js'

export interface BuildFlags extends FeatureFlagValues {
  output?: string
  name?: string
  clean?: boolean
  strict?: boolean
}

interface Page {
  src: string
  rel: string
  url: string
  title: string
}

function htmlPath(rel: string): string {
  return rel.replace(/(^|\/)README\.md$/i, '$1index.md').replace(MARKDOWN_EXT, '.html')
}

function relHref(from: string, to: string): string {
  const r = relative(dirname(from), to).split('\\').join('/')
  return r === '' ? './' : r
}

const SEARCH_SCRIPT = `<script>(() => {
  const box = document.querySelector('.mm-search input'); const list = document.querySelector('.mm-search ul');
  if (!box || !list) return; let index;
  const base = document.querySelector('meta[name="markupme-root"]')?.content || './';
  box.addEventListener('input', async () => {
    index ??= await fetch(base + 'search-index.json').then((r) => r.json()).catch(() => []);
    const q = box.value.trim().toLowerCase(); list.innerHTML = '';
    if (q.length < 2) return;
    for (const p of index.filter((p) => (p.title + ' ' + p.headings.join(' ') + ' ' + p.text).toLowerCase().includes(q)).slice(0, 8)) {
      const li = document.createElement('li'); const a = document.createElement('a');
      a.href = base + p.url; a.textContent = p.title; li.appendChild(a); list.appendChild(li);
    }
  });
})();</script>`

/** Builds a static documentation site: one page per Markdown file, navigation, search index. */
export async function runBuild(
  io: Io,
  dir: string | undefined,
  flags: BuildFlags,
  cmd?: import('commander').Command,
): Promise<number> {
  const root = resolve(io.cwd, dir ?? '.')
  if (!existsSync(root)) throw new CliError(`No such directory: ${dir}`, EXIT.USAGE)
  const fileConfig = loadConfig(root, flags.config ? resolve(io.cwd, flags.config) : undefined)
  const config = mergeConfig(DEFAULT_CONFIG, fileConfig, flagsToConfig(flags, cmd))
  const out = resolve(io.cwd, flags.output ?? 'site')
  if (out === root)
    throw new CliError('Output directory must differ from the source directory', EXIT.USAGE)
  if (flags.clean !== false && existsSync(out)) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  const exclude = [...(config.site?.exclude ?? []), relative(root, out).split('/')[0] ?? '']
  const sources = walkMarkdown(root, exclude.filter(Boolean))
  if (sources.length === 0) throw new CliError(`No Markdown files in ${dir ?? '.'}`, EXIT.USAGE)
  const pipeline = createPipeline(config, [mdLinksToHtml])
  const pages: Page[] = sources.map((src) => {
    const rel = relative(root, src).split('\\').join('/')
    const doc = pipeline.processor.parse(readInput(src))
    const fmTitle = doc.frontmatter?.title
    const h1 = outline(doc.tree).find((h) => h.depth === 1)?.text
    return {
      src,
      rel,
      url: htmlPath(rel),
      title: typeof fmTitle === 'string' ? fmTitle : (h1 ?? rel.replace(MARKDOWN_EXT, '')),
    }
  })
  pages.sort((a, b) =>
    a.url === 'index.html' ? -1 : b.url === 'index.html' ? 1 : a.url.localeCompare(b.url),
  )

  const siteName =
    flags.name ?? config.site?.name ?? pages.find((p) => p.url === 'index.html')?.title ?? 'Docs'
  writeFileSync(join(out, 'markupme.css'), markupmeCss.trimStart())
  const all: Diagnostic[] = []
  const search: { title: string; url: string; headings: string[]; text: string }[] = []
  let needMermaid = false
  let needMath = false

  for (const page of pages) {
    const target = join(out, page.url)
    const nav: NavItem[] = pages.map((p) => ({
      title: p.title,
      href: relHref(page.url, p.url),
      current: p === page,
    }))
    const rootHref = relHref(page.url, 'x').replace(/x$/, '') || './'
    const source = readInput(page.src)
    const result = await renderPage(pipeline, source, {
      format: 'html',
      standalone: true,
      file: page.rel,
      assetsHref: `${rootHref}assets/`,
      nav,
      siteName,
      homeHref: `${rootHref}index.html`,
      head: `<meta name="markupme-root" content="${rootHref}">`,
      footer: SEARCH_SCRIPT,
    })
    const html = result.output
      .replace(/<style>[\s\S]*?<\/style>/, `<link rel="stylesheet" href="${rootHref}markupme.css">`)
      .replace(
        '<button class="mm-theme-toggle"',
        '<div class="mm-search" role="search"><input type="search" placeholder="Search" aria-label="Search pages"><ul></ul></div><button class="mm-theme-toggle"',
      )
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, html)
    all.push(...result.diagnostics)
    needMermaid ||= result.hasMermaid
    needMath ||= result.hasMath
    const doc = pipeline.processor.parse(source)
    const text = (await pipeline.processor.render(doc, { format: 'text' })).output
    search.push({
      title: page.title,
      url: page.url,
      headings: outline(doc.tree).flatMap(function flat(h): string[] {
        return [h.text, ...h.children.flatMap(flat)]
      }),
      text: text.slice(0, 2000),
    })
  }
  if (!pages.some((p) => p.url === 'index.html')) {
    const list = pages.map((p) => `- [${p.title}](${p.url.replace(/\.html$/, '.md')})`).join('\n')
    const result = await renderPage(pipeline, `# ${siteName}\n\n${list}\n`, {
      format: 'html',
      standalone: true,
      assetsHref: 'assets/',
      siteName,
      homeHref: 'index.html',
    })
    writeFileSync(join(out, 'index.html'), result.output)
  }
  writeFileSync(join(out, 'search-index.json'), JSON.stringify(search))
  if (needMermaid || needMath)
    writeAssets(join(out, 'assets'), { mermaid: needMermaid, math: needMath })

  // Copy images and other assets next to the pages.
  const copyAssets = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || exclude.includes(e.name)) continue
      const full = join(d, e.name)
      if (e.isDirectory()) copyAssets(full)
      else if (/\.(?:png|jpe?g|gif|svg|webp|avif|ico|pdf|mp4|webm)$/i.test(e.name)) {
        const dest = join(out, relative(root, full))
        mkdirSync(dirname(dest), { recursive: true })
        copyFileSync(full, dest)
      }
    }
  }
  copyAssets(root)

  printDiagnostics(
    io,
    all.filter((d) => d.severity !== 'info'),
    flags.strict,
  )
  io.err(`built ${plural(pages.length, 'page')} into ${relative(io.cwd, out) || '.'}`)
  return failing(all, flags.strict === true) ? EXIT.INVALID : EXIT.OK
}
