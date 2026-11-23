import { parseFleetSites, parseFleetSite, type FleetSite } from "@/lib/site-fleet-schema"

export const endpoint = "/api/v1/sites"
export const intent = "owned-sites"
export const maxZip = 9 * 1024 * 1024
export const maxFolder = 8 * 1024 * 1024
export const maxStarterHtml = 32 * 1024

export class StaticSiteInputRejected extends Error {
  constructor(message = "The site files were rejected. Include a root index.html and use a valid ZIP or folder within upload limits.") {
    super(message)
    this.name = "StaticSiteInputRejected"
  }
}

export function validateStaticZipSelection(file: Pick<File, "name" | "size">): string | null {
  if (!/\.zip$/i.test(file.name)) return "Choose a .zip archive for static hosting."
  if (file.size === 0) return "The selected ZIP is empty."
  if (file.size > maxZip) return "ZIP is larger than 9 MiB."
  return null
}

/** Browser preflight for first release; the backend still validates CRC and assets. */
export async function inspectInitialStaticZip(file: File): Promise<string | null> {
  const selected = validateStaticZipSelection(file)
  if (selected) return selected
  const invalid = "ZIP structure is invalid. Select a standard ZIP archive with index.html."
  const missing = "ZIP needs a nonempty index.html at the root or inside one top-level folder."
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength < 98) return invalid
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const decoder = new TextDecoder("utf-8", { fatal: true })
    // The server imports classic ZIP central-directory entries, not shell paths.
    for (let end = bytes.length - 22; end >= Math.max(0, bytes.length - 65557); end--) {
      if (view.getUint32(end, true) !== 0x06054b50 ||
          end + 22 + view.getUint16(end + 20, true) !== bytes.length ||
          view.getUint16(end + 4, true) !== 0 ||
          view.getUint16(end + 6, true) !== 0) continue
      const count = view.getUint16(end + 10, true)
      const size = view.getUint32(end + 12, true)
      const offset = view.getUint32(end + 16, true)
      if (!count || count > 130 || count !== view.getUint16(end + 8, true) ||
          size < 46 || offset > end || size > end - offset) continue
      let cursor = offset
      const boundary = offset + size
      const entries: { name: string; length: number }[] = []
      let valid = true
      for (let i = 0; i < count; i++) {
        if (cursor + 46 > boundary || view.getUint32(cursor, true) !== 0x02014b50) {
          valid = false
          break
        }
        const nameLen = view.getUint16(cursor + 28, true)
        const extraLen = view.getUint16(cursor + 30, true)
        const commentLen = view.getUint16(cursor + 32, true)
        const next = cursor + 46 + nameLen + extraLen + commentLen
        const localOffset = view.getUint32(cursor + 42, true)
        const flags = view.getUint16(cursor + 8, true)
        const method = view.getUint16(cursor + 10, true)
        const compressed = view.getUint32(cursor + 20, true)
        const expanded = view.getUint32(cursor + 24, true)
        if (next > boundary || !nameLen || localOffset >= offset ||
            localOffset + 30 > offset || view.getUint32(localOffset, true) !== 0x04034b50 ||
            (flags & 0x41) !== 0 || (method !== 0 && method !== 8) ||
            compressed === 0xffffffff || expanded === 0xffffffff) {
          valid = false
          break
        }
        const localNameLen = view.getUint16(localOffset + 26, true)
        const localExtraLen = view.getUint16(localOffset + 28, true)
        const localEnd = localOffset + 30 + localNameLen + localExtraLen + compressed
        if (localEnd > offset || localNameLen !== nameLen ||
            view.getUint16(localOffset + 8, true) !== method) {
          valid = false
          break
        }
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen))
        const localName = decoder.decode(bytes.subarray(localOffset + 30,
          localOffset + 30 + localNameLen))
        if (name !== localName) {
          valid = false
          break
        }
        if (!name.endsWith("/")) entries.push({ name, length: expanded })
        cursor = next
      }
      if (!valid || cursor !== boundary || entries.length === 0 || entries.length > 100)
        return invalid
      if (entries.some(entry => entry.name === "index.html" && entry.length > 0))
        return null
      // Mirror the importer's one-common-folder normalization.
      const root = entries[0].name.split("/")[0]
      if (root && entries.every(entry => entry.name.startsWith(root + "/")) &&
          entries.some(entry => entry.name === root + "/index.html" && entry.length > 0))
        return null
      return missing
    }
    return invalid
  } catch {
    return "Could not inspect the selected ZIP. Select the file again."
  }
}

/** Validate a complete immutable site release before asking to publish or write. */
export function validateStaticFolderSelection(
  files: readonly Pick<File, "name" | "size" | "webkitRelativePath">[],
): string | null {
  if (!files.length || files.length > 100 ||
      files.some(file => file.size > 2 * 1024 * 1024) ||
      files.reduce((total, file) => total + file.size, 0) > maxFolder)
    return "Folder exceeds 100 files, 2 MiB per file or 8 MiB total."

  // A directory picker prefixes files with one selected folder name, while
  // single-file and test inputs use the filename itself. Match the importer's
  // one-common-folder normalization without reading or changing file bytes.
  const names = files.map(file => file.webkitRelativePath || file.name)
  const firstFolder = names[0].split("/")[0]
  const wrapped = firstFolder.length > 0 &&
    names.every(name => name.startsWith(firstFolder + "/"))
  // Match the host's case-insensitive duplicate check after it removes
  // a shared directory-picker prefix. Do not start a doomed create/publish.
  const normalized = wrapped ? names.map(name => name.slice(firstFolder.length + 1)) : names
  const folded = normalized.map(name => name.toLowerCase())
  if (new Set(folded).size !== folded.length)
    return "Folder contains duplicate file paths. Rename files that differ only by case."
  const homepage = files.some((file, index) => file.size > 0 && (
    names[index] === "index.html" ||
    (wrapped && names[index] === firstFolder + "/index.html")
  ))
  return homepage ? null :
    "Folder needs a nonempty index.html at the root or inside one top-level folder."
}

/** Prepare either an initial folder release or an update, before any server write. */
export async function encodeStaticFolder(files: readonly File[]): Promise<string> {
  const invalid = validateStaticFolderSelection(files)
  if (invalid) throw new StaticSiteInputRejected(invalid)
  const entries = await Promise.all(files.map(async file => ({
    name: file.webkitRelativePath || file.name,
    base64: encodeBase64(new Uint8Array(await file.arrayBuffer())),
  }))).catch(() => {
    throw new StaticSiteInputRejected("Could not read the selected folder. Select it again.")
  })
  return JSON.stringify({ files: entries })
}

/** Read-only site queries must settle; mutation requests retain their own lifecycle. */
export function readSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(10_000)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export const starterHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My PocketHost site</title>
  <style>
    body { font: 18px system-ui, sans-serif; max-width: 720px; margin: 15vh auto; padding: 1rem; }
    h1 { color: #156f60; }
  </style>
</head>
<body>
  <h1>My first PocketHost site</h1>
  <p>This page is hosted on my own device.</p>
</body>
</html>`

export async function readSites(signal?: AbortSignal): Promise<FleetSite[]> {
  const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: readSignal(signal) })
  if (response.status === 404) throw new Error("Static hosting is disabled on this panel.")
  if (response.status === 403) throw new Error("Static hosting access denied.")
  if (!response.ok) throw new Error("Could not load static sites. Try Refresh.")
  try {
    return parseFleetSites(await response.json())
  } catch {
    throw new Error("Invalid static site inventory. No changes were made.")
  }
}
export async function mutate(url: string, method: "POST" | "PUT" | "DELETE", body?: BodyInit, type?: string): Promise<FleetSite> {
  const response = await fetch(url, {
    method, credentials: "same-origin",
    headers: { "X-PocketHost-Intent": intent, ...(type ? { "Content-Type": type } : {}) },
    body,
  })
  if (!response.ok) {
    if (response.status === 400) {
      if (method === "POST" && url === endpoint + "/")
        throw new StaticSiteInputRejected("The site name was rejected. Choose a valid name of 2–60 characters.")
      throw new StaticSiteInputRejected()
    }
    throw new Error("Operation was safely refused. Check the process identity, site port and release.")
  }
  return parseFleetSite(await response.json())
}
export function siteAddress(site: FleetSite): string {
  if (typeof window !== "undefined" && window.location.port === "18878") {
    return window.location.protocol + "//" + window.location.hostname + ":18879/h2/" + site.id + "/"
  }
  return "http://127.0.0.1:" + site.port + "/"
}
export function encodeBase64(bytes: Uint8Array): string {
  let text = ""
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(text)
}
