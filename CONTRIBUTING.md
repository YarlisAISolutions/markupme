# Contributing to MarkupMe

Thanks for helping. This page says how to set up, what we expect in a pull request, and where to talk.

## Setup

Requirements: Node.js 22 or later and Bun 1.4.

```bash
git clone https://github.com/YarlisAISolutions/markupme.git
cd markupme
bun install
bun run build
node packages/cli/dist/bin.js --help
```

Useful commands:

| Command | What |
| ------- | ---- |
| `bun run build` | Build every package (`tsc`) |
| `bun run type-check` | Type-check every package |
| `bun run test` | Run all vitest suites |
| `bun run lint` | Fix lint and formatting with Biome |
| `bun run lint:check` | Check lint and formatting (what CI runs) |
| `cd packages/core && bunx vitest` | Watch one package's tests |
| `node packages/cli/dist/bin.js serve examples` | Preview the kitchen sink |

## Making a change

1. Create a branch from `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`.
2. Make the change with tests. Bug fixes get a test that fails without the fix.
3. Run all four checks:

   ```bash
   bun run lint:check && bun run build && bun run type-check && bun run test
   ```

4. Update the docs that describe the behaviour: `docs/guide/*`, and the status in `docs/product/FRD.md` and `docs/implementation/requirements-traceability.md` when a requirement changes state.
5. Add a line to `CHANGELOG.md` under "Unreleased".
6. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(diagrams): add a d2 provider`, `fix(core): keep ids on headings with emoji`.
7. Open a pull request. It is squash-merged.

## What we look for

- **Honest capabilities.** Do not mark anything as built in `markupme capabilities`, the README or the docs unless it works and has a test. Unfinished formats exit 64.
- **Security.** Sanitizing stays on by default. Changes to the sanitize schema, the SVG sanitizer or code block handlers need a security test. See [docs/guide/security.md](docs/guide/security.md).
- **Browser-safe core.** No `node:` imports in `packages/core`, `highlight`, `diagrams` or `themes`.
- **Determinism.** No timestamps or random values in output.
- **Small public API.** New exports need a reason and a doc entry in [docs/guide/sdk.md](docs/guide/sdk.md).
- **Plain docs.** Short sentences, concrete examples, no marketing words.

## Architecture decisions

Larger changes (a new package, a new dependency with wide reach, a change to the document model) need an ADR in `docs/architecture/architecture-decision-records/`. Copy the closest one and open it as `Proposed`.

## CI

Every pull request runs `.github/workflows/ci.yml`:

- `test`: the four checks above, `validate examples --strict --check-diagrams`, a determinism diff (render and build twice, `diff -r`) and `npm pack --dry-run` per package.
- `e2e`: starts `markupme serve examples --port 4321` and runs the SDODS api and ui suites from markupme-qa, with a minimum of 15 api and 10 ui scenarios.
- `gitleaks`: secret scan.

### Dependency overrides

The root `package.json` `overrides` force a patched version of a transitive dependency when the package that pulls it in has not caught up. Each one has a reason and a condition for removing it:

| Override | Advisory | Pulled in by | Remove when |
| -------- | -------- | ------------ | ----------- |
| `@azure/msal-node` 7.1.1 | [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5) (fixed in 7.1.0, no 6.x fix) | `@vscode/vsce` → `@azure/identity` 4.14.0, which declares `^6.0.0` | `@azure/identity` allows `^7` |
| `katex` 0.18.11 | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) (fixed in 0.18.2, no 0.16.x fix) | `rehype-katex` 7.0.1 and `micromark-extension-math` 3.1.0, which declare `^0.16.0`; Mermaid 12.2.0 already uses 0.18 | both declare `^0.18` |

The `@azure/msal-node` override is outside `@azure/identity`'s declared range. `@vscode/vsce` only reaches it for `--azure-credential` publishing, which no test covers and `vscode-publish.yml` does not use (it signs in with `VSCE_PAT`).

`security.yml` runs OSV-Scanner on the dependencies. `release.yml` publishes the npm packages and creates the `.vsix` GitHub release when versions bump, but only while the repository variable `RELEASE_ENABLED` is `true`; do not bump versions in a feature pull request unless you are cutting a release.

### Publishing the VS Code extension

`vscode-publish.yml` publishes `yarlis.markupme-vscode` to the VS Code Marketplace and Open VSX. It never runs on merge; a maintainer starts it from the Actions tab.

1. Bump `version` in `packages/vscode/package.json` and add a section to `packages/vscode/CHANGELOG.md`.
2. Run **Publish VS Code extension** with `dry_run` on. It builds, tests and packages the `.vsix` and checks that `VSCE_PAT` and `OVSX_PAT` can publish for `yarlis`.
3. Run it again with `dry_run` off. A version already on a registry is skipped.

The tokens are repository secrets managed by Yarlis Keep (`VSCE_PAT`: Azure DevOps, Marketplace (Manage) scope; `OVSX_PAT`: Open VSX). Rotate them with `pbpaste | ykeep rotate <NAME>`.

## End-to-end tests

End-to-end scenarios live in [YarlisAISolutions/markupme-qa](https://github.com/YarlisAISolutions/markupme-qa) and use SDODS. If you change the serve API, the playground or a `data-testid`, open a matching markupme-qa branch; the repository variable `QA_REF` points this repo's `e2e` job at it while both pull requests are open.

To run them locally:

```bash
node packages/cli/dist/bin.js serve examples --port 4321   # in this repo
bun run lint && bun run test:api && bun run test:ui        # in markupme-qa
```

## Reporting bugs and ideas

Yarlis team members file work items in YCadence. Outside contributors can open a pull request or start a GitHub discussion if enabled. Security problems: see [SECURITY.md](SECURITY.md), never a public report.

## Licence

By contributing you agree that your contribution is licensed under the MIT licence of this repository.
