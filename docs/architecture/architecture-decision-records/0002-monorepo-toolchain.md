# ADR 0002: bun + turbo monorepo, strict TypeScript, independently publishable packages

- Status: Accepted
- Date: 2026-10-20

## Context

MarkupMe is a set of parts that different users need separately: a browser-safe core, highlighting, diagrams, themes, a CLI, and (in progress) a web studio, a VS Code extension and a React component. Users must be able to install only what they use. The org's other TypeScript repos use bun and turbo on Node 22.

## Decision

- One repository, `YarlisAISolutions/markupme`, with bun workspaces (`apps/*`, `packages/*`) and turbo for `build`, `type-check`, `test` and `dev` (`turbo.json`). `packageManager: bun@1.4.0`, `engines.node: ">=22"`.
- Every package is published on its own under the `@markupme` npm scope, MIT licensed, ESM-only, with `exports`, `types`, `sideEffects: false` and `publishConfig.access: public`.
- TypeScript in strict mode with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `isolatedModules` (`tsconfig.base.json`). Packages build with plain `tsc -p tsconfig.build.json` into `dist/`; no bundler for libraries.
- vitest for unit tests, one `test/` folder per package.
- Biome for lint and format (`biome.json`): `bun run lint:check` in CI, `bun run lint` to fix.
- Exact dependency versions, no ranges, so builds are reproducible.

Current packages: `@markupme/core`, `@markupme/highlight`, `@markupme/diagrams`, `@markupme/themes`, `@markupme/cli`. In progress: `apps/studio`, `packages/vscode`, `packages/react`.

## Alternatives

| Option | Why not |
| ------ | ------- |
| One package with subpath exports | Users who want the core would pull in Shiki, Graphviz WASM and Mermaid. |
| npm or pnpm workspaces | Both work. bun matches the org standard and is fast for install and scripts. |
| tsup / rollup builds | Extra configuration for little gain: ESM-only output from `tsc` is enough for libraries. The studio uses Vite because it is an app. |
| ESLint + Prettier | Two tools and more configuration. Biome does both and is fast. |
| Jest | Slower ESM support. vitest runs ESM TypeScript directly. |

## Consequences

- Releasing means publishing several packages with matching versions. Each package has a `VERSION` constant (`packages/core/src/version.ts`) that a test keeps equal to `package.json` (`VERSION matches package.json`).
- Internal dependencies are pinned to the same version (`"@markupme/core": "0.1.0"`), so a release bumps them together.
- No CommonJS build. Projects on CommonJS need dynamic `import()`.
- The root `bun run lint:check && bun run build && bun run type-check && bun run test` is the definition of a green tree.
