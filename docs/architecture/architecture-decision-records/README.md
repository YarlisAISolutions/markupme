# Architecture decision records

Decisions that shape MarkupMe, in [Michael Nygard's format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Status, Context, Decision, Alternatives, Consequences. Each record is short and stands alone.

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-unified-remark-micromark.md) | unified, remark and micromark as the parsing foundation | Accepted |
| [0002](0002-monorepo-toolchain.md) | bun + turbo monorepo, strict TypeScript, independently publishable packages | Accepted |
| [0003](0003-sanitize-by-default.md) | Sanitize by default, insert trusted output through slots | Accepted |
| [0004](0004-document-model.md) | Document model: mdast + schemaVersion + diagnostics | Accepted |
| [0005](0005-diagram-provider-interface.md) | Diagram provider interface | Accepted |
| [0006](0006-mermaid-client-side.md) | Mermaid renders in the browser, no CDN by default | Accepted |
| [0007](0007-codemirror-studio-editor.md) | CodeMirror 6 for the studio; rich-text editing deferred | Accepted (studio in progress) |
| [0008](0008-sdods-e2e-validation.md) | SDODS end-to-end validation in markupme-qa, vitest for units | Accepted |

## Writing a new ADR

1. Copy the most similar record and number it next (`0009-short-title.md`).
2. Start with `Status: Proposed`. Change it to `Accepted` when the pull request that implements it merges.
3. Never rewrite an accepted record. Supersede it with a new one and set the old one to `Superseded by 00NN`.
4. Add it to the table above.
