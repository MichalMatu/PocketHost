# Shizuku module developer notes

## Scope

Owner: Shizuku. Model real Android permissions and available power-user
capabilities through the native PocketHost Companion and typed transport.
Node.js and the browser do not inherit Android Binder privileges.
UI development uses the agreed fast DEV loop.

## Forbidden

Do not invent ADB/root privileges, silently execute Android mutations,
pretend that a declined action succeeded, expose the native bridge to
WAN, or import another module's internal implementation. Do not impose
arbitrary product-level feature bans; the actual Shizuku authorization,
Android UID and OS permissions determine what works. Never mutate
unrelated Termux or Android services automatically.

## Gate

For each changed contract, verify the selected user intent, target
identity, actual Android UID, bounded responses, explicit refusal and
errors through relevant Node/UI negative tests. Native installation,
phone authorization, browser requests and physical hardware acceptance
are separate exact-source gates. Never report physical PASS from source
tests alone.
