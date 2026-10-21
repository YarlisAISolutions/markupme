import type { ProcessorOptions, RenderOptions, RuleSetting, TocOptions } from '@markupme/core'

/** Settings the extension reads, already validated. Kept free of `vscode` so it can be tested. */
export interface MarkupMeSettings {
  theme: 'auto' | 'light' | 'dark'
  sanitize: boolean
  lineNumbers: boolean
  math: boolean
  emoji: boolean
  providers: string[]
  server: string
  toc: { minDepth: number; maxDepth: number }
  formatEnable: boolean
  validateEnable: boolean
  rules: Record<string, RuleSetting>
}

export const DEFAULT_SETTINGS: MarkupMeSettings = {
  theme: 'auto',
  sanitize: true,
  lineNumbers: false,
  math: false,
  emoji: false,
  providers: ['blueprint', 'graphviz', 'mermaid'],
  server: '',
  toc: { minDepth: 2, maxDepth: 3 },
  formatEnable: false,
  validateEnable: true,
  rules: {},
}

export const PROVIDER_IDS = ['blueprint', 'graphviz', 'mermaid'] as const

const RULE_SETTINGS = new Set<string>(['off', 'info', 'warning', 'error'])

/** Reads one setting by its key below `markupme.` (for example `preview.theme`). */
export type SettingGetter = (key: string) => unknown

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

function depth(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6 ? v : d
}

/** Turns raw configuration values into settings, falling back to defaults for anything invalid. */
export function readSettings(get: SettingGetter): MarkupMeSettings {
  const d = DEFAULT_SETTINGS
  const theme = get('preview.theme')
  const providers = get('diagrams.providers')
  const server = get('diagrams.server')
  const rawRules = get('validate.rules')
  const rules: Record<string, RuleSetting> = {}
  if (rawRules && typeof rawRules === 'object' && !Array.isArray(rawRules)) {
    for (const [k, v] of Object.entries(rawRules))
      if (typeof v === 'string' && RULE_SETTINGS.has(v)) rules[k] = v as RuleSetting
  }
  let minDepth = depth(get('toc.minDepth'), d.toc.minDepth)
  let maxDepth = depth(get('toc.maxDepth'), d.toc.maxDepth)
  if (minDepth > maxDepth) [minDepth, maxDepth] = [maxDepth, minDepth]
  return {
    theme: theme === 'light' || theme === 'dark' || theme === 'auto' ? theme : d.theme,
    sanitize: bool(get('preview.sanitize'), d.sanitize),
    lineNumbers: bool(get('preview.lineNumbers'), d.lineNumbers),
    math: bool(get('markdown.math'), d.math),
    emoji: bool(get('markdown.emoji'), d.emoji),
    providers: Array.isArray(providers)
      ? [
          ...new Set(
            providers.filter((p): p is string =>
              (PROVIDER_IDS as readonly string[]).includes(p as string),
            ),
          ),
        ]
      : [...d.providers],
    server: typeof server === 'string' ? server.trim() : '',
    toc: { minDepth, maxDepth },
    formatEnable: bool(get('format.enable'), d.formatEnable),
    validateEnable: bool(get('validate.enable'), d.validateEnable),
    rules,
  }
}

/**
 * Settings that are safe in an untrusted workspace (VS Code Workspace Trust). A workspace could
 * set these to turn sanitizing off or send diagram source to a server of its choosing, so until
 * the user trusts it, rendering stays sanitized and Kroki stays off.
 */
export function applyTrust(s: MarkupMeSettings, trusted: boolean): MarkupMeSettings {
  return trusted ? s : { ...s, sanitize: true, server: '' }
}

export function tocOptions(s: MarkupMeSettings): TocOptions {
  return { minDepth: s.toc.minDepth, maxDepth: s.toc.maxDepth }
}

/** Processor options for rendering and validation. `toc` keeps `[[toc]]` markers working. */
export function processorOptions(s: MarkupMeSettings): ProcessorOptions {
  return { math: s.math, emoji: s.emoji, toc: tocOptions(s) }
}

/** Processor options for formatting: no TOC regeneration, so formatting never rewrites content. */
export function formatOptions(s: MarkupMeSettings): ProcessorOptions {
  return { math: s.math, emoji: s.emoji, toc: false }
}

export function renderOptions(
  s: MarkupMeSettings,
  extra: Pick<RenderOptions, 'baseUrl' | 'codeBlocks'> = {},
): RenderOptions {
  return {
    format: 'html',
    sanitize: s.sanitize,
    allowHtml: true,
    anchors: true,
    externalLinksNewTab: false,
    ...extra,
  }
}
