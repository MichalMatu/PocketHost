# Tests Agent Instructions

## Scope

Foundation quality tests and future module/unit/integration tests. Every PocketHost test must run on the exact Samsung Termux target through Local Agent; isolated on-device detached QA checkouts are allowed.

## Forbidden

No physical production service mutations, network-dependent unit tests, unapproved device access, or false hardware pass claims.

## Gate

Exercise both success and rejection paths. A safety invariant must have a negative test before introducing a privileged feature.
