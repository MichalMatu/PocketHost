# PocketHost

PocketHost is an experimental Android/Termux hosting control panel.
It provides read-only host monitoring, a React admin panel, an
explicitly PocketHost-owned static demo and a stopped managed
PhotoMap TEST catalog. It is **not yet a production hosting manager**.

## Current status (2026-11-07)

| Scope | Acceptance |
| --- | --- |
| P0–P2: inventory, read-only monitoring and admin baseline | Accepted |
| P3: owned demo Start/Stop/Publish/Rollback | Native and live loopback HTTP PASS; real browser interactions HOLD |
| Generic runtime and process safety source | Native `check:all` PASS; real PRoot orphan recovery HOLD |
| P4: imported PhotoMap TEST catalog and isolated workset | Read-only accepted; live runtime disabled |
| Packages, AI-facing API, public deployment and autostart | Deferred/not authorized |

At source `bc5e5539ca4656e59077335b71c0875f967ea859`,
the Samsung Local Agent recorded **101/101 Node tests**, **16/16 admin
Vitest tests**, complete `check:all` PASS and **80.34% line coverage**.
A separate real owned P3 Publish → Rollback → Stop → Start cycle passed
with unchanged status of six external services. PhotoMap port 8010 was
closed. The outstanding browser, PRoot recovery and activation gates are
listed in the [current handoff](docs/HANDOFF_NEXT_CHAT.md).

## Strict development rules

- Work on fresh `main` with GitHub Connector and the exactly verified
  Samsung Termux Local Agent. No Codex, ChatGPT Work, GitHub Actions,
  Mac/Linux PocketHost execution, new branches or force push without
  separate authorization.
- Only explicitly registered PocketHost-owned processes may be
  controlled. Never infer ownership from a discovered port/process.
- No action on original PhotoMap, IleStoi.pl, Local Agent or any other
  externally managed service. No implicit package changes, autostart,
  public ingress or arbitrary remote shell.
- The DEV panel launches manually and binds loopback by default.
  A separately approved opt-in trusted private-LAN gateway is not a
  secure public administration endpoint.
- Code quality and native source tests do not substitute for real
  browser interaction or hardware recovery/rollback acceptance.

## Where to resume

Read [AGENTS.md](AGENTS.md), the
[next-chat handoff](docs/HANDOFF_NEXT_CHAT.md),
[quality gates](docs/QUALITY_GATES.md),
[development plan](docs/DEVELOPMENT_PLAN.md) and
[Samsung Local Agent runbook](docs/LOCAL_AGENT_TERMUX.md).
The [final native QA checkpoint](docs/checkpoints/2026-11-07-final-native-qa-handoff.md)
contains exact results; the [historical archive](docs/checkpoints/README.md)
preserves older sprint evidence.

Do not replay already accepted checks on unchanged code or mark
unexecuted release gates as finished.
