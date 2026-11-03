/**
 * `@markupme/cli/experimental`: the Node functions behind the `markupme` commands. The command
 * line is the CLI's contract; these follow its internals, so their shape may change in a minor
 * release. Pin the exact version when you use them. See docs/api-stability.md.
 */
export { CAPABILITIES } from './commands/info.js'
export { startServer } from './commands/serve.js'
export { createPipeline, mergeConfig, renderPage } from './pipeline.js'
