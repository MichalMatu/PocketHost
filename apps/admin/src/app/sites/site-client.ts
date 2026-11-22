import { parseFleetSites, parseFleetSite, type FleetSite } from "@/lib/site-fleet-schema"

export const endpoint = "/api/v1/sites"
export const intent = "owned-sites"
export const maxZip = 9 * 1024 * 1024
export const maxFolder = 8 * 1024 * 1024
export const maxStarterHtml = 32 * 1024

export class StaticSiteInputRejected extends Error {
  constructor(message = "The site files were rejected. Include a root index.html and use a valid ZIP within the upload limits.") {
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
