/** Bytes expressed by the host API as mebibytes; preserve binary units. */
export function formatMemory(mib: number): string {
  if (!Number.isFinite(mib) || mib < 0) return "Unavailable"
  if (mib >= 1024) {
    return `${(mib / 1024).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} GiB`
  }
  return `${mib.toLocaleString("en-US", { maximumFractionDigits: 0 })} MiB`
}
