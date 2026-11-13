/** Load a fixed, bounded three-file Node entrypoint into the editor; never upload or execute. */
const FILES = ["package.json", "package-lock.json", "server.mjs"] as const
const MAX_TOTAL_BYTES = 320 * 1024
const MAX_SOURCE_BYTES = 64 * 1024

export interface LocalNodeFiles {
  manifest: string
  lockfile: string
  source: string
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read selected Node files."))
    reader.onabort = () => reject(new Error("Node file selection was interrupted."))
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Could not read selected Node files."))
        return
      }
      try {
        resolve(new TextDecoder("utf-8", { fatal: true }).decode(reader.result))
      } catch {
        reject(new Error("Selected Node text file is not valid UTF-8."))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export async function readLocalNodeFiles(files: readonly File[]): Promise<LocalNodeFiles> {
  if (files.length !== FILES.length) {
    throw new Error("Select exactly package.json, package-lock.json and server.mjs.")
  }
  const selected = new Map<string, File>()
  let total = 0
  for (const file of files) {
    if (!FILES.some(name => name === file.name) ||
        selected.has(file.name) || file.webkitRelativePath) {
      throw new Error("Only the three root Node files are supported; duplicates and folders are not.")
    }
    if (!Number.isSafeInteger(file.size) || file.size < 1 ||
        (file.name === "server.mjs" && file.size > MAX_SOURCE_BYTES)) {
      throw new Error("Empty or oversized Node source file.")
    }
    total += file.size
    if (total > MAX_TOTAL_BYTES) throw new Error("Node source files exceed 320 KB.")
    selected.set(file.name, file)
  }
  if (!FILES.every(name => selected.has(name)))
    throw new Error("Select exactly package.json, package-lock.json and server.mjs.")

  const [manifest, lockfile, source] = await Promise.all(
    FILES.map(name => readFile(selected.get(name)!)),
  )
  if (source.includes("\0") || !source.trim() ||
      new Blob([source]).size > MAX_SOURCE_BYTES)
    throw new Error("Invalid or oversized Node entry source.")

  return parseNodeSource(manifest, lockfile, source)
}

function parseNodeSource(manifest: string, lockfile: string, source: string): LocalNodeFiles {
  let pkg: Record<string, unknown>
  let lock: Record<string, unknown>
  try {
    pkg = JSON.parse(manifest) as Record<string, unknown>
    lock = JSON.parse(lockfile) as Record<string, unknown>
  } catch {
    throw new Error("Invalid package.json or package-lock.json.")
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg) ||
      !lock || typeof lock !== "object" || Array.isArray(lock) ||
      !pkg.scripts || typeof pkg.scripts !== "object" ||
      (pkg.scripts as Record<string, unknown>).start !== "node server.mjs" ||
      pkg.name !== lock.name || pkg.version !== lock.version) {
    throw new Error("Node manifest and lockfile must match; start must be node server.mjs.")
  }
  return { manifest: JSON.stringify(pkg, null, 2),
    lockfile: JSON.stringify(lock, null, 2), source }
}


/** Explicit folder selection. No ZIP extraction, npm execution or arbitrary file paths. */
const TEXT_EXTRA =
  /^(?:src|public)\/(?:[A-Za-z0-9_-]+\/){0,6}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:js|jsx|ts|tsx|css|html|json|svg|txt|md)$/
const ROOT_EXTRA =
  /^(?:index\.html|vite\.config\.(?:js|mjs|ts)|tsconfig(?:\.[a-z0-9_-]+)?\.json|postcss\.config\.(?:js|cjs)|tailwind\.config\.(?:js|ts))$/
const BINARY_EXTRA =
  /^(?:public|src\/assets)\/(?:[A-Za-z0-9_-]+\/){0,5}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:png|jpg|jpeg|webp|gif|ico|woff2)$/

export interface LocalNodeFolder extends LocalNodeFiles {
  extraFiles: Record<string, string>
  assetFiles: Record<string, string>
}

function readBinaryBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read selected binary asset."))
    reader.onabort = () => reject(new Error("Binary asset selection was interrupted."))
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read selected binary asset."))
        return
      }
      const match = /^data:[^,]*;base64,([A-Za-z0-9+/]+={0,2})$/.exec(reader.result)
      if (!match) reject(new Error("Invalid local binary encoding."))
      else resolve(match[1]!)
    }
    reader.readAsDataURL(file)
  })
}
function assetSignature(path: string, base64: string): boolean {
  const header = atob(base64.slice(0, 24))
  const byte = (n: number) => header.charCodeAt(n)
  const name = path.split(".").at(-1)
  if (name === "png") return [137,80,78,71,13,10,26,10].every((n, i) => byte(i) === n)
  if (name === "jpg" || name === "jpeg") return byte(0) === 255 && byte(1) === 216 && byte(2) === 255
  if (name === "webp") return header.slice(0, 4) === "RIFF" && header.slice(8, 12) === "WEBP"
  if (name === "gif") return header.slice(0, 6) === "GIF87a" || header.slice(0, 6) === "GIF89a"
  if (name === "ico") return byte(0) === 0 && byte(1) === 0 && byte(2) === 1 && byte(3) === 0
  if (name === "woff2") return header.slice(0, 4) === "wOF2"
  return false
}
/** One top-level selected directory, fixed source layout, bounded text and binary budgets. */
export async function readLocalNodeFolder(files: readonly File[]): Promise<LocalNodeFolder> {
  if (files.length < FILES.length || files.length > 47)
    throw new Error("Local Node folder must contain the three root files and at most 44 extras.")
  const selected = new Map<string, File>()
  let root: string | null = null
  let textBytes = 0
  let assetBytes = 0
  let textCount = 0
  let assetCount = 0
  for (const file of files) {
    const parts = file.webkitRelativePath.split("/")
    if (parts.length < 2 || !/^[A-Za-z0-9_-]{1,60}$/.test(parts[0] ?? "") ||
        (root !== null && root !== parts[0])) {
      throw new Error("Select one local Node project folder.")
    }
    root = parts[0]!
    const name = parts.slice(1).join("/")
    const required = FILES.some(value => value === name)
    const binary = BINARY_EXTRA.test(name)
    const text = TEXT_EXTRA.test(name) || ROOT_EXTRA.test(name)
    if (name.length > 160 || selected.has(name) || !(required || text || binary) ||
        !Number.isSafeInteger(file.size) || file.size < 1) {
      throw new Error("Unsupported, duplicated or empty local Node project file.")
    }
    if (file.name !== parts.at(-1)) throw new Error("Local Node file name mismatch.")
    if (binary) {
      assetCount++
      assetBytes += file.size
      if (assetCount > 12 || file.size > 128 * 1024 || assetBytes > 512 * 1024)
        throw new Error("Local binary assets exceed budget.")
    } else {
      if (!required) textCount++
      textBytes += file.size + (required ? 0 : name.length)
      if (textCount > 32 || file.size > (name === "server.mjs" ? MAX_SOURCE_BYTES :
          required ? MAX_TOTAL_BYTES : 32 * 1024) ||
          textBytes > 320 * 1024)
        throw new Error("Local Node text files exceed budget.")
    }
    selected.set(name, file)
  }
  if (!FILES.every(name => selected.has(name)))
    throw new Error("Local Node folder must include package.json, package-lock.json and server.mjs.")
  const [manifest, lockfile, source] = await Promise.all(
    FILES.map(name => readFile(selected.get(name)!)),
  )
  if (source.includes("\0") || !source.trim() || new Blob([source]).size > MAX_SOURCE_BYTES)
    throw new Error("Invalid or oversized Node entry source.")
  const parsed = parseNodeSource(manifest, lockfile, source)
  const extras: Record<string, string> = {}
  const assets: Record<string, string> = {}
  for (const name of [...selected.keys()].sort()) {
    if (FILES.some(required => required === name)) continue
    const file = selected.get(name)!
    if (BINARY_EXTRA.test(name)) {
      const encoded = await readBinaryBase64(file)
      if (!assetSignature(name, encoded))
        throw new Error("Binary asset does not match its filename extension.")
      assets[name] = encoded
    } else {
      const contents = await readFile(file)
      if (!contents.trim() || contents.includes("\0") ||
          new Blob([contents]).size > 32 * 1024)
        throw new Error("Invalid local frontend text file.")
      extras[name] = contents
    }
  }
  return { ...parsed, extraFiles: extras, assetFiles: assets }
}
