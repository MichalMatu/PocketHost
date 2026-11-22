---
status: accepted
owner: sites
last_reviewed: 2026-11-14
purpose: Minimal module boundary
---

# Sites module

Owned static/Node sites use versioned isolated files, releases and rollback. No discovery-based adoption of IleStoi/PhotoMap.

## Static ZIP upload UX (2026-11-22)

The browser /sites upload picker rejects an empty or oversized/non-ZIP selection before sending a mutation. A definitive HTTP 400 from the owned static API is reported as an input rejection; ambiguous transport/server failures still require manual refresh and are never retried. A successful upload only shows a published confirmation after independent exact-site readback confirms a new nonempty immutable release. UI interaction fixtures cover the ZIP bytes, intent header, single PUT, independent readback, empty file and HTTP 400 outcome; these fixtures require separately approved QA execution.

## Create new site with first ZIP release

The /sites creation form optionally accepts an initial ZIP. A **single owner-intent POST** to `/api/v1/sites/import?name=<encoded>` sends raw ZIP bytes; the server decodes/validates the archive before allocating the site and then creates the stopped site and its first immutable release within the serialized write handler. The UI independently compares the returned release with both the owned-site inventory and an exact-site GET before confirming. A definitive invalid ZIP (HTTP 400) does not create a site; unexpected failures after site allocation can still leave an inert site requiring explicit inventory refresh. No automatic retry, start, deletion or changes to existing sites. Browser interaction QA is still OPEN.

## Static form error boundaries (2026-11-22)

A definite HTTP 400 for an invalid new site name is reported next to the creation form, without hiding the previously verified owned-site inventory. Correcting the name allows another deliberate submit. ZIP file selection or site-name edits clear only transient form validation; they never clear a failed/unverified owned catalog or re-enable creation without a successful inventory reload. Ambiguous POST/PUT/readback failures still clear action cards and require an explicit refresh. Targeted interaction regressions committed; test execution separately authorized by exact SHA and categories.

## Initial ZIP structural preflight (2026-11-22)

Before POST creating a new Static site with a first ZIP, the browser performs a bounded classic ZIP envelope check (EOCD, central-directory and local-file headers) on the selected file. Obvious renamed text/invalid archives never create an empty site. This is intentionally not full decompression or CRC validation: the server is authoritative and now rejects invalid ZIP contents **before** allocating a site in the initial-import API. The existing direct ZIP upload flow does not perform this initial-site preflight. New interaction regression uses a valid one-file ZIP fixture plus malformed-file and server-400 scenarios; QA has not been executed.

## Initial ZIP index inventory preflight (2026-11-22)

Before creating an owned static site, the browser now walks the bounded classic ZIP central directory and verifies that a nonempty `index.html` exists either at the archive root or under one common top-level folder (as the server's decoder supports). Malformed entry structures and archives without a usable homepage are rejected before creating a site; the server remains authoritative for decompression, path safety, CRC and final asset validation. Existing-site uploads are not changed. Browser interaction fixtures for missing homepage and wrapped homepage are committed but not run; real browser acceptance remains OPEN.


## Single-request Static create + initial ZIP import (2026-11-22)

The frontend now uses **one owner-intent POST** to `/api/v1/sites/import?name=<encoded>` with raw ZIP bytes for the optional first release. The DEV API strictly decodes/validates ZIP **before** calling the existing owned-site creation and immutable release-deploy methods in the same serialized mutation. An invalid ZIP cannot allocate an owned site; a successfully acknowledged request must still pass independent inventory and exact-site readbacks before the UI confirms publication. A later operational/deploy failure could leave an inert new site; the UI reports unconfirmed state and never removes or retries it automatically. Plain empty-site creation, updates to existing sites and protected services are unchanged. New UI fixtures cover one POST, definite 400 (no site) and uncertain 503 (no automatic retry); functional QA requires exact-SHA scoped approval.

## Uncertain site action write lock (2026-11-22)

A static-site card locks **writes only for that site** after an ambiguous POST/PUT/DELETE outcome or unsuccessful exact-site confirmation. Upload ZIP/folder, HTML publish, Start/Stop/Restart/Rollback and historical restore/prune remain blocked until a fresh owned-inventory Refresh supplies a new site record. Read-only logs, HTTP checks, asset and version inspection remain available and cannot silently clear the lock. Definitive invalid-input HTTP 400 leaves writes available for user correction. Three UI regressions cover ambiguous 503, failed exact-site readback and definitive 400; these are committed but need separately approved exact-SHA QA.

## Confirmed actions and local folder input (2026-11-22)

After independent exact-site readback succeeds, a failed owned-inventory refresh blocks any subsequent write on stale site state until explicit Refresh. Failures in the optional saved-version panel are reported separately, since the owned inventory may already be current. Local oversized-folder and local file-read failures are definitive input errors before any PUT and must not trigger an uncertain-write lock. Regression cases were added but not run; exact SHA and check categories are required for A8 QA.
