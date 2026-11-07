import { describe, expect, it } from "vitest"
import { parseOwnedSiteLogs, parseOwnedSiteState } from "@/lib/owned-site-schema"
import { parseManagedPhotoMapResponse } from "@/lib/managed-photomap-schema"

const demo = () => ({
  version: 1, id: "pockethost-demo", ownership: "pockethost", state: "running",
  port: 18787, url: "http://127.0.0.1:18787/",
  contentVersion: 1, previousVersion: null, canRollback: false,
})

const photomap = () => ({
  version: 1, id: "photomap-test", label: "PhotoMap TEST",
  ownership: "pockethost", importState: "verified-copy", runtimeState: "disabled",
  release: "import-20261106", port: 8010,
  tools: [], lockfiles: [], data: { databaseBytes: 100, privateMediaFiles: 2, publicMediaFiles: 0 },
  dependencies: { prootEnvironment: "external-unfrozen", isolatedRollback: false },
  capabilities: { startStop: false, packages: false, rollback: false },
})

describe("P3 owned-site API schema", () => {
  it("accepts a valid explicitly owned demo and bounded logs", () => {
    expect(parseOwnedSiteState({ enabled: true, site: demo() }).site?.id).toBe("pockethost-demo")
    expect(parseOwnedSiteLogs({ logs: ["first", "second"] })).toEqual(["first", "second"])
  })
  it("rejects forged ownership, nonloopback links and inconsistent rollback flags", () => {
    for (const modified of [
      { id: "foreign-site" },
      { url: "https://remote.example/" },
      { previousVersion: 1, canRollback: false },
      { ownership: "none", state: "running" },
    ]) {
      expect(() => parseOwnedSiteState({ enabled: true, site: { ...demo(), ...modified } })).toThrow()
    }
    expect(() => parseOwnedSiteLogs({ logs: ["x".repeat(400)] })).toThrow()
  })
})

describe("P4 catalog API schema", () => {
  it("accepts a disabled PhotoMap import without granting runtime commands", () => {
    expect(parseManagedPhotoMapResponse({ project: photomap() }).capabilities.startStop).toBe(false)
  })
  it("rejects API attempts to enable runtime or redirect to foreign assets", () => {
    for (const change of [
      { capabilities: { startStop: true, packages: false, rollback: false } },
      { runtimeState: "running" },
      { port: 8000 },
      { id: "foreign" },
      { lockfiles: [{ path: "../etc/passwd", sha256: "a".repeat(64) }] },
    ]) {
      expect(() => parseManagedPhotoMapResponse({ project: { ...photomap(), ...change } })).toThrow()
    }
  })
})
