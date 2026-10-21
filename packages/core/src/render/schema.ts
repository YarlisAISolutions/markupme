import { defaultSchema, type Schema } from 'hast-util-sanitize'

/** Classes MarkupMe itself emits. User-authored classes outside this list are removed. */
const CLASS_NAMES: (string | RegExp)[] = [
  /^mm-[\w-]+$/,
  /^markdown-alert(?:-[\w-]+)?$/,
  /^language-[\w+#.-]+$/,
  'contains-task-list',
  'task-list-item',
  'footnotes',
  'sr-only',
  'data-footnote-backref',
  'math',
  'math-inline',
  'math-display',
]

/**
 * GitHub's sanitization schema (hast-util-sanitize default) plus the elements and classes that
 * MarkupMe's own transforms produce. Scripts, event handlers, `style`, iframes and
 * `javascript:` URLs stay blocked.
 */
export const markupmeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'nav',
    'section',
    'figure',
    'figcaption',
    'mark',
    'abbr',
    'aside',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []).filter((a) => a !== 'className'),
      ['className', ...CLASS_NAMES],
      'role',
      'ariaLabel',
      'ariaHidden',
      'dataFootnotes',
      'dataFootnoteRef',
      'dataFootnoteBackref',
    ],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'decoding'],
    abbr: ['title'],
    details: ['open'],
    code: [['className', ...CLASS_NAMES]],
  },
}
