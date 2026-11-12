# PocketHost Companion — native Android and Shizuku DEV adapter

This is the **existing**, separately installed development Companion.
Its Java source is the base for the Android part of the future unified
PocketHost app, as specified by
[ADR-0017](../../docs/adr/0017-termux-first-single-app-integration.md).
It is **not** a new runtime, replacement Termux or standalone host engine.

## Current source capabilities

- Shizuku Binder permission/status; real authorized ADB/root UID and
  PowerUserService actions (ADB does not imply root).
- Android telemetry and app/process/service/permission information
  subject to actual Android access.
- Owner-enabled foreground monitoring service with visible notification.
- Local Android loopback telemetry bridge and owner-directed Android
  action/shell routes for the PocketHost DEV web interface.
- ContentProvider for bounded diagnosis with caller restrictions.
  The HTTP loopback action routes are **not caller-authenticated** by
  being on 127.0.0.1; current private-LAN DEV access is not production
  security and must never be exposed publicly.

Current web integration is described in
[Shizuku module](../../docs/modules/shizuku.md). Do not infer every
operation is accepted on the latest source revision from an older
hardware test. Real Binder permission, Android errors and privilege
revocation must be shown honestly.

## Build and device operations

Follow [root AGENTS](../../AGENTS.md) and
[Samsung Local Agent workflow](../../docs/LOCAL_AGENT_TERMUX.md).
Build/test commands execute only through the verified Samsung Termux
Local Agent; a source commit never installs an APK. Keep official
Termux, installed Companion, Shizuku and foreign services untouched.

The future one-app integration will **adapt this Java code**, plus
needed Termux:API and Boot components, into a licensed termux-app-based
Android application. Do not write another shell/package manager or
silently adopt old service/process ownership. Embedded Shizuku server
and pairing remain feasibility gates, not assumed capabilities.
