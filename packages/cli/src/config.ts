import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ProcessorOptions, RuleSetting, TocOptions } from '@markupme/core'
import { CliError, EXIT } from './exit.js'

export const CONFIG_FILE = 'markupme.config.json'

/** `markupme.config.json`. Every field is optional; CLI flags win over the file. */
export interface MarkupMeConfig {
  gfm?: boolean
  frontmatter?: boolean
  directives?: boolean
  alerts?: boolean
  math?: boolean
  emoji?: boolean
  headingIds?: boolean
  toc?: boolean | TocOptions
  render?: {
    sanitize?: boolean
    allowHtml?: boolean
    anchors?: boolean
    highlight?: boolean
    lineNumbers?: boolean
    theme?: 'light' | 'dark' | 'auto'
    baseUrl?: string
    externalLinksNewTab?: boolean
  }
  diagrams?: {
    /** Provider ids to enable. Default ['blueprint', 'graphviz', 'mermaid']. */
    providers?: string[]
    /** Kroki server for PlantUML, Structurizr, C4, D2 … Off by default. */
    server?: string
  }
  rules?: Record<string, RuleSetting>
  site?: { name?: string; exclude?: string[] }
}

export const DEFAULT_CONFIG: MarkupMeConfig = {
  gfm: true,
  frontmatter: true,
  directives: true,
  alerts: true,
  math: false,
  emoji: false,
  headingIds: true,
  toc: { minDepth: 2, maxDepth: 3 },
  render: { sanitize: true, anchors: true, highlight: true, lineNumbers: false, theme: 'auto' },
  diagrams: { providers: ['blueprint', 'graphviz', 'mermaid'] },
  rules: {},
}

export function loadConfig(cwd: string, path?: string): MarkupMeConfig {
  const file = path ? resolve(cwd, path) : join(cwd, CONFIG_FILE)
  if (!existsSync(file)) {
    if (path) throw new CliError(`Config file not found: ${path}`, EXIT.USAGE)
    return {}
  }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (typeof data !== 'object' || data === null || Array.isArray(data))
      throw new Error('expected an object')
    return data as MarkupMeConfig
  } catch (error) {
    throw new CliError(`Invalid ${CONFIG_FILE}: ${(error as Error).message}`, EXIT.USAGE)
  }
}

export function processorOptions(c: MarkupMeConfig): ProcessorOptions {
  const o: ProcessorOptions = {}
  for (const k of [
    'gfm',
    'frontmatter',
    'directives',
    'alerts',
    'math',
    'emoji',
    'headingIds',
    'toc',
  ] as const) {
    if (c[k] !== undefined) (o as Record<string, unknown>)[k] = c[k]
  }
  return o
}
