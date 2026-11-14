# Documentation agent rules

## Scope

Keep one current instruction per topic. Git `d801da7` contains pre-slimming docs.

## Forbidden

No chronology, transcripts, copied test logs, secret/host IDs, duplicated plans or stale SHA claimed current.

## Gate

Preserve headings, frontmatter and relative links. Follow root code → deploy → verify for product changes. Docs-only: commit to Git without automatic Markdown checks, build or restart. Run tests/checks only after explicit owner authorization.
