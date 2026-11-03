import { CommanderError } from 'commander'
import { CliError, EXIT } from './exit.js'
import { type Io, processIo } from './io.js'
import { program } from './program.js'

export { CliError, EXIT, type Io }

/** Runs the CLI and returns the exit code. Never calls process.exit, so tests can run it in-process. */
export async function run(argv: string[], io: Io = processIo): Promise<number> {
  let code: number | Promise<number> = EXIT.OK
  const p = program(io, (c) => {
    code = c
  })
  try {
    await p.parseAsync(argv, { from: 'user' })
    return await code
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version' ||
        error.code === 'commander.help'
      )
        return EXIT.OK
      return EXIT.USAGE
    }
    if (error instanceof CliError) {
      io.err(`markupme: ${error.message}`)
      return error.exitCode
    }
    io.err(`markupme: ${(error as Error).message}`)
    return EXIT.FAILURE
  }
}
