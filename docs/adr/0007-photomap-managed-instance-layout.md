---
status: proposed
owner: sites
last_reviewed: 2026-11-06
purpose: Define isolated PocketHost-managed PhotoMap test instance, its package catalog and reversible releases
---

# ADR-0007: Managed PhotoMap test instance on Samsung

## Decision and explicit scope

The owner authorizes stopping and **adopting the Samsung test copy** of PhotoMap into PocketHost, keeping its exact existing source (including local uncommitted changes) as a private backup. The public PhotoMap service on Raspberry Pi, any live IleStoi service, Cloudflare, and the Local Agent are strictly out of scope.

The initial handoff is a **stopped** private managed instance. Do not expose it on LAN, register autostart, change package installations, or claim live site compatibility until exact managed runtime wiring and acceptance tests pass.

## Canonical Termux data root

PocketHost application code remains in its checked-out Git repository. Its persistent managed content has a dedicated root, not inside the Git tree or the existing P3 demo:

`$HOME/Projects/PocketHost-Managed/`

```text
PocketHost-Managed/
  registry/
    photomap-test.json                # typed registry, controlled by PocketHost
  instances/
    photomap-test/
      manifests/
        instance.json                 # ownership, approved source and storage
        runtime.json                  # explicit launch/runtime paths, initially disabled
        packages.json                 # inspected package versions and lock hashes
      releases/
        import-20261106/
          source/                     # immutable snapshot of original code and build
          source-manifest.json        # source HEAD, local-diff and content inventory
      current.json                    # selected release ID (not arbitrary symlink)
      data/
        database/app.db               # verified independent SQLite copy
        media/private/                # private originals
        media/public/                 # public derivatives
      runtime/
        logs/
        state/                        # future owned PID/start-ticks record
      package-locks/
        import-20261106/              # requirements/lockfiles and version inventory
      snapshots/
        import-20261106/              # rollback metadata and read-only data manifest
  backups/
    photomap-test/
      import-20261106/
        original-code/                # preservation of all current non-media source
        metadata.json                 # local git status, hashes, backup provenance
  toolchains/
    catalog.json                      # discovered tool versions, not a shared mutable env
```

All directories are private (owner-only). Never traverse or copy symlinks outside the approved source tree. Source and data are separate; no hard-coded absolute path in public APIs. Every manifest has a schema version and explicit owner `pockethost` plus instance ID `photomap-test`. The original `$HOME/Projects/PhotoMap` remains intact as a second fallback copy, and no deletions occur during adoption.

## Safe import transaction

1. Inspect exact Termux runit symlink target, process tree, port 8010 and active service state; stop **only** the verified Samsung PhotoMap test service, then disable only its runit registration. If ownership is ambiguous, abort.
2. Snapshot current source including dirty modifications and untracked files, avoiding duplicate media and dependency caches. Record current Git HEAD, dirty paths, locks and source hashes privately. Keep the source checkout unchanged.
3. Copy the source snapshot into an immutable managed release; copy SQLite and both media trees to `data/` without following symlinks, using staging paths. Validate SQLite SHA-256/integrity/migration and file counts/bytes; compare with source after copy. Publish staging by atomic directory rename only on complete success.
4. Write private, validated ownership registry and disabled runtime manifest only after verified copy. Keep port 8010 free and the production systems unchanged. A failed import leaves source and service stopped and staging unadopted; never mark ownership accepted on incomplete data.
5. Capture toolchain and package versions independently: Termux Node and package manager, frontend npm lock and resolved installs, PRoot distribution and Python/pip requirements. A pre-existing PRoot environment is a **dependency**, not an owned rollbackable release, until a separate isolated image/snapshot has been created and tested.

## Update and rollback guarantees

A managed release must reference an immutable source snapshot, an isolated dependency/runtime snapshot, and a consistent SQLite+media snapshot. Rollback is an explicit transaction that stops only the owned instance, validates the desired snapshot, swaps a manifest pointer, restarts the verified owned process and performs health checks. Failures restore the previous pointer. Do not advertise a global rollback until **all** mutable parts, including Python packages and database migrations, have tested restore points.

The admin UI will expose each managed project with its installed tools, versions and package locks; dependency updates must use allowlisted, project-scoped actions, a preview plan and explicit confirmation. Direct `pkg upgrade`, `apt upgrade`, global `pip install` and arbitrary shell commands are not allowed from the PocketHost panel. The P3 demo's v1/v2 selector must not be reused as a generic package rollback.

## Acceptance gates

The first physical import is accepted only with a terminal Local Agent result proving: PhotoMap test HTTP port 8010 stopped, its verified runit registration disabled, source snapshot preserved, copied SQLite checksum/PRAGMA checks and media inventory matching, ownership manifests valid, target still stopped, six existing non-PhotoMap monitored services unchanged, and Pi production untouched (by operation scope, not remote claims). Package updates, managed start/stop and full rollback controls require later independent code and device gates.
