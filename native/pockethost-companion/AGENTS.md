# Native Companion agent rules

## Scope

Existing optional Android/Shizuku loopback bridge; frozen for Basic Hosting.

## Forbidden

No fake privilege, extra approval queue for explicit owner Run, WAN listener, unverified APK deployment or foreign Termux mutation.

## Gate

Root AGENTS applies: code → deploy → verify in one task on verified Samsung Termux Agent only, no tests unless the owner explicitly authorizes them. Preserve safety gates and report real UID/errors and exact-SHA results.
