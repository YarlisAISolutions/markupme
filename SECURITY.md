# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub's private vulnerability reporting:

1. Go to https://github.com/YarlisAISolutions/markupme/security/advisories/new (or the repository's **Security** tab, then **Report a vulnerability**).
2. Describe the problem, the affected package and version, and the smallest input that shows it (for example a Markdown string that runs script after `markupme render`).

Do not open a public issue, pull request or discussion for a vulnerability.

We aim to acknowledge a report within 3 working days and to ship a fix within 30 days for confirmed issues in default settings. These are targets, not guarantees. We credit reporters in the advisory unless you ask us not to.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x (unreleased) | Yes, once released |

Until the first release is tagged, fixes go to `main`.

## In scope

- Script execution or HTML injection through Markdown rendered with default options (`sanitize` on).
- Bypasses of the SVG sanitizer for diagram output.
- DOM clobbering through author-written ids.
- Path traversal, request smuggling or unintended exposure in `markupme serve` with default options.
- Any network request made by default (MarkupMe should make none).

## Out of scope

- Output rendered with `--no-sanitize` / `sanitize: false`, or a server started with `--unsafe` or bound to a public interface on purpose.
- HTML returned by your own code block handlers or plugins (they are trusted code).
- Vulnerabilities in a Kroki server you configured.
- Denial of service from very large inputs on a local machine.

The threat model and the sanitizing pipeline are described in [docs/guide/security.md](docs/guide/security.md).
