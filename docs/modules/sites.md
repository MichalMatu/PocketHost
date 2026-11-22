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
