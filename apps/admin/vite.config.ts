import { readHostMetrics, readProcessInventory, readPackageInventory } from "../../src/modules/host/observability-probes.ts"
import { readTermuxToolInventory } from "../../src/modules/host/termux-tool-inventory.ts"
import { applyPackageAction, previewPackageAction, WorkspaceFiles, WorkspaceBackups } from "../../src/modules/host/termux-admin.ts"
import { TermuxServiceAdmin } from "../../src/modules/host/termux-service-admin.ts"
import { listInstalledTermuxPackages, searchAvailableTermuxPackages } from "../../src/modules/host/termux-package-catalog.ts"
import { ResticWorkspaceAdmin } from "../../src/modules/host/termux-restic-admin.ts"
import { TermuxFileRoots, type FileRoot } from "../../src/modules/host/termux-file-roots.ts"
import { TermuxTerminal } from "../../src/modules/host/termux-terminal.ts"
import { admitsAgentCommand, OWNER_AGENT_CAPABILITIES } from "../../src/modules/host/termux-agent-contract.ts"
import { ObservabilityHistory } from "../../src/modules/observability/overview.ts"
import { ManagedPhotoMapRuntimeHost } from "../../src/modules/host/photomap-runtime-host.ts"
import { readLegacyPhotoMapEvents } from "../../src/modules/host/photomap-legacy-events.ts"
import { createLanControl, createLanRecovery, availableLanInterfaces } from "../../src/modules/host/lan-control.mjs"
import { readCompanionStatus, readCompanionApps, readCompanionApp, readCompanionSystem } from "../../src/modules/host/shizuku-companion.mjs"
import { validateRemoteShellPayload } from "../../src/modules/host/remote-shell-contract.mjs"
import { validateAndroidActionPayload } from "../../src/modules/host/android-action-contract.mjs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { readHostSnapshot } from "../../src/modules/host/host-snapshot.ts"
import { OwnedDemoHost } from "../../src/modules/host/owned-site-host.ts"
import { ManagedPhotoMapHost } from "../../src/modules/host/managed-photomap-host.ts"
import { createOwnedSiteRuntime } from "../../src/modules/runtime/owned-site-runtime.ts"
import { SiteFleetHost } from "../../src/modules/host/site-fleet-host.ts"
import { NodeProjectHost } from "../../src/modules/host/node-project-host.ts"
import { NodeRunitHost } from "../../src/modules/host/node-runit-host.ts"
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
        const match = /^\/(site-[a-f0-9]{32})(?:\/(logs|health|files|start|stop|restart|rollback|deploy|releases))?$/.exec(route)
        const releaseRoute = /^\/(site-[a-f0-9]{32})\/releases\/(r-[a-f0-9]{32})\/(restore|prune)$/.exec(route)
        const id = match?.[1]
        const action = match?.[2]
        if (request.method === "GET") {
          try {
            const result = route === "/" ? { sites: fleet.list() } :
              id && !action ? { site: fleet.inspect(id) } :
              id && action === "health" ? { healthy: await fleet.health(id) } :
              id && action === "logs" ? { logs: fleet.logs(id) } :
              id && action === "files" ? { files: fleet.listActiveFiles(id) } :
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

/** M3 source-only Node project wizard API: no process manager or implicit execution. */
function nodeProjectApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  async function readJson(request: IncomingMessage, limit: number): Promise<unknown> {
    if (request.headers["content-encoding"]) throw new RangeError("Compressed payload refused")
    const claimed = request.headers["content-length"]
    if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > limit)) throw new RangeError("Payload too large")
    request.setTimeout(20000, () => request.destroy())
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += bytes.length
      if (total > limit) throw new RangeError("Payload too large")
      chunks.push(bytes)
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  }
  return {
    name: "pockethost-owned-node-projects-dev",
    apply: "serve",
    configureServer(server) {
      // A separate opt-in is required even when static H2 is enabled.
      const enabled = process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1" &&
        process.env.POCKETHOST_ENABLE_NODE_HOSTING_DEV === "1"
      const host = enabled ? new NodeProjectHost() : null
      const runtime = enabled ? new NodeRunitHost() : null
      const executionEnabled = process.env.POCKETHOST_ENABLE_NODE_RUNTIME_DEV === "1"
      let pending: Promise<void> = Promise.resolve()
      function serial<T>(fn: () => T): Promise<T> {
        const action = pending.then(fn, fn)
        pending = action.then(() => undefined, () => undefined)
        return action
      }
      server.middlewares.use("/api/v1/node-projects", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const origin = request.headers.origin
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (origin && !origins.has(origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end('{"error":"forbidden"}')
          return
        }
        if (!host) {
          response.statusCode = 404
          response.end('{"error":"node-projects-disabled"}')
          return
        }
        const route = request.url?.split("?")[0] ?? ""
        const match = /^\/(node-[a-f0-9]{32})(?:\/(releases|stage|restore-candidate|runtime|plan|logs|deploy|stop))?$/.exec(route)
        const id = match?.[1]
        const op = match?.[2]
        if (request.method === "GET") {
          try {
            const data = route === "/" ? { projects: host.list() } :
              id && !op ? { project: host.inspect(id) } :
              id && op === "releases" ? { releases: host.candidates(id) } :
              id && op === "runtime" ? { runtime: runtime!.status(id), executionEnabled } :
              id && op === "plan" ? { plan: runtime!.preview(id), executionEnabled } :
              id && op === "logs" ? { logs: runtime!.logs(id) } : null
            if (!data) response.statusCode = 404
            else response.statusCode = 200
            response.end(JSON.stringify(data ?? { error: "not-found" }))
          } catch {
            response.statusCode = 409
            response.end('{"error":"node-project-state-unavailable"}')
          }
          return
        }
        const create = request.method === "POST" && route === "/"
        const stage = request.method === "POST" && !!id && op === "stage"
        const restore = request.method === "POST" && !!id && op === "restore-candidate"
        const deploy = request.method === "POST" && !!id && op === "deploy"
        const stop = request.method === "POST" && !!id && op === "stop"
        if (!create && !stage && !restore && !deploy && !stop) {
          response.statusCode = 404
          response.end('{"error":"not-found"}')
          return
        }
        if (!origin || !origins.has(origin) ||
            request.headers["x-pockethost-intent"] !== "owned-node-project") {
          response.statusCode = 403
          response.end('{"error":"mutation-not-authorized"}')
          return
        }
        try {
          const result = await serial(async () => {
            if (deploy || stop) {
              if (!executionEnabled) throw new Error("Node runtime activation disabled")
              const requestBody = await readJson(request, 1024)
              if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody))
                throw new RangeError("Invalid runtime approval")
              const body = requestBody as Record<string, unknown>
              if (deploy) {
                if (Object.keys(body).sort().join(",") !== "approved,release" ||
                    body.approved !== true || typeof body.release !== "string")
                  throw new RangeError("Missing explicit release approval")
                return { runtime: await runtime!.deploy(id!, body.release, true) }
              }
              if (Object.keys(body).join(",") !== "approved" || body.approved !== true)
                throw new RangeError("Missing explicit stop approval")
              return { runtime: await runtime!.stop(id!, true) }
            }
            if (restore) {
              if (request.headers["transfer-encoding"] !== undefined ||
                  ![undefined, "0"].includes(request.headers["content-length"])) {
                throw new RangeError("Body not permitted on candidate restore")
              }
              return { project: host.restoreCandidate(id!) }
            }
            const input = await readJson(request, stage ? 340 * 1024 : 1024)
            if (create) {
              if (!input || typeof input !== "object" || Array.isArray(input) ||
                  Object.keys(input).join(",") !== "name") throw new RangeError("Invalid project")
              return { project: host.create((input as { name: unknown }).name) }
            }
            return host.stage(id!, input)
          })
          response.statusCode = create ? 201 : 200
          response.end(JSON.stringify(result))
        } catch (error) {
          response.statusCode = error instanceof RangeError || error instanceof SyntaxError ? 400 : 409
          response.end(JSON.stringify({ error: response.statusCode === 400 ?
            "invalid-node-project-input" : "node-project-operation-refused" }))
        }
      })
    },
  }
}

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
        if (request.url !== "/" && request.url !== "/events") {
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
          if (request.url === "/events") {
            const diagnostics = readLegacyPhotoMapEvents(() => new ManagedPhotoMapRuntimeHost().readLogs())
            response.statusCode = 200
            response.end(JSON.stringify(diagnostics))
            return
          }
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
          // M0: global O1 is product-neutral; P4 events remain accessible
          // only through the explicit GET-only legacy PhotoMap endpoint.
          const diagnostics = { state: "unavailable" as const, events: [] }
          const observedAt = new Date().toISOString()
          const payload = history.append({
            version: 1,
            mode: "read-only",
            observedAt,
            host,
            metrics,
            processes,
            packages,
            diagnostics,
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
/** Native Android Companion status, forwarded from an on-device read-only provider. */
function shizukuCompanionApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-native-shizuku-companion",
    apply: "serve",
    configureServer(server) {


      server.middlewares.use("/api/v1/shizuku/system", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (request.headers.origin && !origins.has(request.headers.origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        if (request.method !== "GET" || request.url?.split("?")[0] !== "/") {
          response.statusCode = request.method === "GET" ? 404 : 405
          response.end(JSON.stringify({ error: "not-found" }))
          return
        }
        try {
          response.end(JSON.stringify(await readCompanionSystem()))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "android-system-unavailable" }))
        }
      })

      server.middlewares.use("/api/v1/shizuku/app", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (request.headers.origin && !origins.has(request.headers.origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        const url = new URL(request.url ?? "/", "http://127.0.0.1")
        const packages = url.searchParams.getAll("package")
        if (request.method !== "GET" || url.pathname !== "/" ||
            packages.length !== 1 || [...url.searchParams.keys()].length !== 1 ||
            !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(packages[0] ?? "") ||
            (packages[0]?.length ?? 0) > 200) {
          response.statusCode = request.method === "GET" ? 400 : 405
          response.end(JSON.stringify({ error: "invalid-request" }))
          return
        }
        try {
          response.end(JSON.stringify(await readCompanionApp(packages[0]!)))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "android-app-details-unavailable" }))
        }
      })
      server.middlewares.use("/api/v1/shizuku/apps", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (request.headers.origin && !origins.has(request.headers.origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        if (request.method !== "GET" || request.url?.split("?")[0] !== "/") {
          response.statusCode = request.method === "GET" ? 404 : 405
          response.end(JSON.stringify({ error: "not-found" }))
          return
        }
        try {
          response.end(JSON.stringify(await readCompanionApps()))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "android-apps-unavailable" }))
        }
      })
      server.middlewares.use("/api/v1/shizuku/status", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (request.headers.origin && !origins.has(request.headers.origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        if (request.method !== "GET" || request.url?.split("?")[0] !== "/") {
          response.statusCode = request.method === "GET" ? 404 : 405
          response.end(JSON.stringify({ error: "not-found" }))
          return
        }
        try {
          const snapshot = await readCompanionStatus()
          response.statusCode = 200
          response.end(JSON.stringify(snapshot))
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "companion-not-connected" }))
        }
      })
    },
  }
}

/**
 * LAN accepts only a paired request/progress check, never direct execution.
 * An exact command is executed only after a separate owner confirmation
 * inside the Android Companion activity. No credentials are persisted here.
 */
function remoteShellApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-direct-android-shell",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/shizuku/remote-shell", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Referrer-Policy", "no-referrer")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const route = request.url?.split("?")[0] ?? ""
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "remote-shell-not-authorized" }))
          return
        }
        if (request.method !== "POST" || route !== "/run") {
          response.statusCode = 405
          response.setHeader("Allow", "POST")
          response.end(JSON.stringify({ error: "remote-shell-route-rejected" }))
          return
        }
        if (request.headers["content-type"] !== "application/json" ||
            request.headers["content-encoding"] !== undefined ||
            request.headers["transfer-encoding"] !== undefined ||
            (request.headers["content-length"] !== undefined &&
              (!/^\d+$/.test(request.headers["content-length"]) ||
                Number(request.headers["content-length"]) > 2048))) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: "invalid-remote-shell-body" }))
          return
        }
        try {
          const chunks: Buffer[] = []
          let bytes = 0
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            bytes += buffer.length
            if (bytes > 2048) throw new RangeError("Body too large")
            chunks.push(buffer)
          }
          const envelope = validateRemoteShellPayload(
            "run",
            JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
          )
          const native = await fetch("http://127.0.0.1:18791/shell/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(envelope),
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(16000),
          })
          const raw = await native.text()
          if (raw.length > 8192) throw new RangeError("Native response too large")
          response.statusCode = native.status
          response.end(raw)
        } catch (error) {
          response.statusCode = error instanceof SyntaxError || error instanceof RangeError ||
            (error instanceof Error && (error.message === "invalid-shell-command" ||
              error.message === "invalid-remote-shell-request")) ? 400 : 503
          response.end(JSON.stringify({
            error: response.statusCode === 400 ? "invalid-shell-command" : "native-shizuku-shell-unavailable",
          }))
        }
      })
    },
  }
}


/** Owner-triggered Android actions over the existing exact private-LAN shell boundary. */
function androidActionApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-direct-android-actions",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/shizuku/action", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Referrer-Policy", "no-referrer")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "android-action-not-authorized" }))
          return
        }
        if (request.method !== "POST" || request.url?.split("?")[0] !== "/run") {
          response.statusCode = 405
          response.setHeader("Allow", "POST")
          response.end(JSON.stringify({ error: "android-action-route-rejected" }))
          return
        }
        if (request.headers["content-type"] !== "application/json" ||
            request.headers["content-encoding"] !== undefined ||
            request.headers["transfer-encoding"] !== undefined ||
            (request.headers["content-length"] !== undefined &&
              (!/^\d+$/.test(request.headers["content-length"]) ||
                Number(request.headers["content-length"]) > 2048))) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: "invalid-android-action-body" }))
          return
        }
        let envelope: ReturnType<typeof validateAndroidActionPayload>
        try {
          const chunks: Buffer[] = []
          let bytes = 0
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            bytes += buffer.length
            if (bytes > 2048) throw new RangeError("Body too large")
            chunks.push(buffer)
          }
          envelope = validateAndroidActionPayload(
            JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
          )
        } catch {
          response.statusCode = 400
          response.end(JSON.stringify({ error: "invalid-android-action" }))
          return
        }
        try {
          const native = await fetch("http://127.0.0.1:18791/action/run", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(envelope), redirect: "error", cache: "no-store",
            signal: AbortSignal.timeout(16000),
          })
          const raw = await native.text()
          if (raw.length > 8192) throw new Error("native-action-response-too-large")
          response.statusCode = native.status
          response.end(raw)
        } catch {
          response.statusCode = 503
          response.end(JSON.stringify({ error: "native-android-action-unavailable" }))
        }
      })
    },
  }
}

function networkAccessApi(): Plugin {
  const autoStart = process.env.POCKETHOST_LAN_AUTOSTART !== "0"
  const controller = createLanControl({ mode: autoStart ? "auto" : "manual" })
  let ownerDisabled = false
  let closed = false
  let autoRetry: ReturnType<typeof setInterval> | undefined
  let starting = false

  let startFailures = 0
  let nextStartAttempt = 0

  // A TCP handshake alone does not prove that the original PocketHost
  // listeners still serve HTTP. Require the exact owned gateway response.
  async function probeGateway(bind: string, port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://${bind}:${port}/.well-known/pockethost-lan-health`, {
        signal: AbortSignal.timeout(1800),
        cache: "no-store",
      })
      return response.status === 204 && response.headers.get("x-pockethost-lan-gateway") === "owned"
    } catch {
      return false
    }
  }

  const recoverOwnLan = createLanRecovery({
    controller,
    interfaces: () => availableLanInterfaces(),
    canRecover: () => !ownerDisabled && !closed && !starting,
    check: async (bind) => {
      const checks = await Promise.all([probeGateway(bind, 18878), probeGateway(bind, 18879)])
      return checks.every(Boolean)
    },
    failureThreshold: 2,
    cooldownMs: 30000,
    maxCooldownMs: 300000,
  })

  function ensurePrivateLan() {
    if (
      !autoStart || ownerDisabled || closed || starting || controller.status().enabled ||
      Date.now() < nextStartAttempt
    ) return
    const options = availableLanInterfaces()
    const preferred = process.env.POCKETHOST_LAN_BIND
    // Without an explicit owner bind, never expose the login-free panel on
    // an arbitrary RFC1918 VPN or cellular interface.
    const selected = options.find((item) => item.address === preferred)
      ?? options.find((item) => item.name.startsWith("wlan"))
    if (!selected) return
    starting = true
    void controller.enable(selected.address)
      .then(() => {
        startFailures = 0
        nextStartAttempt = 0
      })
      .catch(() => {
        startFailures += 1
        nextStartAttempt = Date.now() + Math.min(300000, 8000 * 2 ** Math.min(startFailures - 1, 6))
      })
      .finally(() => { starting = false })
  }
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-manual-lan-control",
    apply: "serve",
    configureServer(server) {
      // Restore on boot and after Wi-Fi comes up; do not seize an
      // existing listener. A manual disable wins until the next session.
      if (autoStart) {
        server.httpServer?.once("listening", () => {
          ensurePrivateLan()
          autoRetry = setInterval(() => {
            if (ownerDisabled || closed || starting) return
            if (!controller.status().enabled) {
              ensurePrivateLan()
            } else {
              void recoverOwnLan().catch(() => undefined)
            }
          }, 8000)
          autoRetry.unref?.()
        })
      }
      server.httpServer?.once("close", () => {
        closed = true
        if (autoRetry) clearInterval(autoRetry)
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
          response.end(JSON.stringify({
            ...controller.status(),
            health: {
              ...recoverOwnLan.health(),
              startupFailures: startFailures,
              nextStartAttemptAt: nextStartAttempt ? new Date(nextStartAttempt).toISOString() : null,
            },
          }))
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
            ownerDisabled = false
            response.end(JSON.stringify(state))
          } else {
            // Finish the proxied response before closing the gateway that carried it.
            const state = controller.status()
            ownerDisabled = true
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

/** H3: bounded read-only tool availability; never executes or installs tools. */
function termuxToolsApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  return {
    name: "pockethost-h3-read-only-tool-inventory",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/termux-tools", (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        if (!hosts.has(request.headers.host ?? "") ||
          (request.headers.origin && !origins.has(request.headers.origin)) ||
          request.headers["sec-fetch-site"] === "cross-site" ||
          !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        if (request.url?.split("?")[0] !== "/") {
          response.statusCode = 404
          response.end("{}")
          return
        }
        if (request.method !== "GET") {
          response.statusCode = 405
          response.setHeader("Allow", "GET")
          response.end("{}")
          return
        }
        response.end(JSON.stringify(readTermuxToolInventory()))
      })
    },
  }
}

/**
 * H3 explicit typed admin operations for the owner-approved trusted LAN.
 * No login dependency. Never accepts shell programs, executable paths,
 * system-service PIDs, or general filesystem paths. Same-origin intent and
 * confirmation are separate from authentication.
 */
function termuxAdminApi(): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  const files = new WorkspaceFiles()
  const backups = new WorkspaceBackups(files)
  const services = new TermuxServiceAdmin()
  const restic = new ResticWorkspaceAdmin(files)
  const fileRoots = new TermuxFileRoots()
  const terminal = new TermuxTerminal()
  let operations: Promise<void> = Promise.resolve()
  const serialize = <T,>(job: () => Promise<T> | T): Promise<T> => {
    const result = operations.then(job, job)
    operations = result.then(() => undefined, () => undefined)
    return result
  }
  async function parseBody(req: IncomingMessage): Promise<{
    action?: string; name?: string; root?: string; path?: string; destination?: string; content?: string; base64?: string;
  }> {
    const declared = req.headers["content-length"]
    if (req.headers["content-encoding"] || (declared && (!/^\d+$/.test(declared) || Number(declared) > 3000000)))
      throw new RangeError("Invalid request budget")
    req.setTimeout(18000, () => req.destroy())
    let bytes = 0
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += b.length
      if (bytes > 3000000) throw new RangeError("Request budget exceeded")
      chunks.push(b)
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("Bad action")
    const data = value as Record<string, unknown>
    if (Object.keys(data).some(key => !["action","name","root","path","destination","content","base64"].includes(key)))
      throw new RangeError("Extra input denied")
    for (const key of ["action","name","root","path","destination","content","base64"]) {
      if (data[key] !== undefined && typeof data[key] !== "string")
        throw new RangeError("Bad request field")
    }
    return data as { action?: string; name?: string; root?: string; path?: string; destination?: string; content?: string; base64?: string }
  }

  return {
    name: "pockethost-h3-typed-admin",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/termux-admin", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        if (!hosts.has(request.headers.host ?? "") ||
            (request.headers.origin && !origins.has(request.headers.origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "")) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: "forbidden" }))
          return
        }
        const route = request.url?.split("?")[0]
        if (route !== "/") {
          response.statusCode = 404
          response.end("{}")
          return
        }
        if (request.method === "GET") {
          try {
            const url = new URL(request.url ?? "/", "http://localhost")
            const mode = url.searchParams.get("mode")
            const result = mode === "files" ? { files: files.list(url.searchParams.get("path") ?? "") } :
              mode === "snapshots" ? { snapshots: backups.list() } :
              mode === "services" ? { services: services.list() } :
              mode === "file-roots" ? { roots: fileRoots.available() } :
              mode === "terminal-status" ? { terminal: terminal.status() } :
              mode === "agent-capabilities" ? OWNER_AGENT_CAPABILITIES :
              mode === "browse-root" ? fileRoots.list(
                (url.searchParams.get("root") ?? "") as FileRoot, url.searchParams.get("path") ?? "",
              ) :
              mode === "restic-status" ? { restic: restic.status() } :
              mode === "restic-snapshots" ? { snapshots: await restic.snapshots() } :
              mode === "system-snapshots" ? { snapshots: await restic.scopeSnapshots(
                (url.searchParams.get("scope") ?? "") as "home" | "prefix" | "all",
              ) } :
              mode === "packages" ? await listInstalledTermuxPackages() :
              mode === "search-packages" ? await searchAvailableTermuxPackages(url.searchParams.get("query") ?? "") : null
            if (!result) { response.statusCode = 400; response.end('{"error":"unknown-query"}'); return }
            response.end(JSON.stringify(result))
          } catch {
            response.statusCode = 409
            response.end('{"error":"unavailable"}')
          }
          return
        }
        const browserIntent = !!request.headers.origin && origins.has(request.headers.origin)
        const agentIntent = admitsAgentCommand({
          origin: request.headers.origin,
          intent: request.headers["x-pockethost-intent"] as string | undefined,
          agentIntent: request.headers["x-pockethost-agent-intent"] as string | undefined,
          fetchSite: request.headers["sec-fetch-site"] as string | undefined,
        })
        if (request.method !== "POST" ||
            !(browserIntent || agentIntent) ||
            request.headers["x-pockethost-intent"] !== "termux-admin" ||
            request.headers["content-type"]?.split(";")[0]?.trim() !== "application/json") {
          response.statusCode = 403
          response.end('{"error":"intent-required"}')
          return
        }
        try {
          const input = await parseBody(request)
          const result = await serialize(async () => {
            if (input.action === "package-preview") {
              if (!input.name || !["install","remove","upgrade","upgrade-all"].includes(input.name))
                throw new RangeError("Invalid package preview")
              return { operation: input.name, result: await previewPackageAction(
                input.name as "install" | "remove" | "upgrade" | "upgrade-all",
                input.path,
              ) }
            }
            if (input.action === "package") {
              if (!input.name || !["refresh", "install", "remove", "upgrade", "upgrade-all"].includes(input.name))
                throw new RangeError("Invalid package action")
              return { operation: input.name, result: await applyPackageAction(
                input.name as "refresh" | "install" | "remove" | "upgrade" | "upgrade-all",
                input.path,
              ) }
            }
            if (input.action === "terminal") {
              if (input.name === "start") return { terminal: await terminal.start() }
              if (input.name === "stop") return { terminal: terminal.stop() }
              throw new RangeError("Invalid terminal action")
            }
            if (input.action === "full-file") {
              const root = (input.root ?? "") as FileRoot
              const relative = input.path ?? ""
              if (input.name === "read") return fileRoots.readText(root, relative)
              if (input.name === "export") return fileRoots.export(root, relative)
              if (["mkdir","save","copy","copy-tree","move","delete","delete-tree","upload"].includes(input.name ?? "")) {
                return fileRoots.apply(root, input.name as "mkdir"|"save"|"copy"|"copy-tree"|"move"|"delete"|"delete-tree"|"upload",
                  relative, { destination: input.destination, content: input.content, base64: input.base64 })
              }
              throw new RangeError("Unknown filesystem operation")
            }
            if (input.action === "restic-system") {
              const scope = (input.root ?? "") as "home" | "prefix" | "all"
              if (!["home","prefix","all"].includes(scope)) throw new RangeError("Invalid backup scope")
              if (input.name === "backup") return { result: await restic.backupScope(scope) }
              if (input.name === "restore") return { result: await restic.restoreScopeToStaging(scope, input.path ?? "") }
              if (input.name === "forget") return { result: await restic.forgetScope(scope, input.path ?? "") }
              if (input.name === "check") return { result: await restic.check() }
              throw new RangeError("Invalid system Restic action")
            }
            if (input.action === "restic") {
              if (!input.name || !["init","backup","check","restore","forget"].includes(input.name))
                throw new RangeError("Invalid Restic operation")
              if (input.name === "init") return { restic: await restic.initialize() }
              if (input.name === "backup") return { result: await restic.backup() }
              if (input.name === "check") return { result: await restic.check() }
              if (input.name === "restore") return { result: await restic.restoreToStaging(input.path ?? "") }
              if (input.name === "forget") return { result: await restic.forget(input.path ?? "") }
            }
            if (input.action === "service-logs") {
              return services.logs(input.path ?? "")
            }
            if (input.action === "service") {
              if (!input.name || !["register","unregister","start","stop","restart","enable","disable"].includes(input.name))
                throw new RangeError("Invalid runit operation")
              return await services.apply(
                input.name as "register" | "unregister" | "start" | "stop" | "restart" | "enable" | "disable",
                input.path ?? "",
              )
            }
            if (input.action === "file") {
              if (!input.name || !["mkdir", "save", "rename", "delete", "copy", "upload"].includes(input.name))
                throw new RangeError("Invalid file action")
              files.apply(input.name as "mkdir" | "save" | "rename" | "delete" | "copy" | "upload", input.path ?? "", {
                destination: input.destination, content: input.content, base64: input.base64,
              })
              return { changed: true }
            }
            if (input.action === "read-file") {
              return { content: files.read(input.path ?? "") }
            }
            if (input.action === "download-file") {
              return files.download(input.path ?? "")
            }
            if (input.action === "snapshot") {
              if (input.name === "create") return { snapshot: backups.create() }
              if (input.name === "verify") return { verification: backups.verify(input.path ?? "") }
              if (input.name === "restore") return { snapshot: backups.restore(input.path ?? "") }
              if (input.name === "delete") {
                backups.delete(input.path ?? "")
                return { changed: true }
              }
            }
            throw new RangeError("Unsupported typed action")
          })
          response.end(JSON.stringify(result))
        } catch {
          response.statusCode = 409
          response.end('{"error":"operation-failed-or-refused"}')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), termuxReadOnlyApi(), ownedDemoApi(), ownedSiteFleetApi(), nodeProjectApi(), managedPhotoMapApi(), observabilityApi(), shizukuCompanionApi(), remoteShellApi(),
    androidActionApi(), networkAccessApi(), termuxToolsApi(), termuxAdminApi()],
  server: {
    host: "127.0.0.1",
    port: 8787,
    strictPort: true,
    proxy: {
      "/terminal": { target: "http://127.0.0.1:18798", changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})