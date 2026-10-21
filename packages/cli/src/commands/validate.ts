import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Diagnostic, Severity } from '@markupme/core'
import { DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { display, expandInputs, readInput } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import { failing, type Io, plural, printDiagnostics } from '../io.js'
import { createPipeline, fileExistsFrom, mergeConfig, renderPage } from '../pipeline.js'

export interface ValidateFlags extends FeatureFlagValues {
  strict?: boolean
  json?: boolean
  checkLinks?: boolean
  diagrams?: string
  quiet?: boolean
}

/** Lints files: parse diagnostics, rules, local links and (with --check-diagrams) diagram errors. */
export async function runValidate(
  io: Io,
  inputs: string[],
  flags: ValidateFlags & { checkDiagrams?: boolean },
  cmd?: import('commander').Command,
): Promise<number> {
  const config = mergeConfig(
    DEFAULT_CONFIG,
    loadConfig(io.cwd, flags.config),
    flagsToConfig(flags, cmd),
  )
  const files = expandInputs(io.cwd, inputs.length > 0 ? inputs : ['.'])
  const pipeline = createPipeline(config)
  const all: Diagnostic[] = []
  for (const file of files) {
    const doc = pipeline.processor.parse(readInput(file), { file: display(io.cwd, file) })
    const diags = pipeline.processor.validate(doc, {
      ...(config.rules ? { rules: config.rules } : {}),
      ...(flags.checkLinks !== false && file !== '-'
        ? { fileExists: fileExistsFrom(dirname(file)) }
        : {}),
    })
    if (flags.checkDiagrams) {
      const page = await renderPage(pipeline, doc.source, {
        format: 'html',
        file: display(io.cwd, file),
      })
      diags.push(...page.diagnostics.filter((d) => d.code === 'MM040'))
    }
    all.push(...diags)
  }
  const count = (s: Severity) => all.filter((d) => d.severity === s).length
  const ok = !failing(all, flags.strict === true)
  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          ok,
          files: files.length,
          errors: count('error'),
          warnings: count('warning'),
          diagnostics: all,
        },
        null,
        2,
      ),
    )
  } else {
    printDiagnostics(
      io,
      flags.quiet ? all.filter((d) => d.severity === 'error') : all,
      flags.strict,
    )
    io.err(
      `${ok ? '✓' : '✗'} ${plural(files.length, 'file')}: ${plural(count('error'), 'error')}, ${plural(count('warning'), 'warning')}, ${count('info')} info`,
    )
  }
  return ok ? EXIT.OK : EXIT.INVALID
}

export interface FormatFlags extends FeatureFlagValues {
  write?: boolean
  check?: boolean
  bullet?: string
  emphasis?: string
}

/** Normalizes Markdown (consistent markers, spacing, fences). Content is never dropped. */
export async function runFormat(
  io: Io,
  inputs: string[],
  flags: FormatFlags,
  cmd?: import('commander').Command,
): Promise<number> {
  const config = mergeConfig(loadConfig(io.cwd, flags.config), flagsToConfig(flags, cmd), {
    toc: false,
  })
  const files = expandInputs(io.cwd, inputs.length > 0 ? inputs : ['-'])
  if ((flags.write || flags.check) && files.includes('-'))
    throw new CliError('--write/--check need files', EXIT.USAGE)
  const { processor } = createPipeline({ ...config, diagrams: { providers: [] } })
  let changed = 0
  for (const file of files) {
    const source = readInput(file)
    const formatted = processor.serialize(processor.parse(source), {
      ...(flags.bullet ? { bullet: flags.bullet as '-' } : {}),
      ...(flags.emphasis ? { emphasis: flags.emphasis as '_' } : {}),
    })
    if (formatted === source) continue
    changed++
    if (flags.check) io.err(`would reformat ${display(io.cwd, file)}`)
    else if (flags.write) {
      writeFileSync(file, formatted)
      io.err(`formatted ${display(io.cwd, file)}`)
    } else io.out(formatted.replace(/\n$/, ''))
  }
  if (!flags.write && !flags.check && changed === 0 && files.length === 1)
    io.out(readInput(files[0] as string).replace(/\n$/, ''))
  if (flags.check) {
    io.err(
      changed === 0
        ? `✓ ${plural(files.length, 'file')} already formatted`
        : `✗ ${plural(changed, 'file')} need formatting`,
    )
    return changed === 0 ? EXIT.OK : EXIT.INVALID
  }
  return EXIT.OK
}

export interface TocFlags extends FeatureFlagValues {
  write?: boolean
  check?: boolean
  position?: string
}

/** Inserts or refreshes a `<!-- toc -->` block (after the title when the file has none). */
export async function runToc(
  io: Io,
  file: string,
  flags: TocFlags,
  cmd?: import('commander').Command,
): Promise<number> {
  const base = mergeConfig(loadConfig(io.cwd, flags.config), flagsToConfig(flags, cmd))
  const tocOpts = typeof base.toc === 'object' ? base.toc : {}
  const position = (flags.position ?? 'after-title') as 'after-title'
  const config = { ...base, toc: { ...tocOpts, position } }
  const [path] = expandInputs(io.cwd, [file])
  const source = readInput(path as string)
  const { processor } = createPipeline({ ...config, diagrams: { providers: [] } })
  const doc = processor.parse(source)
  const hasToc = doc.tree.children.some((n) => n.type === 'toc')
  if (!hasToc) throw new CliError('No headings deep enough for a table of contents', EXIT.INVALID)
  const out = processor.serialize(doc)
  if (flags.check) {
    if (out !== source) {
      io.err(`✗ table of contents in ${display(io.cwd, path as string)} is out of date`)
      return EXIT.INVALID
    }
    io.err('✓ table of contents is up to date')
  } else if (flags.write) {
    writeFileSync(path as string, out)
    io.err(`updated table of contents in ${display(io.cwd, path as string)}`)
  } else io.out(out.replace(/\n$/, ''))
  return EXIT.OK
}
