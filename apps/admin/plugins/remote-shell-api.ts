import type { Plugin } from "vite"
import { validateRemoteShellPayload } from "../../../src/modules/host/remote-shell-contract.mjs"

/**
 * LAN accepts only a paired request/progress check, never direct execution.
 * An exact command is executed only after a separate owner confirmation
 * inside the Android Companion activity. No credentials are persisted here.
 */
export function remoteShellApi(forward: typeof fetch = fetch): Plugin {
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
          const native = await forward("http://127.0.0.1:18791/shell/run", {
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
