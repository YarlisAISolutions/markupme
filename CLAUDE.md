# CLAUDE.md: MarkupMe

Rules for agents (and people) working in this repository. Read [README.md](README.md) for what the product does and [docs/](docs/) for requirements and decisions.

## Product

- Name: **MarkupMe**. npm scope **`@markupme`**. CLI **`markupme`**. Repository `YarlisAISolutions/markupme`. Licence MIT.
- The original brief (`docs/product/original-brief.md`) says "MarkForge" and `@yarlis/markforge-*`. Those names are retired; never use them in code or docs.
- Stack: bun 1.4 workspaces + turbo, Node.js 22 or later, TypeScript strict, `tsc` builds, vitest, Biome. ESM only.

| Path | Package |
| ---- | ------- |
| `packages/core` | `@markupme/core`: parse, document model, safe HTML, serialize, lint, TOC, diff, stats |
| `packages/highlight` | `@markupme/highlight`: Shiki code block handler |
| `packages/diagrams` | `@markupme/diagrams`: diagram providers, SVG sanitizer |
| `packages/themes` | `@markupme/themes`: CSS, runtime, `wrapDocument` |
| `packages/cli` | `@markupme/cli`: the `markupme` command and preview server |
| `packages/react` | `@markupme/react`: `<Markdown>`, `useMarkdown`, `renderToReact` |
| `packages/vscode` | `markupme-vscode` (private): preview, export, TOC, formatter, diagnostics; packaged as a `.vsix` |
| `apps/studio` | MarkupMe Studio (private): Vite + CodeMirror 6 browser editor, served at `/studio/` in the e2e run |

## Rules

1. **No fake features.** Planned stays planned. A format or command that is not built exits 64 in the CLI (`EXIT.UNSUPPORTED`) and returns 501 from the serve API. `CAPABILITIES` in `packages/cli/src/commands/info.ts` lists a feature as `built` only when the code and a test exist. Docs and README follow the same rule.
2. **Sanitize by default, never weakened.** `sanitize` defaults to true everywhere. Do not add tags, attributes or classes to `markupmeSchema` (`packages/core/src/render/schema.ts`) without a new test in `describe('security')` in `packages/core/test/core.test.ts`. Handler output is trusted: escape everything you put in it, and pass all SVG through `sanitizeSvg`. See [ADR 0003](docs/architecture/architecture-decision-records/0003-sanitize-by-default.md).
3. **Determinism.** Same input and options give the same output. Keep the determinism tests (`is deterministic`, `renders Blueprint to deterministic SVG`, `keeps a TOC block idempotent`) passing; add one when you add output that could vary (no timestamps, no random ids outside the slot nonce).
4. **Browser-safe libraries.** No `node:` imports in `packages/core/src`, and keep it that way in `highlight`, `diagrams` and `themes`. Filesystem access goes through injected functions (like `ValidateOptions.fileExists`). Node-only code belongs in `packages/cli`.
5. **Data-preserving parse.** Parse-time transforms keep what the serializer needs; presentation happens on a clone at render time ([ADR 0004](docs/architecture/architecture-decision-records/0004-document-model.md)). Never drop unknown syntax: keep it and report a diagnostic.
6. **Stable contracts.** Diagnostic codes (`MMxxx`), exit codes (0/1/2/3/64), the `Diagnostic` shape and `SCHEMA_VERSION` change only on purpose, with a CHANGELOG entry.
7. **Versions in sync.** `VERSION` in `packages/core/src/version.ts` equals `packages/core/package.json` (a test checks it). Internal dependencies use the same exact version. Bump them together.
8. **No network by default.** No CDN URLs in output unless the user passes `--mermaid-url`; Kroki only with a configured server.
9. **Exact dependency versions**, no ranges. Keep the runtime pins (Node 22, Bun 1.4).
10. **Docs stay true.** When you change behaviour, update `docs/guide/*`, the FRD row status and `docs/implementation/requirements-traceability.md`.

## Before claiming done

```bash
bun run lint:check && bun run build && bun run type-check && bun run test
```

All four must pass. Report test counts from the real output. CI (`.github/workflows/ci.yml`) runs the same plus `validate examples --strict --check-diagrams`, a determinism diff, `npm pack --dry-run`, the SDODS e2e suites from markupme-qa and gitleaks; do not weaken or skip those steps. If you changed the serve API or a `data-testid`, say which markupme-qa scenarios need updating.

## Git

- Feature branch and pull request for every change; never commit on `main`. Branch prefixes: `feat/` `fix/` `chore/` `docs/` `ci/` `test/`. Squash-merge and delete the branch.
- Conventional Commits (`feat(core): …`, `fix(cli): …`, `docs: …`).
- Run `gitleaks git --staged --no-banner .` before each commit.
- Never add `Co-Authored-By: Claude`, `Claude-Session:` or "Generated with Claude Code" lines to commits or pull requests.
- Never force-push, `reset --hard` or bypass hooks (`--no-verify`).
- `gh` and HTTPS git need the sandbox off.

## Org process

- **Work items** live in YCadence (https://ycadence.yarlis.com), not GitHub issues. Bugs, follow-ups and gaps go there.
- **Secrets** only through Yarlis Keep (`ykeep`). Never literals, `.env` files or log lines.
- **End-to-end tests** live in `YarlisAISolutions/markupme-qa` (SDODS). Agents propose scenarios; a person accepts them. Run against `markupme serve examples --port 4321`.
- **Announcements** go through Yarlis Relay; release and PR events are sent automatically by the org webhook.
