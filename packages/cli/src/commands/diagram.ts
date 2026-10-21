import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { extractDiagrams, sanitizeSvg } from '@markupme/diagrams'
import { DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { display, expandInputs, MARKDOWN_EXT, readInput } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import { type Io, plural } from '../io.js'
import { mergeConfig, mermaidScriptPath, providersFor } from '../pipeline.js'

/** Renders Mermaid to SVG in headless Chromium. Needs the optional `playwright` package. */
async function mermaidToSvg(sources: string[]): Promise<string[]> {
  let pw: {
    chromium: { launch(): Promise<{ newPage(): Promise<unknown>; close(): Promise<void> }> }
  }
  try {
    pw = (await import('playwright' as string)) as typeof pw
  } catch {
    throw new CliError(
      'Mermaid SVG export needs Playwright: npm i -D playwright && npx playwright install chromium',
      EXIT.UNSUPPORTED,
    )
  }
  const browser = await pw.chromium.launch()
  try {
    const page = (await browser.newPage()) as {
      setContent(html: string): Promise<void>
      addScriptTag(o: { content: string }): Promise<void>
      evaluate<T, A>(fn: (a: A) => Promise<T>, arg: A): Promise<T>
    }
    await page.setContent('<!doctype html><html><body></body></html>')
    await page.addScriptTag({ content: readFileSync(mermaidScriptPath(), 'utf8') })
    return await page.evaluate(async (list: string[]) => {
      const m = (
        globalThis as unknown as {
          mermaid: {
            initialize(o: object): void
            render(id: string, s: string): Promise<{ svg: string }>
          }
        }
      ).mermaid
      m.initialize({ startOnLoad: false, securityLevel: 'strict' })
      const out: string[] = []
      for (let i = 0; i < list.length; i++)
        out.push((await m.render(`mm${i}`, list[i] as string)).svg)
      return out
    }, sources)
  } finally {
    await browser.close()
  }
}

export async function runDiagram(
  io: Io,
  file: string,
  flags: FeatureFlagValues & { output?: string; list?: boolean },
  cmd?: import('commander').Command,
): Promise<number> {
  const config = mergeConfig(
    DEFAULT_CONFIG,
    loadConfig(io.cwd, flags.config),
    flagsToConfig(flags, cmd),
  )
  const providers = providersFor(config)
  const [path] = expandInputs(io.cwd, [file])
  const found = await extractDiagrams(readInput(path as string), providers)
  if (flags.list || !flags.output) {
    for (const d of found)
      io.out(`${d.index + 1}. ${d.provider} (${d.lang})${d.line ? ` line ${d.line}` : ''}`)
    if (!flags.output)
      io.err(
        `${plural(found.length, 'diagram')} in ${display(io.cwd, path as string)}${found.length ? ' (use -o <dir> to export SVG)' : ''}`,
      )
    return EXIT.OK
  }
  const outDir = resolve(io.cwd, flags.output)
  mkdirSync(outDir, { recursive: true })
  const stem = basename(path as string).replace(MARKDOWN_EXT, '')
  let failed = 0
  const mermaid = found.filter((d) => d.provider === 'mermaid')
  const mermaidSvgs = mermaid.length > 0 ? await mermaidToSvg(mermaid.map((d) => d.source)) : []
  for (const d of found) {
    const name = `${stem}-${d.index + 1}-${d.lang}.svg`
    try {
      let svg: string
      if (d.provider === 'mermaid') svg = mermaidSvgs[mermaid.indexOf(d)] as string
      else {
        const p = providers.find((x) => x.id === d.provider)
        const out = await p?.render({ lang: d.lang, source: d.source, theme: 'light' })
        if (out?.kind !== 'svg') throw new Error('no SVG output')
        svg = out.svg
      }
      writeFileSync(join(outDir, name), `${sanitizeSvg(svg)}\n`)
      io.err(`wrote ${display(io.cwd, join(outDir, name))}`)
    } catch (error) {
      failed++
      io.err(
        `${display(io.cwd, path as string)}:${d.line ?? 0} error MM040 ${d.provider} diagram: ${(error as Error).message}`,
      )
    }
  }
  io.err(
    `${plural(found.length - failed, 'diagram')} exported${failed ? `, ${failed} failed` : ''}`,
  )
  return failed ? EXIT.INVALID : EXIT.OK
}
