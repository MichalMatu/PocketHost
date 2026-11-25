import type { Plugin } from "vite"
import { readOwnedTraffic } from "../../../src/modules/host/traffic-runtime.ts"
import { SiteFleetHost } from "../../../src/modules/host/site-fleet-host.ts"
import { decodeSiteFolder, decodeSiteZip, MAX_UPLOAD_BYTES } from "../../../src/modules/sites/site-bundle.ts"
import type { IncomingMessage } from "node:http"
import { reportDashboardOwnedEvent } from "../../../src/modules/host/dashboard-telemetry-history.ts"

/**
 * H2: explicit user-created STATIC sites only. All writes require an
 * interactive same-origin intent; no process IDs, paths, commands or
 * external services are accepted as management targets.
 */
export function ownedSiteFleetApi(
  createFleet: () => SiteFleetHost = () => new SiteFleetHost(),
  reportEvent: typeof reportDashboardOwnedEvent = reportDashboardOwnedEvent,
): Plugin {
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
      const fleet = enabled ? createFleet() : null
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
        const match = /^\/(site-[a-f0-9]{32})(?:\/(logs|health|files|html|export|start|stop|restart|rollback|deploy|releases|traffic))?$/.exec(route)
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
            if (id && action === "traffic") {
              const site = fleet.inspect(id)
              const proof = site.state === "running" && site.pid !== null && site.startTicks !== null
                ? { pid: site.pid, startTicks: site.startTicks } : null
              response.end(JSON.stringify(readOwnedTraffic(id, request.url ?? "", proof)))
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
              if (!selectedSite || !revision) throw new RangeError("Invalid release route")
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
          if (upload || importInitial) reportEvent("owned-release-published")
          if (action === "rollback" || (versionCommand && releaseRoute?.[3] === "restore"))
            reportEvent("owned-release-rolled-back")
          if (action === "restart") reportEvent("owned-service-restarted")
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
