import { readHostMetrics, readProcessInventory, readPackageInventory } from "../../src/modules/host/observability-probes.ts"
import { ObservabilityHistory } from "../../src/modules/observability/overview.ts"
import { runtimeEventHistory } from "../../src/shared/runtime-diagnostics.ts"
import { ManagedPhotoMapRuntimeHost } from "../../src/modules/host/photomap-runtime-host.ts"
import { createLanControl } from "../../src/modules/host/lan-control.mjs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { readHostSnapshot } from "../../src/modules/host/host-snapshot.ts"
import { OwnedDemoHost } from "../../src/modules/host/owned-site-host.ts"
import { ManagedPhotoMapHost } from "../../src/modules/host/managed-photomap-host.ts"
import { createOwnedSiteRuntime } from "../../src/modules/runtime/owned-site-runtime.ts"

/** DEV-only, loopback-only read-only API. There are no mutation endpoints. */
function termuxReadOnlyApi(): Plugin {
  const allowedHosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const allowedOrigins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-read-only-host",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/host/snapshot", (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        const host = request.headers.host || ""
        const origin = request.headers.origin
        const fetchSite = request.headers["sec-fetch-site"]
        const remote = request.socket.remoteAddress
        if (
          !allowedHosts.has(host) ||
          (origin && !allowedOrigins.has(origin)) ||
          fetchSite === "cross-site" ||
          (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")
        ) {
          response.statusCode = 403
          response.end()
          return
        }
        if (request.url?.split("?")[0] !== "/") {
          response.statusCode = 404
          response.end()
          return
        }
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET")
          response.statusCode = 405
          response.end()
          return
        }
        try {
          response.setHeader("Content-Type", "application/json; charset=utf-8")
          response.statusCode = 200
          response.end(JSON.stringify(readHostSnapshot()))
        } catch {
          response.statusCode = 503
          response.end()
        }
      })
    },
  }
}

/**
 * Opt-in, DEV-only own-site actions. This is not a production HTTP control API.
 * Never infer process ownership from process discovery.
 */
function ownedDemoApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  const allowedActions = new Set(["create", "start", "stop", "publish/v1", "publish/v2", "rollback"])

  return {
    name: "pockethost-owned-single-site-dev",
    apply: "serve",
    configureServer(server) {
      const enabled = process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1"
      // No filesystem inspection or process management when the flag is off.
      const runtime = enabled ? createOwnedSiteRuntime(new OwnedDemoHost()) : null
      let mutationQueue: Promise<void> = Promise.resolve()
      const serializeMutation = <T,>(action: () => Promise<T> | T): Promise<T> => {
        const result = mutationQueue.then(action, action)
        mutationQueue = result.then(() => undefined, () => undefined)
        return result
      }
      server.middlewares.use("/api/v1/owned-site", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const host = request.headers.host ?? ""
        const origin = request.headers.origin
        const remote = request.socket.remoteAddress
        if (
          !hosts.has(host) ||
          (origin && !origins.has(origin)) ||
          request.headers["sec-fetch-site"] === "cross-site" ||
          (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")
        ) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        const route = request.url?.split("?")[0] ?? ""
        if (request.method === "GET" && route === "/") {
          response.statusCode = 200
          response.end(JSON.stringify({
            enabled,
            site: enabled ? runtime!.inspect() : null,
          }))
          return
        }
        if (request.method === "GET" && route === "/logs") {
          if (!runtime) {
            response.statusCode = 404
            response.end("{}")
            return
          }
          try {
            response.statusCode = 200
            response.end(JSON.stringify({ logs: runtime.logs() }))
          } catch {
            response.statusCode = 409
            response.end(JSON.stringify({ error: "owned-site-unavailable" }))
          }
          return
        }
        const action = route.startsWith("/") ? route.slice(1) : ""
        if (!allowedActions.has(action)) {
          response.statusCode = 404
          response.end("{}")
          return
        }
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST")
          response.statusCode = 405
          response.end("{}")
          return
        }
        // Require a same-origin browser request and deliberate non-simple header.
        // No body, input path, PID, port, shell command or generic service ID.
        if (
          !runtime ||
          !origin ||
          !origins.has(origin) ||
          request.headers["x-pockethost-intent"] !== "owned-demo" ||
          request.headers["transfer-encoding"] !== undefined ||
          ![undefined, "0"].includes(request.headers["content-length"])
        ) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "action-not-authorized" }))
          return
        }
        try {
          const site = await serializeMutation(() =>
            action === "create" ? runtime.create() :
            action === "start" ? runtime.start() :
            action === "stop" ? runtime.stop() :
            action === "publish/v1" ? runtime.publish(1) :
            action === "publish/v2" ? runtime.publish(2) :
            runtime.rollback()
          )
          response.statusCode = 200
          response.end(JSON.stringify({ site }))
        } catch {
          response.statusCode = 409
          response.end(JSON.stringify({ error: "operation-rejected-safely" }))
        }
      })
    },
  }
}

/**
 * P4: a strictly read-only catalog for one verified imported project.
 * This does not enable PhotoMap launch, package mutations or rollback.
 */
function managedPhotoMapApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-photomap-catalog",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/managed-photomap", (request, response) => {
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
        if (request.url !== "/") {
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
          const project = new ManagedPhotoMapHost().inspect()
          response.statusCode = 200
          response.end(JSON.stringify({ project }))
        } catch {
          response.statusCode = 409
          response.end(JSON.stringify({ error: "managed-project-unavailable" }))
        }
      })
    },
  }
}

/** O1: on-demand, loopback-only read-only observations; no background sampler. */
function observabilityApi(): Plugin {
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
        if (request.url !== "/") {
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
            Promise.resolve(readHostSnapshot()),
            readHostMetrics(),
          ])
          const processes = readProcessInventory()
          const packages = readPackageInventory()
          // Only the existing fixed, disabled PhotoMap TEST adapter reads its own
          // bounded structured log. No PhotoMap start, stop or process probe.
          let events: ReturnType<typeof runtimeEventHistory> = []
          let diagnosticsState: "ok" | "unavailable" = "unavailable"
          try {
            events = runtimeEventHistory(new ManagedPhotoMapRuntimeHost().readLogs())
            diagnosticsState = "ok"
          } catch {
            // Honest absent/permission/unsafe log state; never leak raw messages.
          }
          const observedAt = new Date().toISOString()
          const payload = history.append({
            version: 1,
            mode: "read-only",
            observedAt,
            host,
            metrics,
            processes,
            packages,
            diagnostics: { state: diagnosticsState, events },
          })
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


/** Opt-in manual LAN listener control. Never signals a preexisting gateway. */
function networkAccessApi(): Plugin {
  const controller = createLanControl()
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-manual-lan-control",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => {
        void controller.disable()
      })
      server.middlewares.use("/api/v1/network-access", async (request, response) => {
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
        const route = request.url?.split("?")[0] ?? ""
        if (route === "/" && request.method === "GET") {
          response.end(JSON.stringify(controller.status()))
          return
        }
        if (request.method !== "POST" || !["/enable", "/disable"].includes(route)) {
          response.statusCode = route === "/" ? 405 : 404
          response.end(JSON.stringify({ error: "not-found" }))
          return
        }
        if (
          !request.headers.origin ||
          !origins.has(request.headers.origin) ||
          request.headers["x-pockethost-intent"] !== "lan-control" ||
          request.headers["transfer-encoding"] !== undefined ||
          ![undefined, "0"].includes(request.headers["content-length"])
        ) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "action-not-authorized" }))
          return
        }
        try {
          if (route === "/enable") {
            const bind = request.headers["x-pockethost-lan-bind"]
            if (typeof bind !== "string") {
              response.statusCode = 400
              response.end(JSON.stringify({ error: "invalid-lan-interface" }))
              return
            }
            const state = await controller.enable(bind)
            response.end(JSON.stringify(state))
          } else {
            // Finish the proxied response before closing the gateway that carried it.
            const state = controller.status()
            response.once("finish", () => {
              void controller.disable().catch(() => undefined)
            })
            response.end(JSON.stringify({
              ...state, enabled: false, bind: null, adminUrl: null, siteUrl: null,
            }))
          }
        } catch {
          // Includes EADDRINUSE: never claim or stop a legacy gateway.
          response.statusCode = 409
          response.end(JSON.stringify({ error: "gateway-unavailable-or-not-owned" }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), termuxReadOnlyApi(), ownedDemoApi(), managedPhotoMapApi(), observabilityApi(), networkAccessApi()],
  server: { host: "127.0.0.1", port: 8787, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})