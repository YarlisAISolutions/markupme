import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { Diagnostic, Severity } from '@markupme/core'

/** Numeric values of `vscode.DiagnosticSeverity` (Error, Warning, Information, Hint). */
export const SEVERITY = { error: 0, warning: 1, info: 2, hint: 3 } as const

export function severityIndex(s: Severity): number {
  return s === 'error' ? SEVERITY.error : s === 'warning' ? SEVERITY.warning : SEVERITY.info
}

export interface LineRange {
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
}

/**
 * Converts 1-based MarkupMe positions to a 0-based range. Without an end position, the range runs
 * from the column to the end of the line (the whole line when there is no column either).
 */
export function diagnosticRange(
  d: Pick<Diagnostic, 'line' | 'column' | 'endLine' | 'endColumn'>,
  lineLength: (line: number) => number,
  lineCount: number,
): LineRange {
  const last = Math.max(0, lineCount - 1)
  const clampLine = (l: number) => Math.min(last, Math.max(0, l))
  const startLine = clampLine((d.line ?? 1) - 1)
  const startCharacter = Math.min(lineLength(startLine), Math.max(0, (d.column ?? 1) - 1))
  if (d.endLine !== undefined) {
    const endLine = clampLine(d.endLine - 1)
    const endCharacter = Math.min(
      lineLength(endLine),
      Math.max(0, (d.endColumn ?? lineLength(endLine) + 1) - 1),
    )
    if (endLine > startLine || (endLine === startLine && endCharacter > startCharacter))
      return { startLine, startCharacter, endLine, endCharacter }
  }
  const len = lineLength(startLine)
  return {
    startLine,
    startCharacter: startCharacter >= len ? 0 : startCharacter,
    endLine: startLine,
    endCharacter: len,
  }
}

/** Checks a relative link target against a document's folder. Percent-escapes are decoded. */
export function fileExistsFrom(baseDir: string, exists: (p: string) => boolean = existsSync) {
  return (path: string): boolean => {
    let p = path
    try {
      p = decodeURIComponent(path)
    } catch {
      // keep the raw path
    }
    return (
      exists(isAbsolute(p) ? p : join(baseDir, p)) || (p !== path && exists(join(baseDir, path)))
    )
  }
}
