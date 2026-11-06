---
status: accepted
owner: packages
last_reviewed: 2026-11-05
purpose: Define the packages module contract
---

# Packages Module

## Responsibility

Present package availability and future curated installation plans.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## P4 PhotoMap read-only inventory

The P4 managed PhotoMap example displays the imported, allowlisted Termux tool names and versions plus SHA-256 hashes of stored dependency lockfiles. The host adapter reads sealed manifests; neither UI nor this module can run package commands. An update proposal and an explicit approval transaction remain a later milestone because the imported Debian PRoot image is not an isolated restorable release.

## Forbidden

No automatic `pkg install`, `pkg upgrade`, repository changes or arbitrary command execution.

## Quality

Tests cover explicit approval, allowlist and no-op paths; installation remains disabled in first milestone.
