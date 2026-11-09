# Tests Agent Instructions

## Scope

Foundation quality tests and future module/unit/integration tests. Every PocketHost test must run on the exact Samsung Termux target through Local Agent; isolated on-device detached QA checkouts are allowed.

## Forbidden

No physical production service mutations, network-dependent unit tests, unapproved device access, or false hardware pass claims.

## Gate

Exercise both success and rejection paths. A safety invariant must have a negative test before introducing a privileged feature.

## Incremental DEV gate

For normal iterations, select tests affected by the changed source and
changed test files using `npm run dev:changed -- --base=<sha>`. Reuse
prior exact-SHA terminal receipts; do not rerun successful unrelated
suites or skip an unmapped privileged change. The full suite and coverage
are milestone/risk gates, not a per-commit default.
