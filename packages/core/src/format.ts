import type { Diagnostic } from './types.js'

/** `file:line:col severity code message (rule)`: the format editors and CI annotate from. */
export function formatDiagnostic(d: Diagnostic): string {
  const where = [d.file ?? '<input>', d.line, d.column].filter((x) => x !== undefined).join(':')
  return `${where} ${d.severity} ${d.code} ${d.message} (${d.rule})`
}
