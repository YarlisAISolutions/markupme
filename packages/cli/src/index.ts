import { VERSION } from '@markupme/core'
import { Command, CommanderError } from 'commander'
import { runBuild } from './commands/build.js'
import { runDiagram } from './commands/diagram.js'
import { runCapabilities, runDiff, runInit, runParse, runStats } from './commands/info.js'
import { runRender } from './commands/render.js'
import { runServe, startServer } from './commands/serve.js'
import { runFormat, runToc, runValidate } from './commands/validate.js'
import { CliError, EXIT } from './exit.js'
import { addFeatureFlags, addRenderFlags } from './flags.js'
import { type Io, processIo } from './io.js'

export { CAPABILITIES } from './commands/info.js'
export { createPipeline, mergeConfig, renderPage } from './pipeline.js'
export { CliError, EXIT, type Io, startServer }

const collect = (value: string, prev: string[] = []) => [...prev, value]

function program(io: Io, setCode: (code: number | Promise<number>) => void): Command {
  const p = new Command('markupme')
    .description('MarkupMe: render, lint, format and preview Markdown with diagrams.')
    .version(VERSION, '-v, --version')
    .showSuggestionAfterError()
    .configureOutput({
      writeOut: (s) => io.out(s.replace(/\n$/, '')),
      writeErr: (s) => io.err(s.replace(/\n$/, '')),
    })
    .exitOverride()

  p.command('init')
    .description('create markupme.config.json (and docs/welcome.md)')
    .option('--force', 'overwrite an existing config')
    .option('--no-sample', 'skip the sample document')
    .action((o) => setCode(runInit(io, o)))

  addRenderFlags(
    addFeatureFlags(
      p
        .command('render')
        .description('render Markdown files (or stdin) to html, md, ast or text')
        .argument('[inputs...]', 'files or directories; - for stdin')
        .option('-f, --format <format>', 'html, md, ast, text (pdf and docx are planned)', 'html')
        .option('-o, --output <path>', 'output file, or directory for several inputs')
        .option('-s, --standalone', 'full HTML page with styles, dark mode and the runtime')
        .option(
          '--assets-dir <dir>',
          'where to write mermaid.min.js and KaTeX files (default: <output>/assets)',
        )
        .option('--inline-assets', 'put Mermaid inside the page (one offline file)')
        .option('--mermaid-url <url>', 'load Mermaid from this URL instead of a local copy')
        .option('-w, --watch', 're-render when files change')
        .option('--strict', 'warnings fail the command')
        .option('--json', 'print diagnostics as JSON')
        .option('-q, --quiet', 'only print problems'),
    ),
  ).action((inputs, o, cmd) => setCode(runRender(io, inputs, o, cmd)))

  addFeatureFlags(
    p
      .command('validate')
      .alias('lint')
      .description('lint Markdown: structure, links, accessibility, frontmatter, directives')
      .argument('[inputs...]', 'files or directories (default: .)')
      .option('--strict', 'warnings fail the command')
      .option('--json', 'machine-readable output')
      .option('--no-check-links', 'skip checking that relative links point to files')
      .option('--check-diagrams', 'render diagrams and report their errors')
      .option('--diagrams <list>', 'diagram providers for --check-diagrams')
      .option('--diagram-server <url>', 'Kroki server for --check-diagrams')
      .option(
        '-r, --rule <name=level>',
        'set a rule to off, info, warning or error (repeatable)',
        collect,
      )
      .option('-q, --quiet', 'only print errors'),
  ).action((inputs, o, cmd) => setCode(runValidate(io, inputs, o, cmd)))

  addFeatureFlags(
    p
      .command('format')
      .alias('fmt')
      .description('normalize Markdown formatting (content is never dropped)')
      .argument('[inputs...]', 'files or directories; - for stdin')
      .option('--write', 'rewrite files in place')
      .option('--check', 'exit 1 when a file would change')
      .option('--bullet <char>', 'list bullet: - * +')
      .option('--emphasis <char>', 'emphasis marker: _ *'),
  ).action((inputs, o, cmd) => setCode(runFormat(io, inputs, o, cmd)))

  addFeatureFlags(
    p
      .command('toc')
      .description('insert or refresh a <!-- toc --> table of contents')
      .argument('<file>')
      .option('--write', 'update the file in place')
      .option('--check', 'exit 1 when the TOC is missing or stale')
      .option('--position <where>', 'after-title (default) or top, when the file has no marker'),
  ).action((file, o, cmd) => setCode(runToc(io, file, o, cmd)))

  addRenderFlags(
    addFeatureFlags(
      p
        .command('build')
        .description('build a static documentation site with navigation and search')
        .argument('[dir]', 'source directory', '.')
        .option('-o, --output <dir>', 'output directory', 'site')
        .option('--name <name>', 'site name')
        .option('--no-clean', 'keep existing files in the output directory')
        .option('--strict', 'warnings fail the build'),
    ),
  ).action((dir, o, cmd) => setCode(runBuild(io, dir, o, cmd)))

  addRenderFlags(
    addFeatureFlags(
      p
        .command('serve')
        .alias('preview')
        .description('live preview with reload, a playground and a JSON render API')
        .argument('[path]', 'file or directory', '.')
        .option('-p, --port <port>', 'port (default 4321, 0 = any free port)')
        .option('--host <host>', 'interface to bind (default 127.0.0.1)')
        .option('--cors <origin>', 'allow this origin (or *) to call the API')
        .option('--unsafe', 'let API callers disable sanitizing (never on a shared host)')
        .option('--no-live-reload', 'do not reload pages on change'),
    ),
  ).action((path, o, cmd) => setCode(runServe(io, path, o, cmd)))

  addFeatureFlags(
    p
      .command('diagram')
      .description('list or export the diagrams in a Markdown file as SVG')
      .argument('<file>')
      .option('-o, --output <dir>', 'write one SVG per diagram here')
      .option('--list', 'only list the diagrams')
      .option('--diagrams <list>', 'diagram providers')
      .option('--diagram-server <url>', 'Kroki server for PlantUML, Structurizr, C4 …'),
  ).action((file, o, cmd) => setCode(runDiagram(io, file, o, cmd)))

  addFeatureFlags(
    p
      .command('parse')
      .description('print the document model (JSON AST with positions)')
      .argument('[file]', 'file; - or nothing for stdin')
      .option('--outline', 'print the heading outline instead')
      .option('--no-positions', 'leave out source positions'),
  ).action((file, o, cmd) => setCode(runParse(io, file, o, cmd)))

  addFeatureFlags(
    p
      .command('stats')
      .description('word count, reading time and structure')
      .argument('[inputs...]')
      .option('--json', 'JSON output'),
  ).action((inputs, o, cmd) => setCode(runStats(io, inputs, o, cmd)))

  addFeatureFlags(
    p
      .command('diff')
      .description('structural (block-level) diff of two Markdown files; exit 1 when they differ')
      .argument('<a>')
      .argument('<b>')
      .option('--json', 'JSON output'),
  ).action((a, b, o, cmd) => setCode(runDiff(io, a, b, o, cmd)))

  p.command('capabilities')
    .description('what is built, opt-in and planned; the lint rules')
    .option('--json', 'JSON output')
    .action((o) => setCode(runCapabilities(io, o)))

  return p
}

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
