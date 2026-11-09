# Documentation Agent Instructions

## Scope

All `docs/` files, including module specifications, ADRs and checkpoints. Keep `docs/README.md` as a complete navigation index.

## Forbidden

No unreviewed assumptions presented as measurements. Do not invent live Termux state, physical test results, installed package lists, ports, credentials, or security assurances. Do not paste secrets or private file content. Avoid disconnected copies of the same architecture rules.

## Gate

Documents (except `docs/README.md` and `docs/AGENTS.md`) need YAML frontmatter fields `status`, `owner`, `last_reviewed`, `purpose`. New modules require a matching specification, `AGENTS.md` and manifest entry. ADRs record major changes. Every relative Markdown link must resolve. Run `npm run check:docs` and `npm run markdownlint` **on Termux through Local Agent** when tools are available. See `LOCAL_AGENT_TERMUX.md`; GitHub-side edits without an on-device task result are documentation publication, not a verified gate pass.

## Context budget

Keep docs/START_HERE.md concise (target under 3 KB); it is the default
entrypoint, not another status chronicle. Store detailed terminal receipts
in checkpoints, link them from indexes and avoid repeatedly prepending
status reports to the 48 KB historical handoff or long quality gates.
Prefer one canonical decision/receipt over competing duplicated summaries.
Read only the relevant document section into Agent context.
