# Contributing

Read `AGENTS.md` and `docs/QUALITY_GATES.md` before editing. Work in small, reviewable increments. Preserve module boundaries. Each proposed change must include its scope, risk to existing services, tests run, affected docs and rollback. Commit generated build artifacts and host-specific configuration **never**. Use feature branches for risky changes; do not publish/deploy without approval. Automated checks, tests and builds run **only on the selected Termux device through Local Agent host commands**, not in GitHub Actions or another execution environment. Follow `docs/LOCAL_AGENT_TERMUX.md` and record on-device evidence.

For new modules, update `project.structure.json`, `docs/MODULES.md`, add `docs/modules/<name>.md`, create `src/modules/<name>/AGENTS.md`, then extend structure tests as appropriate.
