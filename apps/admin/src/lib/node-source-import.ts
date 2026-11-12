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
      if (typeof reader.result !== "string")
        reject(new Error("Could not read selected Node files."))
      else resolve(reader.result)
    }
    reader.readAsText(file, "utf-8")
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
