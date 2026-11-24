import type { Plugin } from "vite"
import { createLanControl, createLanRecovery, availableLanInterfaces } from "../../../src/modules/host/lan-control.mjs"

/** Existing manual/automatic owned LAN listener control. */
export function networkAccessApi({
  autoStart = process.env.POCKETHOST_LAN_AUTOSTART !== "0",
  createController = createLanControl,
  interfaces = availableLanInterfaces,
} = {}): Plugin {
  const controller = createController({ mode: autoStart ? "auto" : "manual" })
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
    interfaces: () => interfaces(),
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
    const options = interfaces()
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
