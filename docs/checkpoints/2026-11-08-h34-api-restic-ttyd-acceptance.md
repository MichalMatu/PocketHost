---
status: in-progress
owner: core
last_reviewed: 2026-11-08
purpose: H3.4 live API test evidence, Restic source repair and ttyd native hold
---

# H3.4 — API and hardware follow-up, 2026-11-08

## Accepted historical baseline

- H3.4 live panel remains the separately accepted
  `e1c11e723105025b0f24ecf8e70974beddc0c2b5`.
  No production cutover of the new source is recorded here.
- `f16982d46635fc57d95522335fadba870afed6aa`
  passed exact-SHA Samsung `npm run check:all`:
  `pockethost-general-audit-exact-main-g2-f16982d-20261107-v1`,
  terminal `done/0 PASS`, 45/45 UI tests.
- No repeat of those accepted gates is necessary.

## Native API and disposable data receipts

- `pockethost-h34-api-autotest-files-packages-20261108-v1`:
  terminal `done/0 PASS`. Verified package dry-run,
  read-only APIs, invalid intent/path/protected-service
  rejection, ten file operations with cleanup, and
  a created/verified workspace snapshot.
- `pockethost-h34-api-terminal-restic-relative-20261108-v1`:
  terminal `failed/1`. Its independently recorded
  checks include protected service and Origin denial
  PASS; disposable relative-path Restic init/backup/
  check/snapshot/staged-restore PASS; terminal start
  returned HTTP 409, so overall task is OPEN.
- `pockethost-h34-restic-disposable-diagnostic-20261107-v1`:
  terminal `failed/1`; native backup with an absolute
  source returned exit 3 after saving a snapshot,
  due to denied `user.serial` extended-attribute
  access on Android's `/data/data` ancestor.
- `pockethost-h34-restic-relative-roots-probe-20261108-v1`:
  terminal `done/0 PASS`. Two relative source roots,
  encrypted backup, integrity check, staged restore,
  exclusion of a disposable secret fixture and cleanup
  were verified. This is not a real full HOME/PREFIX backup.

## Source changes since accepted release

- The Restic host adapter now refuses nonzero
  `HostCommandResult.exit` and adds negative tests.
- Restic workspace and HOME/PREFIX command plans now
  use a controlled working directory and relative
  source names to avoid traversing inaccessible
  Android ancestor metadata. Backup state/key paths
  remain excluded; tests assert arguments and cwd.
- `pockethost-h34-restic-relative-source-native-focused-d1e7b10-20261108-v1`
  returned terminal `failed/1`: five focused Node
  tests PASS, but Restic source Prettier FAIL.
  A follow-up source-formatting change was committed;
  **no exact-current-SHA green QA is yet claimed**.
- `wreckscanner-backup` is newly classified as
  protected in the source, including alias rejection;
  the old fixed "six protected" UI caption was removed.
  These changes have not been deployed.

## ttyd native finding and hold

- The controlled package installation previously returned
  `done/0 PASS` for ttyd 1.7.7-6 without package upgrades.
- API terminal start returned HTTP 409. Isolated task
  `pockethost-h34-ttyd-isolated-diagnostic-20261108-v1`
  returned terminal `failed/1`: ttyd 1.7.7-unknown
  with libwebsockets 5.1.0 crashed during start
  (exit -11 / SIGSEGV), before binding its test port.
  The temporary listener was closed and existing
  sites remained available.
- `pockethost-h34-ttyd-argv-safe-isolated-20261108-v1`
  tests bounded alternative argv plans. Its result
  was not yet received when this checkpoint was written.
  Do not claim ttyd live HTTP/WebSocket acceptance,
  reinstall packages, expose terminal access, or
  restart services without a new reviewed gate.

## Open gates and safety

1. Receive authoritative receipts for the remaining
   isolated ttyd compatibility and formatting tasks.
   Do not replay uncertain side effects.
2. Run exact-current-main Samsung `check:all` only after
   formatting is fixed, record SHA and exit status.
3. Validate Restic's fixed adapter on strictly
   disposable data through the typed API; do not
   perform a full HOME/PREFIX backup or apply restore
   to active Termux data.
4. Independently accept actual ttyd HTTP/WebSocket
   operation and Mac Chrome UI once the native crash
   is fixed.
5. Before any new panel-only deployment, independently
   recheck the two original sites, their file digests,
   protected services, PhotoMap TEST closed port and
   rollback readiness.

The trusted-LAN administrative interface has no login.
Keep WAN exposure, autostart, production package changes
and unrelated service mutations prohibited.
