/** Looks up a Studio element by id (without the `st-` prefix). Throws when the shell is broken. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(`st-${id}`)
  if (!el) throw new Error(`MarkupMe Studio: missing element #st-${id}`)
  return el as T
}

/** Creates an element with attributes and text. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  if (text !== undefined) el.textContent = text
  return el
}

export const isApple = /Mac|iPhone|iPad|iPod/.test(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform,
)
