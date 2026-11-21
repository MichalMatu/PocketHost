/** Non-React Shizuku page contracts and read-only helpers. */
export type Section = "applications" | "processes" | "services" | "shell" | "diagnostics"
export type PackageFilter = "all" | "user" | "system"
export const PAGE_SIZE = 80

export async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET", cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("Endpoint unavailable")
  return response.json() as Promise<unknown>
}

/** First-entry GET retry for a temporarily cold Companion, never a shell or mutation. */
export async function readEntryJson(url: string, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await readJson(url, AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]))
    } catch (error) {
      if (signal.aborted || attempt === 1) throw error
      await new Promise(resolve => setTimeout(resolve, 350))
    }
  }
  throw new Error("Android inventory unavailable")
}

export function unavailable(value: string | number | null | undefined, suffix = "") {
  return value == null ? "Unavailable" : String(value) + suffix
}

/** Android process RSS is in KiB; show process-scale values in MiB. */
export function processMiB(value: number | null) {
  if (value == null) return "Unavailable"
  if (value === 0) return "0 MiB"
  return (value / 1024).toFixed(value < 1024 ? 2 : 1) + " MiB"
}

