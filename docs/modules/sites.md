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

The /sites creation form optionally accepts a first ZIP. The browser validates its filename/size before POST, creates an inert stopped site, independently re-reads the exact owner inventory, and only then sends one ZIP PUT to that new site's immutable-release endpoint. After an acknowledged upload it compares an exact site GET and another inventory GET before reporting a published release. Definitive ZIP rejection leaves the new empty site visible; uncertain upload or readback state hides operation cards and requires explicit refresh. No automatic retry, start, deletion, or changes to existing sites. UI regression fixtures are committed and need exact-SHA, separately approved QA.

## Static form error boundaries (2026-11-22)

A definite HTTP 400 for an invalid new site name is reported next to the creation form, without hiding the previously verified owned-site inventory. Correcting the name allows another deliberate submit. ZIP file selection or site-name edits clear only transient form validation; they never clear a failed/unverified owned catalog or re-enable creation without a successful inventory reload. Ambiguous POST/PUT/readback failures still clear action cards and require an explicit refresh. Targeted interaction regressions committed; test execution separately authorized by exact SHA and categories.
