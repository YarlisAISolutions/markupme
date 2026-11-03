// The stable exports of @markupme/cli that no behaviour test exercises on its own (MKP-3).
// docs/api-stability.md links here; `run` and `EXIT` are covered by cli.test.ts.
import { describe, expect, expectTypeOf, it } from 'vitest'
import { CliError, EXIT, type Io } from '../src/index.js'

describe('stable cli exports', () => {
  it('CliError carries an exit code', () => {
    const e = new CliError('bad flag', EXIT.USAGE)
    expect(e).toBeInstanceOf(Error)
    expect(e.exitCode).toBe(2)
  })

  it('EXIT codes are fixed', () => {
    expect(EXIT).toEqual({ OK: 0, INVALID: 1, USAGE: 2, FAILURE: 3, UNSUPPORTED: 64 })
  })

  it('exports the stable types', () => {
    expectTypeOf<Io>().toHaveProperty('out')
    expectTypeOf<Io>().toHaveProperty('cwd')
  })
})
