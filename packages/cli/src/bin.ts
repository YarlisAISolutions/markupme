#!/usr/bin/env node
import { run } from './index.js'

// `markupme … | head` closes the pipe early; that is not an error.
for (const stream of [process.stdout, process.stderr])
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0)
    throw error
  })

process.exitCode = await run(process.argv.slice(2))
