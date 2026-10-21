import type { RuleSetting } from '@markupme/core'
import type { Command } from 'commander'
import type { MarkupMeConfig } from './config.js'
import { CliError, EXIT } from './exit.js'

/** Feature switches shared by render, build, serve and validate. */
export function addFeatureFlags(cmd: Command): Command {
  return cmd
    .option('-c, --config <file>', 'config file (default: ./markupme.config.json)')
    .option(
      '--no-gfm',
      'CommonMark only: no tables, task lists, strikethrough, autolinks, footnotes',
    )
    .option('--no-frontmatter', 'treat --- blocks as Markdown')
    .option('--no-directives', 'disable :::callouts, ::toc and :kbd[] directives')
    .option('--no-alerts', 'disable GitHub > [!NOTE] alerts')
    .option('--math', 'render $math$ and $$math$$ with KaTeX')
    .option('--emoji', 'replace :shortcode: emoji')
    .option('--no-heading-ids', 'do not add ids to headings')
    .option('--toc [position]', 'insert a table of contents: marker (default), top or after-title')
    .option('--toc-depth <range>', 'heading levels in the TOC, e.g. 2-3')
}

export function addRenderFlags(cmd: Command): Command {
  return cmd
    .option('--theme <mode>', 'light, dark or auto (follows the system)')
    .option('--no-sanitize', 'trust the input: keep scripts, styles and event handlers (unsafe)')
    .option('--no-html', 'drop raw HTML in the Markdown')
    .option('--no-anchors', 'no # links on headings')
    .option('--no-highlight', 'no syntax highlighting')
    .option('--line-numbers', 'line numbers on every code block')
    .option('--diagrams <list>', 'diagram providers: blueprint,graphviz,mermaid,kroki or none')
    .option(
      '--diagram-server <url>',
      'Kroki server for PlantUML, Structurizr, C4, D2 … (sends diagram source to it)',
    )
    .option('--base-url <url>', 'resolve relative links and images against this URL')
    .option('--external-new-tab', 'open external links in a new tab')
}

export interface FeatureFlagValues {
  config?: string
  gfm?: boolean
  frontmatter?: boolean
  directives?: boolean
  alerts?: boolean
  math?: boolean
  emoji?: boolean
  headingIds?: boolean
  toc?: boolean | string
  tocDepth?: string
  theme?: string
  sanitize?: boolean
  html?: boolean
  anchors?: boolean
  highlight?: boolean
  lineNumbers?: boolean
  diagrams?: string
  diagramServer?: string
  baseUrl?: string
  externalNewTab?: boolean
  rule?: string[]
}

/** Only flags the user actually changed go into the layer, so the config file still applies. */
export function flagsToConfig(f: FeatureFlagValues, cmd?: Command): MarkupMeConfig {
  const set = (name: string) => !cmd || cmd.getOptionValueSource(name) === 'cli'
  const c: MarkupMeConfig = {}
  for (const k of [
    'gfm',
    'frontmatter',
    'directives',
    'alerts',
    'math',
    'emoji',
    'headingIds',
  ] as const)
    if (f[k] !== undefined && set(k)) c[k] = f[k]
  if (f.toc !== undefined && set('toc')) {
    const position = f.toc === true ? 'marker-only' : f.toc
    if (!['marker', 'marker-only', 'top', 'after-title'].includes(String(position)))
      throw new CliError(`--toc must be marker, top or after-title (got "${position}")`, EXIT.USAGE)
    c.toc = { position: position === 'marker' ? 'marker-only' : (position as 'top') }
  }
  if (f.tocDepth) {
    const m = /^([1-6])-([1-6])$/.exec(f.tocDepth)
    if (!m) throw new CliError('--toc-depth must look like 2-3', EXIT.USAGE)
    c.toc = {
      ...(typeof c.toc === 'object' ? c.toc : {}),
      minDepth: Number(m[1]),
      maxDepth: Number(m[2]),
    }
  }
  const render: NonNullable<MarkupMeConfig['render']> = {}
  if (f.theme !== undefined) {
    if (!['light', 'dark', 'auto'].includes(f.theme))
      throw new CliError('--theme must be light, dark or auto', EXIT.USAGE)
    render.theme = f.theme as 'auto'
  }
  if (f.sanitize !== undefined && set('sanitize')) render.sanitize = f.sanitize
  if (f.html !== undefined && set('html')) render.allowHtml = f.html
  if (f.anchors !== undefined && set('anchors')) render.anchors = f.anchors
  if (f.highlight !== undefined && set('highlight')) render.highlight = f.highlight
  if (f.lineNumbers) render.lineNumbers = true
  if (f.baseUrl) render.baseUrl = f.baseUrl
  if (f.externalNewTab) render.externalLinksNewTab = true
  if (Object.keys(render).length > 0) c.render = render
  if (f.diagrams !== undefined || f.diagramServer !== undefined) {
    c.diagrams = {}
    if (f.diagrams !== undefined)
      c.diagrams.providers = f.diagrams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    if (f.diagramServer) c.diagrams.server = f.diagramServer
  }
  if (f.rule?.length) {
    const rules: Record<string, RuleSetting> = {}
    for (const r of f.rule) {
      const [name, level] = r.split('=')
      if (!name || !level || !['off', 'info', 'warning', 'error'].includes(level))
        throw new CliError(
          `--rule must look like name=off|info|warning|error (got "${r}")`,
          EXIT.USAGE,
        )
      rules[name] = level as RuleSetting
    }
    c.rules = rules
  }
  return c
}
