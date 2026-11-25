import type { IncomingMessage, ServerResponse } from "node:http"
import { NodeProjectDataScope } from "../../../src/modules/host/node-project-data-scope.ts"
import { NodeSqliteStudio, parseSqliteQuery } from "../../../src/modules/host/node-sqlite-studio.ts"

/** Called inside the existing Node owner, loopback and same-origin boundary. */
export function createSqliteReadApi(scope: NodeProjectDataScope,
  runtime: (projectId: string) => { state: string; desired: string }) {
  const studio = new NodeSqliteStudio(scope, runtime)
  return async (request: IncomingMessage, response: ServerResponse, authorized: boolean) => {
    const url = request.url ?? ""
    const match = /^\/(node-[a-f0-9]{32})\/sqlite$/.exec(url.split("?")[0] ?? "")
    if (!match) return false
    if (request.method !== "GET") {
      response.statusCode = 405
      response.setHeader("Allow", "GET")
      response.end('{"error":"sqlite-read-only"}')
    } else if (!authorized) {
      response.statusCode = 403
      response.end('{"error":"node-owner-required"}')
    } else {
      try {
        const query = parseSqliteQuery(url)
        response.end(JSON.stringify(await studio.read(match[1]!, query)))
      } catch {
        response.statusCode = 400
        response.end('{"error":"invalid-sqlite-selection"}')
      }
    }
    return true
  }
}
