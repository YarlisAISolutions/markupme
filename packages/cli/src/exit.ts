/** Exit codes. Stable: CI scripts may depend on them. */
export const EXIT = {
  OK: 0,
  /** Validation errors (or warnings with --strict), or `format --check` found changes. */
  INVALID: 1,
  /** Bad arguments or options. */
  USAGE: 2,
  /** Rendering or file I/O failed. */
  FAILURE: 3,
  /** The command or format is on the roadmap but not implemented. */
  UNSUPPORTED: 64,
} as const

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message)
    this.name = 'CliError'
  }
}
