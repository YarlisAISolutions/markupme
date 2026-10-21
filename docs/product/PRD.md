# Product requirements: MarkupMe

- Version: 0.1.0 (unreleased)
- Date: 2026-10-20
- Owner: Yarlis AI Solutions
- Licence: MIT
- Repository: [YarlisAISolutions/markupme](https://github.com/YarlisAISolutions/markupme), npm scope `@markupme`, CLI `markupme`

The original brief called the product "MarkForge" with the namespace `@yarlis/markforge-*`. It was renamed MarkupMe, `@markupme/*`, before any release.

Related: [BRD](BRD.md) · [FRD](FRD.md) · [NFR](NFR.md) · [Acceptance criteria](acceptance-criteria.md) · [Implementation plan](../implementation/implementation-plan.md)

## Problem

Teams write a lot of Markdown: READMEs, design docs, runbooks, release notes. To turn it into something readable and safe they combine five or six tools: a renderer (marked, markdown-it), a linter (markdownlint), a formatter (Prettier), a TOC tool, a diagram tool (Mermaid CLI, PlantUML) and a docs framework. Each has its own config and syntax rules. Common renderers do not sanitize by default, so untrusted Markdown leads to XSS. Diagrams usually load from a CDN or a public server. And many tools claim features they only half support.

## Product

MarkupMe is a standards-first Markdown engine with one CLI, plus editor integrations:

- A browser-safe core on unified/remark: CommonMark, GFM, frontmatter, GitHub alerts, directives, heading ids, TOC, math and emoji.
- Safe HTML by default, with highlighting and diagrams inserted after sanitizing.
- Diagrams as code: Yarlis Blueprint, Graphviz, Mermaid, and PlantUML/C4/Structurizr/D2 through an opt-in Kroki server.
- One CLI for render, lint, format, TOC, static site, live preview with a JSON API, diagram export, AST, stats, diff and capabilities.
- A web studio, a VS Code extension and a React component (in progress, Phase 1).

## Users

| Persona | Needs | Main entry point |
| ------- | ----- | ---------------- |
| Developer writing docs in a repo | Preview, lint in CI, keep TOCs fresh, diagrams next to text | CLI: `serve`, `validate`, `toc --check` |
| Platform team rendering user content | Safe HTML from untrusted Markdown, stable API | `@markupme/core` `render()` |
| Tech writer | A clean editor with live preview and export | Studio (in progress) |
| VS Code user | Preview with diagrams, diagnostics in the editor | VS Code extension (built) |
| React app developer | Render Markdown as components | `@markupme/react` (built) |
| Yarlis product teams | One shared Markdown engine across products | All of the above |

## Goals

| ID | Goal | Measure |
| -- | ---- | ------- |
| G1 | One tool replaces the render/lint/format/TOC/preview chain | All 12 CLI commands share one config file and one flag set ([FR-G13](FRD.md#g-cli)). |
| G2 | Safe by default | No script runs from any attack string in the security tests with default options ([AC-030](acceptance-criteria.md)). |
| G3 | No lock-in, no hidden network | Default render makes no network request; Kroki only when configured ([NFR-005](NFR.md)). |
| G4 | Honest capabilities | Every planned feature exits 64 or returns 501; `capabilities` matches reality ([AC-061](acceptance-criteria.md)), checked end to end by SDODS. |
| G5 | Source fidelity | Kitchen-sink document round-trips without loss ([AC-020](acceptance-criteria.md)). |
| G6 | Usable from editors | Studio and VS Code extension render the same HTML as the CLI (Phase 1, PR#2 and PR#3). |

## Non-goals (for now)

- Replacing Docusaurus or VitePress. `markupme build` makes simple sites; versioning, i18n and plugins-as-themes are out of scope.
- A new Markdown dialect. Extensions follow existing conventions (GitHub alerts, generic directives, VitePress-style fence meta).
- Running embedded code. MDX output is planned and will never execute untrusted documents.
- A hosted SaaS. Everything runs locally.

## Scope by phase

| Phase | Scope | Status |
| ----- | ----- | ------ |
| Phase 1, PR#1 | `@markupme/core`, `highlight`, `diagrams`, `themes`, `cli` (all commands, serve API), CI, SDODS api and ui suites in markupme-qa | Merged to `main`; 71 unit tests; SDODS api 17/17 and ui 10/10 pass in CI |
| Phase 1, PR#2 | `apps/studio` (Vite + CodeMirror 6), SDODS Studio scenarios | In progress (`feat/studio`) |
| Phase 1, PR#3 | `packages/vscode`, `packages/react` | In progress (`feat/vscode`) |
| Phase 2 | PDF, DOCX, MDX output; rich-text editing; VS Code Marketplace listing | Planned |

## Success metrics

These are targets for after the first release, not measurements.

| Metric | Target |
| ------ | ------ |
| Security issues reported against default settings | 0 unfixed after 30 days |
| CI green on `main` (`lint:check`, `build`, `type-check`, `test`) | 100% of merges |
| SDODS release gate pass rate | 100%, 0 flaky |
| Yarlis products using `@markupme/core` for Markdown | At least 2 within two quarters of the first release |

## Risks

See the [implementation plan](../implementation/implementation-plan.md#risks-and-mitigations).

## Open questions

1. Do we publish under `@markupme` from the first tag, and who owns the npm scope? The release workflow exists; the npm token must be rotated first (YCadence SDO-48).
2. Which Phase 2 export path for PDF: browser print through Playwright, or Pandoc as an external tool? (Pandoc is GPL; calling it as a separate program is fine, bundling is not.)
3. Milkdown or Tiptap for rich text: decided by the spike criteria in [ADR 0007](../architecture/architecture-decision-records/0007-codemirror-studio-editor.md).
