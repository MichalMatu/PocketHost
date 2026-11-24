import type { Plugin } from "vite"
import { readHostMetrics, readProcessInventory, readPackageInventory } from "../../../src/modules/host/observability-probes.ts"
import { ObservabilityHistory, parseObservabilityScope } from "../../../src/modules/observability/overview.ts"
import { readHostSnapshot } from "../../../src/modules/host/host-snapshot.ts"

/** O1: on-demand, loopback-only read-only observations; no background sampler. */
export function observabilityApi(probes = { readHostSnapshot, readHostMetrics, readProcessInventory, readPackageInventory }): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  const history = new ObservabilityHistory()
  return {
    name: "pockethost-observability-o1",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/observability", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const remote = request.socket.remoteAddress
        if (
          !hosts.has(request.headers.host ?? "") ||
          (request.headers.origin && !origins.has(request.headers.origin)) ||
          request.headers["sec-fetch-site"] === "cross-site" ||
          (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")
        ) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        const scope = parseObservabilityScope(request.url)
        if (scope === null) {
          response.statusCode = 404
          response.end("{}")
          return
        }
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET")
          response.statusCode = 405
          response.end("{}")
          return
        }
        try {
          const [host, metrics] = await Promise.all([
            Promise.resolve(probes.readHostSnapshot()),
            probes.readHostMetrics(),
          ])
          const processes = probes.readProcessInventory()
          const observedAt = new Date().toISOString()
          // Monitoring has no package list. Avoid five synchronous local CLI probes
          // on this route; full inventory remains available to Packages and Services.
          const packages = scope === "monitoring"
            ? { state: "unavailable" as const, observedAt, installed: [], truncated: false,
              updates: { state: "unknown" as const, candidates: [] } }
            : probes.readPackageInventory()
          // M0: global O1 is product-neutral; P4 events remain accessible
          // only through an explicit, scoped GET-only endpoint.
          const diagnostics = { state: "unavailable" as const, events: [] }
          const payload = history.append({
            version: 1,
            mode: "read-only",
            observedAt,
            host,
            metrics,
            processes,
            packages,
            diagnostics,
          }, { includePackageAlerts: scope === "full" })
          response.statusCode = 200
          response.end(JSON.stringify(payload))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "observation-unavailable" }))
        }
      })
    },
  }
}
