import type { Plugin } from "vite"
import { probeInternetConnectivity, allowsInternetProbeRequest } from "../../../src/modules/host/internet-connectivity.ts"

/** Fixed endpoint, read-only, on-demand; no network discovery or background scan. */
export function internetConnectivityApi(probe: () => ReturnType<typeof probeInternetConnectivity> = probeInternetConnectivity, now = Date.now): Plugin {
  let cached: Awaited<ReturnType<typeof probeInternetConnectivity>> | null = null
  let cachedAt = 0
  let pending: Promise<Awaited<ReturnType<typeof probeInternetConnectivity>>> | null = null
  function read() {
    if (cached && now() - cachedAt < 12000) return Promise.resolve(cached)
    if (pending) return pending
    pending = probe().then(value => {
      cached = value
      cachedAt = now()
      return value
    }).finally(() => { pending = null })
    return pending
  }
  return {
    name: "pockethost-internet-connectivity",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/internet-connectivity", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        if (!allowsInternetProbeRequest({
          host: request.headers.host ?? "", origin: request.headers.origin ?? "",
          remote: request.socket.remoteAddress ?? "",
          fetchSite: request.headers["sec-fetch-site"] ?? "",
          method: request.method ?? "", route: request.url ?? "",
        })) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        try {
          response.end(JSON.stringify(await read()))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "probe-unavailable" }))
        }
      })
    },
  }
}
