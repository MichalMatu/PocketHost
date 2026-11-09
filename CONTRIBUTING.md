# Contributing

Begin with [AGENTS.md](AGENTS.md) and the
[small context entrypoint](docs/START_HERE.md). Use fresh main,
respect nearest scoped AGENTS.md, keep changes focused and
preserve module/host boundaries. For source ownership and
affected test entrypoints consult [CODE_MAP](docs/CODE_MAP.md).

Use the [change-aware DEV flow](docs/DEV_ITERATION.md) on the
verified Samsung Termux **through Local Agent only**.
A source commit is not a deployment or physical acceptance.
Document the exact SHA, tests run/skipped, risk to external
services and recovery approach. No GitHub Actions, Codex,
Work, Mac/Linux PocketHost test execution, unapproved
dependencies or forced changes to main.

New feature modules require a registered manifest entry,
typed shared boundaries, a module spec and scoped AGENTS.md.
Run positive/negative tests that match the change; do not
replay unrelated successful suites.
