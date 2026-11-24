import { applyPackageAction, previewPackageAction, WorkspaceFiles, WorkspaceBackups } from "../../src/modules/host/termux-admin.ts"
import { TermuxServiceAdmin } from "../../src/modules/host/termux-service-admin.ts"
import { inspectLocalGitWorkspace } from "../../src/modules/host/git-workspace-inspection.ts"
import { inspectTermuxBoot } from "../../src/modules/host/termux-boot-inspection.ts"
import { CloudflareTunnelDiagnosticHost } from "../../src/modules/host/cloudflare-tunnel-diagnostics.ts"
import { ProtectedServiceDiagnosticHost } from "../../src/modules/host/protected-service-diagnostics.ts"
import { inspectMqttLoopbackHealth } from "../../src/modules/host/mqtt-loopback-health.ts"
import { ControlPlaneDiagnosticHost } from "../../src/modules/host/control-plane-diagnostics.ts"
import { LocalAgentLogHost } from "../../src/modules/host/local-agent-log-diagnostics.ts"
import { LocalAgentRawLogHost } from "../../src/modules/host/local-agent-raw-log.ts"
import { LocalAgentOperationsHost, type AgentAction } from "../../src/modules/host/local-agent-operations.ts"
import { SSHConnectionsHost } from "../../src/modules/host/ssh-connections.ts"
import { listInstalledTermuxPackages, searchAvailableTermuxPackages } from "../../src/modules/host/termux-package-catalog.ts"
import { ResticWorkspaceAdmin } from "../../src/modules/host/termux-restic-admin.ts"
import { TermuxFileRoots, type FileRoot } from "../../src/modules/host/termux-file-roots.ts"
import { TermuxTerminal } from "../../src/modules/host/termux-terminal.ts"
import { admitsAgentCommand, OWNER_AGENT_CAPABILITIES } from "../../src/modules/host/termux-agent-contract.ts"
import { createLanControl, createLanRecovery, availableLanInterfaces } from "../../src/modules/host/lan-control.mjs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { nodeProjectApi } from "./plugins/node-project-api.ts"
import { termuxReadOnlyApi } from "./plugins/host-snapshot-api.ts"
import { observabilityApi } from "./plugins/observability-api.ts"
import { internetConnectivityApi } from "./plugins/internet-connectivity-api.ts"
import { dashboardTelemetryApi } from "./plugins/dashboard-telemetry-api.ts"
import { shizukuCompanionApi } from "./plugins/shizuku-companion-api.ts"
import { remoteShellApi } from "./plugins/remote-shell-api.ts"
import { androidActionApi } from "./plugins/android-action-api.ts"
import { termuxToolsApi } from "./plugins/termux-tools-api.ts"
import { OwnedDemoHost } from "../../src/modules/host/owned-site-host.ts"
import { createOwnedSiteRuntime } from "../../src/modules/runtime/owned-site-runtime.ts"
import { SiteFleetHost } from "../../src/modules/host/site-fleet-host.ts"
import { NodeProjectHost } from "../../src/modules/host/node-project-host.ts"
import { NodeRunitHost } from "../../src/modules/host/node-runit-host.ts"
import { nodeHostingUnitName } from "../../src/shared/node-hosting-projection.ts"
import { decodeSiteFolder, decodeSiteZip, MAX_UPLOAD_BYTES } from "../../src/modules/sites/site-bundle.ts"
import type { IncomingMessage } from "node:http"
import { reportDashboardOwnedEvent } from "../../src/modules/host/dashboard-telemetry-history.ts"

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
        const match = /^\/(site-[a-f0-9]{32})(?:\/(logs|health|files|html|export|start|stop|restart|rollback|deploy|releases))?$/.exec(route)
        const releaseRoute = /^\/(site-[a-f0-9]{32})\/releases\/(r-[a-f0-9]{32})\/(restore|prune)$/.exec(route)
        const id = match?.[1]
        const action = match?.[2]
        if (request.method === "GET") {
          try {
            if (id && action === "export") {
              const result = fleet.exportActiveZip(id)
              response.setHeader("Content-Type", "application/zip")
              response.setHeader("Content-Disposition",
                'attachment; filename="' + id + "-" + result.release + '.zip"')
              response.setHeader("Content-Length", result.archive.length)
              response.end(result.archive)
              return
            }
            const result = route === "/" ? { sites: fleet.list() } :
              id && !action ? { site: fleet.inspect(id) } :
              id && action === "health" ? { healthy: await fleet.health(id) } :
              id && action === "logs" ? { logs: fleet.logs(id) } :
              id && action === "files" ? { files: fleet.listActiveFiles(id) } :
              id && action === "html" ? fleet.readActiveHtml(id) :
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
        const importInitial = request.method === "POST" && route === "/import"
        const command = request.method === "POST" && !!id &&
          ["start", "stop", "restart", "rollback"].includes(action ?? "")
        const upload = request.method === "PUT" && !!id && action === "deploy"
        const remove = request.method === "DELETE" && !!id && !action
        const versionCommand = !!releaseRoute && (
          (request.method === "POST" && releaseRoute[3] === "restore") ||
          (request.method === "DELETE" && releaseRoute[3] === "prune")
        )
        if (!create && !importInitial && !command && !upload && !versionCommand && !remove) {
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
            if (importInitial) {
              // A single owner-approved request: reject invalid archive bytes
              // before allocating a site ID or writing a site directory.
              const query = new URLSearchParams(request.url?.split("?")[1] ?? "")
              if (query.size !== 1 || !query.has("name"))
                throw new RangeError("Invalid new site import parameters")
              const siteName = query.get("name")
              if (!siteName) throw new RangeError("Initial import needs a site name")
              const contentType = request.headers["content-type"]?.split(";")[0]?.trim()
              let files
              if (contentType === "application/zip") {
                files = decodeSiteZip(await body(request, MAX_UPLOAD_BYTES))
              } else if (contentType === "application/json") {
                const data = await body(request, 12 * 1024 * 1024)
                files = decodeSiteFolder(JSON.parse(data.toString("utf8")) as unknown)
              } else throw new RangeError("Initial import requires a static ZIP or folder payload")
              const created = await fleet.create(siteName)
              // Unexpected post-create failures remain explicit 409/refresh,
              // never an automatic retry or blind directory removal.
              return fleet.deploy(created.id, files)
            }
            if (remove) {
              if (request.headers["content-type"]?.split(";")[0]?.trim() !== "application/json")
                throw new RangeError("Removal requires a site snapshot")
              return fleet.remove(id!, JSON.parse((await body(request, 1024)).toString("utf8")))
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
          // These events reflect only successful, explicitly owned site actions.
          if (upload || importInitial) reportDashboardOwnedEvent("owned-release-published")
          if (action === "rollback" || (versionCommand && releaseRoute?.[3] === "restore"))
            reportDashboardOwnedEvent("owned-release-rolled-back")
          if (action === "restart") reportDashboardOwnedEvent("owned-service-restarted")
          response.statusCode = create || importInitial ? 201 : 200
          response.end(JSON.stringify(remove ? result : { site: result }))
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
  const nodeProjectsForRunit = new NodeProjectHost()
  const nodeRuntimeForRunit = new NodeRunitHost()
  const cloudflare = new CloudflareTunnelDiagnosticHost()
  const protectedServices = new ProtectedServiceDiagnosticHost()
  const controlPlane = new ControlPlaneDiagnosticHost()
  const agentLogs = new LocalAgentLogHost()
  const rawAgentLog = new LocalAgentRawLogHost()
  const localAgentOperations = new LocalAgentOperationsHost()
  const sshConnections = new SSHConnectionsHost()
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
            // Exact svlogd bytes, streamed incrementally to the trusted LAN UI.
            // This is not the classified/sanitized diagnostic endpoint.
            if (mode === "local-agent-raw-log") {
              const cursor = url.searchParams.get("cursor")
              if ((url.searchParams.size !== 1 && url.searchParams.size !== 2) ||
                  Array.from(url.searchParams.keys()).some(key => key !== "mode" && key !== "cursor") ||
                  (cursor !== null && !/^[0-9]{1,20}:[0-9]{1,20}:[0-9]{1,16}$/.test(cursor))) {
                response.statusCode = 400
                response.end('invalid-cursor')
                return
              }
              const chunk = rawAgentLog.read(cursor)
              response.setHeader("Content-Type", "application/octet-stream")
              response.setHeader("X-Agent-Log-State", chunk.state)
              response.setHeader("X-Agent-Log-Reset", chunk.reset ? "1" : "0")
              response.setHeader("X-Agent-Log-More", chunk.more ? "1" : "0")
              if (chunk.cursor) response.setHeader("X-Agent-Log-Cursor", chunk.cursor)
              response.statusCode = chunk.state === "ok" ? 200
                : chunk.state === "missing" ? 404 : 503
              response.end(chunk.bytes)
              return
            }
            const result = mode === "files" ? { files: files.list(url.searchParams.get("path") ?? "") } :
              mode === "snapshots" ? { snapshots: backups.list() } :
              mode === "services" ? (() => {
                const inventory = services.list()
                const ownedProjects = new Map<string, { id: string; name: string }>()
                // A matching runit name is not sufficient proof of ownership.
                // Reattest the trusted Node project, unit marker and run digest
                // before linking the service to its owning project.
                if (process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1" &&
                    process.env.POCKETHOST_ENABLE_NODE_HOSTING_DEV === "1" &&
                    inventory.some(unit => unit.control === "delegated")) {
                  try {
                    for (const project of nodeProjectsForRunit.list()) {
                      const unit = nodeHostingUnitName(project.id)
                      if (!inventory.some(service => service.name === unit &&
                          service.control === "delegated" && service.registered))
                        continue
                      try {
                        if (nodeRuntimeForRunit.status(project.id).state !== "not-provisioned")
                          ownedProjects.set(unit, { id: project.id, name: project.name })
                      } catch {
                        // A changed project stays unlinked and read-only here.
                      }
                    }
                  } catch {
                    // Bad source registry cannot confer service provenance.
                  }
                }
                return {
                  services: inventory.map(service => ({
                    ...service,
                    ...(service.control === "delegated" && ownedProjects.has(service.name)
                      ? { project: ownedProjects.get(service.name) }
                      : {}),
                  })),
                  archived: services.archivedWorkers(),
                }
              })() :
              mode === "git-workspace" && url.searchParams.size === 1 ? inspectLocalGitWorkspace() :
              mode === "service-boot" && url.searchParams.size === 1 ? inspectTermuxBoot() :
              mode === "service-http-readiness" && url.searchParams.size === 4 &&
                url.searchParams.has("name") && url.searchParams.has("port") &&
                url.searchParams.has("path") &&
                /^[0-9]{4,5}$/.test(url.searchParams.get("port") ?? "") ?
                  await services.inspectWorkerHttp(url.searchParams.get("name") ?? "",
                    Number(url.searchParams.get("port")), url.searchParams.get("path") ?? "") :
              mode === "service-health-overview" && url.searchParams.size === 1 ?
                services.inspectHealthOverview() :
              mode === "service-health" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.inspectHealth(url.searchParams.get("name") ?? "") :
              mode === "service-recovery" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.reviewWorkerRecovery(url.searchParams.get("name") ?? "") :
              mode === "python-source-review" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.inspectPythonSource(url.searchParams.get("name") ?? "") :
              mode === "node-source-review" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.inspectNodeSource(url.searchParams.get("name") ?? "") :
              mode === "python-source-history" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.inspectPythonSourceHistory(url.searchParams.get("name") ?? "") :
              mode === "node-source-history" && url.searchParams.size === 2 &&
                url.searchParams.has("name") ? services.inspectNodeSourceHistory(url.searchParams.get("name") ?? "") :
              mode === "cloudflare-diagnostics" && url.searchParams.size === 1 ? cloudflare.inspect() :
              mode === "ssh-diagnostics" && url.searchParams.size === 1 ? protectedServices.inspect("sshd") :
              mode === "mqtt-diagnostics" && url.searchParams.size === 1 ? protectedServices.inspect("mosquitto") :
              mode === "mqtt-loopback-health" && url.searchParams.size === 1 ?
                await inspectMqttLoopbackHealth() :
              mode === "control-plane-diagnostics" && url.searchParams.size === 1 ? controlPlane.inspect() :
              mode === "local-agent-logs" && url.searchParams.size === 1 ? agentLogs.inspect() :
              mode === "local-agent-operations" && url.searchParams.size === 1 ?
                await localAgentOperations.inspect() :
              mode === "ssh-connections" && url.searchParams.size === 1 ?
                { connections: sshConnections.list(), activeSession: terminal.session(),
                  terminal: terminal.status() } :
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
        let requestedAction: string | undefined
        try {
          const input = await parseBody(request)
          requestedAction = input.action
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
            if (input.action === "local-agent-operations") {
              const actions = ["agent-start","agent-stop","agent-pause","agent-resume",
                "ssh-start","ssh-stop","ssh-restart"] as const
              if (!input.name || !actions.includes(input.name as AgentAction) ||
                  Object.keys(input).some(key => key !== "action" && key !== "name"))
                throw new RangeError("Invalid Local Agent action")
              return await localAgentOperations.apply(input.name as AgentAction)
            }
            if (input.action === "ssh-profile") {
              if (input.name === "connect" && typeof input.path === "string" &&
                  Object.keys(input).every(key => ["action","name","path"].includes(key))) {
                return { terminal: await terminal.startSSH(sshConnections.find(input.path)),
                  connections: sshConnections.list(), activeSession: terminal.session() }
              }
              if (input.name === "delete" && typeof input.path === "string" &&
                  Object.keys(input).every(key => ["action","name","path"].includes(key))) {
                return { connections: sshConnections.delete(input.path),
                  terminal: terminal.status(), activeSession: terminal.session() }
              }
              if (["add","update"].includes(input.name ?? "") && typeof input.content === "string" &&
                  input.content.length <= 1500 &&
                  Object.keys(input).every(key => ["action","name","path","content"].includes(key))) {
                const info: unknown = JSON.parse(input.content)
                return { connections: sshConnections.save(info,
                  input.name === "update" ? input.path ?? "" : undefined),
                  terminal: terminal.status(), activeSession: terminal.session() }
              }
              throw new RangeError("Invalid SSH connection operation")
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
            if (input.action === "service-heartbeat") {
              // Persist only one of three built-in heartbeat freshness limits,
              // or disable the policy. No remote URL, script, port or command.
              if (!["disabled", "180", "300", "600"].includes(input.name ?? "") ||
                  Object.keys(input).some(key => !["action", "name", "path"].includes(key)))
                throw new RangeError("Unsupported worker heartbeat policy");
              const seconds = input.name === "disabled"
                ? null : Number(input.name) as 180 | 300 | 600;
              return services.configureWorkerHeartbeat(input.path ?? "", seconds)
            }
            if (input.action === "service-recover") {
              // One explicit user-reviewed attempt for attested builtin workers.
              // The host enforces stop state, desired autostart and durable budget.
              if (input.name !== "once" ||
                  Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
                throw new RangeError("Unsupported service recovery action");
              }
              return await services.recoverWorkerOnce(input.path ?? "")
            }
            if (input.action === "service-python-restore") {
              if (Object.keys(input).some(key =>
                    !["action", "name", "path", "root", "destination"].includes(key)) ||
                  typeof input.name !== "string" ||
                  typeof input.root !== "string" ||
                  typeof input.destination !== "string")
                throw new RangeError("Invalid Python restore request");
              return services.restorePythonSourceRevision(
                input.path ?? "", input.name, input.root, input.destination)
            }
            if (input.action === "service-python-update") {
              // Compare-and-swap only the exact, stopped, attested source.
              // No release execution, runtime enable or arbitrary file path.
              if (typeof input.content !== "string" ||
                  typeof input.destination !== "string" ||
                  Object.keys(input).some(key => !["action", "path", "destination", "content"].includes(key))) {
                throw new RangeError("Invalid Python revision request");
              }
              return services.updatePythonSource(
                input.path ?? "", input.destination, input.content)
            }
            if (input.action === "service-node-restore") {
              if (Object.keys(input).some(key =>
                    !["action", "name", "path", "root", "destination"].includes(key)) ||
                  typeof input.name !== "string" ||
                  typeof input.root !== "string" ||
                  typeof input.destination !== "string")
                throw new RangeError("Invalid Node.js restore request");
              return services.restoreNodeSourceRevision(
                input.path ?? "", input.name, input.root, input.destination)
            }
            if (input.action === "service-node-update") {
              // Stopped, source-attested compare-and-swap; never authorizes execution.
              if (typeof input.content !== "string" ||
                  typeof input.destination !== "string" ||
                  Object.keys(input).some(key => !["action", "path", "destination", "content"].includes(key))) {
                throw new RangeError("Invalid Node.js revision request");
              }
              return services.updateNodeSource(
                input.path ?? "", input.destination, input.content)
            }
            if (input.action === "service-create") {
              // Custom Node.js/Python source is staged only. The LAN cannot
              // authorize Start, Restart, Autostart or Recovery for it.
              const customSource = input.name === "python-source-v1" || input.name === "node-source-v1"
              if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1",
                    "node-source-v1"].includes(input.name ?? "") ||
                  Object.keys(input).some(key => !["action", "name", "path",
                    ...(customSource ? ["content"] : [])].includes(key)) ||
                  (customSource && (typeof input.content !== "string" ||
                    Buffer.byteLength(input.content) > 32 * 1024))) {
                throw new RangeError("Unsupported worker source or template");
              }
              return services.createManagedWorker(input.path ?? "",
                input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1",
                input.content)
            }
            if (input.action === "service-archive") {
              // Narrow non-destructive archive, never generic unlink or adoption.
              if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
                  Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
                throw new RangeError("Unsupported service archive");
              }
              return await services.archiveManagedWorker(input.path ?? "")
            }
            if (input.action === "service-restore") {
              // Restore only a previously recorded, stopped and fully attested
              // builtin worker; no browser-supplied path, run script or PID.
              if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
                  Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
                throw new RangeError("Unsupported service restoration");
              }
              return services.restoreArchivedWorker(input.path ?? "",
                input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1")
            }
            if (input.action === "service-retire") {
              // Never recursively delete a worker. Revoke only an attested
              // archive and retain its bytes in bounded private quarantine.
              if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
                  Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
                throw new RangeError("Unsupported worker retirement");
              }
              return services.retireArchivedWorker(input.path ?? "",
                input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1")
            }
            if (input.action === "service") {
              if (!input.name || !["start","stop","restart","enable","disable"].includes(input.name))
                throw new RangeError("Invalid runit operation")
              // The generic LAN UI can only mutate verified builtin
              // workers, never Node Hosting project processes, even though
              // the latter are enrolled in the shared runit registry.
              return await services.applyStandalone(
                input.name as "start" | "stop" | "restart" | "enable" | "disable",
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
          if (["restic", "restic-system", "snapshot"].includes(input.action ?? "")) {
            if (input.name === "backup" || input.name === "create")
              reportDashboardOwnedEvent("owned-backup-created")
            if (input.name === "restore")
              reportDashboardOwnedEvent("owned-backup-restored")
          }
          response.end(JSON.stringify(result))
        } catch (error) {
          response.statusCode = 409
          if (requestedAction === "service-create") {
            // A fixed diagnostic only. Never expose host paths, source,
            // stack traces, process details or arbitrary error messages.
            const message = error instanceof Error ? error.message : ""
            const reason = message.includes("quota reached") ? "capacity" :
              message === "Service name or log directory already exists" ? "name-in-use" :
              message === "Termux runtime unavailable" ? "runtime-unavailable" :
              message === "Managed worker inventory unverified" ||
              message === "Untrusted Termux service directory" ? "storage-unverified" :
              "unconfirmed"
            response.end(JSON.stringify({ error: "operation-failed-or-refused", reason }))
          } else {
            response.end('{"error":"operation-failed-or-refused"}')
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), termuxReadOnlyApi(), internetConnectivityApi(), dashboardTelemetryApi(), ownedDemoApi(), ownedSiteFleetApi(), nodeProjectApi(), observabilityApi(), shizukuCompanionApi(), remoteShellApi(),
    androidActionApi(), networkAccessApi(), termuxToolsApi(), termuxAdminApi()],
  server: {
    host: "127.0.0.1",
    port: 8787,
    strictPort: true,
    proxy: {
      // Keep /terminal as a React page; proxy only ttyd iframe/WebSocket subpaths.
      "/terminal/": { target: "http://127.0.0.1:18798", changeOrigin: true, ws: true },
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
