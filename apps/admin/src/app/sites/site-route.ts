export function siteDetailPath(id: string): string {
  return "/sites/" + encodeURIComponent(id)
}
