import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import { diagnosticRange, fileExistsFrom, SEVERITY, severityIndex } from '../src/diagnostics.js'

describe('diagnostics', () => {
  it('maps severities to VS Code values', () => {
    expect(severityIndex('error')).toBe(SEVERITY.error)
    expect(severityIndex('warning')).toBe(1)
    expect(severityIndex('info')).toBe(2)
  })

  const lines = ['# Title', '', 'some text here']
  const len = (l: number) => lines[l]?.length ?? 0

  it('converts 1-based positions to 0-based ranges', () => {
    expect(diagnosticRange({ line: 3, column: 6, endLine: 3, endColumn: 10 }, len, 3)).toEqual({
      startLine: 2,
      startCharacter: 5,
      endLine: 2,
      endCharacter: 9,
    })
  })

  it('falls back to the rest of the line, or the whole line', () => {
    expect(diagnosticRange({ line: 3, column: 6 }, len, 3)).toEqual({
      startLine: 2,
      startCharacter: 5,
      endLine: 2,
      endCharacter: 14,
    })
    expect(diagnosticRange({}, len, 3)).toEqual({
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 7,
    })
    expect(diagnosticRange({ line: 99 }, len, 3).startLine).toBe(2)
  })

  it('checks local files relative to the document folder', () => {
    const seen: string[] = []
    const exists = fileExistsFrom('/docs', (p) => {
      seen.push(p)
      return p === '/docs/my file.md'
    })
    expect(exists('my%20file.md')).toBe(true)
    expect(exists('missing.md')).toBe(false)
    expect(seen).toContain('/docs/missing.md')
  })

  it('works with the core validator', () => {
    const p = createProcessor()
    const found = p.validate('# A\n\n[x](./nope.md)\n\n# B\n', {
      rules: { 'single-h1': 'error' },
      fileExists: fileExistsFrom('/nowhere', () => false),
    })
    const codes = found.map((d) => `${d.code}:${d.severity}`)
    expect(codes).toContain('MM002:error')
    expect(codes.some((c) => c.startsWith('MM012'))).toBe(true)
  })
})
