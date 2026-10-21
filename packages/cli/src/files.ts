import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { CliError, EXIT } from './exit.js'

export const MARKDOWN_EXT = /\.(?:md|markdown|mdown|mkd)$/i
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'site', 'out', 'coverage'])

/** Markdown files under a directory, sorted, skipping dot folders and build output. */
export function walkMarkdown(dir: string, exclude: string[] = []): string[] {
  const out: string[] = []
  const visit = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name.startsWith('.') || exclude.includes(entry.name)) continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) visit(full)
      } else if (MARKDOWN_EXT.test(entry.name)) out.push(full)
    }
  }
  visit(dir)
  return out
}

/** Expands file and directory arguments into Markdown files. `-` means stdin. */
export function expandInputs(cwd: string, inputs: string[]): string[] {
  const files: string[] = []
  for (const input of inputs) {
    if (input === '-') {
      files.push('-')
      continue
    }
    const full = resolve(cwd, input)
    if (!existsSync(full)) throw new CliError(`No such file or directory: ${input}`, EXIT.USAGE)
    if (statSync(full).isDirectory()) files.push(...walkMarkdown(full))
    else files.push(full)
  }
  if (files.length === 0) throw new CliError('No Markdown files found', EXIT.USAGE)
  return files
}

export function readInput(file: string): string {
  try {
    return file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8')
  } catch (error) {
    throw new CliError(`Cannot read ${file}: ${(error as Error).message}`, EXIT.FAILURE)
  }
}

export function display(cwd: string, file: string): string {
  if (file === '-') return '<stdin>'
  const rel = relative(cwd, file)
  return rel.startsWith('..') ? file : rel.split(sep).join('/')
}
