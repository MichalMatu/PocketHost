# Source Agent Instructions

## Scope

Application code will live under `src/modules/`, `src/ui/` or `src/shared/`. No application feature code during the foundation phase. Maintain explicit typed contracts.

## Forbidden

No cross-module internal imports, hidden shell execution, public admin listeners, hard-coded host paths or unowned lifecycle actions. The host adapter remains the only future command boundary.

## Gate

Structure gate, unit/contract tests, ESLint, Prettier and TypeScript strict mode before merge.
