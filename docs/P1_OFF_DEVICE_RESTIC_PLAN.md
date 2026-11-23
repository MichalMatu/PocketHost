---
status: design-only
owner: core
last_reviewed: 2026-11-18
purpose: P1 off-device protection cutline, not approval to copy data
---

# P1 — Off-device Node Restic protection (design only)

## Verified baseline

- `NodeProjectBackupHost` backs up only the PocketHost-owned `PocketHost-NodeProjects` root into the encrypted local Restic repository at `~/.local/state/pockethost/node-restic/repo`. Its password file lives separately in `~/.local/state/pockethost/node-restic/password` and is required for recovery.
- On A8, a single owner-approved scoped encrypted snapshot and restore to isolated staging passed. This was **on-device only**, not disaster recovery. Browser backup mutations remain feature-disabled. Never infer whole-device coverage, reboot readiness, or readiness of third-party apps.
- Current runtime processes, their identities and other Termux/Android data are **not** an off-device restore target.

## Delivery slices

1. **P1-D1 — design (this document):** select one owner-approved destination and transfer method; define custody for the recovery password **separately** from the encrypted repository. No destination, credential, or network access is currently approved.
2. **P1-D2 — guarded implementation (pending):** offer an explicitly approved, one-shot encrypted repository copy. Restrict it to the exact local Restic repository, refuse symlinks/foreign roots, missing key, insufficient destination space, concurrent backup/prune/deploy or changed owner identity. No arbitrary shell input, automatic schedule, SSH/WAN or credential output. Implement a separate destination adapter only after its threat model and destination are fixed.
3. **P1-D3 — independent physical acceptance (pending fresh approval):** verify the copied repository with Restic at the destination, then restore **from that copy** into a new isolated staging directory. Verify all expected owned-project digests and file hashes, show snapshot identity and a bounded receipt. Leave running Node/Static source, runit and protected services unchanged.

## Non-negotiable recovery constraints

- Repository files may be copied only under a consistent, non-mutating Restic state. Never copy an in-flight repository or include the password file with the same backup payload.
- The owner must maintain a separate recoverable copy of the Restic password; without it an encrypted repository copy is not sufficient for recovery. Never publish secrets to GitHub, task payloads, logs, UI or chat.
- Reject an unverified destination or incomplete copy; do **not** mark a successful upload as a verified restore. Preserve the original on-device repository and snapshots until independent restore evidence exists.
- Restore only to staging, not into `PocketHost-NodeProjects`, another service, or a running application's directory. Do not auto-start a restored application.
- A8 panel/deployment health checks are not data-integrity evidence. Acceptance needs repository verification **and** independent file/digest verification.

## Owner decisions needed before execution

Approve the destination (e.g. removable offline media or a named authenticated remote target), storage/credential custody, whether network access is permitted, and one exact copy-plus-restore acceptance scope. Reboot, WAN, SSH, and physical recovery operations each require their own authorization.

**Status: DESIGN COMPLETE / IMPLEMENTATION HOLD / OFF-DEVICE COPY NOT PERFORMED.** Hosting P0 functional acceptance and QA remain deferred independently.
