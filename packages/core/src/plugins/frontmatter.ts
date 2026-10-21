import type { Root } from 'mdast'
import { parse as parseToml } from 'smol-toml'
import { parse as parseYaml } from 'yaml'
import type { Diagnostic } from '../types.js'

/** Reads the first YAML or TOML frontmatter block. Invalid data is reported, never thrown. */
export function readFrontmatter(
  tree: Root,
  report: (d: Diagnostic) => void,
): Record<string, unknown> | undefined {
  const node = tree.children[0]
  if (!node || (node.type !== 'yaml' && node.type !== 'toml')) return undefined
  const value = (node as { value: string }).value
  try {
    const data = node.type === 'yaml' ? parseYaml(value) : parseToml(value)
    if (data === null || data === undefined) return {}
    if (typeof data !== 'object' || Array.isArray(data)) {
      report({
        code: 'MM010',
        rule: 'invalid-frontmatter',
        severity: 'error',
        message: 'Frontmatter must be a mapping of keys to values',
        line: node.position?.start.line,
        column: 1,
      })
      return undefined
    }
    return data as Record<string, unknown>
  } catch (error) {
    report({
      code: 'MM010',
      rule: 'invalid-frontmatter',
      severity: 'error',
      message: `Invalid ${node.type.toUpperCase()} frontmatter: ${(error as Error).message.split('\n')[0]}`,
      line: node.position?.start.line,
      column: 1,
    })
    return undefined
  }
}
