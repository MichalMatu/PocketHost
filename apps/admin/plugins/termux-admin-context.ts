import type { IncomingMessage } from "node:http"
import { WorkspaceFiles, WorkspaceBackups } from "../../../src/modules/host/termux-admin.ts"
import { TermuxServiceAdmin } from "../../../src/modules/host/termux-service-admin.ts"
import { CloudflareTunnelDiagnosticHost } from "../../../src/modules/host/cloudflare-tunnel-diagnostics.ts"
import { ProtectedServiceDiagnosticHost } from "../../../src/modules/host/protected-service-diagnostics.ts"
import { ControlPlaneDiagnosticHost } from "../../../src/modules/host/control-plane-diagnostics.ts"
import { LocalAgentLogHost } from "../../../src/modules/host/local-agent-log-diagnostics.ts"
import { LocalAgentRawLogHost } from "../../../src/modules/host/local-agent-raw-log.ts"
import { LocalAgentOperationsHost } from "../../../src/modules/host/local-agent-operations.ts"
import { SSHConnectionsHost } from "../../../src/modules/host/ssh-connections.ts"
import { ResticWorkspaceAdmin } from "../../../src/modules/host/termux-restic-admin.ts"
import { TermuxFileRoots } from "../../../src/modules/host/termux-file-roots.ts"
import { TermuxTerminal } from "../../../src/modules/host/termux-terminal.ts"
import { NodeProjectHost } from "../../../src/modules/host/node-project-host.ts"
import { NodeRunitHost } from "../../../src/modules/host/node-runit-host.ts"

/** One host context per server adapter; shared by reads and serialized actions. */
export function createTermuxAdminContext() {
  const files = new WorkspaceFiles()
  const backups = new WorkspaceBackups(files)
  const services = new TermuxServiceAdmin()
  const nodeProjectsForRunit = new NodeProjectHost()
  const nodeRuntimeForRunit = new NodeRunitHost()
  const cloudflare = new CloudflareTunnelDiagnosticHost()
  const protectedServices = new ProtectedServiceDiagnosticHost()
  const controlPlane = new ControlPlaneDiagnosticHost()
  const agentLogs = new LocalAgentLogHost()
  const rawAgentLog = new LocalAgentRawLogHost()
  const localAgentOperations = new LocalAgentOperationsHost()
  const sshConnections = new SSHConnectionsHost()
  const restic = new ResticWorkspaceAdmin(files)
  const fileRoots = new TermuxFileRoots()
  const terminal = new TermuxTerminal()
  return { files, backups, services, nodeProjectsForRunit, nodeRuntimeForRunit, cloudflare, protectedServices, controlPlane, agentLogs, rawAgentLog, localAgentOperations, sshConnections, restic, fileRoots, terminal }
}

export type TermuxAdminContext = ReturnType<typeof createTermuxAdminContext>
export type TermuxAdminInput = { action?: string; name?: string; root?: string; path?: string; destination?: string; content?: string; base64?: string }

export async function parseTermuxAdminBody(req: IncomingMessage): Promise<TermuxAdminInput> {
  const declared = req.headers["content-length"]
  if (req.headers["content-encoding"] || (declared && (!/^\d+$/.test(declared) || Number(declared) > 3000000)))
    throw new RangeError("Invalid request budget")
  req.setTimeout(18000, () => req.destroy())
  let bytes = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += b.length
    if (bytes > 3000000) throw new RangeError("Request budget exceeded")
    chunks.push(b)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("Bad action")
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !["action","name","root","path","destination","content","base64"].includes(key)))
    throw new RangeError("Extra input denied")
  for (const key of ["action","name","root","path","destination","content","base64"]) {
    if (data[key] !== undefined && typeof data[key] !== "string")
      throw new RangeError("Bad request field")
  }
  return data as TermuxAdminInput
}
