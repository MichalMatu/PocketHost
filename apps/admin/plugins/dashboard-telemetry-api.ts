import type { Plugin } from "vite"
import { allowsInternetProbeRequest } from "../../../src/modules/host/internet-connectivity.ts"
import { DashboardTelemetryRecorder, parseDashboardHistoryRoute, attachDashboardOwnedEvents } from "../../../src/modules/host/dashboard-telemetry-history.ts"

/** Owner-approved 60s read-only sampler in the existing DEV panel process. */
export function dashboardTelemetryApi(
  createRecorder: () => DashboardTelemetryRecorder = () => new DashboardTelemetryRecorder(),
  attachEvents: typeof attachDashboardOwnedEvents = attachDashboardOwnedEvents,
): Plugin {
  return {
    name: "pockethost-dashboard-history",
    apply: "serve",
    configureServer(server) {
      const recorder = createRecorder()
      attachEvents(recorder.store)
      recorder.start()
      server.httpServer?.once("close", () => {
        attachEvents(null)
        recorder.stop()
      })

      server.middlewares.use("/api/v1/dashboard/history", (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        if (!allowsInternetProbeRequest({
          host: request.headers.host, origin: request.headers.origin,
          remote: request.socket.remoteAddress,
          fetchSite: request.headers["sec-fetch-site"],
          method: request.method, route: "/",
        })) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        const range = parseDashboardHistoryRoute(request.url ?? "/")
        if (!range) {
          response.statusCode = 404
          response.end(JSON.stringify({ error: "invalid-history-range" }))
          return
        }
        response.statusCode = 200
        response.end(JSON.stringify(recorder.store.history(range)))
      })
    },
  }
}
