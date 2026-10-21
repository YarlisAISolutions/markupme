# Business requirements: MarkupMe

- Date: 2026-10-20
- Related: [PRD](PRD.md) · [FRD](FRD.md) · [NFR](NFR.md)

## Background

Yarlis AI Solutions builds several products that show Markdown to people: product docs, assistant answers, knowledge pages, work item descriptions, release notes. Each product picked its own renderer and its own safety rules. That means repeated work, different output for the same text, and uneven security. The org also wants open-source projects that outside developers can use and contribute to.

## Business objectives

| ID | Objective | Measure |
| -- | --------- | ------- |
| BO-1 | One Markdown engine for Yarlis products | Products import `@markupme/core` instead of their own renderer. Target: 2 products within two quarters of the first release. |
| BO-2 | Lower security risk from user-generated Markdown | Default rendering passes the security test list; any reported bypass is fixed and released within 30 days. |
| BO-3 | An open-source project with outside users | MIT licence, public repository, packages on npm under `@markupme` after the first tag. |
| BO-4 | Fewer tools in developer workflows | A repo can lint, format, keep TOCs fresh and preview with only `@markupme/cli`. |
| BO-5 | Credible capability claims | No feature is listed as built unless a test covers it. Planned features fail clearly (exit 64 / HTTP 501). |

## Stakeholders

| Stakeholder | Interest |
| ----------- | -------- |
| Yarlis product teams | A stable, safe engine with a clear upgrade path |
| Yarlis QA | End-to-end checks in `markupme-qa` with SDODS |
| Security (Yarlis Bastion) | Sanitize-by-default, no hidden network calls, disclosure process |
| Outside developers | Good docs, small focused packages, permissive licence |
| Maintainers | Simple toolchain matching the org (bun, turbo, Node 22) |

## Business rules

1. **Licence.** All MarkupMe code is MIT. Bundled dependencies must have MIT-compatible licences. GPL tools (Pandoc, some PlantUML editions) may be called as separate programs or servers, never linked into the packages.
2. **No mandatory SaaS.** Local processing needs no account and no network. Network features (Kroki, a Mermaid CDN URL) are opt-in.
3. **Honest claims.** README, docs and `markupme capabilities` show built, opt-in and planned status. Marketing text never runs ahead of the code.
4. **Org process.** Work items live in YCadence, not GitHub issues. Secrets come from Yarlis Keep. Deploys and announcements use the org's own tools (Tollgate, Relay). End-to-end tests live in `YarlisAISolutions/markupme-qa`.
5. **Naming.** Product name MarkupMe; npm scope `@markupme`; CLI `markupme`. Trademark and domain checks happen before public launch.

## Constraints

| Constraint | Source |
| ---------- | ------ |
| Node.js 22 or later, Bun 1.4 for development | Org runtime pins |
| ESM-only packages | unified ecosystem ([ADR 0001](../architecture/architecture-decision-records/0001-unified-remark-micromark.md)) |
| Core must run in browsers | Studio, React component, Yarlis web products |
| Releases tagged from `main` through pull requests | Org git rules |

## Assumptions

- The `@markupme` npm scope is available to the org. (Not verified.)
- `@bpview/core` 0.1.0 (Yarlis Blueprint) stays compatible with the provider API it exposes today (`renderSourceToSvg`).
- Users who need PlantUML or Structurizr can run or reach a Kroki server.

## Out of scope

- Hosted rendering service.
- Paid tiers or closed extensions.
- Content management (storage, permissions, workflows).

## Approval

This BRD is accepted when the Phase 1 PR#1 pull request merges with the documentation set. Changes after that go through a pull request that updates this file.
