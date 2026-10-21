import { watch as fsWatch, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { Diagnostic, RenderFormat } from '@markupme/core'
import { DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { display, expandInputs, MARKDOWN_EXT, readInput } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import { failing, type Io, plural, printDiagnostics } from '../io.js'
import { createPipeline, mergeConfig, renderPage, writeAssets } from '../pipeline.js'

const FORMATS: Record<string, RenderFormat> = {
  html: 'html',
  md: 'markdown',
  markdown: 'markdown',
  ast: 'ast',
  json: 'ast',
  text: 'text',
  txt: 'text',
}
const PLANNED: Record<string, string> = {
  pdf: 'PDF export is planned (print the --standalone HTML to PDF meanwhile)',
  docx: 'DOCX export is planned',
  mdx: 'MDX output is planned',
}
const EXT: Record<RenderFormat, string> = {
  html: '.html',
  markdown: '.md',
  ast: '.json',
  text: '.txt',
}

export interface RenderFlags extends FeatureFlagValues {
  format?: string
  output?: string
  standalone?: boolean
  assetsDir?: string
  inlineAssets?: boolean
  mermaidUrl?: string
  strict?: boolean
  json?: boolean
  watch?: boolean
  quiet?: boolean
}

export async function runRender(
  io: Io,
  inputs: string[],
  flags: RenderFlags,
  cmd?: import('commander').Command,
): Promise<number> {
  const name = (flags.format ?? 'html').toLowerCase()
  if (PLANNED[name])
    throw new CliError(`${PLANNED[name]}. See \`markupme capabilities\`.`, EXIT.UNSUPPORTED)
  const format = FORMATS[name]
  if (!format)
    throw new CliError(`Unknown format "${name}". Use html, md, ast or text.`, EXIT.USAGE)
  const config = mergeConfig(
    DEFAULT_CONFIG,
    loadConfig(io.cwd, flags.config),
    flagsToConfig(flags, cmd),
  )
  const files = expandInputs(io.cwd, inputs.length > 0 ? inputs : ['-'])
  const outArg = flags.output ? resolve(io.cwd, flags.output) : undefined
  const many = files.length > 1
  const outIsDir =
    outArg !== undefined && (many || (!MARKDOWN_EXT.test(outArg) && !/\.\w+$/.test(outArg)))
  if (many && !outArg)
    throw new CliError('Rendering several files needs -o <directory>', EXIT.USAGE)

  const once = async (): Promise<Diagnostic[]> => {
    const pipeline = createPipeline(config)
    const all: Diagnostic[] = []
    const base = files.length > 1 ? commonDir(files) : undefined
    for (const file of files) {
      const source = readInput(file)
      const target = !outArg
        ? undefined
        : outIsDir
          ? join(
              outArg,
              (base ? relative(base, file) : basename(file)).replace(MARKDOWN_EXT, '') +
                EXT[format],
            )
          : outArg
      const assetsDir =
        flags.inlineAssets || !target
          ? undefined
          : resolve(
              io.cwd,
              flags.assetsDir ??
                (outIsDir ? join(outArg as string, 'assets') : join(dirname(target), 'assets')),
            )
      const assetsHref =
        assetsDir && target
          ? `${relative(dirname(target), assetsDir).split('\\').join('/') || '.'}/`
          : undefined
      const page = await renderPage(pipeline, source, {
        format,
        standalone: flags.standalone === true,
        file: display(io.cwd, file),
        ...(assetsHref ? { assetsHref } : {}),
        inlineMermaid: !assetsHref && !flags.mermaidUrl,
        ...(flags.mermaidUrl ? { mermaidUrl: flags.mermaidUrl } : {}),
      })
      all.push(...page.diagnostics)
      if (target) {
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, page.output)
        if (
          flags.standalone &&
          assetsDir &&
          ((page.hasMermaid && !flags.mermaidUrl) || page.hasMath)
        )
          writeAssets(assetsDir, {
            mermaid: page.hasMermaid && !flags.mermaidUrl,
            math: page.hasMath,
          })
        if (!flags.quiet && !flags.json) io.err(`wrote ${display(io.cwd, target)}`)
      } else io.out(page.output.replace(/\n$/, ''))
    }
    return all
  }

  const report = (diagnostics: Diagnostic[]) => {
    if (flags.json)
      io.out(
        JSON.stringify({ ok: !failing(diagnostics, flags.strict === true), diagnostics }, null, 2),
      )
    else
      printDiagnostics(
        io,
        diagnostics.filter((d) => d.severity !== 'info'),
        flags.strict,
      )
  }

  let diagnostics = await once()
  report(diagnostics)
  if (!flags.watch) return failing(diagnostics, flags.strict === true) ? EXIT.INVALID : EXIT.OK
  if (files.includes('-')) throw new CliError('--watch needs files, not stdin', EXIT.USAGE)

  io.err(`watching ${plural(files.length, 'file')} (Ctrl+C to stop)`)
  let timer: ReturnType<typeof setTimeout> | undefined
  const watchers = [...new Set(files.map((f) => dirname(f)))].map((dir) =>
    fsWatch(dir, () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          diagnostics = await once()
          report(diagnostics)
        } catch (error) {
          io.err(`markupme: ${(error as Error).message}`)
        }
      }, 80)
    }),
  )
  await new Promise<void>((done) => process.once('SIGINT', () => done()))
  for (const w of watchers) w.close()
  return EXIT.OK
}

function commonDir(files: string[]): string {
  const parts = files.map((f) => dirname(f).split('/'))
  const first = parts[0] ?? []
  let i = 0
  while (i < first.length && parts.every((p) => p[i] === first[i])) i++
  return first.slice(0, i).join('/') || '/'
}
