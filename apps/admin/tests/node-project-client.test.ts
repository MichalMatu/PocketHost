import { describe, expect, it } from "vitest"
import { parseCandidates, parseNodeHealth, parseProjectCatalog, validProject } from "@/app/projects/node-project-client"

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
  it("rejects one release claiming both current and previous candidate roles", () => {
    expect(() => parseCandidates([{ ...valid, previousCandidate: true }]))
      .toThrow(/inventory/)
    // Distinct current and previous source versions remain valid.
    const previous = {
      ...valid, id: "r-" + "b".repeat(32), candidate: false, previousCandidate: true,
    }
    expect(parseCandidates([valid, previous])).toEqual([valid, previous])
  })

  it("requires a primitive source-integrity value, not a stringified object", () => {
    expect(() => parseCandidates([{ ...valid, sourceIntegrity: Object("verified") }]))
      .toThrow(/inventory/)
    expect(() => parseCandidates([{
      ...valid, sourceIntegrity: { toString: () => "verified" },
    }])).toThrow(/inventory/)
  })

  it("retains legacy source integrity warnings", () => {
    expect(parseCandidates([{ ...valid, sourceIntegrity: "legacy-needs-restaging" }])[0]
      .sourceIntegrity).toBe("legacy-needs-restaging")
  })
})

describe("owned Node project catalog revisions", () => {
  const created = {
    id: "node-" + "a".repeat(32), name: "Revision fixture",
    kind: "node", state: "created", runtime: "not-provisioned",
    activeRelease: null, candidateRelease: null, previousCandidate: null,
    deploymentCount: 0, createdAt: "2026-11-22T10:00:00Z",
  }

  it("accepts verified zero and positive source revisions", () => {
    expect(validProject(created)).toBe(true)
    expect(validProject({ ...created, deploymentCount: 7 })).toBe(true)
  })

  it.each([undefined, null, -1, 0.5, Number.NaN, Infinity, "0", Number.MAX_SAFE_INTEGER + 1])(
    "rejects an unusable expected source revision %s", revision => {
      expect(validProject({ ...created, deploymentCount: revision })).toBe(false)
    },
  )
})

describe("owned Node project catalog integrity", () => {
  const item = {
    id: "node-" + "a".repeat(32), name: "Owned fixture",
    kind: "node", state: "created", runtime: "not-provisioned",
    activeRelease: null, candidateRelease: null, previousCandidate: null,
    deploymentCount: 0, createdAt: "2026-11-22T10:00:00Z",
  }

  it("accepts an empty and a unique owned catalog", () => {
    expect(parseProjectCatalog([])).toEqual([])
    expect(parseProjectCatalog([item])).toEqual([item])
  })

  it("rejects duplicate identities rather than presenting ambiguous project choices", () => {
    expect(() => parseProjectCatalog([item, { ...item, name: "Conflicting label" }]))
      .toThrow("Invalid Node project registry response")
  })

  it("refuses more than the host's eight-project catalog limit", () => {
    const oversized = Array.from({ length: 9 }, (_, index) => ({
      ...item, id: "node-" + index.toString(16).padStart(32, "0"),
    }))
    expect(() => parseProjectCatalog(oversized))
      .toThrow("Invalid Node project registry response")
  })
})

describe("owned Node readiness response", () => {
  const release = "r-" + "b".repeat(32)
  it("preserves verified health values without coercion", () => {
    expect(parseNodeHealth({ state: "running", release, ready: true }))
      .toEqual({ state: "running", release, ready: true })
    expect(parseNodeHealth({ state: "stopped", release, ready: null }))
      .toEqual({ state: "stopped", release, ready: null })
    expect(parseNodeHealth({ state: "not-provisioned", release: null, ready: null }))
      .toEqual({ state: "not-provisioned", release: null, ready: null })
  })

  it.each([
    { state: Object("running"), release, ready: true },
    { state: { toString: () => "running" }, release, ready: true },
    { state: 123, release, ready: true },
    { state: "running", release, ready: "true" },
    { state: "running", release, ready: undefined },
    { state: "running", release: undefined, ready: true },
    { state: "created", release, ready: true },
    { state: "not-provisioned", release: null, ready: true },
    { state: "stopped", release, ready: true },
    { state: "unknown", release, ready: true },
    { state: "running", release: null, ready: true },
    { state: "running", release: "foreign", ready: true },
    null,
    [],
  ])("refuses malformed health replies rather than reporting readiness: %s", invalid => {
    expect(() => parseNodeHealth(invalid)).toThrow("Invalid owned Node health response")
  })
})
