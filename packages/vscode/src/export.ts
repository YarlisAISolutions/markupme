import { wrapDocument } from '@markupme/themes'
import { type Pipeline, renderBody } from './pipeline.js'

/** Folder next to the exported page that holds browser assets, as in `markupme render`. */
export const ASSETS_DIR = 'assets'

export interface ExportedPage {
  html: string
  /** Assets to copy into `assets/` next to the page. */
  needs: { mermaid: boolean; math: boolean }
  title?: string
}

/** A standalone HTML page (theme, runtime, Mermaid and KaTeX linked from `assets/`). */
export async function exportPage(
  p: Pipeline,
  source: string,
  o: { file?: string; fallbackTitle?: string } = {},
): Promise<ExportedPage> {
  const doc = p.processor.parse(source, o.file ? { file: o.file } : {})
  const r = await renderBody(p, doc)
  const description = doc.frontmatter?.description
  const title = r.title ?? o.fallbackTitle
  const html = wrapDocument({
    body: r.output,
    ...(title ? { title } : {}),
    ...(typeof description === 'string' ? { description } : {}),
    theme: p.settings.theme,
    ...(r.hasMath
      ? { head: `<link rel="stylesheet" href="${ASSETS_DIR}/katex/katex.min.css">` }
      : {}),
    ...(r.hasMermaid ? { mermaidUrl: `${ASSETS_DIR}/mermaid.min.js` } : {}),
  })
  return { html, needs: { mermaid: r.hasMermaid, math: r.hasMath }, ...(title ? { title } : {}) }
}
