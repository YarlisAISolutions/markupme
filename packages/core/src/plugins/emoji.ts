import { gemoji } from 'gemoji'
import type { Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

let names: Map<string, string> | undefined

function lookup(): Map<string, string> {
  if (!names) {
    names = new Map()
    for (const entry of gemoji) for (const name of entry.names) names.set(name, entry.emoji)
  }
  return names
}

const SHORTCODE = /:([a-z0-9_+-]+):/g

/** Render time: replaces GitHub `:shortcode:` names with emoji. Unknown names stay as written. */
export function presentEmoji(tree: Root): void {
  const map = lookup()
  visit(tree, 'text', (node: Text) => {
    if (!node.value.includes(':')) return
    node.value = node.value.replace(SHORTCODE, (whole, name: string) => map.get(name) ?? whole)
  })
}
