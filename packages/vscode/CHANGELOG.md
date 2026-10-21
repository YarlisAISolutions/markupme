# Changelog

## 0.2.2

- Installs on VS Code 1.82 and later (was 1.95). Older VS Code runs extensions on Node 18, so the extension supplies the Web Crypto global there. CI now runs the end-to-end tests in the oldest supported VS Code and the latest stable.

## 0.2.1

- Marketplace page: the version and install badges come from vsmarketplacebadges.dev, because shields.io retired its Marketplace badges.

## 0.2.0

- New MarkupMe mark and Marketplace page: icon, banner colour, badges and screenshots.
- **Get started with MarkupMe** walkthrough. It opens once on first install; **MarkupMe: Get Started** opens it again.
- Snippets for Mermaid, Graphviz and Blueprint diagrams, GitHub alerts, the table-of-contents region, containers, tables, tasks, footnotes, collapsible sections and math.
- **MarkupMe: Toggle Bold / Italic / Strikethrough / Inline Code**. Opt-in shortcuts (Ctrl/Cmd+B, Ctrl/Cmd+I, Alt+S) with `markupme.editor.shortcuts`. Ctrl+Alt+M (Cmd+Alt+M) opens the preview to the side.
- Preview, table of contents and export in the editor's right-click menu; Open Preview in the Explorer's.
- JSON schema for `markupme.config.json`.
- Workspace Trust: in Restricted Mode, rendering stays sanitized and Kroki stays off. Virtual workspaces are supported with the local-file check skipped.
- After a feature release, one short notice links to these notes (`markupme.notifications.whatsNew`).
- Dark mode: Graphviz and Blueprint diagrams sit on a white card instead of a white box inside a dark one.

## 0.1.0

- First release: live preview with Blueprint, Graphviz and Mermaid diagrams and syntax highlighting, scroll sync, Export to HTML, Insert/Update Table of Contents, Format Document, lint diagnostics and a word count in the status bar.
