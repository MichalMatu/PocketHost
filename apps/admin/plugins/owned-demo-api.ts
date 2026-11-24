import type { Plugin } from "vite"
import { OwnedDemoHost } from "../../../src/modules/host/owned-site-host.ts"
import { createOwnedSiteRuntime } from "../../../src/modules/runtime/owned-site-runtime.ts"

/**
 * Opt-in, DEV-only own-site actions. This is not a production HTTP control API.
 * Never infer process ownership from process discovery.
 */
export function ownedDemoApi(): Plugin {
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
