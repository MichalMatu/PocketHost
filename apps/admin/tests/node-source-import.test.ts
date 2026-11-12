import { expect, it } from "vitest"
import { readLocalNodeFiles } from "@/lib/node-source-import"

const pkg = { name: "local-node", version: "1.0.0", scripts: { start: "node server.mjs" } }
const lock = {
  name: "local-node", version: "1.0.0", lockfileVersion: 3,
  packages: { "": { name: "local-node", version: "1.0.0" } },
}
function fixture(
  manifest: unknown = pkg,
  lockfile: unknown = lock,
  source = "console.log('local source')",
): File[] {
  return [
    new File([JSON.stringify(manifest)], "package.json"),
    new File([JSON.stringify(lockfile)], "package-lock.json"),
    new File([source], "server.mjs"),
  ]
}

it("loads three root Node files without writing or running anything", async () => {
  const imported = await readLocalNodeFiles(fixture())
  expect(JSON.parse(imported.manifest)).toEqual(pkg)
  expect(JSON.parse(imported.lockfile)).toEqual(lock)
  expect(imported.source).toBe("console.log('local source')")
})

it("rejects missing, duplicate and additional files", async () => {
  const files = fixture()
  await expect(readLocalNodeFiles(files.slice(0, 2))).rejects.toThrow(/exactly/)
  await expect(readLocalNodeFiles([files[0], files[0], files[2]])).rejects.toThrow(/duplicates/)
  await expect(readLocalNodeFiles([files[0], files[1], new File(["x"], "server.js")]))
    .rejects.toThrow(/three root/)
})

it("rejects empty and oversized source before reading files", async () => {
  const files = fixture()
  await expect(readLocalNodeFiles([files[0], files[1], new File([""], "server.mjs")]))
    .rejects.toThrow(/Empty or oversized/)
  await expect(readLocalNodeFiles([files[0], files[1], new File(["x".repeat(65537)], "server.mjs")]))
    .rejects.toThrow(/Empty or oversized/)
  await expect(readLocalNodeFiles([
    new File(["{".repeat(200_000)], "package.json"),
    new File(["{".repeat(150_000)], "package-lock.json"),
    files[2],
  ])).rejects.toThrow(/320 KB/)
})

it("rejects invalid manifest, mismatched lock and unsupported entrypoint", async () => {
  await expect(readLocalNodeFiles([
    new File(["{"], "package.json"), ...fixture().slice(1),
  ])).rejects.toThrow(/Invalid package/)
  await expect(readLocalNodeFiles(fixture(pkg, { ...lock, version: "2.0.0" })))
    .rejects.toThrow(/must match/)
  await expect(readLocalNodeFiles(fixture({ ...pkg, scripts: { start: "npm start" } })))
    .rejects.toThrow(/must be node server.mjs/)
})
