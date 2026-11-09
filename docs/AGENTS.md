# Documentation Agent Instructions

## Scope

Documentation, module specs, ADRs, checkpoints and navigation indexes.
docs/START_HERE.md is the default small entrypoint (target under
3 KB); docs/README.md is the **complete link index**, not a
chronological session log. Read only the active section relevant
to changed code.

## Forbidden

Do not copy full test output, entire source trees, credentials,
private host identifiers, repeated status histories, guessed
physical state or duplicated architecture decisions into active
docs. Do not prepend another "latest" section to the handoff,
roadmap or quality gates. Keep historical receipts in dated,
indexed checkpoints; preserve verified evidence and exact SHAs.
A git commit or request publication is not hardware PASS.

## Reader intent (Diátaxis)

Choose tutorial, how-to, reference or explanation by the reader's intended
use, not by a mandatory directory name. Existing files stay where they are.
Prefer linking to the canonical document over creating a second summary;
guided tutorials are added only when an actual learner workflow needs one.
Every new active document must be linked from docs/README.md and have a
clear audience/purpose. Checkpoints are historical evidence, never the
default how-to or live status source.

## Gate

Every doc except docs/README.md and docs/AGENTS.md needs
frontmatter: status, owner, last_reviewed and purpose.
New modules require a registered spec and scoped AGENTS.md.
Relative links must resolve; record exact impact without
creating irrelevant new checkpoints. For docs-only changes run
docs link/index, changed Markdown lint and Prettier on Samsung
Termux through Local Agent **when the executor is available**.
Do not run app tests, builds or restart the panel for docs alone.
If no native terminal result exists, mark UNVERIFIED.

## Context budget

- Keep START_HERE under 3 KB, HANDOFF below roughly 5 KB and
  other active files concise; split reusable details by topic.
- One current status and one canonical reference per decision.
  Historical checkpoints are opened **only by direct need**.
- Prefer exact file paths/commit hashes to repeated evidence tables.
  Don't archive a second duplicate of content still in Git
  history unless a specific external retention requirement exists.
