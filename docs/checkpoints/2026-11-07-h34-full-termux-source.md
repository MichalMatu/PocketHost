---
status: source-candidate
owner: core
last_reviewed: 2026-11-07
purpose: H3.4 Full Termux Administration source and native QA acceptance handoff
---

# H3.4 — Full Termux Administration

## Branch and ownership

Branch `feature/h3-termux-control-center-20261107` is an explicit
owner-authorized exception to the main-only development policy.
Do not merge or deploy from this branch without an independent
accepted release route, fresh host identity and preservation checks.
No H2 hosted websites, six protected runit services, PhotoMap or
Local Agent installation have been modified during source work.

The owner explicitly requested password-free administration.
**No password or authentication setup is a prerequisite for H3.4.**
Anyone on the already trusted private LAN may operate these controls.
Do not connect the LAN gateway or ttyd to public networks.

## Implemented adapters and user controls

- **Full Files:** `TermuxFileRoots` offers explicit HOME, PREFIX
  and Android shared storage roots. Nested files may be inspected,
  edited (UTF-8 up to 1 MiB), imported/exported (up to 2 MiB),
  copied or moved, and explicitly deleted. Bounded directory-tree
  copy and separately double-confirmed recursive deletion are
  supported. Absolute traversal and linked descendants are
  refused. The earlier scratch-workspace manager remains.
- **Terminal:** `ttyd` is started only when requested, as one
  writable client, bound exclusively to `127.0.0.1:18798`.
  It embeds the existing ttyd/xterm.js frontend through the
  admin Vite WebSocket proxy on `/terminal/`, which remains
  behind the existing trusted-LAN gateway. No autostart, daemon
  enrollment, credential request or public interface.
- **Services:** existing runit discovered services are observed
  first. Explicitly registered exact-target services may now
  be started/stopped/restarted, enabled/disabled at shell login
  using installed `sv-enable`/`sv-disable`, and their bounded
  logs inspected. Six protected services and aliases remain
  non-manageable. No service creation or adoption by PID.
- **Backups:** reuses native `restic` and its existing encrypted
  local repository for HOME, PREFIX, or both. The repository
  and encryption key directory are excluded from system backup;
  restore is staged separately rather than applied over live
  files. Includes scope-specific snapshot list and Forget/Prune.
  **Off-device disaster recovery is not yet established**;
  save the encryption key separately before relying on a backup.
- **Agent API:** reuses the same typed `/api/v1/termux-admin`
  operations over the existing loopback HTTP/Vite listener. A
  same-OS-user Local Agent host task can call it with exact
  `X-PocketHost-Intent: termux-admin` and
  `X-PocketHost-Agent-Intent: termux-owner-agent` headers
  without an Origin or login. The LAN gateway strips the agent-only
  header so a remote Wi-Fi client cannot impersonate this local
  transport. Capability discovery:
  `GET ?mode=agent-capabilities`. This is not a new Local
  Agent service, Git repository queue or external public API.

## QA acceptance

The previous version `bcec008` passed full native `check:all`.
The separate H3 Restic QA task at `52629df` returned OPEN with
151/151 Node, 41/41 UI, coverage, build and types passing, but
Prettier/Markdown failed. Neither result validates H3.4 code.

New H3.4 tests cover full named-root traversal, recursive copy/delete
with symlink refusal,
Restic HOME/PREFIX command arguments, runit autostart admission,
manual ttyd loopback plan and agent intent. Browser tests cover
Files, Terminal, Backups and Agent API. Run fresh Samsung Termux
`npm run check:all` on the exact H3.4 commit in an isolated
checkout, recording the Local Agent task ID, SHA and exit code.

## Physical checks outstanding

No H3.4 package installation, terminal spawn, service signal,
system Restic backup, Restore/Prune, or production file mutation
has been performed by this sprint. Verify availability of ttyd,
restic, runit, accessible Android shared storage and actual browser
WebSocket behavior in separate owner-accepted physical tests.
G3 live source cutover is separately held and not implied by code.

## Submitted native QA tasks

- `pockethost-h34-full-source-diagnostic-b8d1232-20261107-v1`:
  exact-SHA native diagnostic matrix (submitted).
- `pockethost-h34-latest-native-g2-e3b1946-20261107-v1`:
  exact-SHA full native G2 matrix after tree operations (submitted).
- `pockethost-h34-native-style-ada4998-20261107-v1`:
  isolated native formatting and markdown checks (submitted).

At the last evidence check, Local Agent had not yet published a
terminal result for these tasks. Submission is **not PASS**.
Additional source changes after those SHAs require their own QA.
