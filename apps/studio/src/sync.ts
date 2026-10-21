/** Editor → preview scroll mapping. Pure: anchors are measured by the caller. */

export interface Anchor {
  /** 1-based source line where the block starts. */
  line: number
  /** Offset of the rendered block from the top of the preview's scroll content, in px. */
  top: number
}

/**
 * Prefix of the class MarkupMe Studio puts on top-level blocks (`mm-srcline-12`). Distinct from
 * the highlighter's `mm-line-numbers` / `mm-line-highlight`.
 */
export const LINE_CLASS = 'mm-srcline-'

/** True for a Studio source-line class such as `mm-srcline-12`. */
export function isLineClass(c: string): boolean {
  return c.startsWith(LINE_CLASS) && /^\d+$/.test(c.slice(LINE_CLASS.length))
}

/** Reads the source line from a class list such as `['markdown-alert', 'mm-srcline-12']`. */
export function lineFromClasses(classes: Iterable<string>): number | undefined {
  for (const c of classes) {
    if (!c.startsWith(LINE_CLASS)) continue
    const n = Number(c.slice(LINE_CLASS.length))
    if (Number.isInteger(n) && n > 0) return n
  }
  return undefined
}

/** Sorts by line, drops duplicates and anchors whose offset goes backwards (hidden blocks). */
export function normalizeAnchors(anchors: Anchor[]): Anchor[] {
  const sorted = [...anchors].sort((a, b) => a.line - b.line || a.top - b.top)
  const out: Anchor[] = []
  for (const a of sorted) {
    const last = out[out.length - 1]
    if (last && (a.line === last.line || a.top < last.top)) continue
    out.push(a)
  }
  return out
}

/**
 * The preview scroll offset for a (fractional) source line: interpolates between the nearest
 * anchors before and after it. Before the first anchor maps to 0; after the last, the offset
 * grows towards `maxTop` over the remaining lines.
 */
export function previewOffsetForLine(
  line: number,
  anchors: Anchor[],
  totalLines: number,
  maxTop: number,
): number {
  const first = anchors[0]
  if (!first || line <= 1) return 0
  if (line < first.line) return (first.top * (line - 1)) / Math.max(first.line - 1, 1)
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i] as Anchor
    const b = anchors[i + 1]
    if (b && line >= a.line && line < b.line) {
      return a.top + ((b.top - a.top) * (line - a.line)) / (b.line - a.line)
    }
  }
  const last = anchors[anchors.length - 1] as Anchor
  const rest = Math.max(totalLines - last.line, 1)
  const end = Math.max(maxTop, last.top)
  return Math.min(end, last.top + ((end - last.top) * (line - last.line)) / rest)
}
