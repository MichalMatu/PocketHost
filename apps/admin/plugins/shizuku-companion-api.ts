import type { Plugin } from "vite"
import { readCompanionStatus, readCompanionApps, readCompanionApp, readCompanionSystem } from "../../../src/modules/host/shizuku-companion.mjs"

/** Native Android Companion status, forwarded from an on-device read-only provider. */
export function shizukuCompanionApi(probes = { readCompanionStatus, readCompanionApps, readCompanionApp, readCompanionSystem }): Plugin {
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
          response.end(JSON.stringify(await probes.readCompanionSystem()))
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
          response.end(JSON.stringify(await probes.readCompanionApp(packages[0]!)))
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
          response.end(JSON.stringify(await probes.readCompanionApps()))
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
          const snapshot = await probes.readCompanionStatus()
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
