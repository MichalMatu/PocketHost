/** Shared PocketHost Termux request contract for UI management panels. */
export const endpoint = "/api/v1/termux-admin"

export async function action<T>(payload: { action: string; name?: string; root?: string; path?: string; destination?: string; content?: string; base64?: string }): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    if (payload.action === "service-create" && response.status === 409) {
      const result = await response.json().catch(() => null) as { reason?: string } | null
      const hints: Record<string, string> = {
        capacity: "Creation blocked: PocketHost worker capacity is full.",
        "name-in-use": "Creation blocked: service name is already in use.",
        "runtime-unavailable": "Creation blocked: required Termux runtime is unavailable.",
        "storage-unverified": "Creation blocked: worker storage identity is unverified.",
      }
      const hint = result?.reason ? hints[result.reason] : undefined
      if (hint) throw new Error(hint)
    }
    throw new Error("Operation refused; no success assumed.")
  }
  return await response.json() as T
}
export async function inspect<T>(mode: string, location = ""): Promise<T> {
  const request = mode === "files" ? endpoint + "?mode=files&path=" + encodeURIComponent(location) :
    mode === "search-packages" ? endpoint + "?mode=search-packages&query=" + encodeURIComponent(location) :
    (["python-source-review", "python-source-history", "node-source-review", "node-source-history"].includes(mode))
      ? endpoint + "?mode=" + mode + "&name=" + encodeURIComponent(location) :
    endpoint + "?mode=" + mode
  const response = await fetch(request, {
    method: "GET", credentials: "same-origin", cache: "no-store",
    // Runit inventory is an ownership gate: never leave controls behind a hung read.
    ...(mode === "services" ? { signal: AbortSignal.timeout(10_000) } : {}),
  })
  if (!response.ok) throw new Error("Inventory unavailable.")
  return await response.json() as T
}
