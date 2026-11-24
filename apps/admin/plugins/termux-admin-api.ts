import type { Plugin } from "vite"
import { admitsAgentCommand } from "../../../src/modules/host/termux-agent-contract.ts"
import { reportDashboardOwnedEvent } from "../../../src/modules/host/dashboard-telemetry-history.ts"
import { createTermuxAdminContext, parseTermuxAdminBody, type TermuxAdminContext } from "./termux-admin-context.ts"
import { readTermuxAdmin } from "./termux-admin-read.ts"
import { runTermuxAdminAction } from "./termux-admin-action.ts"

/**
 * H3 explicit typed admin operations for the owner-approved trusted LAN.
 * No login dependency. Never accepts shell programs, executable paths,
 * system-service PIDs, or general filesystem paths. Same-origin intent and
 * confirmation are separate from authentication.
 */
export function termuxAdminApi(context: TermuxAdminContext = createTermuxAdminContext()): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  let operations: Promise<void> = Promise.resolve()
  const serialize = <T,>(job: () => Promise<T> | T): Promise<T> => {
    const result = operations.then(job, job)
    operations = result.then(() => undefined, () => undefined)
    return result
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
          await readTermuxAdmin(request, response, context)
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
          const input = await parseTermuxAdminBody(request)
          requestedAction = input.action
          const result = await serialize(() => runTermuxAdminAction(input, context))
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

