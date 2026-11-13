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


function folderFile(contents: string | Uint8Array, path: string): File {
  const file = new File([contents], path.split("/").at(-1)!)
  Object.defineProperty(file, "webkitRelativePath", { value: "my-project/" + path })
  return file
}
it("imports a bounded local multi-file frontend folder with binary assets", async () => {
  const files = [
    folderFile(JSON.stringify(pkg), "package.json"),
    folderFile(JSON.stringify(lock), "package-lock.json"),
    folderFile("console.log('local')", "server.mjs"),
    folderFile("<html>ok</html>", "index.html"),
    folderFile("export const ready = true", "src/main.ts"),
    folderFile(Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII="), c => c.charCodeAt(0)), "public/logo.png"),
  ]
  const { readLocalNodeFolder } = await import("@/lib/node-source-import")
  const parsed = await readLocalNodeFolder(files)
  expect(parsed.extraFiles["index.html"]).toContain("ok")
  expect(parsed.extraFiles["src/main.ts"]).toContain("ready")
  expect(parsed.assetFiles["public/logo.png"]).toBe("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=")
  expect(JSON.parse(parsed.manifest)).toEqual(pkg)
})
it("rejects traversal, unsupported files and mixed roots before reading local folder", async () => {
  const { readLocalNodeFolder } = await import("@/lib/node-source-import")
  const files = [
    folderFile(JSON.stringify(pkg), "package.json"),
    folderFile(JSON.stringify(lock), "package-lock.json"),
    folderFile("console.log(1)", "server.mjs"),
  ]
  await expect(readLocalNodeFolder([
    ...files, folderFile("secrets", "src/.env"),
  ])).rejects.toThrow(/Unsupported/)
  await expect(readLocalNodeFolder([
    ...files, folderFile("exec", "src/../oops.js"),
  ])).rejects.toThrow(/Unsupported/)
  await expect(readLocalNodeFolder([
    ...files, folderFile("unknown", "public/virus.exe"),
  ])).rejects.toThrow(/Unsupported/)
  const second = folderFile("<html>x</html>", "index.html")
  Object.defineProperty(second, "webkitRelativePath", {
    value: "other-root/index.html", configurable: true,
  })
  await expect(readLocalNodeFolder([...files, second])).rejects.toThrow(/one local Node project/)
  const bad = folderFile("not real png!", "public/logo.png")
  await expect(readLocalNodeFolder([...files, bad])).rejects.toThrow(/does not match/)
})

it("rejects invalid UTF-8 in the local entrypoint and imported frontend source", async () => {
  const { readLocalNodeFolder } = await import("@/lib/node-source-import")
  const invalid = Uint8Array.from([0xff, 0xfe, 0x00])
  await expect(readLocalNodeFiles([
    new File([JSON.stringify(pkg)], "package.json"),
    new File([JSON.stringify(lock)], "package-lock.json"),
    new File([invalid], "server.mjs"),
  ])).rejects.toThrow(/UTF-8/)
  await expect(readLocalNodeFolder([
    folderFile(JSON.stringify(pkg), "package.json"),
    folderFile(JSON.stringify(lock), "package-lock.json"),
    folderFile("console.log(1)", "server.mjs"),
    folderFile(invalid, "src/main.ts"),
  ])).rejects.toThrow(/UTF-8/)
})
