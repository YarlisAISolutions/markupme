# Changelog

All notable changes to the `@markupme/*` packages. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

First version. Not yet published to npm.

### Added

- `@markupme/core`: CommonMark and GFM parsing on unified/remark; YAML and TOML frontmatter; GitHub alerts; directives (callouts, `details`, `figure`, `columns`, `kbd`, `abbr`, `mark`, `sub`, `sup`, `badge`, `toc`, `br`); GitHub-style heading ids with `{#custom-id}`; TOC markers; opt-in math (KaTeX) and emoji.
- Document model `MarkupMeDocument` with `schemaVersion: 1`, positions and diagnostics.
- HTML rendering sanitized by default, with trusted code block output inserted after sanitizing; Markdown, JSON AST and plain-text output.
- `validate` with ten lint rules (MM001, MM002, MM004, MM005, MM006, MM008, MM012, MM013, MM015, MM016), plugin rules and severity overrides.
- `transform`, `serialize`, `roundTrip`, `query`, `outline`, `diff`, `stats`.
- `@markupme/highlight`: Shiki highlighting with dual themes, titles, line numbers, line highlights and copy buttons.
- `@markupme/diagrams`: provider interface; Yarlis Blueprint and Graphviz (WebAssembly) to SVG; Mermaid for the browser; opt-in Kroki for PlantUML, C4, Structurizr, D2 and more; SVG sanitizer; SHA-256 cache.
- `@markupme/themes`: light, dark and print CSS, page runtime (copy, theme toggle, Mermaid), `wrapDocument`.
- `@markupme/cli`: `init`, `render`, `validate`/`lint`, `format`/`fmt`, `toc`, `build`, `serve`/`preview` (live reload, playground, JSON API), `diagram`, `parse`, `stats`, `diff`, `capabilities`; `markupme.config.json`; exit codes 0/1/2/3/64; GitHub Actions annotations.
- Documentation: guides, PRD, BRD, FRD, NFR, acceptance criteria, ADRs 0001–0008, implementation plan, traceability, competitive analysis.

- Task list checkboxes get an accessible name (`Completed task: …` / `Open task: …`).
- `POST /api/render` accepts `lint: true` to add lint diagnostics; the playground uses it.
- CI: `ci.yml` (lint, build, type-check, tests, strict example validation, determinism diff, pack dry-run, SDODS e2e, gitleaks), `security.yml`, `release.yml` (npm publish with provenance).

### Changed

- VS Code extension (`markupme-vscode`): live preview with diagrams under a strict CSP, export HTML, insert/update TOC, opt-in formatter, diagnostics in the Problems panel.
- `@markupme/react`: `<Markdown>`, `useMarkdown` and `renderToReact`, sanitized like the HTML output.
- MarkupMe Studio (`apps/studio`): browser editor with live preview, diagrams, outline, problems, command palette, autosave, import and export, themes and focus mode.
- Plugin `rehype` hooks run on the hast tree before sanitizing.
- The `TocOptions.title` doc comment now says it sets the TOC's `aria-label` (default "Table of contents").
