# Shizuku module developer notes

Owner: shizuku. Integrate real Shizuku Android permissions and
capabilities through a native PocketHost Companion, not by assuming
Node.js/browser inherit Binder access. Favor full available
power-user capability; do not impose arbitrary product-level feature
limits. User-directed actions should name their targets, accurately
report success/failure and never silently mutate unrelated services.
Fast DEV UI iterations apply. Respect actual Android/ADB/root policy.
