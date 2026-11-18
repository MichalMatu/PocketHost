/** Presentation only; API actions keep full release IDs. */
export function shortRelease(id: string | null | undefined): string {
  return id ? id.slice(0, 12) + "…" : "none"
}
export function localEventTime(value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value
}
export function releaseRole(
  release: { id: string; candidate: boolean; previousCandidate: boolean },
  active: string | null | undefined, running: boolean,
): string {
  if (release.id === active) return running ? "Running release" : "Last deployed release (stopped)"
  if (release.candidate) return "Staged candidate — not running"
  if (release.previousCandidate) return "Previous staged source — not automatic rollback"
  return "Archived source"
}
