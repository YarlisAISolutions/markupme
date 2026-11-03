/**
 * rehype plugin that renders math with KaTeX: the in-tree equivalent of rehype-katex 7.0.1 (MIT,
 * https://github.com/remarkjs/remark-math), calling the `katex` version this package pins.
 * rehype-katex declares `katex ^0.16.0`, and npm ignores our root `overrides` for installed
 * packages, so depending on it gave every consumer a vulnerable KaTeX (GHSA-238p-pmpm-9mq7,
 * MKP-7). Behaviour is unchanged: elements with a `language-math`, `math-display` or
 * `math-inline` class are replaced by KaTeX output; errors are reported on the file and
 * rendered in KaTeX's error style.
 */
import type { ElementContent, Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { toText } from 'hast-util-to-text'
import katex from 'katex'
import { SKIP, visitParents } from 'unist-util-visit-parents'
import type { VFile } from 'vfile'

export function rehypeKatex() {
  return (tree: Root, file: VFile): undefined => {
    visitParents(tree, 'element', (element, parents) => {
      const classes: unknown[] = Array.isArray(element.properties.className)
        ? element.properties.className
        : []
      // ```math fenced code
      const languageMath = classes.includes('language-math')
      // $$ flow math
      const mathDisplay = classes.includes('math-display')
      // $ text math
      const mathInline = classes.includes('math-inline')
      let displayMode = mathDisplay

      if (!languageMath && !mathDisplay && !mathInline) return

      let parent = parents[parents.length - 1]
      let scope = element

      // ```math: replace the <pre> and use display mode.
      if (
        element.tagName === 'code' &&
        languageMath &&
        parent &&
        parent.type === 'element' &&
        parent.tagName === 'pre'
      ) {
        scope = parent
        parent = parents[parents.length - 2]
        displayMode = true
      }

      if (!parent) return

      const value = toText(scope, { whitespace: 'pre' })
      let result: ElementContent[] | string

      try {
        result = katex.renderToString(value, { displayMode, throwOnError: true })
      } catch (error) {
        const cause = error as Error
        file.message('Could not render math with KaTeX', {
          ancestors: [...parents, element],
          cause,
          place: element.position,
          ruleId: cause.name.toLowerCase(),
          source: 'rehype-katex',
        })
        try {
          result = katex.renderToString(value, {
            displayMode,
            strict: 'ignore',
            throwOnError: false,
          })
        } catch {
          // KaTeX's error markup, for errors it does not handle itself.
          result = [
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['katex-error'],
                style: 'color:#cc0000',
                title: String(error),
              },
              children: [{ type: 'text', value }],
            },
          ]
        }
      }

      if (typeof result === 'string') {
        result = fromHtmlIsomorphic(result, { fragment: true }).children as ElementContent[]
      }

      const index = parent.children.indexOf(scope)
      parent.children.splice(index, 1, ...result)
      return SKIP
    })
  }
}
