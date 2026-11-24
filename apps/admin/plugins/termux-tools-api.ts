import type { Plugin } from "vite"
import { readTermuxToolInventory } from "../../../src/modules/host/termux-tool-inventory.ts"

/** H3: bounded read-only tool availability; never executes or installs tools. */
export function termuxToolsApi(readInventory: typeof readTermuxToolInventory = readTermuxToolInventory): Plugin {
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
        response.end(JSON.stringify(readInventory()))
      })
    },
  }
}
