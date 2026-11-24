import type { Plugin } from "vite"
import { validateAndroidActionPayload } from "../../../src/modules/host/android-action-contract.mjs"

/** Owner-triggered Android actions over the existing exact private-LAN shell boundary. */
export function androidActionApi(forward: typeof fetch = fetch): Plugin {
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
          const native = await forward("http://127.0.0.1:18791/action/run", {
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
