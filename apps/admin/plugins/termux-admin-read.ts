import type { IncomingMessage, ServerResponse } from "node:http"
import type { TermuxAdminContext } from "./termux-admin-context.ts"
import { inspectLocalGitWorkspace } from "../../../src/modules/host/git-workspace-inspection.ts"
import { inspectTermuxBoot } from "../../../src/modules/host/termux-boot-inspection.ts"
import { inspectMqttLoopbackHealth } from "../../../src/modules/host/mqtt-loopback-health.ts"
import { listInstalledTermuxPackages, searchAvailableTermuxPackages } from "../../../src/modules/host/termux-package-catalog.ts"
import { nodeHostingUnitName } from "../../../src/shared/node-hosting-projection.ts"
import type { FileRoot } from "../../../src/modules/host/termux-file-roots.ts"
import { OWNER_AGENT_CAPABILITIES } from "../../../src/modules/host/termux-agent-contract.ts"

/** Existing read projections and exact raw log bytes; no mutation dispatch. */
export async function readTermuxAdmin(request: IncomingMessage, response: ServerResponse, context: TermuxAdminContext) {
  const { files, backups, services, nodeProjectsForRunit, nodeRuntimeForRunit, cloudflare, protectedServices, controlPlane, agentLogs, rawAgentLog, localAgentOperations, sshConnections, restic, fileRoots, terminal } = context
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
}
