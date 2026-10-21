import { type Diagnostic, formatDiagnostic } from '@markupme/core'

/** Where output goes; tests swap it for buffers. */
export interface Io {
  out(text: string): void
  err(text: string): void
  cwd: string
  env: Record<string, string | undefined>
}

export const processIo: Io = {
  out: (t) => process.stdout.write(`${t}\n`),
  err: (t) => process.stderr.write(`${t}\n`),
  cwd: process.cwd(),
  env: process.env,
}

/** Human output, plus GitHub Actions annotations when running there. */
export function printDiagnostics(io: Io, diagnostics: Diagnostic[], strict = false): void {
  const gha = io.env.GITHUB_ACTIONS === 'true'
  for (const d of diagnostics) {
    io.err(formatDiagnostic(d))
    if (gha && d.severity !== 'info') {
      const level = d.severity === 'error' || strict ? 'error' : 'warning'
      const props = [
        d.file && `file=${d.file}`,
        d.line && `line=${d.line}`,
        d.column && `col=${d.column}`,
        `title=${d.code}`,
      ]
        .filter(Boolean)
        .join(',')
      io.out(`::${level} ${props}::${d.message.replace(/\r?\n/g, ' ')}`)
    }
  }
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** True when the diagnostics should fail the command. */
export function failing(diagnostics: Diagnostic[], strict: boolean): boolean {
  return diagnostics.some((d) => d.severity === 'error' || (strict && d.severity === 'warning'))
}
