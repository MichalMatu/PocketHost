import { expect, it } from "vitest"
import { shortRelease, localEventTime, releaseRole } from "@/app/projects/node-project-display"
const candidate = { id: "r-" + "a".repeat(32), candidate: true, previousCandidate: false }
it("shortens presented IDs", () => {
  expect(shortRelease(candidate.id)).toBe("r-" + "a".repeat(10) + "…")
  expect(shortRelease(null)).toBe("none")
})
it("distinguishes deployment and staged source roles", () => {
  expect(releaseRole(candidate, candidate.id, true)).toBe("Running release")
  expect(releaseRole(candidate, candidate.id, false)).toMatch(/stopped/)
  expect(releaseRole(candidate, null, false)).toBe("Prepared update — not running")
  expect(releaseRole({ ...candidate, candidate: false, previousCandidate: true }, null, false))
    .toBe("Older prepared source")
})
it("does not invent malformed event time", () => {
  expect(localEventTime("invalid timestamp")).toBe("invalid timestamp")
})
