# PocketHost Companion — Android & Shizuku

This native Android source begins the actual Shizuku integration. It is a
standalone **developer app**, not yet connected to the PocketHost browser.

## What works when installed and authorized

- Detect real Shizuku Binder availability, permission, ADB shell (UID 2000)
  vs root (UID 0).
- Explicitly ask the **user** to grant Shizuku permission from Android.
- Start a Shizuku UserService and request a bounded, real Android CPU
  `dumpsys cpuinfo` sample and Android-visible process count.
- Display actual readings on the phone, without inventing a system CPU %.

No public HTTP endpoints, automatically granted permission, background
daemons, privileged shell buttons or changes to unrelated Android services
are introduced. Those are later modules, not banned features.

## Development build

From the Mac Android SDK environment (after installing Android Gradle
Plugin dependencies as needed):

```sh
cd native/pockethost-companion
gradle :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n pl.pockethost.companion/.MainActivity
```

The first run needs an **on-device Shizuku permission approval**. After
granting, tap **Read Android CPU and processes**. Native IPC with the web
panel is a separate next slice; it must not expose an unrestricted Shizuku
Binder bridge to the currently login-free LAN web page.

Shizuku API: `dev.rikka.shizuku:api:13.1.5` and
`dev.rikka.shizuku:provider:13.1.5`; user service is used instead
of the deprecated `Shizuku.newProcess`.

## Caveat

The initial CPU parser targets the Android `dumpsys cpuinfo` `TOTAL`
summary observed over ADB on Samsung. Other Android versions may return
different output; report `Unavailable` rather than guessing.

Build tools: Android SDK API 36, Android Gradle Plugin 8.10.1,
Gradle 8.11.1+ and Java 17+. No device app is installed by committing code.

## DEV bridge to Termux (2026-11-08)

After explicit Shizuku authorization, the companion samples CPU/process
information while its screen is active and publishes a short-lived JSON
snapshot via Android `content read --uri
content://pl.pockethost.companion.telemetry/status`. The provider is
read-only and accepts only the Termux app UID and shell UID. Snapshots
expire after 30 seconds. It exposes no actions, Binder references or
privileged command execution. A matching PocketHost loopback API can
fetch this output without making an Android HTTP listener.

For continued sampling when the app is in the background, a future
Android foreground service with an explicit user-visible notification
is needed. This first DEV version does not claim always-on telemetry.

On Android 16, the Termux app UID cannot execute `/system/bin/content`
because `app_process` is restricted. The supported initial transport is
`http://127.0.0.1:18791/status`, bound *only* to Android loopback by
PocketHost Companion, read-only, short-lived, and without any actions.
Termux can retrieve it directly; the existing browser panel proxies only
typed telemetry. The provider remains for Android ADB-level diagnosis.
