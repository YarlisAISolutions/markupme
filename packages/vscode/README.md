# MarkupMe for VS Code

Standards-first Markdown (CommonMark + GFM) in VS Code: a live preview with diagrams and syntax highlighting, HTML export, a table of contents, formatting and lint diagnostics. It uses the same engine as the `markupme` CLI.

## Features

- **Preview.** `MarkupMe: Open Preview` and `MarkupMe: Open Preview to the Side` (also the preview button in the editor title bar of Markdown files). The preview updates as you type, follows the active Markdown editor, and scrolls with the editor.
  - Syntax highlighting with Shiki, in light and dark.
  - Diagrams: Blueprint (`ybp`, `blueprint`, `blueprint-yaml`) and Graphviz (`dot`, `graphviz`) render inside VS Code; Mermaid (`mermaid`) renders in the preview. A Kroki server can add PlantUML, C4, Structurizr, D2 and more (off by default).
  - GitHub alerts, footnotes, task lists, directives, optional KaTeX math and emoji.
  - Relative images load from the document's folder. Links to other files open them in VS Code; web links open in the browser.
  - The colors follow the VS Code theme, or a fixed light or dark theme.
  - The preview runs with a strict Content Security Policy: scripts need a per-page nonce, and the HTML is sanitized unless you turn that off.
- **Export to HTML.** `MarkupMe: Export to HTML` writes a standalone page (default `<name>.html` next to the file). When the page has Mermaid diagrams or math, `mermaid.min.js` and the KaTeX stylesheet go into an `assets/` folder next to it, as with `markupme render`.
- **Table of contents.** `MarkupMe: Insert/Update Table of Contents` refreshes the `<!-- toc --> … <!-- tocstop -->` region, or adds one after the first level-1 heading. Only that region changes, and one undo removes it.
- **Formatting.** `MarkupMe: Format Document` normalizes Markdown (list markers, emphasis, fences, spacing) without dropping content. Turn on `markupme.format.enable` to make MarkupMe a formatter for **Format Document** and format-on-save.
- **Diagnostics.** MarkupMe's lint rules (heading levels, a single h1, broken fragment links, missing local files, image alt text, unsafe URLs and more) show in the Problems panel as you type, with the rule code (for example `MM012`).
- **Word count.** The status bar shows the word count of the active Markdown file; click it to open the preview.

## Commands

| Command | ID |
| --- | --- |
| MarkupMe: Open Preview | `markupme.openPreview` |
| MarkupMe: Open Preview to the Side | `markupme.openPreviewToSide` |
| MarkupMe: Export to HTML | `markupme.exportHtml` |
| MarkupMe: Insert/Update Table of Contents | `markupme.insertToc` |
| MarkupMe: Format Document | `markupme.formatDocument` |

`markupme.exportHtml` also accepts a target file URI as an argument (for keybindings and tasks); the save dialog is skipped then.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `markupme.preview.theme` | `auto` | `auto` follows the VS Code theme; `light` or `dark` fixes it. Also used for exported HTML. |
| `markupme.preview.sanitize` | `true` | Sanitize rendered HTML. Turning it off lets raw HTML through unchanged: only do that for documents you trust. |
| `markupme.preview.lineNumbers` | `false` | Line numbers on every code block. |
| `markupme.markdown.math` | `false` | `$inline$` and `$$block$$` math with KaTeX. |
| `markupme.markdown.emoji` | `false` | `:shortcode:` emoji. |
| `markupme.diagrams.providers` | `["blueprint", "graphviz", "mermaid"]` | Diagram renderers to use. |
| `markupme.diagrams.server` | `""` | Kroki server URL. This sends diagram source to that server. Empty turns Kroki off. |
| `markupme.toc.minDepth` / `markupme.toc.maxDepth` | `2` / `3` | Heading levels in a generated table of contents. |
| `markupme.format.enable` | `false` | Register MarkupMe as a Markdown formatter. Off by default so it does not replace your formatter. |
| `markupme.validate.enable` | `true` | Show lint diagnostics. |
| `markupme.validate.rules` | `{}` | Rule severities by name or code, for example `{ "single-h1": "off", "MM005": "error" }`. Values: `off`, `info`, `warning`, `error`. |

## Privacy

Nothing leaves your machine unless you set `markupme.diagrams.server`. Mermaid, KaTeX and the highlighter ship inside the extension.

## Development

```sh
bun run build        # esbuild bundle (dist/extension.js) + media/ (preview script, Mermaid, KaTeX)
bun run type-check
bun run test         # unit tests (vitest)
bun run test:e2e     # runs the extension in a real VS Code (needs a display)
bun run package      # markupme-vscode-0.1.0.vsix
```

`test:e2e` downloads VS Code unless `VSCODE_EXECUTABLE` points to an installed one. `bun run icon` renders `icon.svg` to `icon.png`.

## Publishing

The package is `private`, so npm never publishes it. The `publisher` (`yarlis`) is a placeholder: publishing to the Visual Studio Marketplace (or Open VSX) needs a publisher account and a token first. Until then, install the `.vsix` with `code --install-extension markupme-vscode-0.1.0.vsix`.

## License

MIT
