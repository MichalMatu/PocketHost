import { describe, expect, it } from "vitest"
import { parseCandidates } from "@/app/projects/node-project-client"

const valid = {
  id: "r-" + "a".repeat(32),
  active: false, candidate: true, previousCandidate: false,
  sourceIntegrity: "verified",
  dependencyPlan: {
    packageName: "owned-node", packageVersion: "1.0.0",
    dependencyCount: 1, status: "review-required",
  },
}

describe("owned Node release inventory", () => {
  it("accepts one verified candidate and refuses repeated identities", () => {
    expect(parseCandidates([valid])).toEqual([valid])
    expect(() => parseCandidates([valid, valid])).toThrow(/inventory/)
  })
  it("rejects malformed release identity and dependency plan", () => {
    expect(() => parseCandidates([{ ...valid, id: "foreign" }])).toThrow(/inventory/)
    expect(() => parseCandidates([{ ...valid, dependencyPlan: null }])).toThrow(/dependency/)
    expect(() => parseCandidates([{ ...valid, dependencyPlan: { ...valid.dependencyPlan, dependencyCount: -1 } }])).toThrow(/inventory/)
    expect(() => parseCandidates([{ ...valid, sourceIntegrity: "unknown" }])).toThrow(/inventory/)
  })
  it("retains legacy source integrity warnings", () => {
    expect(parseCandidates([{ ...valid, sourceIntegrity: "legacy-needs-restaging" }])[0]
      .sourceIntegrity).toBe("legacy-needs-restaging")
  })
})
