#!/usr/bin/env node
// Explicitly authorized, one-image private Local Agent preview transport.
// NEVER run on unreviewed screenshots or publish to the public PocketHost repo.
import { realpath, mkdtemp, readFile, rm, chmod } from "node:fs/promises"
import { join, resolve, dirname, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { isAllowedScreenshotName } from "./artifact-names.mjs"

const exec = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..", ".test-lab")
function args(argv) {
  if (argv.length !== 2) throw Error("Need exactly --run and --shot")
  const map = Object.create(null)
  for (const item of argv) {
    const hit = /^--(run|shot)=(.+)$/.exec(item)
    if (!hit || Object.hasOwn(map, hit[1])) throw Error("Invalid option")
    map[hit[1]] = hit[2]
  }
  if (!/^\d{13}-[a-f0-9]{8}$/.test(map.run || "") || !isAllowedScreenshotName(map.shot))
    throw Error("Preview selection not allowlisted")
  return map
}
async function main() {
  const { run, shot } = args(process.argv.slice(2))
  const allowed = await realpath(ROOT)
  const source = await realpath(join(allowed, run, shot))
  if (!source.startsWith(allowed + sep)) throw Error("Source path escapes private captures")
  const temp = await mkdtemp(join(allowed, "preview-"))
  await chmod(temp, 0o700)
  try {
    const dest = join(temp, "preview.jpg")
    await exec("/usr/bin/sips", [
      "-s", "format", "jpeg", "-s", "formatOptions", "23",
      "-Z", "420", source, "--out", dest,
    ], { timeout: 20000, maxBuffer: 65536 })
    const bytes = await readFile(dest)
    if (bytes.length > 36000 || bytes.length < 100) throw Error("Preview size out of bounds")
    // The only intended off-device disclosure is this selected, bounded preview.
    process.stdout.write(JSON.stringify({
      kind: "PocketHostTestLabPreview", run, shot, mime: "image/jpeg",
      bytes: bytes.length, base64: bytes.toString("base64"),
    }) + "\n")
  } finally { await rm(temp, { recursive: true, force: true }) }
}
main().catch(() => {
  process.stderr.write("PocketHost Test Lab: selected preview unavailable\n")
  process.exitCode = 1
})
