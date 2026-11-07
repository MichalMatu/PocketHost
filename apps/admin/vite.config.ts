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
import { SiteFleetHost } from "../../src/modules/host/site-fleet-host.ts"
import { decodeSiteFolder, decodeSiteZip, MAX_UPLOAD_BYTES } from "../../src/modules/sites/site-bundle.ts"
import type { IncomingMessage } from "node:http"

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
  const allowedActions = new Set(["create", "start", "stop", "restart", "publish/v1", "publish/v2", "rollback"])

  return {
    name: "pockethost-owned-single-site-dev",
    apply: "serve",
    configureServer(server) {
      const enabled = process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1"
      // No filesystem inspection or process management when the flag is off.
      const adapter = enabled ? new OwnedDemoHost() : null
      const runtime = adapter ? createOwnedSiteRuntime(adapter) : null
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
        if (request.method === "GET" && route === "/project") {
          if (!adapter) {
            response.statusCode = 404
            response.end(JSON.stringify({ error: "project-management-disabled" }))
            return
          }
          try {
            response.statusCode = 200
            response.end(JSON.stringify({ project: adapter.inspectProject() }))
          } catch {
            response.statusCode = 409
            response.end(JSON.stringify({ error: "owned-project-unavailable" }))
          }
          return
        }
        if (request.method === "GET" && route === "/health") {
          if (!adapter) {
            response.statusCode = 404
            response.end(JSON.stringify({ error: "project-management-disabled" }))
            return
          }
          try {
            response.statusCode = 200
            response.end(JSON.stringify({ healthy: await adapter.health() }))
          } catch {
            response.statusCode = 409
            response.end(JSON.stringify({ error: "owned-project-unavailable" }))
          }
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
            action === "restart" ? runtime.restart() :
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
 * H2: explicit user-created STATIC sites only. All writes require an
 * interactive same-origin intent; no process IDs, paths, commands or
 * external services are accepted as management targets.
 */
function ownedSiteFleetApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  async function body(request: IncomingMessage, maximum: number): Promise<Buffer> {
    const claimed = request.headers["content-length"]
    if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > maximum)) {
      throw new RangeError("Upload too large")
    }
    if (request.headers["content-encoding"]) throw new RangeError("Compressed transport denied")
    request.setTimeout(20000, () => request.destroy())
    let length = 0
    const chunks: Buffer[] = []
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      length += bytes.length
      if (length > maximum) throw new RangeError("Upload too large")
      chunks.push(bytes)
    }
    return Buffer.concat(chunks)
  }
  return {
    name: "pockethost-owned-static-fleet-dev",
    apply: "serve",
    configureServer(server) {
      const enabled = process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1" &&
        process.env.POCKETHOST_ENABLE_USER_SITES_DEV === "1"
      const fleet = enabled ? new SiteFleetHost() : null
      let writes: Promise<void> = Promise.resolve()
      function serialize<T>(fn: () => Promise<T>): Promise<T> {
        const result = writes.then(fn, fn)
        writes = result.then(() => undefined, () => undefined)
        return result
      }
      server.middlewares.use("/api/v1/sites", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const origin = request.headers.origin
        const remote = request.socket.remoteAddress
        if (
          !hosts.has(request.headers.host ?? "") ||
          (origin && !origins.has(origin)) ||
          request.headers["sec-fetch-site"] === "cross-site" ||
          (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")
        ) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        if (!fleet) {
          response.statusCode = 404
          response.end(JSON.stringify({ error: "static-fleet-disabled" }))
          return
        }
        const route = request.url?.split("?")[0] ?? ""
        const match = /^\/(site-[a-f0-9]{32})(?:\/(logs|health|start|stop|restart|rollback|deploy|releases))?$/.exec(route)
        const releaseRoute = /^\/(site-[a-f0-9]{32})\/releases\/(r-[a-f0-9]{32})\/(restore|prune)$/.exec(route)
        const id = match?.[1]
        const action = match?.[2]
        if (request.method === "GET") {
          try {
            const result = route === "/" ? { sites: fleet.list() } :
              id && !action ? { site: fleet.inspect(id) } :
              id && action === "health" ? { healthy: await fleet.health(id) } :
              id && action === "logs" ? { logs: fleet.logs(id) } :
              id && action === "releases" ? { releases: fleet.listReleases(id) } : null
            if (!result) {
              response.statusCode = 404
              response.end("{}")
            } else response.end(JSON.stringify(result))
          } catch {
            response.statusCode = 409
            response.end(JSON.stringify({ error: "site-state-unavailable" }))
          }
          return
        }
        const create = request.method === "POST" && route === "/"
        const command = request.method === "POST" && !!id &&
          ["start", "stop", "restart", "rollback"].includes(action ?? "")
        const upload = request.method === "PUT" && !!id && action === "deploy"
        const versionCommand = !!releaseRoute && (
          (request.method === "POST" && releaseRoute[3] === "restore") ||
          (request.method === "DELETE" && releaseRoute[3] === "prune")
        )
        if (!create && !command && !upload && !versionCommand) {
          response.statusCode = 404
          response.end("{}")
          return
        }
        if (!origin || !origins.has(origin) ||
            request.headers["x-pockethost-intent"] !== "owned-sites") {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "mutation-not-authorized" }))
          return
        }
        if ((command || versionCommand) && (request.headers["transfer-encoding"] !== undefined ||
            ![undefined, "0"].includes(request.headers["content-length"]))) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "body-not-allowed" }))
          return
        }
        try {
          const result = await serialize(async () => {
            if (create) {
              const data = await body(request, 1024)
              const parsed: unknown = JSON.parse(data.toString("utf8"))
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
                  Object.keys(parsed).length !== 1 ||
                  typeof (parsed as { name?: unknown }).name !== "string")
                throw new RangeError("Invalid site name")
              return fleet.create((parsed as { name: string }).name)
            }
            if (upload) {
              const contentType = request.headers["content-type"]?.split(";")[0]?.trim()
              let files
              if (contentType === "application/zip") {
                files = decodeSiteZip(await body(request, MAX_UPLOAD_BYTES))
              } else if (contentType === "application/json") {
                const data = await body(request, 12 * 1024 * 1024)
                files = decodeSiteFolder(JSON.parse(data.toString("utf8")) as unknown)
              } else throw new RangeError("Only static ZIP or folder upload is accepted")
              return fleet.deploy(id!, files)
            }
            if (versionCommand && releaseRoute) {
              const selectedSite = releaseRoute[1]
              const revision = releaseRoute[2]
              return releaseRoute[3] === "restore"
                ? fleet.restoreRelease(selectedSite, revision)
                : fleet.pruneRelease(selectedSite, revision)
            }
            if (action === "start") return fleet.start(id!)
            if (action === "stop") return fleet.stop(id!)
            if (action === "restart") return fleet.restart(id!)
            return fleet.rollback(id!)
          })
          response.statusCode = create ? 201 : 200
          response.end(JSON.stringify({ site: result }))
        } catch (error) {
          response.statusCode = error instanceof RangeError || error instanceof SyntaxError ? 400 : 409
          response.end(JSON.stringify({
            error: response.statusCode === 400 ? "invalid-static-site-input" : "owned-site-operation-rejected",
          }))
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
  plugins: [react(), tailwindcss(), termuxReadOnlyApi(), ownedDemoApi(), ownedSiteFleetApi(), managedPhotoMapApi(), observabilityApi(), networkAccessApi()],
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