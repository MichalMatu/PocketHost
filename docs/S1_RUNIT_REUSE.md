---
status: historical-reference
owner: core
last_reviewed: 2026-11-22
purpose: S1 termux-services source review and verified service enrollment boundary
---

# S1 — reuse upstream runit, do not build another supervisor

**Reference-only progression notes (14 November design).** Later A8 evidence
qualified one owned fixed-template worker; general S1–S4 remains
**READY_FOR_ACCEPTANCE**, not universally accepted. Headings below saying
"current" or "not physically tested" refer to the older increment, **not**
the latest system status. Use the [current MVP tracker](MVP_EXECUTION_PLAN.md)
and [22 November checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md)
for next actions. Preserve this technical record; do not rerun old experiments
because this reference document contains an earlier pending step.

## Open-source decision

The upstream [termux/termux-services](https://github.com/termux/termux-services) already provides `service-daemon` with `runsvdir`, `sv-enable` / `sv-disable` and `svlogger`; see [README](https://github.com/termux/termux-services/blob/master/README.md), [sv-enable](https://github.com/termux/termux-services/blob/master/sv-enable), and [service-daemon](https://github.com/termux/termux-services/blob/master/service-daemon).

- Reuse the existing Termux packages and runit binaries on the Galaxy A8. Do **not** vendor, fork, reimplement, upgrade or replace them in S1.
- `sv` controls process liveness; `sv-enable` and `sv-disable` alter the `down` marker. These utilities **do not attest ownership**, readiness, application health, source revision or project membership.
- Termux:Boot only brings up the service daemon after Android boot; it does not independently prove an app's lifecycle ownership. Physical reboot remains a separate owner-approved qualification.
- Do not add Kubernetes, Nomad, PM2 or a competing health/restart scheduler. Scoped app health policy belongs to PocketHost's registry, runit owns process supervision.

## S1 implementation boundary

The previously installed adapter `TermuxServiceAdmin` gave a discovered `pockethost-*` unit the option to register simply because its name matched. This is a weak ownership shortcut.

The first S1 increment changes that contract:

1. Discovery is read-only for **all unenrolled units**, regardless of prefix.
2. HTTP users cannot register an arbitrary observed unit by giving its name.
3. **Only a trusted in-process PocketHost service provisioner**, after creating its own unit and before operating on it, can invoke `registerProvisioned(name, {target, runSha256})`. This verifies an exact canonical service directory, safe ownership/mode, executable non-symlink `run` script and expected script hash, and atomically records the target. It deliberately accepts safe unit names independent of the legacy `pockethost-` prefix.
4. `NodeRunitHost` uses this trusted path only **after** creating its own runit script, private project state and unit marker. This is not adoption of an observed service.
5. Every later lifecycle/log/autostart operation requires a matching registered canonical target. System SSH, Local Agent, PocketHost panel/watch and any unregistered/external unit remain protected; no action is issued to them.
6. Existing registrations are read for backward compatibility under their previous exact-target checks; do not silently promote any newly observed names.

**This is a foundation, not full S1 acceptance.** Still needed: a safe owner-visible workflow for creating/enrolling arbitrary app services (not blind adoption), immutable service identity and drift recovery, lifecycle and negative tests, status UX, and stage-level A8 owner acceptance. No tests run for this interim implementation per the approved fast-flow convention.

## Next increment — revocation on source drift

The H3 registry now stores a SHA-256 digest of the provisioned `run` script and rechecks its current safe file identity on service inventory and every runit/log action. A changed, missing, symlinked or unsafe script makes the unit **read-only** (`identity: changed`). Old records without a digest remain **legacy/read-only** until a trusted creator can attest them; no automatic migration. Registered names remain generic and independent of the `pockethost-` prefix.

`NodeRunitHost` refreshes that digest only from its trusted in-process release code during its explicit update path, with both previous saved digest and new on-disk digest checked. No browser endpoint accepts a digest, executable path or arbitrary unit adoption. Services UI distinguishes verified/changed/legacy/unregistered/reserved units, and links to Projects as the existing creator of Node-managed services. This does not yet provide general-purpose manual provisioning, so S1 remains **IN_PROGRESS**.

Existing older test fixtures that register by service name must be updated to use trusted provisioner evidence at the **complete Services closure test gate**; no test execution is permitted during interim FAST FLOW iterations. A guarded deployment status is not a functional test result.

## S1 standalone service creator: a bounded first template

The `Runit services → Add Service` action creates a **new**, isolated
`heartbeat-worker-v1` service without creating a Project. It is a real runit
unit, not a fake status indicator:

- The browser supplies only a validated new service name and the exact built-in
  template identifier. It cannot provide JavaScript, Python, shell, executable,
  filesystem path, port or existing-service target.
- The host requires the official Termux-owned service and log roots, refuses
  every existing name/path or protected system service, bounds managed inventory
  and caps this first template at **four** workers.
- The host prepares an owner-only definition under `PREFIX/var/sv/<name>`,
  creates a runit `down` marker **before** the executable script, writes a
  fixed Node heartbeat script/logging unit and a private ownership marker.
- Only after preparation does it publish a symlink into the watched
  `PREFIX/var/service` directory and call the trusted provenance registry.
  User code and foreign services are **never** adopted.
- Creation leaves the worker **stopped and autostart-disabled**. Start,
  Stop and Restart reuse existing `sv` commands and exact script identity;
  no application worker is started by creation. Runit can still launch its
  own supervisor and logger for the published, down-marked definition. The status
  adapter accepts the standard `var/service` → `var/sv` symlink **only**
  when the target is already enrolled and re-attested; an external symlink
  cannot gain ownership or reveal a controllable autostart state.
- Generic `unregister` has been withdrawn from the browser and refused by
  the adapter. It could strand an active runit definition without ownership,
  especially when a service belongs to a Node project.
- The only reversible retirement operation is **Archive worker** for the
  built-in standalone template. Before touching a supervisor, PocketHost
  rechecks the exact original `var/service` symlink, fixed canonical
  `var/sv/<name>` directory, private creator marker (owner, name, instance,
  template and run digest), stored registry digest, down state and disabled
  autostart. It then sends runit's own fixed-argv `sv exit`, re-attests the
  worker and unlinks **only** the exact published symlink. The registry
  capability is revoked and the scripts and logs are **retained**, rather than
  recursively deleting unknown files.
- Archive is deliberately not presented as permanent deletion or cleanup.
  Archived definitions still count against the four-worker quota, preventing
  repeated create/archive from exhausting the host. An attested **Restore service**
  inverse now exists, but permanent purge of archived files and cleanup of
  Node-project runtimes remain separately gated.
- The first template is a bounded integration bridge, **not** arbitrary
  standalone app execution. User-controlled Node/Python programs need
  reviewed source declarations and a separate owner-authorization model
  before being permitted through the no-login LAN UI.

No host package was installed or updated; no unrelated service was changed.
The complete positive/negative test matrix is reserved for the finished
Services acceptance gate. S1 remains **IN_PROGRESS** until real application
source enrollment and recovery/removal semantics are covered.

## S1 fixed Node.js and Python service templates

The standalone `Add Service` provisioner now supports two **fixed** runtime
templates using the same runit registry, provenance digest, lifecycle controls,
log path, autostart, and attested archive flow:

- `heartbeat-worker-v1` — Node.js heartbeat
- `python-heartbeat-v1` — Python heartbeat (isolated `python -I -u`)

The browser can select **only** one of these IDs and a bounded unique
service name. The run scripts contain the complete, fixed code; they are
SHA-256-attested and launched with `env -i`, excluding inherited admin
environment variables and secrets. They bind no network ports. Creation
does not execute the worker and sets the runit `down` marker before the
unit is published. The shared quota of four definitions includes archived
workers, irrespective of runtime. The exact owner marker, path and script
are checked before either runtime can be archived.

This integrates the _runtime types_, **not arbitrary user application code**.
For a real program, the next permission boundary is source provenance,
reviewed execution declarations, immutable releases and an explicit approval
to launch. Browser-posted shell/script text or a foreign process name
will not be converted into authority merely because the LAN is trusted.

## S1/S2 archived-worker recovery contract (code complete, not qualified)

The standalone Node.js and Python templates now share a **private archive ledger**
separate from the active service authority registry. Archive first records
the exact verified instance ID, canonical definition path, template and run
digest before unpublishing the runit symlink. The script and logs remain
unchanged. `Runit services` lists archived entries as **restorable** or
**identity changed**.

`Restore service` is the inverse of archive, not an import feature. It
refuses any currently published name, active registration, missing or
modified original marker, non-private definition, missing `down` marker,
modified run-script digest, altered log supervisor or non-builtin source.
The expected SHA-256 is recomputed from the fixed template, independently
of both the marker and the saved archive record. A restore re-links only
the exact original definition, passes it through `registerProvisioned`
and removes the archive record. **It never starts the worker or enables
autostart.** The four-unit quota counts archived definitions.

Interruption and incomplete writes are fail-closed. In particular,
if a crash leaves both an archived ledger entry and a still-published unit
(or an active ownership registration), the service inventory reports
`archive-conflict` and the archive list reports `conflict`. All lifecycle
operations and Restore are disabled until an independent repair verifies
both ledgers, the exact original symlink and the worker's identity.
This applies to both an interrupted archive and an interrupted restore.
Neither the browser nor a refresh silently repairs, adopts or restarts a unit.
A human must inspect the preserved owner and filesystem markers first.
This remains **unqualified on physical A8**, and the prior successful
FAST FLOW receipts apply to earlier deployed code only.

## Stage closure cases for interrupted operations

Include negative tests for both failure windows before acceptance:
(1) archiving wrote its private ledger but did not unlink the active
service symlink, (2) restore re-created the symlink/registration but did
not clear the archived ledger. Both must show a read-only conflict in
the UI and refuse Start, Stop, Restart, Enable, Disable and Restore.
Verify that neither case changes SSH, Local Agent, panel/watch or any
unrelated project service. Only after reconciling state under a distinct
controlled recovery gate may the unit become manageable again.

## S3 runit autostart readback (partial)

The existing official Termux `sv-enable` / `sv-disable` operations are
the only writers of desired per-service autostart state. For an attested
unit, PocketHost now verifies the fixed command exit, canonical service
target, current ownership digest and the persisted `down` marker **after**
the command returns. A mismatched or unreadable marker is an unconfirmed
operation (fail closed), not success. The UI re-reads inventory and only
displays successful persistent state when the observed value agrees.

Unlike a pure configuration toggle, enabling runit may **start the service
immediately**, and disabling may stop it. This is stated in the
confirmation and status text. This slice does not modify the OS boot
policy, Termux:Boot permissions or any protected service. Boot recovery,
actual phone reboot and stage regression tests remain **OPEN**; no
background polling/scheduler was added.

## S4 on-demand process observation (partial)

`Services → Health checks` now also shows a separate, manual runit
inspection for services currently attested by PocketHost. The GET route
`/api/v1/termux-admin?mode=service-health&name=<owned-unit>`
accepts a bounded service name, refuses reserved and unregistered
targets, and re-attests the exact canonical target and registry digest
after inspecting. It reports runit process state, the existing down
marker and bounded log-write metadata. Reading metadata neither
executes nor restarts a service. Unsafe log paths never become proof.
Application readiness is **always** reported as `not-verified`,
because a running PID and an updated log are insufficient.

This does not duplicate Hosting's existing explicit HTTP readiness
probe. It adds no polling, timer, scheduler, background monitor or
automatic recovery. S4 still needs a separately approved desired-state
and bounded recovery policy, reliable application readiness, and
positive/negative A8 stage tests before qualification.

## S4 explicitly reviewed, durable-budget recovery (partial)

The existing pure `evaluateHealthPolicy` evaluator is reused for
**explicit, manual recovery** of already attested builtin Node.js/Python
workers. This is deliberately separate from the established Node Hosting
project release/rollback policy and does not grant recovery authority to
other enrolled services or foreign processes.

`Review recovery` reads the exact worker identity, runit state,
persistent `down` marker and a private, bounded per-instance recovery
ledger. A request can be eligible only when the unit is **stopped**,
autostart is **enabled**, the recorded digest still matches, and the
allowance is under **two starts per rolling one-hour window**, with at
least **two minutes between starts**. Unknown/running state, manual
disablement, identity change, stale clock or exhausted allowance block
the request.

`Request one recovery start` requires a fresh server-side review and
an explicit browser confirmation. The allowance is persisted atomically
**before** the sole fixed `sv up` command; command errors and interrupted
attempts still consume the allowance. Returning from `sv up` does
not certify application readiness. No interval polling, scheduler,
background watchdog, automatic restart or loopback HTTP probe is added.
The allowance only bounds **PocketHost-requested starts**; the existing
runit supervisor has its own independent process restart behavior.

S4 remains incomplete without owner-defined readiness configurations,
a broader recovery policy for eligible projects, explicit rollback
semantics and the scoped positive/negative Tests S5 closure gate.
The physical A8 cannot be considered functionally qualified by merely
deploying this code without execution of that gate.

## S4 built-in worker heartbeat policy (partial readiness)

A fixed Node.js/Python heartbeat worker can now opt into an **on-demand
log-heartbeat check** with an explicit freshness threshold: 3, 5 or
10 minutes, or Off. The policy is stored privately, bound to the exact
verified worker instance UUID and rejected if that instance changes.
The browser supplies only a fixed policy ID and an enrolled service name;
there is no shell, command, HTTP URL, port or executable injection.

The check requires the original PocketHost template and log-run script
attested against their source, and a trusted owner-only log. It inspects
only the **last complete** `svlogd -tt` record, which must match the
runtime-specific fixed heartbeat text. A recent file modification time
within the chosen threshold provides **worker-output evidence**, not a
proof of full application readiness. Missing, stale, unknown or unsafe
logs never become a healthy signal. The existing distinct Node Hosting
HTTP readiness with nonce identity remains authoritative for web apps.
For services without an explicit built-in worker template, application
readiness stays `not-verified`.

The UI re-reads the actual persisted policy after each change. No
watchdog, scheduler or automatic recovery action is added. S4 still
requires general app readiness configuration, clearly scoped rollback
semantics, functional stage tests and acceptance.

## S4 Node Hosting release-bound readiness and rollback navigation

The existing Node runtime owns and checks HTTP readiness on the fixed
loopback endpoint, with the current release nonce, process PID and
start-tick reattestation. On-demand readiness samples in Services now
carry their exact release ID and local observation time: a new release
cannot inherit a previous release's cached `ready` label. No background
polling or health scheduler was introduced.

The health view also exposes only the **recorded previous-good-release
candidate** and navigates to Projects for a proper rollback review.
This inventory hint is not a safety approval: the existing local-only
`rollback-preview` and mutation gate stay inaccessible from the
unauthenticated LAN proxy. The host still enforces source, dependencies,
toolchain, syntax and exact ownership before a rollback can change
a running project. S4 and stage tests remain open.

## S4 cross-process recovery attempt exclusion (partial)

The explicit one-shot worker recovery now holds a fixed, owner-only
`O_EXCL` lock at `h3-worker-recovery.lock` in the private PocketHost
state directory. This serializes the complete admission check, instance
attestation, retry-budget write and single `sv up` request even if
different privileged PocketHost adapters execute concurrently. The
existing in-process HTTP mutation queue alone is not sufficient across
two host processes.

A duplicate or overlapping request is **refused**, not queued or
automatically retried. The lock file can only be removed by the holder
after checking its inode/device and owner again. A process crash leaves
the lock in place for independent manual reconciliation; it never
automatically reclaims a potentially live attempt. A refused lock
acquisition does not consume a recovery attempt; a command error after
the journal write does. This does **not** limit runit's own supervisor
restart behavior or prove the service application became ready.

At the Services closure gate, include competing-adapter requests,
duplicate submissions, crash-left lock, malicious/replaced lock
identity, two-per-rolling-hour exhaustion, cooldown, and no effects
on protected or foreign services. No test suite has been run for this
increment and S4 remains **IN_PROGRESS**.

## S1/S2 delegated service ownership boundary (partial)

The shared runit inventory now differentiates three **control scopes**:

- `standalone`: a currently verified, immutable PocketHost Node/Python
  builtin worker, with separately attested creator marker, exact run digest
  and original fixed logging script. Only these units expose generic
  **Start / Stop / Restart / Autostart** in the Services H3 API.
- `delegated`: a verified registry entry created by **another trusted
  provisioner** (currently Node Hosting). Its running state is observable
  in Services, but the generic LAN H3 controls are rejected by the host
  even if a caller sends a direct request. The actual creator must use
  its own release, process-identity, dependency and HTTP-readiness gates.
- `read-only`: every unregistered, changed, legacy, protected or
  identity-conflicted unit. These do not gain lifecycle authority.

A unit being registered in the shared registry is **not** sufficient
to grant all frontend operations. `TermuxServiceAdmin.applyStandalone`
enforces the immutable standalone template check at the server action
boundary. `NodeRunitHost` retains the internal `apply` path for its
own verified deployments, one-shot starts, stops and rollback.
The panel labels delegated units and navigates to Projects without
offering generic runit mutation buttons. No arbitrary service enrollment,
new process supervisor, shell input, or LAN Node Hosting mutation has
been introduced.

At the full Services closure gate test positive builtin unit controls
and negative direct-API attempts against Node-project, SSH, Local Agent,
panel/watch, unknown and changed units. Also verify Node Hosting can
still perform its explicitly approved internal one-shot lifecycle
through its own attested path. **S1/S2 are still IN_PROGRESS.**

## S2 lifecycle command acknowledgement and post-operation ownership

The fixed runit Start/Stop/Restart/Once bridge now refuses a nonzero `sv`
result and re-attests the same canonical path and registry digest **after**
the command. Generic Services actions additionally require the original
attested built-in worker marker, script and logger after completion. Drift
or a competing archive returns an error rather than a false success. A runit
command acknowledgement is not application readiness; it does not promise an
immediate observed running/stopped state. The control surface remains limited
to `standalone`; Node project runit stays delegated to its owner.

At S5 stage closure test nonzero `sv` results, a changed run script during
a held command, marker/log replacement, archive conflicts and unchanged
protected-service state. This slice is not yet tested or accepted on A8.

## S1/S2 cross-process standalone lifecycle exclusion (partial)

Create, Restore, Archive and standalone Start/Stop/Restart/Autostart now share
an owner-private, exclusive `O_EXCL` lock in the PocketHost registry directory.
The lease covers the entire admission, filesystem/registry change and
fixed-argument `sv` command, preventing concurrent panel processes from
allocating against stale standalone quotas or interleaving destructive
archive/restore operations with lifecycle controls. Conflicts are refused,
not queued or automatically retried. A crash-left or tampered lock requires
independent manual inspection. The lock is never an authorization to adopt
foreign, protected or delegated Node-project services.

The S5 stage gate must include two independent adapters creating distinct
workers at the quota boundary, duplicate names, Archive versus Restore or
Start, contention while a command is held, replaced and crash-left locks,
and protected service isolation. No interim suite or physical acceptance is
claimed. S1/S2 stay IN_PROGRESS.

## S2 archived worker log visibility (partial)

Archived builtin workers retain their own `svlogd` files, but lose the live
registration by design. The Services archive list now offers **Saved logs**
without restoring or starting any process. `TermuxServiceAdmin.logs` grants
read-only access only to an already-verified live service or an exact archive
entry whose unpublished source, marker, logger and instance are independently
attested. It opens `current` with `O_NOFOLLOW`, bounds the file size, verifies
fd/path identity, sanitizes lines, and rechecks enrollment or archived
identity after reading. A changed/conflicting entry or foreign service has
no access. No polling, background work or extra execution.

S5 tests pending: archived log present/missing, symlink/inode replacement,
marker drift, concurrent archive/restore, foreign/protected unit denial and
UI readback. Still not accepted as complete S2; separate safe permanent
retirement and custom app enrollment are outstanding.

## S2 bounded retirement of archived worker definitions (partial)

The explicit **Retire definition** action is available only on a fully attested
archived builtin Node/Python worker, never on live, delegated, changed, conflicted
or protected services. It requires typing the exact name and a second user
confirmation. Under the shared cross-process standalone lifecycle lock, the
host re-attests the exact unpublished unit and log directory, creates at most
four private instance-keyed quarantine tombstones, moves both original
directories by rename without traversing or deleting their contents, and only
then revokes the archived registry entry. No arbitrary path/PID/shell access,
automatic retry, recursive deletion or service restart. The original bytes
remain for manual forensic review; this is not secure erasure. If any step
fails, the archive is left un-restorable until the partial state is manually
reconciled. The separate Node-project provisioner remains authoritative.

S5 stage gate: archived owner positive path; name reuse after retirement;
restoration denial after retirement; invalid template, protected name,
foreign symlink and identity drift denials; tombstone quota/collision;
rename and journal failure ambiguity; UI confirmations; isolation of SSH,
Local Agent, panel/watch and Node Hosting. No worker retired in this
implementation iteration. S1/S2 still IN_PROGRESS.

## S1 verified Node project ownership deep link (partial)

Generic Services now labels an exact Node project as the delegated owner only
after the Node provisioner independently validates its project source,
private runtime marker, run digest and shared Termux registry. Matching unit
names alone cannot claim ownership. The link opens the specific project
(`/projects?project=...`) and refreshes its release/runtime readback without
granting operation approval. Generic Services commands remain disallowed for
delegated units; NodeRunitHost retains its own rollout/rollback gates.
Feature-disabled, changed and unknown services remain unlinked.

This is an integrated path for existing own Node source, not a general-purpose
arbitrary-code executor or Python importer. S1/S2 are IN_PROGRESS. The
focused S5 gate must verify legitimate Node provenance, impostor unit names,
source/marker drift, disabled feature and UI deep-link approval isolation.

## S1 owner-staged Python source (partial)

Add Service can now stage a private `worker.py` (maximum 32 KiB) as
`python-source-v1`, with no user-selected executable, shell, PID or path.
The fixed runit launcher and source are SHA-256 attested in the private marker;
source identity is checked for live enrollment, log reads, archival, restore
and retirement. This preserves the existing ownership lifecycle and quota.
The new unit has its `down` marker, cannot automatically start and never
executes during creation. **Generic browser/API Start, Restart and Enable
autostart are denied for `python-source-v1`. Manual recovery and heartbeat
automation are denied too.** Python `-I` is not an OS sandbox; there is no
claim that the submitted code would be safe to execute if later authorized.
A separately approved owner-authenticated executor and its security review
are required before general Python application lifecycle can be enabled.

S5 stage-close acceptance needs positive creation and archive/readback and
negative input/owner/marker/source drift cases, permission and quota errors,
failure and crash handling, lifecycle denial and protected-service isolation.
No Python code is executed and no S5 tests are claimed in this slice.

## S1 Python source review before owner activation (partial)

An attested `python-source-v1` worker now has a dedicated read-only
**Review Python source** action. The API reveals only the exact source
SHA-256, byte length, observed runit state, autostart marker and review
timestamp; it does not return source content or approval material.
The host opens `worker.py` with `O_NOFOLLOW`, requires an owner-private
regular single-link file and compares descriptor/path inode, size, mtime
and digest to the immutable marker, then re-attests the full worker
identity. It never runs, restarts or enables the worker.

The PocketHost browser terminal is itself a remote TTY, so a local
terminal prompt alone **cannot** be treated as strong physical owner
presence. Device-owner execution approval remains unimplemented and
the generic LAN Start/Restart/Autostart/Recovery denies custom Python.
At S5 test owner/source drift, symlink/inode replacement, query validation,
foreign and protected services, stale UI and zero script execution.
S1–S4 remain IN_PROGRESS; do not claim Python execution is authorized.

## S1/S2 Python source revision flow (partial)

A verified stopped Python worker can now **Replace staged Python source**
after a read-only exact-SHA review. A single private lifecycle lock prevents
competing PocketHost Create/Archive/Restore/Retire mutations. The host
requires `stopped`, `autostart=false`, matching digest and trusted
owner-private source, saves the previous source as one of at most eight
private 32 KiB history entries, prepares bounded staged files, then
updates worker.py and its SHA-256 marker through separate atomic renames.
A crash between renames intentionally leaves `changed` ownership
requiring manual reconciliation; there is no automatic retry or shell
execution. Source history remains inside the exact owned service unit,
and archive/retire retain it. A successful revision re-attests source,
runit identity and disabled autostart before reporting success.

The LAN interface cannot Start/Restart/Enable/recover custom Python;
this adds editing only. Focused S5 acceptance must cover stale expected
SHA, non-UTF8/corrupt marker, quota and write failures, symlink/inode
replacement, stopped vs running refusal, history retention and
UI's state invalidation on ambiguous receipts. S1–S4 IN_PROGRESS.

## S1/S2 Python revision inventory and source restore (partial)

Under **Review Python source**, the user can read up to eight privately
retained prior `worker.py` versions as SHA-256, byte count and saved time
without downloading or executing code. The host verifies exact worker
ownership, canonical private history, regular single-link files, and
descriptor inode/size/mtime before and after bounded reads. History with
unexpected names/files fails closed. Restoring one previous version
requires the exact current SHA, exact selected snapshot SHA and typed
owner intent in the UI. The existing stopped, autostart-disabled Python
CAS path stages the chosen content and saves the current source before
switching. No global script path or local execution is exposed; with
eight snapshots the restore button is deliberately disabled (no silent
deletion). Partial commits still require manual investigation.

Focused end-of-stage S5 checks: stale/malformed revision IDs, symlinks,
history drift, target/source mismatch, UTF-8 corruption, quota limit,
concurrent updates, stopped/autostart refusal, protected service isolation
and browser stale-selection reset. S1/S2 remain IN_PROGRESS.

## Current incomplete acceptance points

The standalone lifecycle has a bounded create path and reversible archive
path in source. Neither has been executed on a physical test unit yet.
Do not assert completed S1/S2 or count this as tested merely from FAST FLOW
build, SHA and HTTP checks. At the Services closure gate, run the approved
positive/negative matrix: create, duplicate name, reserved-name refusal,
attestation drift, Start/Stop/logs/autostart, archive prerequisites, and
confirmation that protected SSH, Local Agent, panel/watch and Node project
units cannot be archived. Physical reboot remains separate consent.

## Invariants for next S1 slice

- No browser or untrusted caller may select a process PID, arbitrary executable, unvalidated service script or foreign directory and call it owned.
- Provisioner evidence comes from code that actually created the service; names, prefixes, `sv status` and occupied ports are insufficient.
- ServiceRegistry vs. ProjectRegistry stay separate; do not couple generic runit enrollment to a particular hosted project.
- Filesystem identity and service script integrity need fail-closed checks at the action boundary, and negative tests at stage closure.
- Never transfer SSH, Local Agent or other external service ownership without separate explicit independently attested approval.
- No physical reboot, new background worker, WAN exposure or package changes without explicit owner consent.

Progress is tracked in [the MVP execution plan](MVP_EXECUTION_PLAN.md), starting from S1.
