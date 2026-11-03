/**
 * remark plugin for math syntax: the in-tree equivalent of remark-math 6.0.0 (MIT,
 * https://github.com/remarkjs/remark-math), using `mdast-util-math` and the ported tokenizers in
 * `math-syntax.ts`. See that file for why remark-math is no longer a dependency (MKP-7).
 */
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import type { Processor } from 'unified'
import { mathSyntax } from './math-syntax.js'

export function remarkMath(this: Processor): undefined {
  const data = this.data()
  data.micromarkExtensions ??= []
  data.fromMarkdownExtensions ??= []
  data.toMarkdownExtensions ??= []
  data.micromarkExtensions.push(mathSyntax())
  data.fromMarkdownExtensions.push(mathFromMarkdown())
  data.toMarkdownExtensions.push(mathToMarkdown())
}
