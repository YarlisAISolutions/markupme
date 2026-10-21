# Export to HTML

**MarkupMe: Export to HTML** writes a standalone page next to your file:

- Graphviz and Blueprint diagrams are inline SVG.
- Mermaid and KaTeX are copied into an `assets/` folder beside the page. Nothing loads from a CDN.
- The HTML is sanitized, the same as in the preview.

The same output comes from the `markupme render --standalone` command line.
