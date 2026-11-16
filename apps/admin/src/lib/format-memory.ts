/** Bytes expressed by the host API as mebibytes; preserve binary units. */
export function formatMemory(mib: number): string {
  if (!Number.isFinite(mib) || mib < 0) return "Unavailable"
  if (mib >= 1024) {
    return `${(mib / 1024).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} GiB`
  }
  return `${mib.toLocaleString("en-US", { maximumFractionDigits: 0 })} MiB`
}

/**
 * Exact byte counts from owned site inventory; present binary IEC units
 * without a trailing .0 or pretending that KiB equals decimal KB.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "Unavailable"
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let amount = bytes
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }) + " " + units[unit]
}
