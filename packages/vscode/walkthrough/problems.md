# Problems as you write

MarkupMe checks each Markdown file as you type and lists findings in the Problems panel, each with a rule code:

- `MM004` a link to a heading that does not exist
- `MM012` a link to a local file that is missing
- `MM001` a heading that skips a level
- `MM005` an image without alt text

Turn a rule off or change its severity in `markupme.validate.rules`, for example `{ "single-h1": "off" }`.
