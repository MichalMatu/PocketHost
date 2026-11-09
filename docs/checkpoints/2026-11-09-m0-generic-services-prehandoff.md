---
status: source-implemented-validation-open
owner: core
last_reviewed: 2026-11-09
purpose: M0 generic observed-service aliases, PhotoMap compiler QA repairs, exact Samsung receipts and safe continuation
---

# M0 — generic observed services and PhotoMap QA repairs

## Authority and boundaries

The owner authorized autonomous source coding on PocketHost `main`.
This slice continues the [UI/source decoupling](2026-11-09-m0-implementation-ui-separation-sprint.md)
and [legacy PhotoMap diagnostics isolation](2026-11-09-m0-photomap-diagnostics-isolation.md).

**Observed baseline:** `main@c4038240688a16ec9ecf0b0cc9248a53bf6f95cf`.
**Last source commit for this slice:** `1451f9bd9bc27dc95447eeb6240693d32ab0c989`.
Always fetch the current `main` before further work; source can advance
in parallel. This is a GitHub-source checkpoint, **not** a claim that
the phone's active panel has been updated.

No actions were taken on running Termux or Android services, Cloudflare,
SSH, the Local Agent worker, protected identities, SiteFleetHost data,
database files, credentials, packages or deployed release pointers.

## Implemented source changes

- `src/modules/host/observed-service-catalog.ts` holds the historical
  six read-only status aliases (`ilestoi`, `tunnel`, `ssh`, `mqtt`,
  `healthwatch`, `local-agent`). Their public IDs, fixed runit targets,
  system/private-Agent scope and wire format remain stable for existing
  UI, integration tests and old client URLs.
- `host-snapshot.ts` imports/re-exports the historical catalog and
  uses it solely for bounded status probes. It no longer embeds named
  product descriptors in the generic host observer.
- Visible labels are generic: web application, tunnel, SSH, MQTT,
  website health monitor and local task agent. **`TermuxServiceAdmin.list()`
  remains the existing generic runit inventory**; do not build another
  competing inventory/supervisor. Status does not authorize adoption.
- `host-snapshot.test.mjs` now asserts stable public aliases, unique
  runit units, non-product-specific labels, valid scope, and
  external-only ownership. The added test has no dependency on
  the actual Termux storage state.
- `photomap-legacy-events.ts` now retains its literal
  `'photomap-test'` identity during event mapping instead of widening
  it to TypeScript `string`. The function signature also follows
  formatting conventions.
- `photomap-legacy-events.test.mjs` was formatted using the
  **actual Samsung Prettier diff** returned by
  `pockethost-m0-format-diff-e2039108-20261109-v1`, which
  finished `done/0`. The formatter task ran on the disposable
  QA checkout and restored that checkout to its previous clean state.

All original PhotoMap compatibility GET routes, H2 Website actions,
private network binds, existing runit administration guards and
protected service names remain unchanged. In particular, the
`ilestoi` string is a **compatibility ID**, not a Hosting
project registration. This source slice does not adopt an
externally running app.

## Actual native QA receipts and unresolved work

**PhotoMap candidate `a4b2a114`:** S22 source checks found:
TypeScript/Build failure on the overly broad `string` event
instance type; a test-regex escape failure; and formatting
issues in two files. Several negative/legacy and UI checks passed.
This is **not** PASS.

**PhotoMap candidate `2aaf78e9`:** later S22 source checks
reported Node tests, UI tests, structural/docs/boundary checks,
ESLint and admin ESLint **PASS**. TypeScript/build still failed
on the same literal-instance type issue, and Prettier identified
the same two files. The type issue was fixed by commit
`e203910809284a87e8e261bc4a50d136f2609081`;
formatting of the test file was then fixed by
`1451f9bd9bc27dc95447eeb6240693d32ab0c989`.

**Most recent M0 source QA:** the unique task
`pockethost-m0-observed-services-native-s22-affcf2d6-20261109-v1`
tests the service catalog, PhotoMap events, legacy consumers,
Node/UI, types/build, lint and changed-file format on
`affcf2d697324395bfaaeaa3760978e8fe022256`.
At publication, its terminal result was not yet available.
The formatter repair `1451f9bd` occurred after that
source snapshot; even if the older task passes other gates,
it cannot certify this final HEAD.

**Status: source changes implemented; full current-SHA QA and
real device acceptance OPEN.** Do not claim hardware PASS
from source code or historical receipts. First consume the
existing native task result (do not requeue identical IDs).
Then, if necessary, fix focused errors and run an
exact-final-SHA source gate in the isolated QA checkout.
Use [quality gates](../QUALITY_GATES.md) and
[Local Agent restrictions](../LOCAL_AGENT_TERMUX.md).

## Safe continuation and M0 acceptance criteria

1. Fetch fresh `main`, compare changed files and read the
   existing `affcf2d6` native QA receipt. Fix only grounded
   regressions/format issues; do not reset a concurrently
   modified checkout or duplicate a successful test run.
2. Verify Node legacy host/observability/PhotoMap contracts,
   UI and no-service-control paths. Keep all six historical
   service IDs/units as backward-compatible external-only
   aliases, while generic discovery remains in
   `TermuxServiceAdmin.list()`.
3. Before M0 final PASS, obtain actual-SHA evidence on
   the Samsung for the H2 disposable static lifecycle,
   release rollback, LAN, external/protected runit
   preservation, active site data and independent
   Local Agent path. Do not disrupt production services
   merely to verify a menu change.
4. Only after M0 closeout, proceed to M1 durable
   ProjectRegistry/ModuleRegistry/ServiceRegistry,
   M2 shared policy backed by existing runit, and the
   early M3 disposable Node.js Hosting MVP. Do not
   silently migrate IleStoi, PhotoMap or Local Agent.

**No additional runtime code or service ownership change
is authorized by the existence of this checkpoint.**
